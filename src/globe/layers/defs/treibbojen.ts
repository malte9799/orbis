import * as THREE from 'three';
import type { Map as MlMap } from 'maplibre-gl';
import { assetUrl } from '../../../assets';
import { fetchJson } from '../../../util';
import type { GeoFrame } from '../../geo3d/frame';
import { GeoLine } from '../../geo3d/line';
import type { GeoFeature, GeoPart } from '../../geo3d/stage';
import { GeoSwarm } from '../../geo3d/swarm';
import type { InfoPanelData } from '../../infopanel';
import {
  dayToIso,
  decodeTracks,
  dotAlpha,
  localStep,
  pointAt,
  pointTimes,
  segmentIndex,
  summarize,
  timeRange,
  TRAIL_DAYS,
  unwrappedTrack,
  type DrifterMeta,
  type Tracks,
} from '../shared/treibbojen';
import { meerDriven, meerLayerTime, meerState, subscribeMeerTick } from '../shared/meerzeit';
import { driftState, reportDriftActive, setDriftReady, subscribeDrift, tickDrift } from '../shared/treibbojentime';
import { defineExtra, type ExtraCtx } from '../types';

// Real tracks of drifting buoys of the NOAA Global Drifter Program (about 3,000 of them, 1979 to 2025, a position every
// five days): the data behind the NASA SVS video 4174. Dots with a short trail, drawn by the GeoStage (GeoSwarm). Two
// modes: the real calendar ("Echte Zeit", the default: buoys appear and vanish as they were really deployed) or all buoys
// starting together at their release ("Gemeinsamer Start", shows how they run together in the gyres). The real calendar follows the shared
// marine-plastic clock (shared/meerzeit.ts) while the layer is coupled (default); uncoupled, and in the shared start, the layer runs its
// own loop. Mode and the layer's own time are in shared/treibbojentime.ts, the timeline in views/globe.ts shows them.
// The files come from scripts/drifters-build.py (public/data/drifters), through assetUrl, only once the layer is switched on.

const ID = 'treibbojen';
const COLOR = '#4dd0e1';
const SELECTED_COLOR = '#ffffff';
/** no map layer: this name leads a click on a dot to the handler of this layer */
const DOT_LAYER = 'treibbojen-dot';
/** how close to a dot (CSS px) a click still hits it */
const PICK_PX = 12;
const DIR = 'data/drifters/';
const DOI = 'https://doi.org/10.25921/7ntx-z961';
const ERDDAP = 'https://erddap.aoml.noaa.gov/gdp/erddap/tabledap/drifter_6hour_qc.htmlTable?ID,time,latitude,longitude&ID=';
const ATTRIBUTION = 'NOAA Global Drifter Program (AOML), Lumpkin & Centurioni 2019, CC BY 4.0';

class Drifters implements GeoPart {
  readonly object = new THREE.Group();
  readonly swarm = new GeoSwarm(COLOR);
  tracks?: Tracks;
  meta?: DrifterMeta;
  private lon = new Float32Array(0);
  private lat = new Float32Array(0);
  private alpha = new Float32Array(0);
  private last = 0;
  private selected = new GeoLine([], { color: SELECTED_COLOR, width: 2, opacity: 0.9 });
  private off: () => void;
  private offClock: () => void;
  private hasSelection = false;

  constructor(private map: MlMap) {
    this.object.add(this.swarm.object, this.selected.object);
    // mode or time changed (buttons, the shared clock): draw again
    this.off = subscribeDrift(() => this.map.triggerRepaint());
    this.offClock = subscribeMeerTick(() => this.map.triggerRepaint());
  }

  build(tracks: Tracks, meta: DrifterMeta) {
    this.tracks = tracks;
    this.meta = meta;
    this.lon = new Float32Array(tracks.count);
    this.lat = new Float32Array(tracks.count);
    this.alpha = new Float32Array(tracks.count);
    this.swarm.setData({ lon: tracks.lon, lat: tracks.lat, times: pointTimes(tracks), segments: segmentIndex(tracks) }, tracks.count);
    this.map.triggerRepaint();
  }

