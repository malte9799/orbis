import { snapshotJson } from './data';

/**
 * Ship-Historie (vessel track/history) – data-layer contracts and snapshot loaders.
 *
 * Historical AIS tracks are mostly commercial (MarineTraffic, VesselFinder, Spire).
 * There is no free, keyless, global historical AIS track API. aisstream.io is
 * realtime only. Global Fishing Watch (GFW) offers track/event APIs but requires a
 * (free) registration token; browser clients cannot safely hold such tokens, so
 * live GFW access is not wired here by default.
 *
 * Practical approach: this module reads prebuilt snapshots (R2/data branch) that can
 * be populated by collector tasks or workers with authorized access, or by curated/
 * observed-position accumulation. Without a populated snapshot, loaders return an
 * empty placeholder with `sourceConstraint` documenting the limitation.
 *
 * Snapshot layout (orbis-data / data branch):
 *   - ships/history.json              index/manifest (+ optional embedded tracks)
 *   - ships/tracks/{mmsi}.json        per-vessel track detail (optional, preferred)
 */

/** One observed/reported vessel position in a track. Coordinates in WGS84 degrees. */
export interface ShipTrackPoint {
  /** Unix seconds (UTC) or ms since epoch; consumers should accept both (see `atMs`). */
  t: number;
  lat: number;
  lon: number;
  /** Speed over ground, knots. */
  sog?: number;
  /** Course over ground, degrees true [0,360). */
  cog?: number;
  /** True heading, degrees [0,360) or absent/511-encoded at source. */
  heading?: number;
  /** Data source tag for mixed-origin tracks (e.g. "aisstream", "gfw", "observed"). */
  src?: string;
}

/** Vessel identity used to key a track. */
export interface ShipTrackIdentity {
  /** Maritime Mobile Service Identity (numeric string or number in sources; normalized to string). */
  mmsi: string;
  imo?: string;
  name?: string;
  callSign?: string;
  flag?: string;
  vesselType?: string;
}

/** A time-ordered track for one vessel. */
export interface ShipTrack extends ShipTrackIdentity {
  /** Points sorted ascending by time. May be sparse/downsampled. */
  points: ShipTrackPoint[];
  /** Track coverage start (unix seconds or ms, matching `points[].t` scale). */
  from?: number;
  /** Track coverage end. */
  to?: number;
  /** Human-readable origin, e.g. "observed (orbis-ships worker)", "GFW API", "curated". */
  source: string;
  /** Set when this record is partial, synthetic, or otherwise constrained. */
  sourceConstraint?: string;
}

/** Index entry: advertises that a track exists without embedding all points. */
export interface ShipHistoryIndexEntry extends ShipTrackIdentity {
  /** Snapshot path for per-vessel detail, relative to data base, e.g. "ships/tracks/211234567.json". */
  path?: string;
  from?: number;
  to?: number;
  pointCount?: number;
  source?: string;
}

/** Top-level snapshot written to ships/history.json. */
export interface ShipHistoryData {
  generated: string;
  source: string;
  /** Explains missing/partial global history when no authorized source is configured. */
  sourceConstraint?: string;
  /** Optional embedded tracks (small curated sets). Prefer per-vessel files for scale. */
  tracks?: ShipTrack[];
  /** Discoverable vessels with available track snapshots. */
  index?: ShipHistoryIndexEntry[];
}

export interface ShipTrackQuery {
  mmsi: string | number;
  /** Optional inclusive lower bound (unix ms). */
  fromMs?: number;
  /** Optional inclusive upper bound (unix ms). */
  toMs?: number;
  /** Maximum points to return after filtering (downsample by stride when exceeded). */
  maxPoints?: number;
}

const NO_HISTORY: ShipHistoryData = {
  generated: new Date().toISOString(),
  source: 'placeholder',
  sourceConstraint:
    'No free global historical AIS track source is configured. Populate ships/history.json or ships/tracks/{mmsi}.json via an authorized collector (e.g. GFW_API_TOKEN) or observed-position snapshots.',
  tracks: [],
  index: [],
};

const normMmsi = (mmsi: string | number) => String(mmsi).trim();

const atMs = (t: number) => (t > 1e12 ? t : t * 1000);

function filterTrack(track: ShipTrack, q: ShipTrackQuery): ShipTrack {
  let pts = track.points;
  if (q.fromMs != null) pts = pts.filter((p) => atMs(p.t) >= q.fromMs!);
  if (q.toMs != null) pts = pts.filter((p) => atMs(p.t) <= q.toMs!);
  if (q.maxPoints && pts.length > q.maxPoints) {
    const stride = Math.ceil(pts.length / q.maxPoints);
    const out: ShipTrackPoint[] = [];
    for (let i = 0; i < pts.length; i += stride) out.push(pts[i]);
    if (out[out.length - 1] !== pts[pts.length - 1]) out.push(pts[pts.length - 1]);
    pts = out;
  }
  return pts === track.points ? track : { ...track, points: pts };
}

/** Ship history index/manifest from orbis-data snapshot (ships/history.json). */
export async function loadShipHistoryIndex(): Promise<ShipHistoryData> {
  return snapshotJson<ShipHistoryData>('ships/history.json', async () => NO_HISTORY);
}

/**
 * Per-vessel track snapshot (ships/tracks/{mmsi}.json). Returns null when absent.
 * This is the preferred storage for large tracks.
 */
export async function loadShipTrackSnapshot(mmsi: string | number): Promise<ShipTrack | null> {
  const id = normMmsi(mmsi);
  if (!id) return null;
  try {
    return await snapshotJson<ShipTrack>(`ships/tracks/${id}.json`);
  } catch {
    return null;
  }
}

/**
 * Load a vessel's track by MMSI from snapshots. Resolution order:
 * 1) ships/tracks/{mmsi}.json (per-vessel detail)
 * 2) embedded track or index-referenced path in ships/history.json
 *
 * Returns null when no track data is available for the vessel.
 */
export async function loadShipTrack(query: ShipTrackQuery): Promise<ShipTrack | null> {
  const mmsi = normMmsi(query.mmsi);
  if (!mmsi) return null;

  const direct = await loadShipTrackSnapshot(mmsi);
  if (direct) return filterTrack(direct, query);

  const idx = await loadShipHistoryIndex();
  const embedded = idx.tracks?.find((t) => normMmsi(t.mmsi) === mmsi);
  if (embedded) return filterTrack(embedded, query);

  const entry = idx.index?.find((e) => normMmsi(e.mmsi) === mmsi);
  if (entry?.path) {
    try {
      const t = await snapshotJson<ShipTrack>(entry.path.replace(/^\/+/, ''));
      return filterTrack(t, query);
    } catch {
      /* fall through */
    }
  }
  return null;
}

/** Normalize an arbitrary timestamp-like track point time to unix ms. */
export { atMs as shipTrackTimeMs };
