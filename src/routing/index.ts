import type { Map as MlMap, MapMouseEvent } from 'maplibre-gl';
import { t } from '../i18n';
import { isPickedPlaceholder, reverseGeocodePoint, searchPlaces } from '../api/openmeteo';
import { store, type Place } from '../store';
import { clockTxt, speedTxt } from '../units';
import { toast } from '../util';
import { distance, duration } from './format';
import { snapToLine } from './geo';
import { newGuideState, prepare, progress, type GuideState, type Prepared } from './guidance';
import { RouteLayer } from './layer';
import { Locator, type LocMode, type NavCamera } from './locator';
import { RoutePanel } from './panel';
import { PROVIDERS } from './providers';
import { defaultProvider, planRoute, providerById, usable, type Planned } from './router';
import { announce } from './speech';
import type { LngLat, Profile, Route } from './types';
import { Voice } from './voice';
import type { Fix, GpsStatus } from './gps';

export interface RoutingHost {
  /** px the Karten stack covers on the left (desktop) – the route is fitted next to it */
  leftInset(): number;
  /** the map view is shown in navigation: hide the Karten HUD and let go of its padding */
  navUi(on: boolean): void;
  /** the planner / navigation is open: hide every layer of the Karte (only the base map stays) */
  layersHidden(on: boolean): void;
  /** the locate mode changed (button state) */
  mode(m: LocMode): void;
}

export interface Routing {
  locator: Locator;
  /** opens the planner, optionally with a destination */
  open(dest?: { lat: number; lon: number; name?: string }): void;
  close(): void;
  /** the map was clicked: true if the planner used the click (picking a stop / choosing an alternative) */
  click(e: MapMouseEvent): boolean;
  navigating(): boolean;
  /** keys or settings changed */
  refresh(): void;
}

const NAV_CAM: Record<Profile, NavCamera> = {
  car: { pitch: 55, lower: 0.25, zoom: (v) => (v < 4 ? 17.6 : v < 10 ? 17 : v < 18 ? 16.3 : v < 28 ? 15.6 : 15) },
  bike: { pitch: 50, lower: 0.2, zoom: (v) => (v < 2 ? 18 : v < 7 ? 17.4 : 16.6) },
  foot: { pitch: 40, lower: 0.15, zoom: () => 18 },
};

/** announce a manoeuvre at these distances (m) before it */
const SAY_AT: Record<Profile, number[]> = { car: [1000, 400, 120], bike: [150, 50], foot: [60] };

const REROUTE_AFTER = 3; // fixes off the route in a row
const REROUTE_GAP = 8000; // ms between two reroutes

interface Nav {
  prep: Prepared;
  st: GuideState;
  /** along-the-route distance of the via points still ahead */
  vias: { pos: LngLat; along: number }[];
  dest: LngLat;
  profile: Profile;
  provider: string;
  lastReroute: number;
  rerouting: boolean;
  lastFixAt: number;
  lastAlong: number;
}

