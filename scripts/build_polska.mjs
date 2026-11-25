// Kontur Polski z Natural Earth 1:10m (pakiet world-atlas, domena publiczna).
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { feature } = require('topojson-client');
const topo = JSON.parse(readFileSync(require.resolve('world-atlas/countries-10m.json'), 'utf8'));
const pl = feature(topo, topo.objects.countries).features.find((f) => f.id === '616' || f.properties.name === 'Poland');
const rnd = (c) => (typeof c[0] === 'number' ? [+c[0].toFixed(3), +c[1].toFixed(3)] : c.map(rnd));
writeFileSync('public/data/polska.geojson', JSON.stringify({ type: 'Feature', properties: {}, geometry: { type: pl.geometry.type, coordinates: rnd(pl.geometry.coordinates) } }));
console.log(pl.properties.name, pl.geometry.type, readFileSync('public/data/polska.geojson').length, 'B');
