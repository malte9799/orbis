// Local run of the panorama list: MAPILLARY_TOKEN=… node scripts/street-panos-cli.mjs <out.json>
import { readFileSync, writeFileSync } from 'node:fs';
import { buildStreetPanos, landTiles } from './street-panos.mjs';

const out = process.argv[2];
if (!out || !process.env.MAPILLARY_TOKEN) throw new Error('usage: MAPILLARY_TOKEN=… node scripts/street-panos-cli.mjs <out.json>');
const countries = JSON.parse(readFileSync(new URL('../public/data/games/countries.json', import.meta.url), 'utf8'));
const data = await buildStreetPanos({ token: process.env.MAPILLARY_TOKEN, tiles: landTiles(countries), log: console.log });
writeFileSync(out, JSON.stringify(data));
console.log(`${data.points.length} points -> ${out}`);
