/**
 * Seeds a Human Pass older than the newness window, and prints its private key so the browser
 * test can hold the same credential in a virtual authenticator.
 */
import { createAuth } from "../../lib/auth";
import { adapterOf } from "../../lib/db";
import { hourOf } from "../../lib/ledger";

const keys = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
const jwk = await crypto.subtle.exportKey("jwk", keys.publicKey);
// The COSE key the server stores, as a passkey registration would have produced it.
const cose = new Uint8Array([
  0xa5,
  0x01,
  0x02,
  0x03,
  0x26,
  0x20,
  0x01,
  0x21,
  0x58,
  0x20,
  ...Buffer.from(jwk.x!, "base64url"),
  0x22,
  0x58,
  0x20,
  ...Buffer.from(jwk.y!, "base64url"),
]);
const credentialId = crypto.getRandomValues(new Uint8Array(16));
const adapter = await adapterOf(createAuth());
await adapter.create({
  model: "humanPass",
  data: {
    credentialId: Buffer.from(credentialId).toString("base64url"),
    publicKey: Buffer.from(cose).toString("base64url"),
    counter: 0,
    aaguid: "00000000-0000-0000-0000-000000000000",
    backedUp: false,
    status: "active",
    hour: hourOf(Date.now()),
    hourCount: 0,
    createdAt: new Date(Date.now() - 2 * 60 * 60_000),
  },
});
console.log(
  JSON.stringify({
    credentialId: Buffer.from(credentialId).toString("base64"),
    privateKey: Buffer.from(await crypto.subtle.exportKey("pkcs8", keys.privateKey)).toString("base64"),
    userHandle: Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString("base64"),
  }),
);
