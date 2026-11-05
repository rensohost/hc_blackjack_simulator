/* Gedeelde jackpotstand, opgeslagen in Upstash Redis. Zuinig met aanvragen en beschermd tegen misbruik.

   Alles staat in één hash:
   - n:                 het totale aantal jackpotinzetten ooit
   - mega/major/minor:  de waarde van n toen die jackpot voor het laatst viel
   Stand van een meter = startbedrag + (n - laatste val) × bijdrage per inzet (zie jackpot-config.js).
   Zo kost een inzet één opdracht (HINCRBY) en het ophalen ook één (HGETALL).

   - GET:  de stand. Vercel bewaart het antwoord 20 seconden in zijn cache, dus hoeveel spelers er ook kijken,
           de database wordt hooguit ongeveer drie keer per minuut gevraagd.
   - feed: jackpotinzetten; de browser bundelt ze en stuurt ze hooguit eens per minuut.
   - hit:  een jackpot valt. De kaarten moeten die jackpot echt vormen, en per bezoeker kan er hooguit
           één jackpot per 12 uur vallen, zodat niemand de meters met nepverzoeken kan leegtrekken.
   Testversies (preview) gebruiken een eigen hash, zodat testrondes de live jackpot niet raken.
   Zonder database-instellingen antwoordt deze route met 503 en speelt de site met een lokale jackpot. */
import { Redis } from '@upstash/redis';
import BJ from '../../../lib/engine';
import { JP_KEYS, JP_START_CENTS, JP_FEED_CENTS } from '../../../lib/jackpot-config';

export const dynamic = 'force-dynamic';

const HASH = process.env.VERCEL_ENV === 'production' ? 'bj:jp' : 'bj:jp:test';
const MAX_FEED = 60;              // jackpotinzetten per verzoek
const FEED_PER_MIN = 120;         // per bezoeker per minuut (ruim boven wat een speler haalt)
const HIT_LOCK_S = 12 * 60 * 60;  // per bezoeker hooguit één jackpotval per 12 uur
const CACHE = 'public, max-age=0, s-maxage=20, stale-while-revalidate=40';
const noStore = { 'Cache-Control': 'no-store' };

let redis = null, salt = '';
function client() {
  if (redis) return redis;
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  redis = new Redis({ url, token });
  salt = token;
  return redis;
}

const fail = (error, status) => Response.json({ error }, { status, headers: noStore });

function snapshot(h) {
  const n = Number(h && h.n) || 0;
  const off = Object.fromEntries(JP_KEYS.map((k) => [k, Number(h && h[k]) || 0]));
  const values = Object.fromEntries(JP_KEYS.map((k) => [k, JP_START_CENTS[k] + Math.max(0, n - off[k]) * JP_FEED_CENTS[k]]));
  return { n, off, values, t: Date.now() };
}

export async function GET() {
  const db = client();
  if (!db) return fail('not_configured', 503);
  try {
    return Response.json(snapshot(await db.hgetall(HASH)), { headers: { 'Cache-Control': CACHE } });
  } catch (e) {
    return fail('unavailable', 503);
  }
}

/* Bezoeker herkennen aan een korte hash van het IP-adres (het adres zelf bewaren we niet). */
async function visitorId(request) {
  const ip = (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() || request.headers.get('x-real-ip') || 'onbekend';
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(salt + '|' + ip));
  return Array.from(new Uint8Array(digest).slice(0, 12), (b) => b.toString(16).padStart(2, '0')).join('');
}

/* Inzetten per bezoeker per minuut, bijgehouden in het geheugen van de server (geen extra databaseverkeer).
   Niet waterdicht over meerdere serverinstanties, wel genoeg om een simpel script af te remmen. */
const feedLog = new Map();
function allowFeed(id, want) {
  const now = Date.now();
  let e = feedLog.get(id);
  if (!e || now - e.t > 60000) {
    if (feedLog.size > 5000) feedLog.clear();
    e = { t: now, n: 0 };
    feedLog.set(id, e);
  }
  const ok = Math.max(0, Math.min(want, FEED_PER_MIN - e.n));
  e.n += ok;
  return ok;
}

/* Jackpotval in één atomaire stap: slot per bezoeker, eventuele eigen inzetten bijtellen, meter terugzetten. */
const HIT_SCRIPT = `
if redis.call('SET', KEYS[2], '1', 'NX', 'EX', ARGV[3]) == false then return false end
local n = redis.call('HINCRBY', KEYS[1], 'n', ARGV[2])
local off = tonumber(redis.call('HGET', KEYS[1], ARGV[1]) or '0')
redis.call('HSET', KEYS[1], ARGV[1], n)
return {n, off}`;

/* Kaarten komen binnen als korte codes, bijv. "Q♦". */
const SUITS = ['♠', '♥', '♦', '♣'];
function parseCard(code) {
  if (typeof code !== 'string' || code.length < 2 || code.length > 3) return null;
  const r = code.slice(0, -1), s = code.slice(-1);
  if (!BJ.RANKS.includes(r) || !SUITS.includes(s)) return null;
  return { r, s, id: 0 };
}

export async function POST(request) {
  const db = client();
  if (!db) return fail('not_configured', 503);
  let body;
  try { body = await request.json(); } catch (e) { return fail('bad_request', 400); }
  if (!body || typeof body !== 'object') return fail('bad_request', 400);
  const want = Math.min(MAX_FEED, Math.max(0, Math.floor(Number(body.action === 'hit' ? body.feed : body.count)) || 0));

  try {
    const id = await visitorId(request);

    if (body.action === 'feed') {
      const ok = allowFeed(id, want);
      const n = ok ? await db.hincrby(HASH, 'n', ok) : null;
      return Response.json({ n, accepted: ok, t: Date.now() }, { headers: noStore });
    }

    if (body.action === 'hit') {
      const level = body.level;
      const cards = Array.isArray(body.cards) ? body.cards.map(parseCard) : [];
      if (!JP_KEYS.includes(level) || cards.length !== 3 || cards.some((c) => !c)) return fail('bad_request', 400);
      const res = BJ.queens(cards[0], cards[1], cards[2]);
      if (!res || res.jackpot !== level) return fail('no_jackpot', 400); // de kaarten moeten deze jackpot echt vormen
      const ok = allowFeed(id, want);
      const out = await db.eval(HIT_SCRIPT, [HASH, `${HASH}:val:${id}`], [level, String(ok), String(HIT_LOCK_S)]);
      if (!out) return fail('locked', 429);
      const [n, off] = out.map(Number);
      const won = JP_START_CENTS[level] + Math.max(0, n - off) * JP_FEED_CENTS[level];
      return Response.json({ won, level, n, t: Date.now() }, { headers: noStore });
    }
  } catch (e) {
    return fail('unavailable', 503);
  }
  return fail('bad_request', 400);
}
