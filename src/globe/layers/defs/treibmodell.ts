import * as THREE from 'three';
import type { Map as MlMap } from 'maplibre-gl';
import { assetUrl } from '../../../assets';
import { fetchJson } from '../../../util';
import type { GeoFrame } from '../../geo3d/frame';
import type { GeoPart } from '../../geo3d/stage';
import { GeoSwarm } from '../../geo3d/swarm';
import {
  buildSources,
  createSim,
  decodeField,
  LIVE_PER_DAY,
  LIVE_SEED,
  movingCount,
  parseRivers,
  parseSeed,
  PARTICLES,
  restartLive,
  restartRun,
  RUN_PER_DAY,
  stepDay,
  strandedShare,
  type CurrentsMeta,
  type Seed,
  type SeedMeta,
  type Sim,
} from '../shared/treibmodell';
import { HOLD_MS, meerDriven, meerLayerTime, meerState, setMeerGate, subscribeMeerTick } from '../shared/meerzeit';
import {
  Checkpoints,
  enterHist,
  HIST_LEAD_DAYS,
  histConfig,
  histDate,
  histDay,
  parseProduction,
  prepareSeek,
  type ProductionDoc,
} from '../shared/treibhistorie';
import { DAYS_PER_MS, modelRunMode, modelState, reportModel, RUN_DAYS, setModelReady, setModelRunTarget, subscribeModel } from '../shared/treibmodelltime';
import { defineExtra, type ExtraCtx } from '../types';

// "Treibgut-Modell": model particles enter the sea continuously at the river mouths (Meijer et al. 2021, public/data/plastik/
// rivers.geojson, weighted by their plastic emission) and drift in time lapse with the MEAN surface current (NOAA/AOML drifter
// climatology, scripts/currents-build.py -> public/data/currents). Three modes (timeline, shared/treibmodelltime.ts): "Historisch ab 1950"
// (default; follows the shared marine-plastic clock, shared/meerzeit.ts: empty sea on 1950-01-01, the release follows the global plastic
// production, a decay removes particles, checkpoints every 5 years for seeking, see shared/treibhistorie.ts; the clock waits for the sim),
// "10 Jahre ab leerem Meer" (run: its own slider 0..10 years, empty sea on day 0, a constant 6 particles per day at the river mouths,
// yearly checkpoints for seeking, at the end the picture holds 2 s and a new run (next seed) starts) and "Live", which runs on its own: it (endless) starts with particles spread like the observed surface plastic (Eriksen et al. 2014, public/data/plastik/
// treibgut-seed.json from scripts/treibgut-seed-build.py), so the gyres are full from the start; if the pool is full the oldest
// particle makes room for a new one. A simplified model of our own, not a forecast: no wind, no waves, no
// seasons, no eddies (a random, but sluggish extra velocity stands for them, see DIFFUSIVITY), no fishing gear. The simulation (shared/treibmodell.ts) runs on the main
// thread, one day per step, only while the layer is on and with a time budget per frame; the dots and their trails of the last
// 46 days are drawn by the GeoSwarm (live mode). The particles are a fixed pool of slots: unused slots are hidden, a slot that
// is reused for a new release has its trail wiped (resetLiveSlot). The timeline in views/globe.ts shows year, particles in the
// sea and stranded share.

const ID = 'treibmodell';
const COLOR = '#ffcc80';
const DIR = 'data/currents/';
const DOI = 'https://doi.org/10.1016/j.dsr.2017.04.009';
const RIVERS_DOI = 'https://doi.org/10.1126/sciadv.aaz5803';
const PRODUCTION_DOI = 'https://doi.org/10.1126/sciadv.1700782';
const ERIKSEN_DOI = 'https://doi.org/10.1371/journal.pone.0111913';
/** no start distribution (file missing): the live mode then starts with an empty sea */
const NO_SEED: Seed = { step: 1, lon: new Float32Array(0), lat: new Float32Array(0), cum: new Float64Array(0) };
/**
 * Days between two samples of the trail; the trail is drawn as straight segments between samples, so a short interval keeps the
 * corners small. 2 days (was 5) with 24 ring slots for 46 days: 8,000 particles x 25 blocks x 2 vertices x 32 bytes = 12.8 MB on
 * the GPU (was 5.6 MB); per sample two blocks of 0.5 MB are uploaded.
 */
const SAMPLE_DAYS = 2;
const TRAIL_DAYS = 46;
/** time budget for the steps of one frame (ms): playing / catching up after a slider jump */
const BUDGET_PLAY_MS = 2;
/** historic run while it plays: the clock waits for the model, a little more budget keeps the wait short (1.7 ms per day at a full pool) */
const BUDGET_HIST_MS = 4;
/** catching up after a jump of the clock (more than HIST_FAR_DAYS behind) */
const BUDGET_SEEK_MS = 8;
const HIST_FAR_DAYS = 60;
/** flat production when production.json is missing: the historic run then releases at a constant rate */
const FLAT_PRODUCTION: ProductionDoc = { years: { '1950': 1, '2025': 1 } };

