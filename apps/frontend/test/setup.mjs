export class LocalStorageMock {
  constructor() {
    this.store = new Map();
  }

  getItem(key) {
    return this.store.has(key) ? this.store.get(key) : null;
  }

  setItem(key, value) {
    this.store.set(key, String(value));
  }

  removeItem(key) {
    this.store.delete(key);
  }

  clear() {
    this.store.clear();
  }

  get length() {
    return this.store.size;
  }

  key(index) {
    const keys = Array.from(this.store.keys());
    return keys[index] || null;
  }
}

let mockStorage = null;

export function ensureEnvironment(apiUrl) {
  if (!globalThis.localStorage) {
    mockStorage = new LocalStorageMock();
    globalThis.localStorage = mockStorage;
  }
  if (apiUrl) {
    process.env.VITE_API_URL = apiUrl;
  }

  // Ensure background heartbeat intervals in frontend shims do not block process exit
  if (!globalThis._hasUnrefInterval) {
    globalThis._hasUnrefInterval = true;
    const origSetInterval = globalThis.setInterval;
    globalThis.setInterval = function (...args) {
      const timer = origSetInterval.apply(this, args);
      if (timer && typeof timer.unref === 'function') {
        timer.unref();
      }
      return timer;
    };
  }
}

export function resetLocalStorage() {
  if (globalThis.localStorage) {
    globalThis.localStorage.clear();
  }
}
