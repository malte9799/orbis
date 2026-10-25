const APPS = ['earth', 'mrn', 'solar-system', 'asteroids', 'exo'] as const;

export interface NasaEyesView {
  el: HTMLElement;
  activate(opts?: { eyes?: string; focus?: string; lat?: number; lon?: number; site?: string }): void;
  deactivate(): void;
}

export function createNasaEyesView(): NasaEyesView {
  const el = document.createElement('div');
  el.className = 'nasa-eyes';
  el.hidden = true;
  el.innerHTML = `<div class="nasa-eyes-frame"><iframe title="NASA Eyes" allow="fullscreen" allowfullscreen referrerpolicy="no-referrer"></iframe></div>`;

  const iframe = el.querySelector('iframe')!;
  let current = 'earth';

  function select(id: string, opts?: { lat?: number; lon?: number }) {
    current = APPS.includes(id as (typeof APPS)[number]) ? id : 'earth';
    let url = `https://eyes.nasa.gov/apps/${current}${current === 'earth' ? '/#/' : current === 'solar-system' ? '/#/home' : current === 'asteroids' ? '' : '/'}`;
    // optional: Erde an Position öffnen (NASA Eyes Earth kennt lat/lon im Hash)
    if (current === 'earth' && Number.isFinite(opts?.lat) && Number.isFinite(opts?.lon)) {
      url = `https://eyes.nasa.gov/apps/earth/#/${opts!.lon!.toFixed(3)}/${opts!.lat!.toFixed(3)}`;
    }
    if (iframe.getAttribute('data-src') !== url) {
      iframe.setAttribute('data-src', url);
      iframe.src = url;
    }
  }

  return {
    el,
    activate(opts) {
      // eyes-Param aus der Topbar gewinnt; sonst aus focus ableiten (z. B. Erde / Planeten)
      const focus = opts?.focus;
      const want = opts?.eyes ?? (!focus ? undefined : focus === 'earth' ? 'earth' : focus === 'mrn' || focus === 'mars' ? 'mrn' : focus === 'asteroids' ? 'asteroids' : focus === 'exo' ? 'exo' : 'solar-system');
      select(want ?? current, opts);
    },
    deactivate() {
      // iframe anhalten (CPU sparen); aktivieren lädt neu, da data-src geleert wurde
      iframe.setAttribute('data-src', '');
      iframe.src = 'about:blank';
    },
  };
}
