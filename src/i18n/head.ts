/** Keeps the static <head> and the PWA manifest in step with the app language.
 *  The static files (index.html, public/manifest.webmanifest) stay German on
 *  purpose: they are the no-JS/SEO/install fallback. From JS onwards the title,
 *  meta description, <noscript> text and a translated manifest blob follow the
 *  active language (and re-apply on `orbis:lang`, i.e. before the reload). */
import { t, getLang, onLangChange } from './index';

/** swap the translatable manifest fields (pure, so it can be unit-tested) */
export function translateManifest(base: Record<string, unknown>, lang: string): Record<string, unknown> {
  return {
    ...base,
    name: t('meta.manifestName'),
    description: t('meta.manifestDescription'),
    lang,
  };
}

function applyHead(): void {
  document.title = t('meta.tagline');
  const desc = document.querySelector<HTMLMetaElement>('meta[name="description"]');
  if (desc) desc.content = t('meta.description');
  const noscript = document.querySelector('noscript');
  if (noscript) noscript.textContent = t('meta.noscript');
}

/** reads the (cached) static manifest, swaps name/description/lang and installs
 *  it as a blob; this is what the browser evaluates at install time. Browsers
 *  re-read the manifest link on install, so the swap before `beforeinstall-
 *  prompt` is picked up; if it fails we silently keep the German static one. */
async function retranslateManifest(): Promise<void> {
  const link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
  if (!link) return;
  try {
    const base = (await fetch(link.href, { cache: 'force-cache' }).then((r) => r.json())) as Record<string, unknown>;
    const translated = translateManifest(base, getLang());
    const blob = new Blob([JSON.stringify(translated)], { type: 'application/manifest+json' });
    URL.revokeObjectURL(link.href);
    link.href = URL.createObjectURL(blob);
  } catch {
    // stay on the static (German) manifest — cosmetic, never fatal
  }
}

/** called once at boot and again on every language change */
export function initHeadI18n(): void {
  applyHead();
  void retranslateManifest();
  onLangChange(() => {
    applyHead();
    void retranslateManifest();
  });
}
