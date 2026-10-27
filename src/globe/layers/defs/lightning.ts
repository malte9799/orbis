import type { ExpressionSpecification } from 'maplibre-gl';
import { defineExtra, type ExtraCtx } from '../types';
import { empty } from '../shared/geo';
import { LIGHTNING_LINES_MS, LIGHTNING_THUNDER_MS, LightningStream } from '../../../api/lightning';
import { cardHtml } from '../../popup';
import { fmt } from '../../../util';
import { clockTxt, coordsTxt } from '../../../units';

/** Geographic circle radius in screen px: px = km · (1000 / 156543.03392) · 2^zoom / cos(lat).
 *  Interpolation stops every second zoom keep the exponential(2) curve exact over the whole
 *  zoom range, so a km-based circle stays the same size on the map while zooming. A small
 *  minimum radius keeps fresh and far-zoomed circles visible at all – it sits inside every
 *  stop, because the zoom interpolate has to stay top-level for the style spec. */
const thunderRadius: ExpressionSpecification = (() => {
  const A = 1000 / 156543.03392;
  const cos = ['cos', ['/', ['*', ['get', 'lat'], 3.141592653589793], 180]] as unknown as ExpressionSpecification;
  const stops: unknown[] = [];
  for (let z = 0; z <= 12; z += 2) stops.push(z, ['max', 10, ['/', ['*', A * 2 ** z, ['get', 'km']], cos]]);
  return ['interpolate', ['exponential', 2], ['zoom'], ...stops] as ExpressionSpecification;
})();

// live lightning: newest strikes bright yellow/white, ageing to dark red
const strikeColor: ExpressionSpecification = ['match', ['get', 'age'], 0, '#ffffff', 1, '#ffe14d', 2, '#ff9100', '#d32f2f'];

type St = { stream: LightningStream | null; opts: { sound: boolean; wave: boolean; detectors: boolean; lines: boolean; thunder: boolean; volume: number }; stationsPushed: number; idle: boolean; audio: AudioContext | null; lastTick: number };
const getState = (ctx: ExtraCtx) => ctx.state<St>('lightning', () => ({ stream: null, opts: { sound: false, wave: false, detectors: false, lines: false, thunder: false, volume: 70 }, stationsPushed: -1, idle: true, audio: null, lastTick: 0 }));

function setOptions(ctx: ExtraCtx, o: { sound?: boolean; wave?: boolean; detectors?: boolean; lines?: boolean; thunder?: boolean; volume?: number }) {
  const st = getState(ctx);
  const vol = o.volume != null && Number.isFinite(o.volume) ? Math.max(0, Math.min(100, o.volume)) : 70;
  const next = { sound: !!o.sound, wave: !!o.wave, detectors: !!o.detectors, lines: !!o.lines, thunder: !!o.thunder, volume: vol };
  const prev = st.opts;
  if (prev.sound === next.sound && prev.wave === next.wave && prev.detectors === next.detectors && prev.lines === next.lines && prev.thunder === next.thunder && prev.volume === next.volume) return;
  st.opts = next;
  if (!ctx.ready) return;
  updateVis(ctx);
  // the AudioContext must be created inside a user gesture once, so that the tick sounds work
  if (next.sound && ctx.isOn('lightning')) ensureAudio(ctx);
  if (!ctx.isOn('lightning')) return;
  if (!next.wave) ctx.setData('lightning-wave', empty());
  if (!next.lines) ctx.setData('lightning-line', empty());
  if (!next.thunder) ctx.setData('lightning-thunder', empty());
  if (!next.detectors) {
    ctx.setData('lightning-sta', empty());
    st.stationsPushed = -1;
  }
  syncAnim(ctx);
}

const delay = (ctx: ExtraCtx) => getState(ctx).stream?.delay;

