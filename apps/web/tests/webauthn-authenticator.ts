/**
 * A software passkey authenticator for tests: real P-256 keys and real signatures, so the server's
 * WebAuthn verification runs unmodified. Attestation is "none".
 */

type Cbor = number | string | Uint8Array | Map<number | string, Cbor> | Cbor[];

function cborHead(major: number, length: number): number[] {
  if (length < 24) {
    return [(major << 5) | length];
  }
  if (length < 256) {
    return [(major << 5) | 24, length];
  }
  return [(major << 5) | 25, length >> 8, length & 0xff];
}

function cbor(value: Cbor): number[] {
  if (typeof value === "number") {
    return value >= 0 ? cborHead(0, value) : cborHead(1, -1 - value);
  }
  if (typeof value === "string") {
    const bytes = new TextEncoder().encode(value);
    return [...cborHead(3, bytes.length), ...bytes];
  }
  if (value instanceof Uint8Array) {
    return [...cborHead(2, value.length), ...value];
  }
  if (Array.isArray(value)) {
    return [...cborHead(4, value.length), ...value.flatMap(cbor)];
  }
  return [...cborHead(5, value.size), ...[...value].flatMap(([key, item]) => [...cbor(key), ...cbor(item)])];
}

const b64url = (bytes: Uint8Array | ArrayBuffer): string => Buffer.from(bytes as Uint8Array).toString("base64url");
const sha256 = async (bytes: Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer>> =>
  new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
const concat = (...parts: Uint8Array[]): Uint8Array<ArrayBuffer> => Uint8Array.from(parts.flatMap((part) => [...part]));
const u32 = (value: number): Uint8Array =>
  new Uint8Array([value >>> 24, (value >>> 16) & 255, (value >>> 8) & 255, value & 255]);

/** WebCrypto signs P-256 as raw r‖s; WebAuthn wants ASN.1 DER. */
function toDer(raw: Uint8Array): Uint8Array {
  const integer = (bytes: Uint8Array): number[] => {
    let start = 0;
    while (start < bytes.length - 1 && bytes[start] === 0) {
      start++;
    }
    const trimmed = [...bytes.slice(start)];
    return trimmed[0]! & 0x80 ? [0x02, trimmed.length + 1, 0, ...trimmed] : [0x02, trimmed.length, ...trimmed];
  };
  const body = [...integer(raw.slice(0, 32)), ...integer(raw.slice(32))];
  return new Uint8Array([0x30, body.length, ...body]);
}

const UP = 0x01;
const UV = 0x04;
const AT = 0x40;

export class TestAuthenticator {
  private keys: CryptoKeyPair | null = null;
  private readonly credentialId = crypto.getRandomValues(new Uint8Array(16));
  /** Pinned so tests can replay an old counter. */
  public counter = 0;

  public constructor(
    private readonly origin: string,
    private readonly rpID = new URL(origin).hostname,
  ) {}

  public get id(): string {
    return b64url(this.credentialId);
  }

  private clientData(type: string, challenge: string): Uint8Array<ArrayBuffer> {
    return new TextEncoder().encode(JSON.stringify({ type, challenge, origin: this.origin, crossOrigin: false }));
  }

  public async create(options: { challenge: string }): Promise<Record<string, unknown>> {
    this.keys = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
    const jwk = await crypto.subtle.exportKey("jwk", this.keys.publicKey);
    const cose = new Map<number, Cbor>([
      [1, 2],
      [3, -7],
      [-1, 1],
      [-2, new Uint8Array(Buffer.from(jwk.x!, "base64url"))],
      [-3, new Uint8Array(Buffer.from(jwk.y!, "base64url"))],
    ]);
    const authData = concat(
      await sha256(new TextEncoder().encode(this.rpID)),
      new Uint8Array([UP | UV | AT]),
      u32(this.counter),
      new Uint8Array(16),
      new Uint8Array([0, this.credentialId.length]),
      this.credentialId,
      new Uint8Array(cbor(cose)),
    );
    const attestationObject = new Uint8Array(
      cbor(
        new Map<string, Cbor>([
          ["fmt", "none"],
          ["attStmt", new Map()],
          ["authData", authData],
        ]),
      ),
    );
    return {
      id: this.id,
      rawId: this.id,
      type: "public-key",
      clientExtensionResults: {},
      response: {
        clientDataJSON: b64url(this.clientData("webauthn.create", options.challenge)),
        attestationObject: b64url(attestationObject),
        transports: ["internal"],
      },
    };
  }

  /** An assertion for `options`; the counter advances unless the test pinned it. */
  public async get(options: { challenge: string }, advance = true): Promise<Record<string, unknown>> {
    if (advance) {
      this.counter++;
    }
    const authData = concat(
      await sha256(new TextEncoder().encode(this.rpID)),
      new Uint8Array([UP | UV]),
      u32(this.counter),
    );
    const clientData = this.clientData("webauthn.get", options.challenge);
    const signed = concat(authData, await sha256(clientData));
    const raw = new Uint8Array(
      await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, this.keys!.privateKey, signed),
    );
    return {
      id: this.id,
      rawId: this.id,
      type: "public-key",
      clientExtensionResults: {},
      response: {
        clientDataJSON: b64url(clientData),
        authenticatorData: b64url(authData),
        signature: b64url(toDer(raw)),
        userHandle: b64url(new Uint8Array(16)),
      },
    };
  }
}
