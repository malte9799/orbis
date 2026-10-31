import type { Maneuver } from './types';
import { t } from '../i18n';

/** key suffix of a manoeuvre in the routing.text namespace */
const key = (m: Maneuver): string => String(m).replace(/-(\w)/g, (_0, s: string) => s.toUpperCase());

/** instruction from a manoeuvre, for providers that only deliver a vocabulary (OSRM) */
export function instruction(m: Maneuver, name: string, exit?: number): string {
  if (m === 'roundabout') {
    const ex = exit && exit <= 10 ? t('routing.text.exitNote', { ord: t(`routing.text.ord.${exit}` as never) }) : t('routing.text.exitLeave');
    return `${t('routing.text.roundabout')}. ${ex}${name ? t('routing.text.towards', { name }) : ''}`;
  }
  if (m === 'arrive') return t('routing.text.arrive');
  const on = name ? t('routing.text.onto', { name }) : '';
  return `${t(`routing.text.${key(m)}` as never)}${on}`;
}

/** OSRM / Mapbox `maneuver.type` + `modifier` → {@link Maneuver} */
export function fromOsrm(type: string, modifier?: string): Maneuver {
  if (type === 'arrive') return 'arrive';
  if (type === 'depart') return 'depart';
  if (type === 'roundabout' || type === 'rotary' || type === 'roundabout turn' || type === 'exit roundabout' || type === 'exit rotary') return 'roundabout';
  if (type === 'merge') return 'merge';
  if (type === 'fork') return modifier?.includes('left') ? 'fork-left' : 'fork-right';
  if (type === 'on ramp' || type === 'off ramp') return modifier?.includes('left') ? 'ramp-left' : 'ramp-right';
  if (type === 'ferry' || type === 'notification') return type === 'ferry' ? 'ferry' : 'straight';
  switch (modifier) {
    case 'uturn':
      return 'uturn';
    case 'sharp left':
      return 'sharp-left';
    case 'left':
      return 'left';
    case 'slight left':
      return 'slight-left';
    case 'sharp right':
      return 'sharp-right';
    case 'right':
      return 'right';
    case 'slight right':
      return 'slight-right';
    default:
      return 'straight';
  }
}

/** Valhalla `maneuver.type` number → {@link Maneuver} */
export function fromValhalla(t: number): Maneuver {
  switch (t) {
    case 1:
    case 2:
    case 3:
      return 'depart';
    case 4:
    case 5:
    case 6:
      return 'arrive';
    case 8:
    case 22:
      return 'straight';
    case 9:
      return 'slight-right';
    case 10:
      return 'right';
    case 11:
      return 'sharp-right';
    case 12:
    case 13:
      return 'uturn';
    case 14:
      return 'sharp-left';
    case 15:
      return 'left';
    case 16:
      return 'slight-left';
    case 17:
    case 19:
      return 'ramp-right';
    case 18:
    case 20:
      return 'ramp-left';
    case 23:
      return 'fork-right';
    case 24:
      return 'fork-left';
    case 25:
      return 'merge';
    case 26:
    case 27:
      return 'roundabout';
    case 28:
      return 'ferry';
    default:
      return 'straight';
  }
}

/** Google Routes `navigationInstruction.maneuver` → {@link Maneuver} */
export function fromGoogle(m: string | undefined): Maneuver {
  switch (m) {
    case 'DEPART':
      return 'depart';
    case 'TURN_SLIGHT_LEFT':
      return 'slight-left';
    case 'TURN_SHARP_LEFT':
      return 'sharp-left';
    case 'TURN_LEFT':
      return 'left';
    case 'TURN_SLIGHT_RIGHT':
      return 'slight-right';
    case 'TURN_SHARP_RIGHT':
      return 'sharp-right';
    case 'TURN_RIGHT':
      return 'right';
    case 'UTURN_LEFT':
    case 'UTURN_RIGHT':
      return 'uturn';
    case 'ROUNDABOUT_LEFT':
    case 'ROUNDABOUT_RIGHT':
      return 'roundabout';
    case 'MERGE':
      return 'merge';
    case 'FORK_LEFT':
      return 'fork-left';
    case 'FORK_RIGHT':
      return 'fork-right';
    case 'RAMP_LEFT':
      return 'ramp-left';
    case 'RAMP_RIGHT':
      return 'ramp-right';
    case 'FERRY':
    case 'FERRY_TRAIN':
      return 'ferry';
    default:
      return 'straight';
  }
}

/** arrow glyph for the banner */
export const ARROW: Record<Maneuver, string> = {
  depart: '↑',
  straight: '↑',
  'slight-left': '↖',
  left: '←',
  'sharp-left': '↙',
  'slight-right': '↗',
  right: '→',
  'sharp-right': '↘',
  uturn: '⮌',
  roundabout: '⟳',
  merge: '⤴',
  'fork-left': '↖',
  'fork-right': '↗',
  'ramp-left': '↰',
  'ramp-right': '↱',
  ferry: '⛴',
  arrive: '⚑',
};
