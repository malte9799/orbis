// public/data/moneyflow.json (durch scripts/moneyflow.mjs erzeugt): pro Kongressabgeordnetem
// Name, Partei, Wahlbezirk, Position des Bezirks und die Geldwerte der pro-israelischen PACs.

export interface MoneyMember {
  /** Name */
  n: string;
  /** Partei (GOP/DEM/…) */
  p: string;
  /** Wahlbezirk („TX-14“, „AK-AL“; Senatoren sind ausgeschlossen) */
  d: string;
  lon: number;
  lat: number;
 /** PAC-Spenden (FEC direkte Beiträge), USD */
  don: number;
  /** für/gegen dieses Mitglied ausgegebene Independent Expenditures, USD */
  ie: number;
  /** davon über AIPAC */
  aipac: number;
  backers?: string[];
}

export interface MoneyFlow {
  built: string;
  source: string;
  members: MoneyMember[];
}

let memo: Promise<MoneyFlow> | null = null;

export function moneyflow(): Promise<MoneyFlow> {
  memo ??= (async () => {
    const res = await fetch('data/moneyflow.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json() as Promise<MoneyFlow>;
  })();
  memo.catch(() => (memo = null));
  return memo;
}