  update(frame: GeoFrame, now: number) {
    const t = this.tracks;
    if (!t || !this.object.visible) {
      this.last = now;
      return false;
    }
    const st = driftState();
    // a long pause (hidden tab) must not make the time jump
    const dt = Math.min(100, Math.max(0, now - this.last));
    this.last = now;
    const playing = meerState().playing;
    // real time: the date of the timeline (the clock while the layer is driven, else the date it held), before the first buoy (1979)
    // nothing is there; the shared start runs its own loop while the layer is the focus and holds otherwise
    const time = st.mode === 'real' ? meerLayerTime('bojen') : playing && meerDriven('bojen') ? tickDrift(dt) : st.time;
    const mode = st.mode;
    let active = 0;
    for (let i = 0; i < t.count; i++) {
      const local = localStep(mode, time, t.start[i], t.stepDays);
      const p = pointAt(t, i, local);
      this.alpha[i] = p ? dotAlpha(local, t.len[i]) : 0;
      if (this.alpha[i] > 0) active++;
      if (p) {
        this.lon[i] = p.lon;
        this.lat[i] = p.lat;
      }
    }
    reportDriftActive(active);
    const zoom = Math.max(1, Math.min(6, this.map.getZoom()));
    this.swarm.setDotSize(3.5 + (zoom - 1) * 0.35);
    this.swarm.setDots(this.lon, this.lat, this.alpha);
    this.swarm.update(frame, time, mode === 'shared' ? 0 : 1, TRAIL_DAYS);
    if (this.hasSelection) this.selected.update(frame);
    return playing && meerDriven('bojen');
  }

  select(i: number | null) {
    const t = this.tracks;
    const pts = t && i != null ? unwrappedTrack(t, i) : [];
    this.hasSelection = pts.length > 1;
    this.selected.object.visible = this.hasSelection;
    if (pts.length > 1) this.selected.setPoints(pts);
    this.map.triggerRepaint();
  }

  featureAt(frame: GeoFrame, x: number, y: number): GeoFeature | null {
    let best = -1;
    let bestD = PICK_PX;
    for (let i = 0; i < this.alpha.length; i++) {
      if (this.alpha[i] < 0.3) continue;
      const s = frame.toScreen(this.lon[i], this.lat[i], 0);
      if (!s) continue;
      const d = Math.hypot(s[0] - x, s[1] - y);
      if (d < bestD && !frame.occluded(this.lon[i], this.lat[i], 0)) {
        bestD = d;
        best = i;
      }
    }
    return best < 0 ? null : { layerId: DOT_LAYER, properties: { i: best, lon: this.lon[best], lat: this.lat[best] } };
  }

  dispose() {
    this.off();
    this.offClock();
    this.swarm.dispose();
    this.selected.dispose();
  }
}

const drifters = (ctx: ExtraCtx) =>
  ctx.state<Drifters>(ID, () => {
    const part = new Drifters(ctx.map);
    part.object.visible = false;
    ctx.stage.add(part);
    return part;
  });

const NUM = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 });
const DEC = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 });
const date = (day: number) => new Date(Math.round(day) * 86400000).toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const place = (p: { lon: number; lat: number }) => `${DEC.format(Math.abs(p.lat))}° ${p.lat >= 0 ? 'N' : 'S'}, ${DEC.format(Math.abs(p.lon))}° ${p.lon >= 0 ? 'O' : 'W'}`;
const duration = (days: number) => (days >= 365 ? `${DEC.format(days / 365.25)} Jahre (${NUM.format(days)} Tage)` : `${NUM.format(days)} Tage`);

