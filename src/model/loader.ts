// Fetches the model chunks from the same origin, verifies them and keeps them in the Cache API.
import type { Manifest } from "./weights";

const CACHE = "llm-microscope-model";

export async function sha256Hex(bytes: Uint8Array<ArrayBuffer>): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return Array.from(digest, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function openCache(): Promise<Cache | null> {
  try {
    return "caches" in self ? await caches.open(CACHE) : null;
  } catch {
    return null; // private mode or blocked storage: fetch every time
  }
}

/** Streams a response into `out` at `offset`, reporting bytes as they arrive. */
async function readInto(res: Response, out: Uint8Array, offset: number, length: number, onBytes: (n: number) => void): Promise<void> {
  const reader = res.body!.getReader();
  let at = offset;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (at + value.length > offset + length) throw new Error("chunk larger than expected");
    out.set(value, at);
    at += value.length;
    onBytes(value.length);
  }
  if (at !== offset + length) throw new Error("chunk truncated, reload to try again");
}

export interface Progress {
  loaded: number;
  total: number;
  /** True while every chunk so far came from the Cache API. */
  cached: boolean;
}

/** Downloads (or reads from cache) every chunk straight into one model blob. */
export async function loadModel(base: string, onProgress: (p: Progress) => void): Promise<{ manifest: Manifest; blob: Uint8Array<ArrayBuffer> }> {
  const res = await fetch(`${base}manifest.json`, { cache: "no-cache" });
  if (!res.ok) throw new Error(`manifest: HTTP ${res.status}`);
  const manifest = (await res.json()) as Manifest;
  const total = manifest.totalBytes;
  const blob = new Uint8Array(total);
  const cache = await openCache();
  const urls = manifest.chunks.map((c) => new URL(base + c.file, self.location.href).href);
  let loaded = 0;
  let cached = true;

  if (cache) {
    // Chunk names are content-hashed, so anything not in this manifest is from an older build.
    const keep = new Set(urls);
    for (const req of await cache.keys()) if (!keep.has(req.url)) await cache.delete(req);
  }

  let offset = 0;
  await Promise.all(
    manifest.chunks.map(async (c, i) => {
      const at = offset;
      offset += c.length;
      const hit = cache ? await cache.match(urls[i]) : undefined;
      if (!hit) cached = false;
      const r = hit ?? (await fetch(urls[i]));
      if (!r.ok) throw new Error(`${c.file}: HTTP ${r.status}`);
      await readInto(r, blob, at, c.length, (n) => {
        loaded += n;
        onProgress({ loaded, total, cached });
      });
      const bytes = blob.subarray(at, at + c.length);
      if ((await sha256Hex(bytes)) !== c.sha256) {
        if (cache) await cache.delete(urls[i]);
        throw new Error(`${c.file}: checksum mismatch, reload to try again`);
      }
      if (cache && !hit) {
        try {
          await cache.put(urls[i], new Response(bytes.slice(), { headers: { "content-type": "application/octet-stream" } }));
        } catch {
          /* quota exceeded: still works, just not cached */
        }
      }
    }),
  );
  return { manifest, blob };
}
