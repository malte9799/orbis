// Cities for the street game's "nur Städte" mode: [name, lng, lat, continent (as in countries.json), spread in degrees].
// A round picks a random city of the chosen area and a random point around its centre, so the photo is urban.
export type City = [name: string, lng: number, lat: number, cont: string, spread?: number];

export const CITIES: City[] = [
  // Europe
  ['Berlin', 13.405, 52.52, 'Europe', 0.1], ['Hamburg', 9.99, 53.55, 'Europe'], ['München', 11.575, 48.137, 'Europe'], ['Köln', 6.96, 50.94, 'Europe'],
  ['Frankfurt', 8.68, 50.11, 'Europe'], ['Wien', 16.37, 48.21, 'Europe'], ['Zürich', 8.54, 47.37, 'Europe'], ['Paris', 2.35, 48.86, 'Europe', 0.1],
  ['Lyon', 4.835, 45.76, 'Europe'], ['Marseille', 5.37, 43.3, 'Europe'], ['London', -0.12, 51.51, 'Europe', 0.12], ['Manchester', -2.24, 53.48, 'Europe'],
  ['Edinburgh', -3.19, 55.95, 'Europe'], ['Dublin', -6.26, 53.35, 'Europe'], ['Amsterdam', 4.9, 52.37, 'Europe'], ['Brüssel', 4.35, 50.85, 'Europe'],
  ['Kopenhagen', 12.57, 55.68, 'Europe'], ['Stockholm', 18.07, 59.33, 'Europe'], ['Oslo', 10.75, 59.91, 'Europe'], ['Helsinki', 24.94, 60.17, 'Europe'],
  ['Madrid', -3.7, 40.42, 'Europe', 0.1], ['Barcelona', 2.17, 41.39, 'Europe'], ['Lissabon', -9.14, 38.72, 'Europe'], ['Porto', -8.61, 41.15, 'Europe'],
  ['Rom', 12.5, 41.9, 'Europe', 0.1], ['Mailand', 9.19, 45.46, 'Europe'], ['Neapel', 14.27, 40.85, 'Europe'], ['Athen', 23.73, 37.98, 'Europe'],
  ['Prag', 14.42, 50.08, 'Europe'], ['Warschau', 21.01, 52.23, 'Europe'], ['Krakau', 19.94, 50.06, 'Europe'], ['Budapest', 19.04, 47.5, 'Europe'],
  ['Bukarest', 26.1, 44.43, 'Europe'], ['Sofia', 23.32, 42.7, 'Europe'], ['Belgrad', 20.46, 44.79, 'Europe'], ['Zagreb', 15.98, 45.81, 'Europe'],
  ['Kiew', 30.52, 50.45, 'Europe'], ['Riga', 24.1, 56.95, 'Europe'], ['Vilnius', 25.28, 54.69, 'Europe'], ['Tallinn', 24.75, 59.44, 'Europe'],
  ['Moskau', 37.62, 55.75, 'Europe', 0.12], ['Sankt Petersburg', 30.32, 59.93, 'Europe'], ['Istanbul', 28.98, 41.01, 'Europe', 0.12],
  // Asia
  ['Tokio', 139.69, 35.69, 'Asia', 0.12], ['Osaka', 135.5, 34.69, 'Asia'], ['Kyoto', 135.77, 35.01, 'Asia'], ['Seoul', 126.98, 37.57, 'Asia', 0.1],
  ['Peking', 116.4, 39.9, 'Asia', 0.1], ['Shanghai', 121.47, 31.23, 'Asia', 0.1], ['Hongkong', 114.17, 22.32, 'Asia'], ['Taipeh', 121.56, 25.04, 'Asia'],
  ['Bangkok', 100.5, 13.75, 'Asia', 0.1], ['Hanoi', 105.85, 21.03, 'Asia'], ['Ho-Chi-Minh-Stadt', 106.7, 10.78, 'Asia'], ['Singapur', 103.82, 1.35, 'Asia'],
  ['Kuala Lumpur', 101.69, 3.14, 'Asia'], ['Jakarta', 106.85, -6.2, 'Asia', 0.1], ['Manila', 120.98, 14.6, 'Asia', 0.1], ['Delhi', 77.21, 28.61, 'Asia', 0.1],
  ['Mumbai', 72.88, 19.08, 'Asia', 0.1], ['Bengaluru', 77.59, 12.97, 'Asia'], ['Dhaka', 90.41, 23.81, 'Asia'], ['Karatschi', 67.01, 24.86, 'Asia'],
  ['Teheran', 51.39, 35.69, 'Asia'], ['Dubai', 55.27, 25.2, 'Asia'], ['Tel Aviv', 34.78, 32.09, 'Asia'], ['Tiflis', 44.79, 41.72, 'Asia'],
  ['Almaty', 76.95, 43.24, 'Asia'], ['Ulaanbaatar', 106.92, 47.92, 'Asia'],
  // Africa
  ['Kairo', 31.24, 30.04, 'Africa', 0.1], ['Casablanca', -7.59, 33.57, 'Africa'], ['Tunis', 10.18, 36.81, 'Africa'], ['Lagos', 3.38, 6.52, 'Africa', 0.1],
  ['Accra', -0.19, 5.6, 'Africa'], ['Dakar', -17.47, 14.69, 'Africa'], ['Nairobi', 36.82, -1.29, 'Africa'], ['Addis Abeba', 38.75, 9.03, 'Africa'],
  ['Daressalam', 39.27, -6.79, 'Africa'], ['Kampala', 32.58, 0.35, 'Africa'], ['Kinshasa', 15.31, -4.32, 'Africa'], ['Johannesburg', 28.05, -26.2, 'Africa'],
  ['Kapstadt', 18.42, -33.92, 'Africa'], ['Durban', 31.02, -29.86, 'Africa'],
  // North America
  ['New York', -74.0, 40.71, 'North America', 0.1], ['Los Angeles', -118.24, 34.05, 'North America', 0.1], ['San Francisco', -122.42, 37.77, 'North America'],
  ['Chicago', -87.63, 41.88, 'North America'], ['Boston', -71.06, 42.36, 'North America'], ['Washington', -77.04, 38.91, 'North America'],
  ['Miami', -80.19, 25.76, 'North America'], ['Seattle', -122.33, 47.61, 'North America'], ['Houston', -95.37, 29.76, 'North America'],
  ['Denver', -104.99, 39.74, 'North America'], ['Toronto', -79.38, 43.65, 'North America'], ['Montreal', -73.57, 45.5, 'North America'],
  ['Vancouver', -123.12, 49.28, 'North America'], ['Mexiko-Stadt', -99.13, 19.43, 'North America', 0.1], ['Guadalajara', -103.35, 20.66, 'North America'],
  ['Havanna', -82.37, 23.13, 'North America'], ['Panama-Stadt', -79.52, 8.98, 'North America'], ['San José', -84.08, 9.93, 'North America'],
  // South America
  ['São Paulo', -46.63, -23.55, 'South America', 0.1], ['Rio de Janeiro', -43.17, -22.91, 'South America'], ['Brasília', -47.88, -15.79, 'South America'],
  ['Buenos Aires', -58.38, -34.6, 'South America', 0.1], ['Santiago', -70.65, -33.45, 'South America'], ['Lima', -77.04, -12.05, 'South America'],
  ['Bogotá', -74.07, 4.71, 'South America'], ['Medellín', -75.57, 6.25, 'South America'], ['Quito', -78.47, -0.18, 'South America'],
  ['Montevideo', -56.19, -34.9, 'South America'], ['La Paz', -68.12, -16.5, 'South America'],
  // Oceania
  ['Sydney', 151.21, -33.87, 'Oceania', 0.1], ['Melbourne', 144.96, -37.81, 'Oceania'], ['Brisbane', 153.03, -27.47, 'Oceania'], ['Perth', 115.86, -31.95, 'Oceania'],
  ['Auckland', 174.76, -36.85, 'Oceania'], ['Wellington', 174.78, -41.29, 'Oceania'],
];

/** random point near a random city's centre (uniform in a disc, longitude scaled so the disc is round) */
export function randomCityPoint(cities: City[]): { pt: [number, number]; name: string } {
  const [name, lng, lat, , spread = 0.06] = cities[Math.floor(Math.random() * cities.length)];
  const r = spread * Math.sqrt(Math.random());
  const a = Math.random() * 2 * Math.PI;
  return { pt: [lng + (r * Math.cos(a)) / Math.cos((lat * Math.PI) / 180), lat + r * Math.sin(a)], name };
}
