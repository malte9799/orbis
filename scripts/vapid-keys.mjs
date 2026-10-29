// Creates a VAPID key pair for proxy/fahrplan-push-worker.js:  node scripts/vapid-keys.mjs
// Public key → worker secret VAPID_PUBLIC, private key (JSON) → worker secret VAPID_PRIVATE.
import { webcrypto as crypto } from 'node:crypto';

const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
const jwk = await crypto.subtle.exportKey('jwk', pair.privateKey);
const b64u = (s) => Buffer.from(s, 'base64url');
const pub = Buffer.concat([Buffer.from([4]), b64u(jwk.x), b64u(jwk.y)]).toString('base64url');

console.log('VAPID_PUBLIC  (Secret):\n' + pub + '\n');
console.log('VAPID_PRIVATE (Secret):\n' + JSON.stringify({ kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y, d: jwk.d }) + '\n');
console.log('Der private Schlüssel gehört nur in den Worker (Secret), nirgends sonst hin.');