class Model implements GeoPart {
  readonly object = new THREE.Group();
  readonly swarm = new GeoSwarm(COLOR, 0.55);
  sim?: Sim;
  meta?: CurrentsMeta;
  private seed: Seed = NO_SEED;
  /** mode and restart counter the simulation was started for (changes in modelState() start a new run) */
  private runMode: ReturnType<typeof modelRunMode> = modelRunMode();
  private restarts = modelState().restarts;
  private alpha = new Float32Array(0);
  private last = 0;
  /** simulated days not yet stepped (fraction of a day carries over) */
  private acc = 0;
  private off: () => void;
  private offClock: () => void;
  private histCfg = histConfig(parseProduction(FLAT_PRODUCTION));
  private cps = new Checkpoints();
  /** run "10 Jahre": a checkpoint every simulated year (seek back = nearest earlier one, same seed, bit-identical) */
  private runCps = new Checkpoints(365);
  private seeks = modelState().seeks;
  /** run: day the sim is catching up to after a jump of the slider (null: none) */
  private seekTo: number | null = null;
  /** run: ms the finished run has been held */
  private holdMs = 0;

  constructor(private map: MlMap) {
    this.object.add(this.swarm.object);
    // mode, restart or the shared clock changed: draw again
    const repaint = () => this.map.triggerRepaint();
    this.off = subscribeModel(repaint);
    this.offClock = subscribeMeerTick(repaint);
  }

  build(field: ReturnType<typeof decodeField>, meta: CurrentsMeta, rivers: Parameters<typeof parseRivers>[0], seed?: SeedMeta, production?: ProductionDoc) {
    this.meta = meta;
    this.histCfg = histConfig(parseProduction(production ?? FLAT_PRODUCTION));
    this.cps.clear();
    this.runCps.clear();
    this.seed = seed ? parseSeed(seed) : NO_SEED;
    this.sim = createSim(field, buildSources(field, parseRivers(rivers)), PARTICLES, 1);
    this.alpha = new Float32Array(PARTICLES);
    this.swarm.setLive(PARTICLES, Math.ceil(TRAIL_DAYS / SAMPLE_DAYS) + 1);
    this.swarm.setDotSize(2.6);
    this.reseed(false);
    this.map.triggerRepaint();
  }

  private reseed(next: boolean) {
    const sim = this.sim!;
    const st = modelState();
    const mode = modelRunMode();
    this.runMode = mode;
    this.restarts = st.restarts;
    const seedValue = next ? sim.seedValue + 1 : sim.seedValue;
    this.seeks = st.seeks;
    this.seekTo = null;
    this.holdMs = 0;
    if (mode === 'hist') enterHist(sim, this.histCfg, this.cps, histDay(meerLayerTime('modell')));
    else if (mode === 'run') this.startRun(seedValue);
    else restartLive(sim, this.seed, LIVE_SEED, seedValue, LIVE_PER_DAY);
    this.acc = 0;
    this.swarm.resetLive();
    this.sample();
  }

  /** new run from an empty sea; the checkpoints of the old seed are void, day 0 is stored */
  private startRun(seedValue: number) {
    const sim = this.sim!;
    restartRun(sim, seedValue, RUN_PER_DAY);
    this.runCps.clear();
    this.runCps.maybeSave(sim);
  }

  private sample() {
    const sim = this.sim!;
    this.fillAlpha();
    this.swarm.pushLive(sim.p.lon, sim.p.lat, this.alpha, sim.day);
  }

  /** visible = moving (free slots and stranded particles are hidden) */
  private fillAlpha() {
    const sim = this.sim!;
    for (let i = 0; i < sim.p.count; i++) this.alpha[i] = sim.active[i] & sim.p.alive[i];
  }

  private step() {
    const sim = this.sim!;
    stepDay(sim);
    // a slot that is used again: forget the trail of its old particle, else a line would run from the old place to the river mouth
    for (const slot of sim.reused) this.swarm.resetLiveSlot(slot);
    if (sim.day % SAMPLE_DAYS === 0) this.sample();
    if (sim.hist) this.cps.maybeSave(sim);
    else if (this.runMode === 'run') this.runCps.maybeSave(sim);
  }

