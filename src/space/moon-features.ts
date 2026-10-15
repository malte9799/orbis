// Named lunar features for the planet map (IAU names, positions rounded). `km` = diameter / length,
// it decides which labels win when they collide and how large they are drawn.

export type FeatureKind = 'mare' | 'basin' | 'crater' | 'mountain' | 'valley' | 'dome';

export interface MoonFeature {
  name: string;
  kind: FeatureKind;
  lat: number;
  lon: number;
  km: number;
}

export const KIND_LABEL: Record<FeatureKind, string> = {
  mare: 'Mare (Lavaebene)',
  basin: 'Einschlagbecken',
  crater: 'Krater',
  mountain: 'Gebirge',
  valley: 'Tal / Rille',
  dome: 'Berg',
};

const f = (name: string, kind: FeatureKind, lat: number, lon: number, km: number): MoonFeature => ({ name, kind, lat, lon, km });

export const MOON_FEATURES: MoonFeature[] = [
  // maria
  f('Oceanus Procellarum', 'mare', 18.4, -57.4, 2568),
  f('Mare Frigoris', 'mare', 56.0, 1.4, 1596),
  f('Mare Imbrium', 'mare', 32.8, -15.6, 1123),
  f('Mare Fecunditatis', 'mare', -7.8, 51.3, 909),
  f('Mare Tranquillitatis', 'mare', 8.5, 31.4, 873),
  f('Mare Nubium', 'mare', -21.3, -16.6, 715),
  f('Mare Serenitatis', 'mare', 28.0, 17.5, 707),
  f('Mare Australe', 'mare', -38.9, 93.0, 603),
  f('Mare Crisium', 'mare', 17.0, 59.1, 555),
  f('Mare Insularum', 'mare', 7.5, -30.9, 513),
  f('Mare Humorum', 'mare', -24.4, -38.6, 389),
  f('Mare Cognitum', 'mare', -10.0, -23.1, 376),
  f('Mare Smythii', 'mare', 1.3, 87.5, 373),
  f('Mare Marginis', 'mare', 13.3, 86.1, 358),
  f('Mare Nectaris', 'mare', -15.2, 35.5, 333),
  f('Mare Ingenii', 'mare', -33.7, 163.5, 318),
  f('Mare Moscoviense', 'mare', 27.3, 147.9, 277),
  f('Mare Humboldtianum', 'mare', 56.8, 81.5, 273),
  f('Mare Vaporum', 'mare', 13.3, 3.6, 245),
  f('Sinus Iridum', 'mare', 44.1, -31.5, 236),
  // basins
  f('Südpol-Aitken-Becken', 'basin', -53.0, -169.0, 2500),
  f('Orientale-Becken', 'basin', -19.4, -92.8, 937),
  f('Apollo-Becken', 'basin', -36.1, -151.8, 492),
  f('Hertzsprung', 'basin', 1.3, -128.7, 591),
  f('Korolev', 'basin', 4.0, -157.4, 417),
  // craters
  f('Bailly', 'crater', -66.5, -69.1, 303),
  f('Schickard', 'crater', -44.0, -54.0, 227),
  f('Clavius', 'crater', -58.8, -14.4, 225),
  f('Maginus', 'crater', -50.5, -6.3, 194),
  f('Schrödinger', 'crater', -75.0, 132.4, 312),
  f('Tsiolkovskiy', 'crater', -20.4, 129.1, 185),
  f('Von Kármán', 'crater', -44.8, 175.9, 180),
  f('Petavius', 'crater', -25.3, 60.4, 177),
  f('Grimaldi', 'crater', -5.2, -68.6, 172),
  f('Ptolemaeus', 'crater', -9.3, -1.9, 153),
  f('Hipparchus', 'crater', -5.1, 5.2, 150),
  f('Longomontanus', 'crater', -49.6, -21.8, 145),
  f('Albategnius', 'crater', -11.2, 4.1, 136),
  f('Langrenus', 'crater', -8.9, 61.1, 132),
  f('Alphonsus', 'crater', -13.4, -3.2, 119),
  f('Gassendi', 'crater', -17.5, -39.9, 110),
  f('Plato', 'crater', 51.6, -9.3, 101),
  f('Cabeus', 'crater', -84.9, -35.5, 98),
  f('Arzachel', 'crater', -18.2, -1.9, 97),
  f('Copernicus', 'crater', 9.6, -20.1, 96),
  f('Posidonius', 'crater', 31.9, 29.9, 95),
  f('Fra Mauro', 'crater', -6.0, -17.0, 95),
  f('Theophilus', 'crater', -11.4, 26.4, 100),
  f('Aristoteles', 'crater', 50.2, 17.4, 87),
  f('Tycho', 'crater', -43.3, -11.4, 85),
  f('Archimedes', 'crater', 29.7, -4.0, 83),
  f('Eratosthenes', 'crater', 14.5, -11.3, 58),
  f('Taruntius', 'crater', 5.6, 46.5, 56),
  f('Descartes', 'crater', -11.7, 15.7, 48),
  f('Aristarchus', 'crater', 23.7, -47.4, 40),
  f('Kepler', 'crater', 8.1, -38.0, 32),
  f('Shackleton', 'crater', -89.7, 129.8, 21),
  // mountains
  f('Montes Apenninus', 'mountain', 18.9, -3.7, 600),
  f('Montes Caucasus', 'mountain', 38.4, 10.0, 445),
  f('Montes Alpes', 'mountain', 48.4, -0.7, 334),
  f('Montes Carpatus', 'mountain', 14.4, -24.4, 361),
  f('Montes Taurus', 'mountain', 28.0, 41.0, 180),
  f('Montes Pyrenaeus', 'mountain', -15.6, 41.1, 164),
  f('Montes Jura', 'mountain', 47.0, -34.0, 422),
  f('Montes Rook', 'mountain', -20.6, -82.5, 791),
  // valleys & others
  f('Vallis Alpes', 'valley', 49.2, 3.6, 166),
  f('Rupes Recta (Gerade Wand)', 'valley', -22.0, -7.8, 110),
  f('Vallis Schröteri', 'valley', 26.2, -50.8, 160),
  f('Rima Hadley', 'valley', 25.0, 3.0, 80),
  f('Mons Rümker', 'dome', 40.8, -58.1, 70),
  f('Mons Hadley', 'dome', 26.7, 4.7, 25),
  f('Mons Piton', 'dome', 40.8, -0.8, 25),
];
