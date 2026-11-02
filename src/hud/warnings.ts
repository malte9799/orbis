// Inhalts-Warnungen: Karten, die belastendes Dokumentationsmaterial zeigen, tragen
// `warn: <id>` und werden vom HUD in go() mit einem Bestätigungsdialog abgefragt. Die
// Bestätigung gilt je Warnung für die laufende Browser-Sitzung (sessionStorage), wenn
// sie der Leser in der Warnung bestätigt: das Archiv selbst fragt so bei jedem Besuch.

export interface WarnDef {
  id: string;
  /** Überschrift */
  title: string;
  /** Warnung als HTML (dort erlaubt: <b>) */
  text: string;
  credit: string;
  ok: string;
  leave: string;
}

export const WARNINGS: Record<string, WarnDef> = {
  zeugen: {
    id: 'zeugen',
    title: 'Inhaltswarnung',
    text:
      'Diese Karte zeigt <b>Kriegsdokumentation aus Gaza, dem Westjordanland und der Ukraine</b> – Material mit Gewalt, Toten und Verletzten, gesammelt für <b>Dokumentation und juristische Aufarbeitung</b>. Auf der Karte selbst tauchen nur Positionen und Text auf; verlinktes Belegmaterial kann verstörende Aufnahmen enthalten. Diskretion empfohlen.',
    credit: 'Datenherkunft: archivegenocide.com · whofundedgenocide.com · Bellingcat · Kiel Institute',
    ok: 'Ich verstehe – Karte öffnen',
    leave: 'Verlassen',
  },
};

const KEY = (id: string) => `wg.warn.${id}`;

export const warned = (id: string): boolean => {
  try {
    return sessionStorage.getItem(KEY(id)) != null;
  } catch {
    return false;
  }
};

export const setWarned = (id: string) => {
  try {
    sessionStorage.setItem(KEY(id), '1');
  } catch {
    /* ohne speicherbaren Zustand fragt es eben wieder */
  }
};