export function createRouting(map: MlMap, container: HTMLElement, host: RoutingHost, onFirstFix: (lat: number, lon: number) => void): Routing {
  const layer = new RouteLayer(map);
  const voice = new Voice();
  const prefs = store.getRoutePrefs();
  voice.enabled = prefs.voice ?? voice.available();
  let profile: Profile = prefs.profile ?? 'car';
  let provider = prefs.provider ?? defaultProvider(store.getKeys());
  let routes: Route[] = [];
  let active = 0;
  let planSeq = 0;
  let pickIndex: number | null = null;
  let nav: Nav | null = null;
  let wakeLock: { release(): Promise<void> } | null = null;
  let watchdog = 0;

  const savePrefs = () => store.setRoutePrefs({ profile, provider, voice: voice.enabled });

  // ----- planner UI -----------------------------------------------------------------
  const panel: RoutePanel = new RoutePanel({
    plan: () => void calculate(),
    pick(i) {
      pickIndex = i;
      panel.hint(t('routing.stops.tapMap'));
      map.getCanvas().style.cursor = 'crosshair';
    },
    close: () => close(),
    start: () => void startNav(),
    chooseRoute(i) {
      if (i === active || !routes[i]) return;
      active = i;
      layer.show(routes, active);
      showResult();
    },
    setProfile(p) {
      profile = p;
      // a provider that cannot do this profile is replaced by one that can
      if (!usable(p, store.getKeys(), provider).some((x) => x.id === provider)) provider = defaultProvider(store.getKeys());
      savePrefs();
      refreshProviders();
      void calculate();
    },
    setProvider(id) {
      provider = id;
      savePrefs();
      refreshProviders();
      void calculate();
    },
    stopChanged: () => void calculate(),
    stopNavigation: () => stopNav(),
    recentre: () => locator.set('heading'),
    toggleVoice() {
      voice.enabled = !voice.enabled;
      if (voice.enabled) voice.say(t('routing.voice.on'));
      else voice.reset();
      savePrefs();
      return voice.enabled;
    },
  });
  container.appendChild(panel.el);
  document.addEventListener('orbis:keys-saved', () => refreshProviders());

  function refreshProviders() {
    const keys = store.getKeys();
    const list = usable(profile, keys);
    if (!list.some((p) => p.id === provider)) provider = list[0]?.id ?? 'fossgis';
    panel.setProviders(list, PROVIDERS, provider, profile);
    panel.setProfile(profile);
  }

  // ----- position ------------------------------------------------------------------------
  const locator = new Locator(
    map,
    {
      onMode(m) {
        host.mode(m);
        if (nav) panel.guideRecentre(m !== 'heading');
      },
      onStatus: (s) => gpsStatus(s),
      onFix: (f) => onFix(f),
    },
    onFirstFix,
  );

  function gpsStatus(s: GpsStatus) {
    if (s === 'denied') toast(t('routing.geo.denied'), 'error');
    else if (s === 'unavailable') toast(t('routing.geo.unavailable'), 'error');
    if ((s === 'denied' || s === 'unavailable') && nav) stopNav();
  }

  /** current position: the running GPS, otherwise one high-accuracy reading */
  function here(): Promise<LngLat> {
    const f = locator.gps.fix;
    if (f && Date.now() - f.t < 30_000) return Promise.resolve([f.lon, f.lat]);
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) return reject(new Error(t('routing.geo.unsupported')));
      navigator.geolocation.getCurrentPosition((p) => resolve([p.coords.longitude, p.coords.latitude]), (e) => reject(e), { enableHighAccuracy: true, timeout: 15000, maximumAge: 20000 });
    });
  }

  // ----- planning -----------------------------------------------------------------------
  /** places the user typed but did not pick from the list: the first hit is meant */
  async function resolveTyped() {
    for (const s of panel.stops) {
      if (s.pos || s.here || s.label.trim().length < 2) continue;
      const hit = (await searchPlaces(s.label.trim()))[0];
      if (!hit) throw new Error(t('routing.stops.notFound', { name: s.label }));
      s.pos = [hit.lon, hit.lat];
      s.label = [hit.name, hit.region].filter(Boolean).join(', ');
    }
    panel.renderStops();
  }

  async function calculate() {
    const my = ++planSeq;
    if (nav) return;
    const stops = panel.stops;
    const last = stops[stops.length - 1];
    if (!last.pos && last.label.trim().length < 2) {
      routes = [];
      layer.clear();
      panel.hint(t('routing.stops.giveDest'));
      return;
    }
    panel.busy(t('routing.calc.busy'));
    try {
      await resolveTyped();
      const points: LngLat[] = [];
      for (const s of stops) {
        if (s.here) points.push(await here());
        else if (s.pos) points.push(s.pos);
        else if (s.label.trim()) throw new Error('Ort fehlt');
      }
      if (my !== planSeq) return;
      if (points.length < 2) {
        panel.hint(t('routing.stops.giveBoth'));
        return;
      }
      const show = (res: Planned, refining: boolean) => {
        routes = res.routes;
        active = 0;
        layer.show(routes, 0);
        layer.stops(points);
        showResult(res.failed.length ? t('routing.calc.fallback', { first: res.failed[0].provider.label, provider: res.provider.label }) : undefined, res.provider.id, refining);
      };
      // the fast route appears at once, the better one replaces it when it is there
      let previewed = false;
      const res = await planRoute({ points, profile, alternatives: points.length === 2 }, store.getKeys(), provider, (pre) => {
        if (my !== planSeq || nav) return;
        previewed = true;
        show(pre, true);
        fit(routes[0]);
      });
      if (my !== planSeq || nav) return;
      show(res, false);
      // a preview was shown: the view stays, only the data is swapped
      if (!previewed) fit(routes[0]);
    } catch (e) {
      if (my !== planSeq) return;
      routes = [];
      layer.clear();
      const msg = e instanceof GeolocationPositionError ? t('routing.calc.locFail') : e instanceof Error ? e.message : t('routing.calc.fail');
      panel.error(msg);
    }
  }

  let lastProvider = '';
  function showResult(note?: string, providerId?: string, refining = false) {
    if (providerId) lastProvider = providerId;
    const p = PROVIDERS.find((x) => x.id === (lastProvider || routes[active]?.provider)) ?? PROVIDERS[0];
    panel.showRoutes(routes, active, p, note, refining ? t('routing.calc.refining', { provider: providerById(provider)?.label ?? t('routing.calc.refiningFallback', { provider: '' }) }) : undefined);
  }

  function fit(r: Route) {
    const phone = window.innerWidth < 700;
    layer.fit(r.geometry, phone ? { top: 70, bottom: Math.round(window.innerHeight * 0.55), left: 30, right: 30 } : { top: 70, bottom: 70, left: host.leftInset() + 410, right: 80 });
  }

  // ----- open / close ----------------------------------------------------------------------
  function open(dest?: { lat: number; lon: number; name?: string }) {
    refreshProviders();
    host.layersHidden(true);
    panel.setMode('plan');
    panel.el.hidden = false;
    container.classList.add('route-open');
    panel.el.style.setProperty('--rt-left', `${host.leftInset() + 12}px`);
    if (dest) {
      const last = panel.stops.length - 1;
      panel.setStop(last, [dest.lon, dest.lat], dest.name ?? `${dest.lat.toFixed(4)}, ${dest.lon.toFixed(4)}`);
      void calculate();
    } else if (!routes.length) panel.hint(t('routing.stops.giveDest'));
    // the position is needed for "Mein Standort": ask early so the browser prompt does not interrupt the calculation
    if (panel.stops[0].here && locator.mode === 'off') void here().catch(() => {});
  }

  function close() {
    if (nav) return;
    pickIndex = null;
    map.getCanvas().style.cursor = '';
    planSeq++;
    panel.el.hidden = true;
    container.classList.remove('route-open');
    layer.clear();
    routes = [];
    panel.clearResult();
    host.layersHidden(false);
  }

  function click(e: MapMouseEvent): boolean {
    if (pickIndex != null) {
      const i = pickIndex;
      pickIndex = null;
      map.getCanvas().style.cursor = '';
      const { lng, lat } = e.lngLat;
      panel.setStop(i, [lng, lat], `${lat.toFixed(4)}, ${lng.toFixed(4)}`);
      void reverseGeocodePoint(lat, lng).then((p: Place) => {
        if (p.name && !isPickedPlaceholder(p.name) && panel.stops[i]?.pos?.[0] === lng) panel.setStop(i, [lng, lat], [p.name, p.region].filter(Boolean).join(', '));
      });
      panel.hint('');
      void calculate();
      return true;
    }
    if (!panel.el.hidden && !nav && routes.length > 1) {
      const alt = layer.pickAlternative(e.point);
      if (alt != null) {
        active = alt;
        layer.show(routes, active);
        showResult();
        return true;
      }
    }
    // while the planner is open or a trip runs, a click on the map must not open the weather pop-up
    return !panel.el.hidden || !!nav;
  }

  // ----- guidance ------------------------------------------------------------------------------
  async function startNav() {
    const route = routes[active];
    if (!route) return;
    // the GPS and (iOS) the compass permission are asked inside this tap
    locator.set('heading');
    void locator.gps.startCompass();
    const points = [...panel.stops.map((s) => s.pos).filter((p): p is LngLat => !!p)];
    const dest = points[points.length - 1] ?? route.geometry[route.geometry.length - 1];
    const prep = prepare(route);
    nav = {
      prep,
      st: newGuideState(),
      vias: [],
      dest,
      profile,
      provider: route.provider,
      lastReroute: 0,
      rerouting: false,
      lastFixAt: Date.now(),
      lastAlong: 0,
    };
    // via points: where along the route they are, to know which are still ahead after a reroute
    nav.vias = panel.stops
      .slice(1, -1)
      .map((s) => s.pos)
      .filter((p): p is LngLat => !!p)
      .map((pos) => ({ pos, along: snapToLine(route.geometry, prep.cum, pos)?.along ?? 0 }));
    layer.show([route], 0);
    panel.setMode('guide');
    panel.el.classList.remove('lost');
    container.classList.add('route-nav');
    host.navUi(true);
    locator.setNavCamera(NAV_CAM[profile]);
    voice.reset();
    if (voice.available()) panel.el.querySelector('[data-a=voice]')?.classList.toggle('on', voice.enabled);
    else panel.el.querySelector('[data-a=voice]')?.setAttribute('hidden', '');
    voice.say('Navigation gestartet');
    void keepAwake();
    watchdog = window.setInterval(() => {
      if (!nav) return;
      const silent = Date.now() - nav.lastFixAt > 8000;
      panel.guideStatus(silent ? 'GPS-Signal schwach …' : '');
    }, 2000);
    const f = locator.gps.fix;
    if (f) onFix(f);
  }

  function stopNav(arrived = false) {
    if (!nav) return;
    nav = null;
    clearInterval(watchdog);
    voice.reset();
    locator.setNavCamera(null);
    locator.set('track');
    void wakeLock?.release().catch(() => {});
    wakeLock = null;
    container.classList.remove('route-nav');
    host.navUi(false);
    layer.clear();
    routes = [];
    panel.clearResult();
    panel.setMode('plan');
    panel.el.hidden = true;
    container.classList.remove('route-open');
    host.layersHidden(false);
    if (arrived) toast('Du hast dein Ziel erreicht.');
  }

  async function keepAwake() {
    try {
      const wl = (navigator as unknown as { wakeLock?: { request(t: 'screen'): Promise<{ release(): Promise<void> }> } }).wakeLock;
      wakeLock = (await wl?.request('screen')) ?? null;
    } catch {
      /* not allowed / not supported: the screen may dim */
    }
  }
  document.addEventListener('visibilitychange', () => {
    if (nav && document.visibilityState === 'visible') void keepAwake();
  });

  /** every filtered fix: where on the route are we */
  function onFix(f: Fix): LngLat | void {
    if (!nav) return;
    nav.lastFixAt = Date.now();
    const pos: LngLat = [f.lon, f.lat];
    const p = progress(nav.prep, pos, f.accuracy, nav.st);
    const steps = nav.prep.route.steps;
    if (!p) {
      // off the line: a few fixes in a row before a reroute, so one bad fix does not cost a recalculation
      if (nav.st.strays >= REROUTE_AFTER && !nav.rerouting && Date.now() - nav.lastReroute > REROUTE_GAP) void reroute(f);
      panel.guideSet('text', nav.rerouting ? t('routing.calc.rerouting') : t('routing.calc.offRoute'));
      return;
    }
    nav.lastAlong = p.along;
    const s = steps[p.next];
    // the driven stretch is dimmed; the arrow sits on the line when the position is close to it
    layer.progress(nav.prep.route.geometry, p.snap.index, p.snap.point);

    panel.guideArrow(s.maneuver);
    panel.guideSet('dist', p.arrived ? '' : distance(p.toNext));
    panel.guideSet('text', s.text);
    const after = p.after != null ? steps[p.after] : null;
    panel.guideSet('then', after && nav.prep.stepAt[p.after!] - nav.prep.stepAt[p.next] < 400 ? `Danach  ${after.text}` : '');
    panel.guideSet('eta', clockTxt(Date.now() + p.remainingTime * 1000));
    panel.guideSet('time', duration(p.remainingTime));
    panel.guideSet('rest', distance(p.remaining));
    panel.guideSet('speed', f.speed != null ? speedTxt(f.speed * 3.6).replace(' ', '\n') : '–');
    panel.guideStatus('');

    if (p.arrived) {
      voice.say('Sie haben Ihr Ziel erreicht');
      stopNav(true);
      return;
    }
    // announcements: once per manoeuvre and distance band
    for (const th of SAY_AT[nav.profile]) {
      if (p.toNext <= th && p.toNext > th * 0.4) voice.once(`${p.next}:${th}`, announce(s.maneuver, s.text, p.toNext));
    }
    // the arrow rides on the line, unless the position is clearly beside it (parallel road, parking lot)
    return p.snap.offset < Math.max(12, f.accuracy) ? p.snap.point : undefined;
  }

  async function reroute(f: Fix) {
    if (!nav) return;
    const n = nav;
    n.rerouting = true;
    n.lastReroute = Date.now();
    panel.guideSet('text', t('routing.calc.rerouting'));
    voice.say(t('routing.calc.rerouteSay'));
    try {
      const h = locator.gps.heading();
      const ahead = n.vias.filter((v) => v.along > n.lastAlong).map((v) => v.pos);
      const points: LngLat[] = [[f.lon, f.lat], ...ahead, n.dest];
      const res = await planRoute({ points, profile: n.profile, alternatives: false, bearing: h?.source === 'gps' ? h.deg : undefined }, store.getKeys(), n.provider);
      if (nav !== n) return;
      const route = res.routes[0];
      n.prep = prepare(route);
      n.st = newGuideState();
      layer.show([route], 0);
      // where the remaining via points lie on the new line
      n.vias = ahead.map((pos) => ({ pos, along: snapToLine(route.geometry, n.prep.cum, pos)?.along ?? 0 }));
      n.lastAlong = 0;
      voice.reset();
      onFix(f);
    } catch {
      if (nav === n) panel.guideSet('text', t('routing.calc.noNewRoute'));
    } finally {
      n.rerouting = false;
    }
  }

  refreshProviders();
  return {
    locator,
    open,
    close,
    click,
    navigating: () => !!nav,
    refresh: refreshProviders,
  };
}
