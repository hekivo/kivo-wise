// plugins/kivo-rebuild/scripts/lib/http.mjs
export async function fetchText(url, { headers = {}, timeoutMs = 20000, fetchImpl = fetch, redirect = 'follow', method = 'GET' } = {}) {
  const started = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, { headers, redirect, method, signal: ctrl.signal });
    const text = method === 'HEAD' ? '' : await res.text();
    return { status: res.status, text, location: res.headers.get('location') ?? '', contentType: res.headers.get('content-type') ?? '', ms: Date.now() - started };
  } catch (e) {
    return { status: 0, text: '', location: '', contentType: '', ms: Date.now() - started, error: String(e?.message ?? e).slice(0, 200) };
  } finally {
    clearTimeout(timer);
  }
}

export async function pool(items, worker, { concurrency = 4, onResult = () => {}, shouldStop = () => false } = {}) {
  let limit = Math.max(1, concurrency);
  let next = 0;
  let active = 0;
  let badStreak = 0;
  await new Promise((resolveAll) => {
    const pump = () => {
      if ((next >= items.length || shouldStop()) && active === 0) return resolveAll();
      while (active < limit && next < items.length && !shouldStop()) {
        const item = items[next++];
        active++;
        Promise.resolve(worker(item)).then((result) => {
          active--;
          const s = result?.status ?? 0;
          badStreak = s === 429 || s >= 500 ? badStreak + 1 : 0;
          if (badStreak >= 3) { limit = Math.max(1, Math.floor(limit / 2)); badStreak = 0; }
          onResult(item, result);
          pump();
        });
      }
    };
    pump();
  });
  return { finalConcurrency: limit };
}