function updateVis(ctx: ExtraCtx) {
  const st = getState(ctx);
  const on = ctx.isOn('lightning');
  ctx.vis('lightning-wave', on && st.opts.wave);
  ctx.vis('lightning-line', on && st.opts.lines);
  ctx.vis('lightning-sta', on && st.opts.detectors);
  ctx.vis('lightning-thunder', on && st.opts.thunder);
}

function syncAnim(ctx: ExtraCtx) {
  const st = getState(ctx);
  const o = st.opts;
  const want = ctx.isOn('lightning') && (o.wave || o.lines || o.thunder);
  if (want) {
    if (st.idle) {
      st.idle = false;
      updateExtras(ctx);
    } else {
      ctx.every('lightning-anim', 200, () => updateExtras(ctx));
    }
    return;
  }
  ctx.clear('lightning-anim');
  if (!st.idle) {
    st.idle = true;
    ctx.setData('lightning-wave', empty());
    ctx.setData('lightning-line', empty());
    ctx.setData('lightning-thunder', empty());
  }
}

function lightningStrike(ctx: ExtraCtx) {
  const st = getState(ctx);
  if (!ctx.isOn('lightning')) return;
  const o = st.opts;
  if (o.sound) playStrikeTick(ctx);
  if (o.wave || o.lines || o.thunder) updateExtras(ctx);
}

function ensureAudio(ctx: ExtraCtx) {
  const st = getState(ctx);
  if (st.audio) return;
  try {
    st.audio = new AudioContext();
  } catch {
    st.audio = null;
    return;
  }
  void st.audio.resume().catch(() => {});
}

function playStrikeTick(ctx: ExtraCtx) {
  const st = getState(ctx);
  if (document.hidden) return;
  try {
    st.audio ??= new AudioContext();
    const ac = st.audio;
    if (!ac) return;
    if (ac.state === 'suspended') {
      void ac.resume().catch(() => {});
      return;
    }
    const t = ac.currentTime;
    if (t - st.lastTick < 0.09) return;
    st.lastTick = t;
    const peak = 0.2 * (st.opts.volume / 100);
    if (peak <= 0) return;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(660, t);
    osc.frequency.exponentialRampToValueAtTime(190, t + 0.05);
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.exponentialRampToValueAtTime(peak, t + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
    osc.connect(gain).connect(ac.destination);
    osc.start(t);
    osc.stop(t + 0.09);
    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };
  } catch {
    /* no audio available */
  }
}

function updateExtras(ctx: ExtraCtx) {
  const st = getState(ctx);
  const o = st.opts;
  const l = st.stream;
  if (!l || !ctx.isOn('lightning') || !(o.wave || o.lines || o.thunder)) {
    syncAnim(ctx);
    return;
  }
  const now = Date.now();
  const keep = Math.max(LIGHTNING_LINES_MS, o.thunder ? LIGHTNING_THUNDER_MS : 0);
  const young = l.hasYoung(now, keep);
  if (!young && st.idle) return; // everything faded out, nothing left to do
  st.idle = !young;
  if (young) ctx.every('lightning-anim', 200, () => updateExtras(ctx));
  if (o.wave) ctx.setData('lightning-wave', l.waveFeatures(now));
  if (o.lines) ctx.setData('lightning-line', l.lineFeatures(now));
  if (o.thunder) ctx.setData('lightning-thunder', l.thunderFeatures(now));
  if (!young) ctx.clear('lightning-anim');
}

function updateLightning(ctx: ExtraCtx) {
  const st = getState(ctx);
  const l = st.stream;
  if (!l) return;
  ctx.setData('lightning', l.features());
  if (st.opts.detectors && st.stationsPushed !== l.stationCount) {
    st.stationsPushed = l.stationCount;
    ctx.setData('lightning-sta', l.stationFeatures());
  }
  lightningStatus(ctx);
}

