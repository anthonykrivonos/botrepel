export class RequestBodyError extends Error {
  public constructor(
    message: string,
    public readonly status: 400 | 413,
  ) {
    super(message);
  }
}

/** Reads at most `maxBytes`, so a huge or endless body can't exhaust memory. */
export async function boundedBytes(request: Request, maxBytes: number): Promise<Uint8Array<ArrayBuffer>> {
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > maxBytes) {
    throw new RequestBodyError("The request body is too large.", 413);
  }
  if (!request.body) {
    return new Uint8Array();
  }
  const chunks: Uint8Array[] = [];
  let size = 0;
  const reader = request.body.getReader();
  for (let read = await reader.read(); !read.done; read = await reader.read()) {
    size += read.value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      throw new RequestBodyError("The request body is too large.", 413);
    }
    chunks.push(read.value);
  }
  return Bun.concatArrayBuffers(chunks, Infinity, true);
}

/** Parses a bounded JSON body; anything but a JSON object or array is a 400. */
export async function boundedJson(request: Request, maxBytes: number): Promise<unknown> {
  const bytes = await boundedBytes(request, maxBytes);
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new RequestBodyError("Send a JSON body.", 400);
  }
}
