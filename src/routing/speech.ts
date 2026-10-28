import type { Maneuver } from './types';

/** short spoken form of a manoeuvre for the announcement ("in 200 Metern links abbiegen") */
const SAY: Record<Maneuver, string> = {
  depart: 'Los geht es',
  straight: 'geradeaus weiter',
  'slight-left': 'leicht links halten',
  left: 'links abbiegen',
  'sharp-left': 'scharf links abbiegen',
  'slight-right': 'leicht rechts halten',
  right: 'rechts abbiegen',
  'sharp-right': 'scharf rechts abbiegen',
  uturn: 'wenden',
  roundabout: 'in den Kreisverkehr einfahren',
  merge: 'einfädeln',
  'fork-left': 'links halten',
  'fork-right': 'rechts halten',
  'ramp-left': 'links auf die Auffahrt',
  'ramp-right': 'rechts auf die Auffahrt',
  ferry: 'die Fähre nehmen',
  arrive: 'Sie haben Ihr Ziel erreicht',
};

/** metres as people say them ("200 Meter", "1,5 Kilometer") */
export function spokenDistance(m: number): string {
  if (m >= 950) return `${(Math.round(m / 100) / 10).toString().replace('.', ',')} Kilometer`;
  return `${Math.max(50, Math.round(m / 50) * 50)} Meter`;
}

export function announce(m: Maneuver, text: string, dist: number | null): string {
  if (m === 'arrive') return SAY.arrive;
  // the provider's own sentence is better than ours when we have one; otherwise build it
  const what = text || SAY[m];
  return dist == null ? what : `In ${spokenDistance(dist)}: ${what}`;
}