  /**
   * Historic run: simulate forward to the date of the shared clock within the frame budget. A jump back (more than the lead behind the
   * clock) restores the nearest earlier checkpoint first. The clock may not run past the day the model has reached (setMeerGate).
   * Returns true while the model has more to do.
   */
  private updateHist(): boolean {
    const sim = this.sim!;
    const meer = meerState();
    const target = histDay(meerLayerTime('modell')) + (meer.playing ? HIST_LEAD_DAYS : 0);
    if (sim.day > target + HIST_LEAD_DAYS || sim.day + HIST_FAR_DAYS * 6 < target) {
      // behind a checkpoint or ahead of the clock: take the nearest one (a later checkpoint saves the way)
      if (prepareSeek(sim, this.cps, target)) {
        this.swarm.resetLive();
        this.sample();
      }
    }
    const budget = target - sim.day > HIST_FAR_DAYS ? BUDGET_SEEK_MS : BUDGET_HIST_MS;
    const t0 = performance.now();
    while (sim.day < target && performance.now() - t0 < budget) this.step();
    setMeerGate(histDate(sim.day));
    return sim.day < target || meer.playing;
  }

  /**
   * Run "10 Jahre ab leerem Meer": a jump of the slider restores the nearest earlier yearly checkpoint (back) or a later one (far ahead)
   * and simulates on to the target within the seek budget (the header shows the catching up); while it plays, days are stepped at the
   * tempo up to RUN_DAYS. At the end the picture holds HOLD_MS, then a new run (next seed) starts. Returns true while there is motion.
   */
  private updateRun(dt: number, playing: boolean): boolean {
    const sim = this.sim!;
    const st = modelState();
    if (st.seeks !== this.seeks) {
      this.seeks = st.seeks;
      this.seekTo = st.target;
      this.acc = 0;
      this.holdMs = 0;
      if (this.seekTo !== null) {
        if (prepareSeek(sim, this.runCps, this.seekTo)) {
          this.swarm.resetLive();
          this.sample();
        } else if (this.seekTo < sim.day) {
          // no checkpoint (cannot happen after day 0 was stored): start over with the same seed
          this.startRun(sim.seedValue);
          this.swarm.resetLive();
          this.sample();
        }
      }
    }
    if (this.seekTo !== null) {
      const t0 = performance.now();
      while (sim.day < this.seekTo && performance.now() - t0 < BUDGET_SEEK_MS) this.step();
      if (sim.day >= this.seekTo) {
        this.seekTo = null;
        setModelRunTarget(null);
      }
      return true;
    }
    if (!playing) return false;
    if (sim.day >= RUN_DAYS) {
      this.holdMs += dt;
      if (this.holdMs >= HOLD_MS) {
        // a new run, not an exact repeat
        this.holdMs = 0;
        this.startRun(sim.seedValue + 1);
        this.swarm.resetLive();
        this.sample();
        this.acc = 0;
      }
      return true;
    }
    // the tempo of the timeline: one year in 1 / 3 / 10 s
    this.acc += (dt * 365) / (meerState().speed * 1000);
    const t0 = performance.now();
    while (this.acc >= 1 && sim.day < RUN_DAYS && performance.now() - t0 < BUDGET_PLAY_MS) {
      this.step();
      this.acc -= 1;
    }
    // out of budget: the time runs slower instead of piling up
    if (this.acc > 3) this.acc = 3;
    return true;
  }

  update(frame: GeoFrame, now: number) {
    const sim = this.sim;
    if (!sim || !this.object.visible) {
      this.last = now;
      return false;
    }
    const st = modelState();
    const playing = meerState().playing;
    const mode = modelRunMode();
    // a long pause (hidden tab) must not make the time jump
    const dt = Math.min(100, Math.max(0, now - this.last));
    this.last = now;
    let moving = false;
    // the timeline drives this layer only while it shows all layers or this one; otherwise the model holds its picture
    const driven = meerDriven('modell');
    if (mode !== 'hist' || !driven) setMeerGate(null);
    if (mode !== this.runMode || (mode !== 'hist' && st.restarts !== this.restarts)) {
      // mode switched or "Jetzt" in the live / run mode: seed anew (a new random start); historic: from the nearest checkpoint
      this.reseed(true);
      moving = true;
    } else if (!driven) {
      moving = false;
    } else if (mode === 'hist') {
      moving = this.updateHist();
    } else if (mode === 'run') {
      moving = this.updateRun(dt, playing);
    } else {
      // live: endless, no end
      moving = playing;
      if (playing) {
        this.acc += dt * DAYS_PER_MS;
        const t0 = performance.now();
        while (this.acc >= 1 && performance.now() - t0 < BUDGET_PLAY_MS) {
          this.step();
          this.acc -= 1;
        }
        // out of budget: the time runs slower instead of piling up
        if (this.acc > 3) this.acc = 3;
      }
    }
    this.fillAlpha();
    this.swarm.setDots(sim.p.lon, sim.p.lat, this.alpha, sim.day);
    this.swarm.update(frame, sim.day, 0, TRAIL_DAYS);
    reportModel(sim.day, strandedShare(sim), movingCount(sim));
    return moving;
  }

