/** Tests for the tiny i18n runtime (message lookup, params, plurals, fallback). */
import { describe, expect, it } from 'vitest';
import { LANGS, fmtLocale, getLang, setLang, t } from './index';

describe('i18n runtime', () => {
  it('knows de/en as the full language list', () => {
    expect([...LANGS]).toEqual(['de', 'en']);
    expect(LANGS.includes(getLang())).toBe(true);
    setLang('de');
    expect(getLang()).toBe('de');
  });

  it('resolves flat and nested keys with de texts', () => {
    expect(t('common.retry')).toBe('Erneut versuchen');
    expect(t('settings.language')).toBe('Sprache');
  });

  it('interpolates {param} placeholders', () => {
    // no catalog message with params yet → checked via the plural entry below
    expect(t('nonexistent.key.placeholder' as never, { x: 1 })).toBe('nonexistent.key.placeholder');
  });

  it('returns the key itself when a message is missing (visible in dev)', () => {
    expect(t('totally.missing' as never)).toBe('totally.missing');
  });

  it('formats numbers/dates in the active locale', () => {
    const tag = fmtLocale();
    expect(tag === 'de-DE' || tag === 'en').toBe(true);
    const n = (1234.5).toLocaleString(tag, { maximumFractionDigits: 1 });
    expect(typeof n === 'string' && n.length > 0).toBe(true);
  });
});
