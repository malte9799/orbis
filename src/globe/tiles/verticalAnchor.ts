// Frozen vertical placement of one tileset.
//
// A tileset is put onto the map with ONE constant vertical shift, measured in the first seconds
// and then never touched again. Measuring the ground continuously under the moving map centre
// slid whole cities up and down: the measurement changes with the level of detail and with what
// the centre happens to cover (a roof, a street, a river bank). With the terrain drawn at
// exaggeration 1 the correct shift is position-independent — the tileset's datum difference
// against the map's — so it can be measured once and kept.
//
// Two independent constants, each measured at the same spot and moment:
//  - flat: the set's own ground height (no terrain shown: the set is lowered onto the flat map)
//  - terrain: that ground minus the map's terrain elevation at the same point (terrain shown)
// Each settles on the first measurement from fine geometry, on two agreeing ones, or at the
// timeout — whatever comes first. Only the terrain pairing re-arms when the view centre moved
// far away: it drifts with the geoid, the flat ground height never does.

/** a ground measurement near the view centre */
export interface GroundMeasure {
  /** ground height in metres, in the tileset's own datum; null if nothing measurable is drawn there */
  h: number | null;
  /** true when h comes from fine geometry, false when only a coarse stand-in's lowest vertex was available */
  fine: boolean;
}

const AGREE_M = 1.5;
const PAIR_AGREE_M = 2;
const TIMEOUT_MS = 9000;
/** re-pair when the view centre moved this far from where the pairing was locked (metres) */
const REARM_M = 50000;
/** a datum difference is a geoid-sized thing; more means the pairing is wrong, not the datum */
const MAX_PAIR_DIFF_M = 150;

export class VerticalAnchor {
  /** metres the whole set is lowered by right now (null: nothing measurable yet, keep the last) */
  offset: number | null = null;
  /** the set's own ground height, once measured (the layer also uses it for the loading order) */
  ground: number | null = null;
  private flat: number | null = null;
  private pair: number | null = null;
  private flatLocked = false;
  private pairLocked = false;
  private everTerrain = false;
  private prevFlat: number | null = null;
  private prevPair: number | null = null;
  private firstAt = 0;
  private at: [number, number] | null = null;

  /** nothing more to measure for the terrain mode in use; the layer can stop measuring */
  get settled(): boolean {
    return this.flatLocked && (this.pairLocked || !this.everTerrain);
  }

  /**
   * Advances the state machine one step (the layer calls this a few times a second until settled).
   * `measure` re-measures the set's ground near the view centre; `terrain` is the map's terrain
   * elevation at the same point (null when the terrain is off or has no data there yet); `at` is
   * the view centre [lon, lat]. Returns the offset to lower the set by (null: keep the last one).
   */
  tick(now: number, at: [number, number], measure: () => GroundMeasure, terrain: number | null): number | null {
    if (terrain !== null) this.everTerrain = true;
    const far = this.at !== null && Math.hypot(at[0] - this.at[0], at[1] - this.at[1]) * 111000 >= REARM_M;
    if (this.pairLocked && terrain !== null && far) {
      this.pairLocked = false;
      this.prevPair = null;
      this.firstAt = 0;
    } else if (this.settled) return this.offset;
    if (!this.firstAt) this.firstAt = now;
    const timedOut = now - this.firstAt > TIMEOUT_MS;
    const m = measure();
    if (m.h !== null) {
      this.ground = m.h;
      if (!this.flatLocked) {
        const agree = this.prevFlat !== null && Math.abs(m.h - this.prevFlat) < AGREE_M;
        this.prevFlat = m.h;
        this.flat = m.h;
        if (m.fine || agree || timedOut) this.flatLocked = true;
      }
      // the terrain pairing needs ground and terrain from the same point and moment
      if (!this.pairLocked && terrain !== null) {
        const diff = m.h - terrain;
        const usable = (terrain !== 0 || m.h <= 100) && Math.abs(diff) < MAX_PAIR_DIFF_M; // a dem tile that has not arrived yet reads 0
        if (usable) {
          const agree = this.prevPair !== null && Math.abs(diff - this.prevPair) < PAIR_AGREE_M;
          this.prevPair = diff;
          this.pair = diff;
          if (m.fine || agree || timedOut) this.pairLocked = true;
        }
      }
    }
    if (timedOut) {
      this.flatLocked = true;
      if (this.pair !== null) this.pairLocked = true; // a pairing that never became plausible stays open for a better terrain reading
    }
    this.at = [at[0], at[1]];
    // with terrain on, an unpaired set keeps its last shift: lowering it by its raw ground would sink it into the terrain
    const next = terrain !== null ? this.pair ?? this.offset : this.flat;
    if (next !== null) this.offset = next;
    return this.offset;
  }
}
