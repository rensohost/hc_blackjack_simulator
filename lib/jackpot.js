/* Gedeelde jackpot in de browser.
   - Live: de stand komt van /api/jackpot (Redis) en wordt elke 15 seconden ververst zolang het tabblad zichtbaar is.
   - Lokaal: zonder database (of als de server niet bereikbaar is) groeit een eigen stand in deze browser. */
import { JP_KEYS, JP_START_CENTS, JP_FEED_CENTS } from './jackpot-config';

const LKEY = 'bj-oefentafel-jp-lokaal';
const POLL_MS = 15000;
const r2 = (n) => Math.round(n * 100) / 100;
const euros = (c) => c / 100;

export function createJackpot(onChange) {
  const start = Object.fromEntries(JP_KEYS.map((k) => [k, euros(JP_START_CENTS[k])]));
  let mode = 'connecting';
  let live = { ...start };
  let local = { ...start };
  try {
    const s = JSON.parse(localStorage.getItem(LKEY) || 'null');
    if (s) for (const k of JP_KEYS) if (typeof s[k] === 'number') local[k] = s[k];
  } catch (e) { /* geen opslag */ }
  const saveLocal = () => { try { localStorage.setItem(LKEY, JSON.stringify(local)); } catch (e) { /* geen opslag */ } };

  let timer = null, stopped = false;

  async function api(method, body) {
    const res = await fetch('/api/jackpot', {
      method,
      cache: 'no-store',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) throw new Error('status ' + res.status);
    return res.json();
  }
  const apply = (values) => { for (const k of JP_KEYS) if (typeof values[k] === 'number') live[k] = euros(values[k]); };

  async function refresh() {
    try {
      const d = await api('GET');
      apply(d.values);
      mode = 'live';
    } catch (e) {
      if (mode !== 'live') mode = 'local'; // eenmaal live blijft de laatste stand staan bij een korte storing
    }
    if (!stopped) onChange();
  }

  const onVisible = () => { if (document.visibilityState === 'visible') refresh(); };

  return {
    mode: () => mode,
    value: (k) => (mode === 'live' ? live[k] : local[k]),

    start() {
      refresh();
      timer = setInterval(() => { if (document.visibilityState === 'visible') refresh(); }, POLL_MS);
      document.addEventListener('visibilitychange', onVisible);
    },
    stop() {
      stopped = true;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    },

    /* n jackpotinzetten in deze ronde */
    feed(n) {
      if (mode === 'live') {
        for (const k of JP_KEYS) live[k] = r2(live[k] + euros(JP_FEED_CENTS[k]) * n);
        onChange();
        api('POST', { action: 'feed', count: n }).then((d) => { apply(d.values); onChange(); }).catch(() => {});
      } else {
        for (const k of JP_KEYS) local[k] = r2(local[k] + euros(JP_FEED_CENTS[k]) * n);
        saveLocal(); onChange();
      }
    },

    /* jackpot gevallen: geeft het gewonnen bedrag in euro's */
    async hit(k, cards) {
      if (mode === 'live') {
        try {
          const d = await api('POST', { action: 'hit', level: k, cards });
          apply(d.values); onChange();
          return euros(d.won);
        } catch (e) {
          const won = live[k];
          live[k] = start[k]; onChange();
          return won;
        }
      }
      const won = local[k];
      local[k] = start[k]; saveLocal(); onChange();
      return won;
    },
  };
}
