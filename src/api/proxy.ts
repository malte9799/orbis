import { store } from '../store';

// Shared data proxy (proxy/cloudflare-worker.js). Set at build time via the repository
// variable PROXY_URL (→ VITE_PROXY_URL), can be overridden per browser in the settings.

// import.meta.env is undefined when the data Action imports this under Node
const BUILT_IN = (import.meta.env?.VITE_PROXY_URL as string | undefined)?.trim() || '';

export const builtInProxy = () => BUILT_IN;

/** Proxy base URL in use, '' if none. */
export function proxyBase(): string {
  return store.getKeys().adsbProxy || BUILT_IN;
}

/** `url` routed through the proxy, or unchanged without one. */
export function viaProxy(url: string): string {
  const proxy = proxyBase();
  return proxy ? `${proxy}${proxy.includes('?') ? '&' : '?'}url=${encodeURIComponent(url)}` : url;
}
