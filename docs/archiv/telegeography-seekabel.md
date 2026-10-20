# Archiv: Seekabel von TeleGeography

Bis Oktober 2026 kamen die Seekabel-Ebene und ihre Anlandepunkte aus der
[TeleGeography Submarine Cable Map](https://www.submarinecablemap.com). Die Ebene wurde auf
OpenStreetMap (ODbL) umgestellt, weil die TeleGeography-Datenbank **nicht offen lizenziert** ist:
Kartenbilder dürfen mit Nennung (CC BY-SA 4.0) gezeigt werden, die Daten selbst gibt es nur mit
kostenpflichtiger Lizenz. Wir hatten die interne API täglich in den öffentlichen `data`-Branch
kopiert – das ist eine Weiterverbreitung ohne Erlaubnis.

**Wieder nutzen nur mit schriftlicher Erlaubnis von TeleGeography** (Kontakt: info@telegeography.com,
Lizenzseiten: [Karten zitieren](https://www2.telegeography.com/cite-telegeography-map),
[Datenlizenz](https://www2.telegeography.com/license-geocoded-map-data)). Dann die Bedingungen
der Erlaubnis in `docs/DATENQUELLEN.md` eintragen und die Attribution entsprechend anpassen.

Vorteile gegenüber OSM: ~1,4 Mio. km statt ~240.000 km Kabel, Anlandepunkte, Länge,
Inbetriebnahme, Eigentümer pro Kabel.

Vollständiger Stand im Git: Commit `f42b749` (`git show f42b749operty `id`, `name`, `color`): `https://www.submarinecablemap.com/api/v3/cable/cable-geo.json`
- Anlandepunkte (GeoJSON): `https://www.submarinecablemap.com/api/v3/landing-point/landing-point-geo.json`
- Details pro Kabel: `https://www.submarinecablemap.com/api/v3/cable/<id>.json` (`name`, `length`, `rfs`, `owners`, `url`, `landing_points`)
- Webseite pro Kabel: `https://www.submarinecablemap.com/submarine-cable/<id>`
- Keine CORS-Header → nur serverseitig abrufbar (Snapshot oder Proxy).

## Loader (`src/api/infra.ts`)

```ts
// Submarine cables & landing points – TeleGeography Submarine Cable Map (free, non-commercial)

const CABLE_API = 'https://www.submarinecablemap.com/api/v3';

export async function loadCables(): Promise<{ cables: FeatureCollection; landings: FeatureCollection }> {
  // TeleGeography sends no CORS headers – use the snapshot from the data branch
  const [cables, landings] = await Promise.all([
    snapshotJson('cables/cable-geo.json', () => fetchJson<FeatureCollection>(`${CABLE_API}/cable/cable-geo.json`, undefined, 40000)),
    snapshotJson('cables/landing-point-geo.json', () => fetchJson<FeatureCollection>(`${CABLE_API}/landing-point/landing-point-geo.json`, undefined, 40000)).catch(
      () => ({ type: 'FeatureCollection', features: [] }) as FeatureCollection,
    ),
  ]);
  return { cables, landings };
}

export interface CableDetails {
  name: string;
  length?: string;
  rfs?: string;
  owners?: string;
  url?: string;
  landing_points?: { name: string }[];
}

let cableDetails: Promise<Record<string, CableDetails>> | null = null;

export async function loadCableDetails(id: string): Promise<CableDetails> {
  cableDetails ??= snapshotJson<Record<string, CableDetails>>('cables/details.json').catch(() => ({}));
  const d = (await cableDetails)[id];
  return d ?? fetchJson<CableDetails>(`${CABLE_API}/cable/${encodeURIComponent(id)}.json`, undefined, 15000);
}

export const cableUrl = (id: string) => `https://www.submarinecablemap.com/submarine-cable/${encodeURIComponent(id)}`;
```

## Snapshot-Task (`scripts/fetch-data.ts`)

```ts
await task('cables', DAY, async () => {
  const API = 'https://www.submarinecablemap.com/api/v3';
  const geo = await json<{ features: { properties: { id: string } }[] }>(`${API}/cable/cable-geo.json`);
  write('cables/cable-geo.json', geo);
  write('cables/landing-point-geo.json', await json(`${API}/landing-point/landing-point-geo.json`));
  const ids = [...new Set(geo.features.map((f) => f.properties.id))];
  const details: Record<string, unknown> = {};
  await pool(ids, 6, async (id) => {
    try {
      const d = await json<{ name: string; length?: string; rfs?: string; owners?: string; url?: string; landing_points?: { name: string }[] }>(`${API}/cable/${encodeURIComponent(id)}.json`, 20000);
      details[id] = { name: d.name, length: d.length, rfs: d.rfs, owners: d.owners, url: d.url, landing_points: d.landing_points?.map((l) => ({ name: l.name })) };
    } catch {
      /* skip single cable */
    }
  });
  write('cables/details.json', details);
});
```

## Ebene Anlandepunkte (`src/globe/extras.ts`, in `init()`)

Dazu gehörten außerdem: `cables: ['cables', 'landings', 'ixp']` in der Gruppen-Zuordnung, `'landings'`
in der Liste der GeoJSON-Quellen, die Attribution
`cables: 'Seekabel: <a href="https://www.submarinecablemap.com/">TeleGeography</a>'` und in
`loadCablesAndIxps()` `this.setData('landings', cables.value.landings)`.

```ts
    add(
      {
        id: 'landings',
        type: 'circle',
        source: 'landings',
        minzoom: 2,
        layout: hidden,
        paint: { 'circle-color': '#ffffff', 'circle-radius': 2.2, 'circle-stroke-color': '#9c6bff', 'circle-stroke-width': 1 },
      },
      'gauges',
```

## Popup (`src/globe/extras.ts`, Klick-Handler)

```ts
      case 'cables': {
        const id = String(p.id ?? p.feature_id ?? '');
        const name = String(p.name ?? 'Seekabel');
        return {
          type: 'html',
          html: cardHtml({ glyph: 'cable', color: String(p.color ?? '#9c6bff'), title: name, subtitle: 'Unterseekabel', source: 'TeleGeography', url: id ? cableUrl(id) : undefined, extra: '<div class="pop-loading small">Details werden geladen …</div>' }),
          lng: at.lng,
          lat: at.lat,
          after: (node) => {
            if (!id) return;
            loadCableDetails(id)
              .then((d) => {
                const rows = [
                  ['Länge', d.length],
                  ['In Betrieb seit', d.rfs],
                  ['Betreiber', d.owners],
                  ['Anlandungen', d.landing_points?.map((l) => l.name).slice(0, 8).join(', ')],
                ].filter(([, v]) => v);
                const el = node.querySelector('.pop-loading');
                if (el) el.outerHTML = `<div class="pop-grid two">${rows.map(([k, v]) => `<span>${k}</span><b>${escapeHtml(v)}</b>`).join('')}</div>`;
              })
              .catch(() => node.querySelector('.pop-loading')?.remove());
          },
        };
      }
```
