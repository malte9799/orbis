import type { Maneuver } from './types';
import { t } from '../i18n';
import { fmt } from '../util';


/** short spoken form of a manoeuvre for the announcement ("in 200 Metern links abbiegen");
 *  fallback text stays German, speech goes through `routing.say.*` */
const key = (m: Maneuver): string => String(m).replace(/-(\w)/g, (_0, s: string) => s.toUpperCase());
const SAY_DE: Record<Maneuver, string> = {
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
  if (m >= 950) return t('routing.say.km', { n: fmt.num(Math.round(m / 100) / 10, 1) });
  return t('routing.say.m', { n: Math.max(50, Math.round(m / 50) * 50) });
}

export function announce(m: Maneuver, text: string, dist: number | null): string {
  if (m === 'arrive') return t('routing.say.arrive');
  // the provider's own sentence is better than ours when we have one; otherwise build it
  const what = text || t(`routing.say.${key(m)}` as never, { d: SAY_DE[m] });
  return dist == null ? what : t('routing.say.inDistance', { d: spokenDistance(dist), what });
}
