/* Gedeelde jackpotstand, opgeslagen in Upstash Redis.
   Per meter bewaren we alleen de groei boven het startbedrag, in centen:
   - feed: INCRBY (atomair, dus gelijktijdige spelers tellen allemaal mee)
   - hit:  GETDEL (atomair, dus maar één winnaar per val; de meter begint weer bij het startbedrag)
   Zonder database-instellingen antwoordt deze route met 503 en speelt de site met een lokale jackpot. */
import { Redis } from '@upstash/redis';
import BJ from '../../../lib/engine';
import { JP_KEYS, JP_START_CENTS, JP_FEED_CENTS } from '../../../lib/jackpot-config';

export const dynamic = 'force-dynamic';

const key = (k) => `bj:jackpot:${k}:groei`;
const noStore = { 'Cache-Control': 'no-store' };

let redis = null;
function client() {
  if (redis) return redis;
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  redis = new Redis({ url, token });
  return redis;
}

const toValues = (growth) => Object.fromEntries(JP_KEYS.map((k, i) => [k, JP_START_CENTS[k] + (Number(growth[i]) || 0)]));

async function readValues(db) {
  return toValues(await db.mget(...JP_KEYS.map(key)));
}

const fail = (error, status) => Response.json({ error }, { status, headers: noStore });

export async function GET() {
  const db = client();
  if (!db) return fail('not_configured', 503);
  try {
    return Response.json({ values: await readValues(db) }, { headers: noStore });
  } catch (e) {
    return fail('unavailable', 503);
  }
}

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

  try {
    if (body.action === 'feed') {
      const n = Math.min(3, Math.max(1, Math.floor(Number(body.count)) || 1)); // max 3 boxen per ronde
      const p = db.pipeline();
      for (const k of JP_KEYS) p.incrby(key(k), JP_FEED_CENTS[k] * n);
      const growth = await p.exec();
      return Response.json({ values: toValues(growth) }, { headers: noStore });
    }

    if (body.action === 'hit') {
      const level = body.level;
      const cards = Array.isArray(body.cards) ? body.cards.map(parseCard) : [];
      if (!JP_KEYS.includes(level) || cards.length !== 3 || cards.some((c) => !c)) return fail('bad_request', 400);
      const res = BJ.queens(cards[0], cards[1], cards[2]);
      if (!res || res.jackpot !== level) return fail('no_jackpot', 400); // de kaarten moeten deze jackpot echt vormen
      const old = await db.getdel(key(level));
      const won = JP_START_CENTS[level] + (Number(old) || 0);
      return Response.json({ won, values: await readValues(db) }, { headers: noStore });
    }
  } catch (e) {
    return fail('unavailable', 503);
  }
  return fail('bad_request', 400);
}
