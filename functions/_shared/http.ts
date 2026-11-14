export class RequestFailure extends Error {
  status: number;
  constructor(message: string, status = 400) { super(message); this.status = status; }
}

// Read at most the accepted number of bytes, even without Content-Length.
// Parsing request.text() first would buffer an arbitrarily large streamed body.
export async function readJson(request: Request, limit = 16384): Promise<Record<string, unknown>> {
  if (request.headers.get('Origin') !== new URL(request.url).origin || request.headers.get('Sec-Fetch-Site') === 'cross-site') {
    throw new RequestFailure('Origem da solicitação não permitida.', 403);
  }
  if (request.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase() !== 'application/json') {
    throw new RequestFailure('Envie os dados em JSON.', 415);
  }
  if (Number(request.headers.get('Content-Length')) > limit) throw new RequestFailure('Solicitação muito grande.', 413);
  const reader = request.body?.getReader();
  if (!reader) throw new RequestFailure('Dados ausentes.');
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const {done, value} = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        throw new RequestFailure('Solicitação muito grande.', 413);
      }
      chunks.push(value);
    }
  } catch (error) {
    if (error instanceof RequestFailure) throw error;
    throw new RequestFailure('Não foi possível ler os dados enviados.');
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  try {
    const value = JSON.parse(new TextDecoder('utf-8', {fatal: true}).decode(bytes));
    if (!value || Array.isArray(value) || typeof value !== 'object') throw new Error();
    return value;
  } catch { throw new RequestFailure('Dados inválidos.'); }
}