function panel(t: Tracks, meta: DrifterMeta, i: number): InfoPanelData {
  const s = summarize(t, i);
  const url = `${ERDDAP}%22${s.id}%22`;
  return {
    glyph: 'vessel',
    color: COLOR,
    title: `Treibboje ${s.id}`,
    subtitle: 'NOAA Global Drifter Program',
    tiles: [
      ['Laufzeit', duration(s.days)],
      ['Strecke', `${NUM.format(s.km)} km`],
    ],
    sections: [
      {
        key: 'track',
        title: 'Bahn',
        open: true,
        rows: [
          { k: 'Ausgesetzt', v: `${date(s.startDay)} · ${place(s.from)}` },
          { k: 'Letzte Position', v: `${date(s.endDay)} · ${place(s.to)}` },
          { k: 'Laufzeit', v: duration(s.days) },
          { k: 'Strecke', v: `mindestens ${NUM.format(s.km)} km (Summe der gespeicherten Positionen)` },
        ],
      },
      {
        key: 'data',
        title: 'Daten',
        open: true,
        rows: [
          { k: 'Positionen', v: `ausgedünnt: alle ${meta.stepDays} Tage (Original: alle 6 Stunden)` },
          { k: 'Datensatz', v: 'drifter_6hour_qc, DOI 10.25921/7ntx-z961', href: DOI },
          { k: 'Diese Boje', v: 'Rohdaten in ERDDAP', href: url },
        ],
      },
    ],
    note: `Die Boje treibt mit ihrem Schirm in etwa 15 m Tiefe, solange er hängt; danach folgt sie auch dem Wind. ${ATTRIBUTION}`,
    link: { label: 'Daten dieser Boje (ERDDAP)', url },
  };
}

export default defineExtra({
  id: ID,
  order: 255,
  section: 'ocean',
  cat: 'meer',
  label: 'Treibbojen (NOAA)',
  hint: 'Echte Bahnen von ~3.000 Treibbojen 1979–2025 als wandernde Punkte mit Spur: echte Zeit (Standard, folgt dem gemeinsamen Zeitstrahl Meeresplastik) oder gemeinsamer Start (zeigt das Zusammenlaufen in den Müllstrudeln) – Optionen im Zeitstrahl',
  glyph: 'vessel',
  icon: 'ocean',
  color: COLOR,
  sources: { [ID]: `Treibbojen: <a href="${DOI}">NOAA Global Drifter Program (AOML)</a> (CC BY 4.0)` },
  setOpacity(ctx, f) {
    drifters(ctx).swarm.setOpacity(f);
    ctx.map.triggerRepaint();
  },
  apply(ctx) {
    // the first apply comes before anyone switched it on: no stage for a layer that stays off
    if (ctx.isOn(ID)) drifters(ctx).object.visible = true;
    else if (ctx.hasState(ID)) {
      const part = drifters(ctx);
      part.object.visible = false;
      part.select(null);
    }
  },
  enable(ctx) {
    ctx.loadOnce(ID, Infinity, async () => {
      const meta = await fetchJson<DrifterMeta>(assetUrl(`${DIR}meta.json`));
      const res = await fetch(assetUrl(`${DIR}tracks.bin`));
      if (!res.ok) throw new Error(`tracks.bin: HTTP ${res.status}`);
      const tracks = decodeTracks(await res.arrayBuffer(), meta);
      drifters(ctx).build(tracks, meta);
      const real = timeRange('real', tracks);
      setDriftReady({ first: real.lo, last: real.hi, count: tracks.count });
      return {
        count: tracks.count,
        note: `${dayToIso(real.lo).slice(0, 4)}–${dayToIso(real.hi).slice(0, 4)} · Position alle ${meta.stepDays} Tage · Optionen im Zeitstrahl · Klick auf eine Boje: Bahn und Daten`,
      };
    });
  },
  click({ ctx, p }) {
    const part = drifters(ctx);
    if (!part.tracks || !part.meta) return null;
    const i = Number(p.i);
    if (!(i >= 0 && i < part.tracks.count)) return null;
    part.select(i);
    return { type: 'panel', data: panel(part.tracks, part.meta, i), lng: Number(p.lon), lat: Number(p.lat) };
  },
  layers: [],
  clickLayers: [DOT_LAYER],
});
