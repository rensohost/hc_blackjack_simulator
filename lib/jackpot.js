/* Gedeelde jackpot in de browser.
   - Live: de stand komt van /api/jackpot (Redis). Elke 20 seconden, zolang het tabblad zichtbaar is,
     halen we de stand op (via de cache van Vercel). De eigen jackpotinzetten gaan gebundeld mee, hooguit eens per minuut,
     en meteen als het tabblad sluit of een jackpot valt. Eigen inzetten tellen direct mee op het scherm.
   - Lokaal: zonder database (of als de server niet bereikbaar is) groeit een eigen stand in deze browser. */
import { JP_KEYS, JP_START_CENTS, JP_FEED_CENTS } from './jackpot-config';

const LKEY = 'bj-oefentafel-jp-lokaal';
const POLL_MS = 20000;   // stand ophalen (komt meestal uit de cache, kost de database niets)
const FLUSH_MS = 60000;  // eigen inzetten versturen: hooguit eens per minuut, één databaseopdracht
const MAX_FEED = 60;
const r2 = (n) => Math.round(n * 100) / 100;
const euros = (c) => c / 100;

export function createJackpot(onChange) {
  const start = Object.fromEntries(JP_KEYS.map((k) => [k, euros(JP_START_CENTS[k])]));
  let mode = 'connecting';
  let srv = null;       // laatste stand van de server: { n, off: {mega, major, minor}, t }
  let pending = 0;      // eigen jackpotinzetten die nog verstuurd moeten worden
  let sending = 0;      // eigen jackpotinzetten die nu onderweg zijn
  let local = { ...start };
  try {
    const s = JSON.parse(localStorage.getItem(LKEY) || 'null');
    if (s) for (const k of JP_KEYS) if (typeof s[k] === 'number') local[k] = s[k];
  } catch (e) { /* geen opslag */ }
  const saveLocal = () => { try { localStorage.setItem(LKEY, JSON.stringify(local)); } catch (e) { /* geen opslag */ } };

  let timer = null, stopped = false, noServer = false;
  const changed = () => { if (!stopped) onChange(); };

  async function api(method, body, keepalive = false) {
    const res = await fetch('/api/jackpot', {
      method,
      keepalive,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { const err = new Error(data.error || 'status ' + res.status); err.status = res.status; throw err; }
    return data;
  }

  /* Een antwoord van de server overnemen, tenzij we al een nieuwere stand hebben (de cache kan iets achterlopen). */
  function take(d) {
    if (typeof d.n !== 'number' || !d.off) return;
    if (srv && d.t < srv.t) return;
    srv = { n: d.n, off: { ...d.off }, t: d.t };
  }

  function liveValue(k) {
    if (!srv) return start[k];
    return euros(JP_START_CENTS[k] + Math.max(0, srv.n + pending + sending - srv.off[k]) * JP_FEED_CENTS[k]);
  }

  /* Naar de lokale stand: eigen inzetten die nog niet verstuurd waren tellen daar mee */
  function goLocal() {
    mode = 'local';
    if (pending) {
      for (const k of JP_KEYS) local[k] = r2(local[k] + euros(JP_FEED_CENTS[k]) * pending);
      pending = 0; saveLocal();
    }
  }

  async function refresh() {
    try {
      take(await api('GET'));
      mode = 'live';
    } catch (e) {
      if (mode !== 'live') goLocal(); // eenmaal live blijft de laatste stand staan bij een korte storing
      if (e.message === 'not_configured') { noServer = true; clearInterval(timer); } // geen database gekoppeld: niet blijven vragen
    }
    changed();
  }

  let lastFlush = Date.now();
  async function flush(keepalive = false) {
    if (mode !== 'live' || !pending) return;
    lastFlush = Date.now();
    const count = Math.min(pending, MAX_FEED);
    pending -= count; sending += count;
    try {
      const d = await api('POST', { action: 'feed', count }, keepalive);
      sending -= count;
      if (srv && typeof d.n === 'number' && d.t >= srv.t) { srv.n = d.n; srv.t = d.t; }
    } catch (e) {
      sending -= count; pending += count; // later opnieuw
    }
    changed();
  }

  function tick() {
    if (noServer || document.visibilityState !== 'visible') return;
    refresh();
    if (Date.now() - lastFlush >= FLUSH_MS - 1000 || pending >= MAX_FEED / 2) flush();
  }
  const onVisibility = () => {
    if (document.visibilityState === 'visible') tick();
    else flush(true); // tabblad weg: eigen inzetten nog even versturen
  };
  const onPageHide = () => flush(true);

  return {
    mode: () => mode,
    value: (k) => (mode === 'local' ? local[k] : liveValue(k)),

    start() {
      refresh();
      timer = setInterval(tick, POLL_MS);
      document.addEventListener('visibilitychange', onVisibility);
      window.addEventListener('pagehide', onPageHide);
    },
    stop() {
      stopped = true;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onPageHide);
    },

    /* n jackpotinzetten in deze ronde */
    feed(n) {
      if (mode === 'local') {
        for (const k of JP_KEYS) local[k] = r2(local[k] + euros(JP_FEED_CENTS[k]) * n);
        saveLocal();
      } else {
        pending += n; // gaat mee met de volgende verzending
      }
      changed();
    },

    /* jackpot gevallen: geeft het gewonnen bedrag in euro's */
    async hit(k, cards) {
      if (mode === 'local') {
        const won = local[k];
        local[k] = start[k]; saveLocal(); changed();
        return won;
      }
      const extra = Math.min(pending, MAX_FEED); // eigen inzetten gaan mee, zodat ze in de prijs zitten
      pending -= extra; sending += extra;
      try {
        const d = await api('POST', { action: 'hit', level: k, cards, feed: extra });
        sending -= extra;
        if (srv) { srv.n = d.n; srv.off[k] = d.n; srv.t = Math.max(srv.t, d.t); }
        changed();
        return euros(d.won);
      } catch (e) {
        // Server weigert of is onbereikbaar: de speler krijgt het bedrag dat op de meter stond.
        sending -= extra; pending += extra;
        const won = liveValue(k);
        changed();
        return won;
      }
    },
  };
}
