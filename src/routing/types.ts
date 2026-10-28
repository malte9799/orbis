import type { ApiKeys } from '../store';

/** [lon, lat] */
export type LngLat = [number, number];

export type Profile = 'car' | 'bike' | 'foot';

export const PROFILES: { id: Profile; label: string; icon: string }[] = [
  { id: 'car', label: 'Auto', icon: '🚗' },
  { id: 'bike', label: 'Fahrrad', icon: '🚲' },
  { id: 'foot', label: 'Zu Fuß', icon: '🚶' },
];

/** manoeuvre kinds the navigation knows (providers map their own vocabulary onto these) */
export type Maneuver =
  | 'depart'
  | 'straight'
  | 'slight-left'
  | 'left'
  | 'sharp-left'
  | 'slight-right'
  | 'right'
  | 'sharp-right'
  | 'uturn'
  | 'roundabout'
  | 'merge'
  | 'fork-left'
  | 'fork-right'
  | 'ramp-left'
  | 'ramp-right'
  | 'ferry'
  | 'arrive';

export interface RouteStep {
  maneuver: Maneuver;
  /** instruction in German ("Links abbiegen auf Hauptstraße") */
  text: string;
  /** street name after the manoeuvre, may be empty */
  name: string;
  /** length of this step in m (from the manoeuvre to the next one) */
  distance: number;
  /** seconds */
  duration: number;
  /** where the manoeuvre happens */
  at: LngLat;
  /** roundabout exit number, if known */
  exit?: number;
}

export interface Route {
  provider: string;
  profile: Profile;
  geometry: LngLat[];
  /** m */
  distance: number;
  /** s, with traffic if the provider knows it */
  duration: number;
  steps: RouteStep[];
  /** short description of the alternative ("über A 7") when the provider gives one */
  summary?: string;
}

export interface RouteRequest {
  /** start, via points, destination */
  points: LngLat[];
  profile: Profile;
  alternatives: boolean;
  /** heading in degrees the traveller currently faces (lets a provider avoid a U-turn when rerouting) */
  bearing?: number;
}

export interface RoutingProvider {
  /** file name = id */
  id: string;
  order: number;
  label: string;
  /** short hint shown below the chooser */
  note: string;
  /** needs an API key from the settings (store key name); undefined = free, no key */
  key?: string;
  profiles: Profile[];
  /** needs a key the user has not entered yet */
  available(keys: ApiKeys): boolean;
  route(req: RouteRequest, keys: ApiKeys): Promise<Route[]>;
}

export const defineProvider = (p: RoutingProvider): RoutingProvider => p;
