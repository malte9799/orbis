import type { IncidentDef } from './types';

// Was am Fahrzeug eines Ereignisses anders ist: Flugzeug (Höhe in ft) oder Tauchboot (Tiefe in m, negativ). Rein, ohne DOM.

const FT = 0.3048;

export interface KindProfile {
  sub: boolean;
  /** Wert der Spur (Spalte "Höhe") in Metern über dem Meeresspiegel/Boden */
  toM: (v: number) => number;
  /** Bezeichnung des Endes der Spur */
  impact: string;
  /** Knopf "ganze Spur" */
  full: { label: string; tip: string };
  followTip: string;
  trackName: string;
  glyph: 'plane' | 'ship';
  color: string;
}

export function profileOf(def: Pick<IncidentDef, 'kind'>): KindProfile {
  if (def.kind === 'submersible') {
    return {
      sub: true,
      toM: (v) => v,
      impact: 'Implosion',
      full: { label: 'Ganzer Tauchgang', tip: 'Vom Ablegen bis zur Implosion' },
      followTip: 'Kamera folgt dem Tauchboot',
      trackName: 'Tauchspur',
      glyph: 'ship',
      color: '#29b6f6',
    };
  }
  return {
    sub: false,
    toM: (v) => v * FT,
    impact: 'Einschlag',
    full: { label: 'Ganzer Flug', tip: 'Vom Start bis zum Einschlag' },
    followTip: 'Kamera folgt dem Flugzeug',
    trackName: 'Flugspur',
    glyph: 'plane',
    color: '#ef5350',
  };
}

/** Druck in bar in einer Wassertiefe (m): grobe Näherung für Meerwasser, 1 bar an der Oberfläche */
export const pressureBar = (depthM: number) => 1.013 + depthM * 0.1015;
