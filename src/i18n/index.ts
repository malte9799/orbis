/** Tiny dependency-free i18n runtime. German (`de`) is the source of truth;
 *  `en` lives alongside. Message catalogs: src/i18n/locales/de|en/*.json
 *  (split by feature area so teams translate in parallel — see README.md).
 *
 *  Usage: `import { t, getLang, setLang, fmtLocale } from '../i18n'`
 *    t('common.retry')                       → "Erneut versuchen"
 *    t('wx.day.length', { h, m })            → interpolated `{param}` tokens
 *    t('app.items', { count: n }, n)         → plural (entry `{ "one": …, "other": … }`)
 *  Catalog change → the page reloads (setLang + location.reload()), since the
 *  views are rendered once without a framework. */
import appDe from './locales/de/app.json';
import appEn from './locales/en/app.json';
import forecastDe from './locales/de/forecast.json';
import forecastEn from './locales/en/forecast.json';
import mapDe from './locales/de/map.json';
import mapEn from './locales/en/map.json';
import miscDe from './locales/de/misc.json';
import miscEn from './locales/en/misc.json';

export const LANGS = ['de', 'en'] as const;
export type Lang = (typeof LANGS)[number];
type Messages = typeof appDe & typeof forecastDe & typeof mapDe & typeof miscDe;

const CATALOG: Record<Lang, Messages> = {
  de: { ...appDe, ...forecastDe, ...mapDe, ...miscDe } as Messages,
  en: { ...appEn, ...forecastEn, ...mapEn, ...miscEn } as Messages,
};

const STORAGE_KEY = 'orbis.lang';
type Dict = Record<string, unknown>;

/** dotted keys of every leaf message ("wx.code.0", "app.items");
 *  plural entries are objects with an "other" form, namespaces recurse deeper */
type KeyOf<T> = T extends string | { other?: string }
  ? never
  : { [K in keyof T & string]: K | `${K}.${KeyOf<T[K]>}` }[keyof T & string];
export type MessageKey = KeyOf<Messages>;

/** stored choice first, then the browser language; anything non-German → en */
function detectLang(): Lang {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if ((LANGS as readonly string[]).includes(stored ?? '')) return stored as Lang;
  } catch {}
  if (typeof navigator !== 'undefined') {
    const nav = (navigator.language ?? navigator.languages?.[0] ?? '').toLowerCase();
    if (nav.startsWith('de')) return 'de';
  }
  return 'en';
}

let lang: Lang = detectLang();
if (typeof document !== 'undefined') document.documentElement.lang = lang;

export const getLang = (): Lang => lang;

/** activate a language: persists + `<html lang>` + `orbis:lang` event.
 *  Not reactive by design — render-once views pick it up on the next reload. */
export function setLang(next: Lang): void {
  lang = next;
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {}
  if (typeof document !== 'undefined') {
    document.documentElement.lang = next;
    window.dispatchEvent(new CustomEvent('orbis:lang', { detail: next }));
  }
}

/** listener for views that rebuild themselves on language switch (see README) */
export function onLangChange(fn: (l: Lang) => void): void {
  if (typeof window === 'undefined') return;
  window.addEventListener('orbis:lang', (e) => fn((e as CustomEvent<Lang>).detail));
}

/** BCP-47 tag for Intl formatting (numbers, dates, DisplayNames) — replaces the
 *  hardcoded 'de-DE' in units.ts/util.ts/games */
export const fmtLocale = (): string => (lang === 'de' ? 'de-DE' : 'en');

const PLURALS = new Map<string, Intl.PluralRules>();
function pluralCategory(count: number): string {
  let pr = PLURALS.get(lang);
  if (!pr) {
    pr = new Intl.PluralRules(lang);
    PLURALS.set(lang, pr);
  }
  return pr.select(count);
}

function lookup(obj: unknown, key: string): unknown {
  let cur: unknown = obj;
  for (const part of key.split('.')) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = (cur as Dict)[part];
  }
  return cur;
}

/** message entry → text; plural entries pick one/other via Intl.PluralRules */
function resolve(entry: unknown, count?: number): string {
  if (typeof entry === 'string') return entry;
  if (entry && typeof entry === 'object') {
    const m = entry as Record<string, string>;
    return m[count == null ? 'other' : pluralCategory(count)] ?? m.other ?? m.one ?? '';
  }
  return '';
}

/** translate: params replace `{name}` tokens; o.count selects the plural form.
 *  en falls back to the de catalog; a totally missing key returns the key itself
 *  (visible + warned in dev so the i18n-check script is never needed at runtime). */
export function t(key: MessageKey, params?: Readonly<Record<string, string | number>>, o?: { count?: number }): string {
  const p = o?.count != null ? { ...params, count: o.count } : params;
  let entry = lookup(CATALOG[lang], key);
  if (entry == null) entry = lookup(CATALOG.de, key);
  if (entry == null) {
    if (import.meta.env?.DEV) console.warn(`[orbis.i18n] missing message: ${key}`);
    return key;
  }
  let text = resolve(entry, o?.count);
  if (p) text = text.replace(/\{(\w+)\}/g, (match, name: string) => (name in p ? String((p as Record<string, unknown>)[name]) : match));
  return text;
}