  dispose() {
    setMeerGate(null);
    this.off();
    this.offClock();
    this.swarm.dispose();
  }
}

const model = (ctx: ExtraCtx) =>
  ctx.state<Model>(ID, () => {
    const part = new Model(ctx.map);
    part.object.visible = false;
    ctx.stage.add(part);
    return part;
  });

export default defineExtra({
  id: ID,
  order: 256,
  section: 'ocean',
  cat: 'meer',
  label: 'Treibgut-Modell',
  hint: 'Vereinfachtes Modell: historisch ab 1950 (leeres Meer, täglich neue Partikel an den Flussmündungen im Verhältnis zur weltweiten Plastikproduktion, folgt dem gemeinsamen Zeitstrahl), alternativ Live (Start verteilt wie das beobachtete Plastik) oder 10 Jahre ab leerem Meer (täglich 6 Partikel an den Flussmündungen, eigener Schieber); alles treibt mit der mittleren Oberflächenströmung in die Müllstrudel',
  glyph: 'vessel',
  icon: 'ocean',
  color: COLOR,
  sources: {
    [ID]: `Strömung: <a href="${DOI}">NOAA Global Drifter Program (AOML), Laurindo et al. 2017</a> (CC BY 4.0) · Flussmündungen nach <a href="${RIVERS_DOI}">Meijer et al. 2021</a> (CC BY 4.0) · Startverteilung (Live) nach <a href="${ERIKSEN_DOI}">Eriksen et al. 2014</a> (CC BY 4.0) · Plastikproduktion (Historisch) nach <a href="${PRODUCTION_DOI}">Geyer et al. 2017</a> via Our World in Data (CC BY)`,
  },
  setOpacity(ctx, f) {
    model(ctx).swarm.setOpacity(f);
    ctx.map.triggerRepaint();
  },
  apply(ctx) {
    // the first apply comes before anyone switched it on: no stage for a layer that stays off
    if (ctx.isOn(ID)) {
      model(ctx).object.visible = true;
      ctx.map.triggerRepaint();
    } else if (ctx.hasState(ID)) {
      model(ctx).object.visible = false;
      // a switched-off model no longer holds the shared clock back
      setMeerGate(null);
    }
  },
  enable(ctx) {
    ctx.loadOnce(ID, Infinity, async () => {
      const meta = await fetchJson<CurrentsMeta>(assetUrl(`${DIR}meta.json`));
      const res = await fetch(assetUrl(`${DIR}mean.bin`));
      if (!res.ok) throw new Error(`mean.bin: HTTP ${res.status}`);
      const field = decodeField(await res.arrayBuffer(), meta);
      const rivers = await fetchJson<Parameters<typeof parseRivers>[0]>(assetUrl('data/plastik/rivers.geojson'));
      // the start distribution is optional: without it the live mode starts with an empty sea
      const seed = await fetchJson<SeedMeta>(assetUrl('data/plastik/treibgut-seed.json')).catch(() => undefined);
      // the plastic production by year is optional: without it the historic run releases at a constant rate
      const production = await fetchJson<ProductionDoc>(assetUrl('data/plastik/production.json')).catch(() => undefined);
      model(ctx).build(field, meta, rivers, seed, production);
      setModelReady({ count: PARTICLES });
      return {
        count: PARTICLES,
        note: `vereinfachtes Modell, keine Vorhersage · Wirbel werden durch eine zufällige, aber träge Zusatzgeschwindigkeit angenähert (Zeitskala 4 Tage) · Historisch ab 1950 (Standard, folgt dem Zeitstrahl): leeres Meer, Eintrag an den Flussmündungen im Verhältnis zur weltweiten Plastikproduktion (Our World in Data / Geyer et al. 2017, CC BY), Abbau mit 15 Jahren Zeitkonstante · 10 Jahre ab leerem Meer: leeres Meer, täglich 6 Partikel an den Flussmündungen (gewichtet nach Emission), Abbau nur durch Stranden, ist das Meer voll, geht das älteste · Live: Start verteilt wie das beobachtete Plastik an der Oberfläche (Eriksen et al. 2014, CC BY 4.0), danach laufend neue Partikel an den Flussmündungen (Meijer et al. 2021, CC BY 4.0), gewichtet nach Emission; ist das Meer voll, geht das älteste · Strömung: ${meta.credit} (${meta.license}) · Zeitraffer: Tempo im Zeitstrahl (Standard 1 Jahr in 3 s)`,
      };
    });
  },
  layers: [],
});
