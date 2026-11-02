import type { GeoFocus } from './focus';
import type { GeoStage, GeoTarget } from './stage';

// The followed object in the address, so a view can be shared and survives a reload:
//   #/karte?follow=sat/iss&follow.t=1730000000
// "sat" and "iss" come from the source, and so do the follow.* values (GeoTarget.params).

const KEY = 'follow';
const PREFIX = `${KEY}.`;
/** only this view has a followed object */
const ROUTE = '/karte';

export interface Follow {
  source: string;
  slug: string;
  params: Record<string, string>;
}

const split = (hash: string): [string, URLSearchParams] => {
  const [path, query = ''] = hash.replace(/^#/, '').split('?');
  return [path, new URLSearchParams(query)];
};

export function readFollow(hash: string): Follow | null {
  const [path, q] = split(hash);
  const value = q.get(KEY);
  if (!path.startsWith(ROUTE) || !value) return null;
  const cut = value.indexOf('/');
  if (cut <= 0 || cut === value.length - 1) return null;
  const params: Record<string, string> = {};
  for (const [k, v] of q) if (k.startsWith(PREFIX)) params[k.slice(PREFIX.length)] = v;
  return { source: value.slice(0, cut), slug: value.slice(cut + 1), params };
}

/** The hash with this followed object (null: none); everything else in it stays. Other views keep theirs as it is. */
export function writeFollow(hash: string, follow: Follow | null): string {
  const [path, q] = split(hash);
  if (!path.startsWith(ROUTE)) return hash;
  for (const k of [...q.keys()]) if (k === KEY || k.startsWith(PREFIX)) q.delete(k);
  if (follow) {
    q.set(KEY, `${follow.source}/${follow.slug}`);
    for (const [k, v] of Object.entries(follow.params)) q.set(`${PREFIX}${k}`, v);
  }
  const query = q.toString().replace(/%2F/g, '/');
  return `#${path}${query ? `?${query}` : ''}`;
}

const followOf = (t: GeoTarget): Follow => ({ source: t.source, slug: t.slug, params: t.params?.() ?? {} });
const same = (a: Follow, b: Follow) => writeFollow(`#${ROUTE}`, a) === writeFollow(`#${ROUTE}`, b);

/** Keeps the address and the focus in step, and starts following what the address says. */
export function bindFollowUrl(focus: GeoFocus, stage: GeoStage) {
  const write = (follow: Follow | null) => {
    const hash = writeFollow(location.hash, follow);
    // no new history entry and no hashchange: the camera does not fly back with the browser's back button
    if (hash !== location.hash) history.replaceState(null, '', `${location.pathname}${location.search}${hash}`);
  };
  focus.onChange = (t) => write(t && followOf(t));
  let asked = 0;
  const apply = () => {
    const wanted = readFollow(location.hash);
    const ask = ++asked;
    if (!wanted) {
      focus.stop();
      return;
    }
    if (focus.target && same(followOf(focus.target), wanted)) return;
    // layers start later than the address is read; stage.onSource comes back here
    if (!stage.hasSource(wanted.source)) return;
    // a source may have to load its object first
    void Promise.resolve(stage.resolve(wanted.source, wanted.slug, wanted.params)).then((t) => {
      if (ask !== asked) return;
      if (t) focus.start(t);
      else write(null);
    });
  };
  stage.onSource = apply;
  window.addEventListener('hashchange', apply);
  apply();
}
