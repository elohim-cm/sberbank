import "server-only";

export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}

export async function readSmallJson(request: Request, maxBytes = 16_384): Promise<unknown> {
  if (!request.headers.get("content-type")?.includes("application/json")) throw new Error("Invalid content type");
  if (Number(request.headers.get("content-length")) > maxBytes || !request.body) throw new Error("Invalid request size");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) { await reader.cancel(); throw new Error("Invalid request size"); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