function lightningStatus(ctx: ExtraCtx) {
  const st = getState(ctx);
  const l = st.stream;
  if (!l) return;
  const d = l.delay;
  const note = l.error
    || (l.connected
      ? `live verbunden · ${fmt.num(l.received)} Blitze seit Aktivierung${d != null ? ` · Verzögerung ~${fmt.num(d, 1)} s` : ''} · weiß = jetzt, rot = bis 15 min`
      : 'verbinde …');
  const prev = ctx.info('lightning');
  if (prev?.count !== l.count || prev?.note !== note) ctx.set('lightning', { count: l.count, note });
}

export const lightningApi = { delay, setOptions };

export default defineExtra({
  id: 'lightning',
  order: 100,
  section: 'earth',
  cat: 'wetter',
  label: 'Blitze Live',
  hint: 'Einschläge der letzten 15 Minuten weltweit, mit Ton, Einschlagskreis und Detektoren – Blitzortung.org (Hobby-Netzwerk, nicht amtlich, nur zur privaten Information, nicht für Warnzwecke)',
  glyph: 'bolt',
  icon: 'bolt',
  color: '#ffd600',
  sources: { lightning: 'Blitze: <a href="https://www.blitzortung.org/">Blitzortung.org</a> – nicht amtlich, nur zur privaten Information, nicht für Warnzwecke', 'lightning-wave': '', 'lightning-line': '', 'lightning-sta': '', 'lightning-thunder': 'Donner: <a href="https://www.blitzortung.org/">Blitzortung.org</a> – nicht amtlich, nur zur privaten Information, nicht für Warnzwecke' },
  addLayers({ add, hidden }) {
    // expanding ring of a fresh strike (grows with "k", fades via "o"); detector lines: white,
    // only a little thicker when the capturing detector sits close to the strike
    // thunder (Unteroption "Donner"): drew the backmost lightning layer first, so it never
    // washes out the wave, lines or strike dots
    add(
      {
        id: 'lightning-thunder',
        type: 'circle',
        source: 'lightning-thunder',
        layout: hidden,
        paint: {
          'circle-color': 'rgba(255,255,255,0.24)',
          'circle-opacity': ['get', 'o'],
          // real geographic radius: screen px = km * A * 2^zoom / cos(lat) – stops every second
          // zoom make the exponential(2) interpolation exact, so the circle scales with the zoom
          'circle-radius': thunderRadius,
        },
      },
      'marker',
    );
    // detector lines (Unteroption "Linien"): line from every capturing detector to the strike (like lightningmaps.org)
    add(
      {
        id: 'lightning-line',
        type: 'line',
        source: 'lightning-line',
        layout: { ...hidden, 'line-join': 'round' },
        paint: {
          // weiß in jeder Entfernung; die Dicke kodiert sie: nah (dc 0) etwas dicker, sonst Basis.
          // Zoom-Ausdruck bleibt top-level im Interpolate (der dc-Faktor sitzt in den Stops, sonst
          // verwirft MapLibre das Paint und schaltet die Linien komplett aus)
          'line-color': '#ffffff',
          'line-width': [
            'interpolate', ['linear'], ['zoom'],
            1, ['*', ['match', ['get', 'dc'], 0, 1.3, 1, 1.1, 1], 0.6],
            8, ['*', ['match', ['get', 'dc'], 0, 1.3, 1, 1.1, 1], 1.1],
            12, ['*', ['match', ['get', 'dc'], 0, 1.3, 1, 1.1, 1], 1.6],
          ],
          'line-opacity': ['get', 'o'],
        },
      },
      'marker',
    );
    // detector stations (Unteroption "Detektoren"): small dots at every station that got
    // learned from the feed while it was enabled
    add(
      {
        id: 'lightning-sta',
        type: 'circle',
        source: 'lightning-sta',
        layout: hidden,
        paint: {
          'circle-color': 'rgba(140,190,255,0.85)',
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 1, 1.6, 6, 3.2, 10, 5],
          'circle-stroke-color': 'rgba(15,25,45,0.75)',
          'circle-stroke-width': 1,
        },
      },
      'marker',
    );
    add(
      {
        id: 'lightning-glow',
        type: 'circle',
        source: 'lightning',
        layout: hidden,
        filter: ['==', ['get', 'age'], 0],
        paint: {
          'circle-color': 'rgba(255,230,80,0.35)',
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 1, 5, 8, 12],
          'circle-blur': 0.8,
        },
      },
      'marker',
    );
    add(
      {
        id: 'lightning',
        type: 'circle',
        source: 'lightning',
        layout: hidden,
        paint: {
          'circle-color': strikeColor,
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 1, 1.6, 6, 3, 10, 5],
          'circle-stroke-color': 'rgba(0,0,0,0.5)',
          'circle-stroke-width': 0.5,
        },
      },
      'marker',
    );
    // strike wave (Unteroption "Einschlagskreis"): like on Blitzortung.org a fresh strike
    add(
      {
        id: 'lightning-wave',
        type: 'circle',
        source: 'lightning-wave',
        layout: hidden,
        paint: {
          'circle-color': 'rgba(255,50,50,0.28)',
          // max. Größe erst ab Zoom 3: bei Weltansicht bleiben die Kreise klein (≤ 8 px),
          // ab Zoom 3 bis 36 px und danach wie bisher weiterwachsen
          'circle-radius': [
            'interpolate', ['linear'], ['zoom'],
            0, ['+', 2, ['*', 6, ['get', 'k']]],
            3, ['+', 6, ['*', 30, ['get', 'k']]],
            6, ['+', 8, ['*', 96, ['get', 'k']]],
            12, ['+', 10, ['*', 180, ['get', 'k']]],
          ],
          'circle-opacity': ['get', 'o'],
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 1, 1.2, 8, 2.2],
          'circle-stroke-opacity': ['get', 'o'],
        },
      },
      'marker',
    );
  },
  enable(ctx) {
    const st = getState(ctx);
    st.stream ??= new LightningStream(() => lightningStatus(ctx));
    st.stream.start();
    st.stream.onStrike = () => lightningStrike(ctx);
    ctx.every('lightning', 3000, () => updateLightning(ctx));
    updateLightning(ctx);
    updateVis(ctx);
  },
  disable(ctx) {
    const st = getState(ctx);
    ctx.clear('lightning');
    ctx.clear('lightning-anim');
    st.stream?.stop();
    ctx.setData('lightning', empty());
    ctx.setData('lightning-wave', empty());
    ctx.setData('lightning-line', empty());
    ctx.setData('lightning-sta', empty());
    ctx.setData('lightning-thunder', empty());
    st.stationsPushed = -1;
    st.idle = true;
    updateVis(ctx);
  },
  click({ ctx, p, pt }) {
    const at = Number(p.at);
    const secs = Math.max(0, Math.round((Date.now() - at) / 1000));
    const ago = secs < 90 ? `vor ${secs} s` : `vor ${Math.round(secs / 60)} min`;
    const n = Number(p.n);
    const d = getState(ctx).stream?.delay;
    const extra = `<div class="pop-grid two"><span>Zeitpunkt</span><b>${clockTxt(at, true)} (${ago})</b><span>Position</span><b>${coordsTxt(pt[1] as number, pt[0] as number)}</b>${Number.isFinite(n) && n > 0 ? `<span>Detektoren</span><b>${n} Stationen</b>` : ''}${d != null ? `<span>Verzögerung</span><b>~${fmt.num(d, 1)} s</b>` : ''}</div>`;
    return { type: 'html', html: cardHtml({ glyph: 'bolt', color: '#ffd600', title: 'Blitzeinschlag', source: 'Blitzortung.org', url: 'https://www.blitzortung.org/', extra }), lng: pt[0], lat: pt[1] };
  },
  layers: ['lightning-thunder', 'lightning-wave', 'lightning-line', 'lightning-sta', 'lightning-glow', 'lightning'],
  clickLayers: ['lightning'],
});
