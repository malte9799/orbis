import type { Maneuver, Profile } from './types';

// Manoeuvre and mode icons (48×48 / 24×24 grids, stroked with currentColor) – plain arrows like the big map apps use.

const M: Record<Maneuver, string> = {
  depart: '<path d="M24 41V9M13 20 24 9l11 11"/>',
  straight: '<path d="M24 41V9M13 20 24 9l11 11"/>',
  right: '<path d="M14 41V28a8 8 0 0 1 8-8h14M28 11l9 9-9 9"/>',
  left: '<path d="M34 41V28a8 8 0 0 0-8-8H12M20 11l-9 9 9 9"/>',
  'slight-right': '<path d="M16 41V32l14-14M20 14h14v14"/>',
  'slight-left': '<path d="M32 41V32L18 18M28 14H14v14"/>',
  'sharp-right': '<path d="M11 12h17a8 8 0 0 1 8 8v21M26 31l10 10 10-10" transform="translate(-2 -3)"/>',
  'sharp-left': '<path d="M37 12H20a8 8 0 0 0-8 8v21M22 31 12 41 2 31" transform="translate(2 -3)"/>',
  uturn: '<path d="M14 41V19a9 9 0 0 1 18 0v14M23 25l9 9 9-9"/>',
  roundabout: '<circle cx="24" cy="29" r="8"/><path d="M24 21V8M17 15l7-7 7 7M24 41v-4"/>',
  merge: '<path d="M16 41V29l8-8V8M17 15l7-7 7 7M32 41V29l-8-8"/>',
  'fork-left': '<path d="M24 41V28L13 17M13 26V17h9M24 28l9-11" opacity="1"/>',
  'fork-right': '<path d="M24 41V28l11-11M35 26V17h-9M24 28l-9-11"/>',
  'ramp-left': '<path d="M34 41V30a8 8 0 0 0-8-8H12M20 13l-9 9 9 9"/>',
  'ramp-right': '<path d="M14 41V30a8 8 0 0 1 8-8h14M28 13l9 9-9 9"/>',
  ferry: '<path d="M7 31l5 9h24l5-9zM24 8v23M24 10h11L24 21"/>',
  arrive: '<path d="M24 43S11 31 11 21a13 13 0 0 1 26 0c0 10-13 22-13 22z"/><circle cx="24" cy="21" r="4.5"/>',
};

export const maneuverSvg = (m: Maneuver, size = 48): string =>
  `<svg viewBox="0 0 48 48" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="4.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${M[m]}</svg>`;

const P: Record<Profile, string> = {
  car: '<path d="M5 14l2-6h10l2 6M3 14h18v5H3zM6 19v2M18 19v2"/><circle cx="7.5" cy="16.5" r=".6"/><circle cx="16.5" cy="16.5" r=".6"/>',
  bike: '<circle cx="6" cy="16" r="3.5"/><circle cx="18" cy="16" r="3.5"/><path d="M6 16l4-8h5l3 8M10 8l3 8H6M8.5 5.5h3"/>',
  foot: '<circle cx="13" cy="4.5" r="1.8"/><path d="M12 8.5l-3 4 2 .5 1 3-2 5M12 8.5l3 3.5 3 .5M12.5 12l.5 3.5 3 3 .5 3"/>',
};

export const profileSvg = (p: Profile) => `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[p]}</svg>`;
