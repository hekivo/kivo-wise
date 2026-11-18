// plugins/kivo-rebuild/scripts/lib/counter.mjs
export class Counter extends Map {
  add(key, n = 1) { this.set(key, (this.get(key) ?? 0) + n); return this; }
  sorted() { return [...this.entries()].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0]))); }
}
