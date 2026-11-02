/* Spellogica en weergave van de oefentafel. Tekent in de vaste opbouw uit components/Game.jsx.
   startGame() koppelt alles aan de pagina en geeft een opruimfunctie terug. */
import BJ from './engine';
import { createJackpot } from './jackpot';
import { JP_BET } from './jackpot-config';

export function startGame() {
  const listeners = [];
  const on = (type, fn) => { document.addEventListener(type, fn); listeners.push([type, fn]); };
  /* ---------- constanten ---------- */
  const TABLES = { 20: { min: 20, max: 1000 }, 50: { min: 50, max: 2500 }, 100: { min: 100, max: 5000 } };
  const SIDE_STEP = 5, SIDE_MAX = 100;
  const SPEEDS = { normaal: 750, snel: 430, direct: 0 };
  const DEAL_ANIM = { normaal: '.45s', snel: '.3s', direct: '0s' };
  const STORE = 'bj-oefentafel-v1';
  const HIST_MAX = 100;
  const LABEL = { H: 'Kaart', S: 'Pas', D: 'Verdubbelen', P: 'Splitsen', Y: 'Verzekeren', N: 'Niet verzekeren' };
  const DEFAULTS = { table: 20, bankroll: 1000, boxes: 1, pair: true, tripps: true, jackpot: true, coach: 'feedback', speed: 'normaal', totals: false };

  /* ---------- helpers ---------- */
  const $ = (id) => document.getElementById(id);
  const nf0 = new Intl.NumberFormat('nl-NL', { maximumFractionDigits: 0 });
  const nf1 = new Intl.NumberFormat('nl-NL', { maximumFractionDigits: 1 });
  const nf2 = new Intl.NumberFormat('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const r2 = (n) => Math.round(n * 100) / 100;
  function eur(n, sign = false) {
    const v = r2(n), a = Math.abs(v);
    const s = (Number.isInteger(a) ? nf0 : nf2).format(a);
    return (v < 0 ? '−' : sign && v > 0 ? '+' : '') + '€ ' + s;
  }
  const eur2 = (n) => '€ ' + nf2.format(n);
  const chipTxt = (n) => (n >= 1000 ? nf1.format(n / 1000) + 'k' : Number.isInteger(n) ? String(n) : nf2.format(n).replace(/,?0+$/, ''));
  const chipCls = (n) => (n >= 500 ? 'p' : n >= 100 ? 'k' : n >= 25 ? 'g' : n >= 10 ? 'b' : '');
  const chip = (n, extra = '') => `<span class="chip ${chipCls(n)} ${extra}">${chipTxt(n)}</span>`;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const store = {
    get() { try { return JSON.parse(localStorage.getItem(STORE) || 'null'); } catch (e) { return null; } },
    set(v) { try { localStorage.setItem(STORE, JSON.stringify(v)); } catch (e) { /* geen opslag beschikbaar */ } },
  };
  const cc = (c) => c.r + c.s; // kaart als korte code, bijv. "Q♦"
  let fakeId = -1;
  const fromCode = (s) => ({ r: s.slice(0, -1), s: s.slice(-1), id: fakeId-- });

  /* ---------- gedeelde jackpot (zie lib/jackpot.js) ---------- */
  const JP = createJackpot(() => renderJackpots());

  /* ---------- toestand ---------- */
  const freshStats = (bank) => ({ rounds: 0, hands: 0, won: 0, lost: 0, push: 0, bj: 0, sideStake: 0, sideRet: 0, insStake: 0, insRet: 0, bonus777: 0, coachOk: 0, coachAll: 0, best: 0, worst: 0, peak: bank, history: [bank] });
  const emptyBets = (n) => Array.from({ length: n }, () => ({ main: 0, pair: 0, tripps: 0, jp: false }));
  const S = {
    settings: { ...DEFAULTS }, bankroll: 0, startBank: 0, rebuys: 0, phase: 'setup',
    bets: emptyBets(1), lastBets: null, round: null, stats: freshStats(0), hist: [],
    sel: 0, busy: false, hint: null, msg: '', toast: null, sheet: null, confirmReset: false,
    anaTab: 'overzicht', onlyErr: false, rebuyAmt: 1000,
  };
  let saved = store.get();
  if (saved && saved.settings) S.settings = { ...DEFAULTS, ...saved.settings };

  const tbl = () => TABLES[S.settings.table];
  const wait = (f = 1) => new Promise((res) => setTimeout(res, SPEEDS[S.settings.speed] * f));
  const staked = (bets) => bets.reduce((t, b) => t + b.main + b.pair + b.tripps + (b.jp ? JP_BET : 0), 0);
  const between = () => S.phase === 'betting' || S.phase === 'settled';

  function save() {
    if (S.phase === 'setup') return;
    store.set({ settings: S.settings, bankroll: S.bankroll, startBank: S.startBank, rebuys: S.rebuys, stats: S.stats, hist: S.hist, lastBets: S.lastBets, bets: S.bets });
  }
  function saveSettings() {
    if (S.phase !== 'setup') return save();
    const cur = store.get() || {};
    store.set({ ...cur, settings: S.settings });
  }
  let toastTimer = null;
  function toast(text, kind = '') {
    S.toast = { text, kind };
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { S.toast = null; renderToast(); }, kind === 'warn' ? 4200 : 2600);
    renderToast();
  }
  function renderToast() {
    const el = $('toast');
    el.hidden = !S.toast;
    if (!S.toast) return;
    el.className = 'toast ' + S.toast.kind;
    el.textContent = S.toast.text;
  }

  /* ---------- sessie ---------- */
  function startSession(resume) {
    if (resume && saved) {
      S.settings = { ...DEFAULTS, ...saved.settings };
      S.bankroll = saved.bankroll; S.startBank = saved.startBank; S.rebuys = saved.rebuys || 0;
      S.stats = saved.stats || freshStats(saved.bankroll); S.lastBets = saved.lastBets || null;
      S.hist = saved.hist || [];
      S.bets = fitBets(saved.bets || saved.lastBets);
    } else {
      S.startBank = S.bankroll = S.settings.bankroll; S.rebuys = 0;
      S.stats = freshStats(S.bankroll); S.lastBets = null; S.hist = [];
      S.bets = emptyBets(S.settings.boxes);
      if (S.bankroll >= tbl().min) S.bets[0].main = tbl().min;
    }
    S.sel = 0; S.round = null; S.phase = 'betting';
    S.msg = 'Plaats uw inzetten.';
    save(); render();
  }

  /* past inzetten aan op aantal boxen, tafel en saldo; een inzet onder het nieuwe minimum gaat naar het minimum */
  function fitBets(src) {
    const n = S.settings.boxes, t = tbl();
    const out = emptyBets(n);
    if (src) src.slice(0, n).forEach((b, i) => {
      if (!b || !b.main) return;
      const main = Math.min(t.max, Math.max(t.min, Math.round(b.main / t.min) * t.min));
      out[i] = { main, pair: S.settings.pair ? b.pair || 0 : 0, tripps: S.settings.tripps ? b.tripps || 0 : 0, jp: S.settings.jackpot && !!b.jp };
    });
    if (staked(out) > S.bankroll + 1e-9) {
      const o = emptyBets(n);
      if (S.bankroll >= t.min) o[0].main = t.min;
      return o;
    }
    return out;
  }

  function switchTable(v) {
    if (!between() || S.busy || !TABLES[v] || v === S.settings.table) return;
    if (S.bankroll < TABLES[v].min) return toast(`Je hebt minstens ${eur(TABLES[v].min)} nodig voor deze tafel.`);
    S.settings.table = v;
    const base = S.phase === 'betting' ? S.bets : S.lastBets;
    S.round = null; S.phase = 'betting'; S.msg = 'Plaats uw inzetten.';
    S.bets = fitBets(base);
    S.lastBets = staked(S.bets) ? JSON.parse(JSON.stringify(S.bets)) : null;
    save(); closeSheet(); render();
    toast(`Je zit nu aan de ${eur(v)}-tafel. Je saldo van ${eur(S.bankroll)} is meegegaan.`);
  }

  function rebuy(amt) {
    amt = Math.floor(+amt);
    if (!Number.isFinite(amt) || amt < 1) return 'Vul een bedrag van minstens € 1 in.';
    if (amt > 1000000) return 'Je kunt maximaal € 1.000.000 per keer bijkopen.';
    S.bankroll = r2(S.bankroll + amt); S.rebuys += amt; S.rebuyAmt = amt;
    S.stats.history.push(S.bankroll);
    closeSheet();
    if (S.phase === 'settled') newRound(false);
    toast(`${eur(amt)} bijgekocht. Nieuw saldo ${eur(S.bankroll)}.`);
    save(); render();
    return '';
  }

  /* ---------- inzetten ---------- */
  function changeBet(field, dir) {
    const b = S.bets[S.sel], t = tbl();
    if (field === 'main') {
      const next = b.main + dir * t.min;
      if (next < 0 || next > t.max) return;
      if (dir > 0 && staked(S.bets) + t.min > S.bankroll + 1e-9) return toast('Onvoldoende saldo voor een hogere inzet.');
      b.main = next;
      if (b.main === 0) { b.pair = 0; b.tripps = 0; b.jp = false; }
    } else {
      if (!b.main) return toast('Plaats eerst een inzet in deze box. Een sidebet kan alleen naast een gewone inzet.');
      const next = b[field] + dir * SIDE_STEP;
      if (next < 0 || next > SIDE_MAX) return;
      if (dir > 0 && staked(S.bets) + SIDE_STEP > S.bankroll + 1e-9) return toast('Onvoldoende saldo voor deze sidebet.');
      b[field] = next;
    }
    render();
  }
  function toggleJp() {
    const b = S.bets[S.sel];
    if (!b.main) return toast('Plaats eerst een inzet in deze box. Alleen de boxhouder speelt mee voor de jackpot.');
    if (!b.jp && staked(S.bets) + JP_BET > S.bankroll + 1e-9) return toast('Onvoldoende saldo voor de jackpotinzet.');
    b.jp = !b.jp; render();
  }

  /* ---------- ronde ---------- */
  const draw = () => S.round.shoe.pop();

  async function deal() {
    if (S.busy || S.phase !== 'betting') return;
    const live = S.bets.map((b, i) => ({ ...b, i })).filter((b) => b.main > 0);
    if (!live.length) return toast('Zet eerst in op minstens één box.');
    const stake = staked(S.bets);
    if (stake > S.bankroll + 1e-9) return toast('Onvoldoende saldo voor deze inzetten.');
    S.lastBets = JSON.parse(JSON.stringify(S.bets));
    const startBank = S.bankroll;
    S.bankroll = r2(S.bankroll - stake);
    S.round = {
      startBank, shoe: BJ.makeShoe(6), dealer: [], active: null, insQueue: [], jpHit: null, log: [],
      boxes: live.map((b) => ({ i: b.i, bet: b.main, pair: b.pair, tripps: b.tripps, jp: b.jp, ins: 0, insRes: null, split: false, side: {}, bonus: 0, hands: [{ cards: [], bet: b.main }] })),
    };
    const jpBets = live.filter((b) => b.jp).length;
    if (jpBets) JP.feed(jpBets);
    const R = S.round;
    S.phase = 'dealing'; S.busy = true; S.hint = null; S.msg = 'Geen inzetten meer.';
    render();
    await wait(0.6);
    for (const b of R.boxes) { b.hands[0].cards.push(draw()); render(); await wait(); }
    R.dealer.push(draw()); render(); await wait();
    for (const b of R.boxes) { b.hands[0].cards.push(draw()); render(); await wait(); }

    const sideWin = await resolveSideBets();
    render();
    if (sideWin) await wait(2);

    if (R.dealer[0].r === 'A') {
      R.insQueue = R.boxes.map((_, k) => k);
      S.phase = 'insurance'; S.busy = false;
      nextInsurance();
      return;
    }
    beginPlay();
  }

  async function resolveSideBets() {
    const R = S.round, d = R.dealer[0];
    let any = false;
    for (const b of R.boxes) {
      const [c1, c2] = b.hands[0].cards;
      const settle = async (key, stake, res) => {
        S.stats.sideStake += stake;
        if (!res) { b.side[key] = { lose: true, stake }; return; }
        let win;
        if (res.jackpot) { win = await JP.hit(res.jackpot, [c1, c2, d].map(cc)); R.jpHit = res.jackpot; }
        else win = stake * res.mult;
        const ret = stake + win;
        S.bankroll = r2(S.bankroll + ret); S.stats.sideRet += ret; any = true;
        b.side[key] = { name: res.name, mult: res.mult, jackpot: res.jackpot, win, stake };
      };
      if (b.pair) await settle('pair', b.pair, BJ.pairPursuit(c1, c2));
      if (b.tripps) await settle('tripps', b.tripps, BJ.tripps(c1, c2, d));
      if (b.jp) await settle('jp', JP_BET, BJ.queens(c1, c2, d));
    }
    return any;
  }

  function nextInsurance() {
    const R = S.round;
    while (R.insQueue.length) {
      const b = R.boxes[R.insQueue[0]];
      if (S.bankroll + 1e-9 >= b.bet / 2) break;
      R.insQueue.shift(); // te weinig saldo om te verzekeren
    }
    if (!R.insQueue.length) return beginPlay();
    const b = R.boxes[R.insQueue[0]];
    S.msg = S.settings.boxes > 1 ? `De bank heeft een aas. Box ${b.i + 1} verzekeren?` : 'De bank heeft een aas. Verzekeren?';
    render();
  }
  function insure(yes) {
    if (S.phase !== 'insurance' || S.busy) return;
    const R = S.round, b = R.boxes[R.insQueue[0]];
    S.stats.coachAll++;
    if (!yes) S.stats.coachOk++;
    else if (S.settings.coach === 'feedback') toast('Basisstrategie: niet verzekeren. De verzekering heeft een huisvoordeel van ruim 7%.', 'warn');
    R.log.push({ b: b.i, ins: true, c: b.hands[0].cards.map(cc), up: cc(R.dealer[0]), a: yes ? 'Y' : 'N', adv: 'N', ok: !yes });
    if (yes) { b.ins = r2(b.bet / 2); S.bankroll = r2(S.bankroll - b.ins); S.stats.insStake += b.ins; }
    R.insQueue.shift();
    nextInsurance();
  }

  function beginPlay() {
    S.phase = 'playing';
    S.round.active = { b: 0, h: 0 };
    advance();
  }

  function available(h) {
    const can = S.bankroll + 1e-9 >= h.bet;
    if (h.splitAces) return { H: false, S: true, D: false, P: BJ.canSplitRule(h) && can };
    return { H: BJ.handTotal(h) < 21, S: true, D: BJ.canDoubleRule(h) && can, P: BJ.canSplitRule(h) && can };
  }

  function describe(cards, lockAce) {
    const t = BJ.total(cards, lockAce);
    if (cards.length === 2 && BJ.val(cards[0]) === BJ.val(cards[1])) return 'paar ' + (cards[0].r === 'A' ? 'azen' : BJ.val(cards[0]) + "'en");
    return (t.soft ? 'zacht ' : 'hard ') + t.total;
  }
  const upName = (c) => (c.r === 'A' ? 'aas' : String(BJ.val(c)));

  async function advance() {
    const R = S.round;
    const start = { ...R.active };
    for (let bi = start.b; bi < R.boxes.length; bi++) {
      const box = R.boxes[bi];
      for (let hi = bi === start.b ? start.h : 0; hi < box.hands.length; hi++) {
        const h = box.hands[hi];
        R.active = { b: bi, h: hi };
        if (h.done) continue;
        if (h.cards.length === 1) { // gesplitste hand krijgt nu zijn tweede kaart
          S.busy = true; S.hint = null; render(); await wait();
          h.cards.push(draw()); render(); await wait(0.7);
        }
        if (BJ.isNatural(h)) { h.done = true; continue; }
        if (BJ.handTotal(h) >= 21) { h.done = true; continue; }
        if (h.splitAces && !BJ.canSplitRule(h)) { h.done = true; continue; }
        const av = available(h);
        S.hint = BJ.strategy(h, R.dealer[0], { canDouble: av.D, canSplit: av.P });
        S.busy = false; S.phase = 'playing';
        S.msg = '';
        render();
        return;
      }
    }
    R.active = null;
    await dealerTurn();
  }

  async function act(a) {
    if (S.busy || S.phase !== 'playing') return;
    const R = S.round, box = R.boxes[R.active.b], h = box.hands[R.active.h];
    const av = available(h);
    if (!av[a]) return;
    if (S.hint) {
      const ok = a === S.hint;
      S.stats.coachAll++;
      if (ok) S.stats.coachOk++;
      R.log.push({ b: box.i, h: R.active.h, nh: box.hands.length, c: h.cards.map(cc), lock: h.lockAce ? h.cards.findIndex((c) => c.id === h.lockAce) : -1, up: cc(R.dealer[0]), a, adv: S.hint, ok });
      if (!ok && S.settings.coach === 'feedback') {
        const where = S.settings.totals ? ` bij ${describe(h.cards, h.lockAce)} tegen ${upName(R.dealer[0])}` : '';
        toast(`Basisstrategie: ${LABEL[S.hint].toLowerCase()}${where}.`, 'warn');
      }
    }
    S.hint = null;
    if (a === 'H') {
      h.cards.push(draw());
      if (BJ.handTotal(h) >= 21) { h.done = true; S.busy = true; render(); await wait(1.2); return advance(); }
      return advance();
    }
    if (a === 'S') { h.done = true; return advance(); }
    if (a === 'D') {
      S.bankroll = r2(S.bankroll - h.bet); h.bet *= 2; h.doubled = true;
      const ace = h.cards.find((c) => c.r === 'A');
      if (ace) h.lockAce = ace.id; // aas + 8: de aas houdt de hele ronde 1 punt
      S.busy = true; render(); await wait();
      h.cards.push(draw()); h.done = true; render(); await wait(1.2);
      return advance();
    }
    if (a === 'P') {
      S.bankroll = r2(S.bankroll - h.bet);
      const mk = (c) => ({ cards: [c], bet: h.bet, fromSplit: true, splitAces: c.r === 'A' });
      box.hands.splice(R.active.h, 1, mk(h.cards[0]), mk(h.cards[1]));
      box.split = true;
      return advance();
    }
  }

  async function dealerTurn() {
    const R = S.round;
    S.phase = 'dealer'; S.busy = true; S.hint = null;
    const hands = R.boxes.flatMap((b) => b.hands);
    const live = hands.some((h) => BJ.handTotal(h) <= 21);
    const anyIns = R.boxes.some((b) => b.ins > 0);
    if (live || anyIns) {
      S.msg = 'De bank trekt haar tweede kaart.'; render(); await wait(1.2);
      R.dealer.push(draw()); render(); await wait();
      const more = hands.some((h) => BJ.handTotal(h) <= 21 && !BJ.isNatural(h));
      if (more && !BJ.dealerBJ(R.dealer)) {
        while (BJ.dealerMustDraw(R.dealer)) { S.msg = 'De bank koopt.'; R.dealer.push(draw()); render(); await wait(1.1); }
      }
    } else {
      S.msg = 'Alle handen zijn kapot. De bank trekt geen tweede kaart.';
    }
    settle();
  }

  function settle() {
    const R = S.round, st = S.stats;
    const dBJ = BJ.dealerBJ(R.dealer);
    let ret = 0;
    for (const b of R.boxes) {
      if (b.ins > 0) {
        b.insRes = dBJ ? { win: true, amt: b.ins * 2 } : { win: false, amt: b.ins };
        if (dBJ) { ret += b.ins * 3; st.insRet += b.ins * 3; }
      }
      if (!b.split && BJ.is777(b.hands[0])) { b.bonus = b.bet; ret += b.bet; st.bonus777 += b.bet; }
      for (const h of b.hands) {
        const r = BJ.settleHand(h, R.dealer);
        h.res = r; ret += r.ret; st.hands++;
        if (r.outcome === 'win' || r.outcome === 'bj') st.won++;
        else if (r.outcome === 'push') st.push++;
        else st.lost++;
        if (r.outcome === 'bj') st.bj++;
      }
    }
    S.bankroll = r2(S.bankroll + ret);
    R.net = r2(S.bankroll - R.startBank);
    st.rounds++;
    st.best = Math.max(st.best, R.net); st.worst = Math.min(st.worst, R.net);
    st.peak = Math.max(st.peak, S.bankroll);
    st.history.push(S.bankroll); if (st.history.length > 400) st.history.splice(1, st.history.length - 400);
    recordHistory(R);
    const dTot = BJ.total(R.dealer).total;
    const show = S.settings.totals;
    let dTxt = '';
    if (dBJ) dTxt = 'De bank heeft Black Jack.';
    else if (R.dealer.length >= 2) dTxt = dTot > 21 ? (show ? `De bank is kapot met ${dTot}.` : 'De bank is kapot.') : (show ? `De bank heeft ${dTot}.` : 'De bank past.');
    S.msg = dTxt || S.msg;
    S.phase = 'settled'; S.busy = false;
    save(); render();
  }

  function recordHistory(R) {
    const sideTxt = (label, r) => (r && !r.lose ? `${label}: ${r.name} ${r.jackpot ? '(jackpot)' : r.mult + ':1'} ${eur(r.win, true)}` : r ? `${label}: geen combinatie ${eur(-r.stake)}` : null);
    S.hist.unshift({
      n: S.stats.rounds, table: S.settings.table, net: R.net,
      dealer: R.dealer.map(cc),
      boxes: R.boxes.map((b) => ({
        i: b.i,
        hands: b.hands.map((h) => ({ c: h.cards.map(cc), bet: h.bet, d: !!h.doubled, sp: !!h.fromSplit, lock: h.lockAce ? h.cards.findIndex((c) => c.id === h.lockAce) : -1, o: h.res.outcome, net: r2(h.res.ret - h.bet) })),
        side: [sideTxt('Pair Pursuit', b.side.pair), sideTxt('Tripps', b.side.tripps), sideTxt('Jackpot', b.side.jp),
          b.ins ? (b.insRes && b.insRes.win ? `Verzekering 2:1 ${eur(b.insRes.amt, true)}` : `Verzekering verloren ${eur(-b.ins)}`) : null,
          b.bonus ? `Bonus 777 ${eur(b.bonus, true)}` : null].filter(Boolean),
      })),
      log: R.log,
      err: R.log.filter((x) => !x.ok).length,
    });
    if (S.hist.length > HIST_MAX) S.hist.length = HIST_MAX;
  }

  function newRound(andDeal) {
    if (S.busy) return;
    S.round = null; S.phase = 'betting'; S.msg = 'Plaats uw inzetten.';
    S.bets = fitBets(S.lastBets);
    if (andDeal) {
      if (staked(S.lastBets || []) > S.bankroll + 1e-9) { render(); return toast('Onvoldoende saldo om dezelfde inzet te herhalen.'); }
      S.bets = JSON.parse(JSON.stringify(S.lastBets));
      return deal();
    }
    render();
  }

  /* ---------- weergave ---------- */
  const seen = new Set();
  function cardHTML(c) {
    const fresh = !seen.has(c.id) && SPEEDS[S.settings.speed] > 0;
    seen.add(c.id);
    const face = ['J', 'Q', 'K'].includes(c.r);
    const nl = { J: 'B', Q: 'V', K: 'H' }[c.r] || c.r; // boer, vrouw, heer
    return `<div class="card${BJ.isRed(c.s) ? ' red' : ''}${fresh ? ' deal' : ''}" role="img" aria-label="${cardName(c)}">
      <div class="idx">${nl}<i>${c.s}</i></div>
      <div class="pip${face ? ' face' : ''}">${face ? nl : c.s}</div></div>`;
  }
  function cardName(c) {
    const n = { A: 'aas', J: 'boer', Q: 'vrouw', K: 'heer' }[c.r] || c.r;
    return `${BJ.SUIT_NAME[c.s]} ${n}`;
  }
  /* force = altijd het getal tonen (terugkijken in Analyse) */
  function badge(cards, lockAce, natural, force = false) {
    if (!cards.length) return '';
    if (natural) return '<span class="tot bj">Black Jack</span>';
    const show = force || S.settings.totals;
    const t = BJ.total(cards, lockAce);
    if (t.total > 21) return `<span class="tot bust">Kapot${show ? ' ' + t.total : ''}</span>`;
    if (!show) return '';
    const txt = t.soft && t.total < 21 ? `${t.hard}/${t.total}` : t.total;
    return `<span class="tot">${txt}</span>`;
  }
  const mini = (codes) => `<span class="mc">${codes.map((s) => { const c = fromCode(s); const nl = { J: 'B', Q: 'V', K: 'H' }[c.r] || c.r; return `<span class="${BJ.isRed(c.s) ? 'r' : ''}">${nl}${c.s}</span>`; }).join('')}</span>`;

  function renderTop() {
    $('bankbar').hidden = S.phase === 'setup';
    $('bankroll').textContent = eur(S.bankroll);
    const t = tbl();
    const inSession = S.phase !== 'setup';
    $('tableLabel').hidden = inSession;
    $('tableBtn').hidden = !inSession;
    $('tableBtn').textContent = `Tafel ${eur(t.min)} – ${eur(t.max)} · wisselen`;
    let onTable = 0;
    if (S.phase === 'betting') onTable = staked(S.bets);
    else if (S.round && S.phase !== 'settled') onTable = S.round.boxes.reduce((s, b) => s + b.ins + b.hands.reduce((x, h) => x + h.bet, 0), 0);
    $('staked').textContent = onTable ? `${eur(onTable)} op tafel` : '';
    document.documentElement.style.setProperty('--dealdur', DEAL_ANIM[S.settings.speed]);
  }

  function renderJackpots() {
    const el = $('jackpots');
    el.hidden = !S.settings.jackpot || S.phase === 'setup';
    if (el.hidden) return;
    const hit = S.round && S.round.jpHit;
    const m = [['mega', 'Mega', '3× ♦V'], ['major', 'Major', '3× V zelfde'], ['minor', 'Minor', '3× V kleur']];
    const note = {
      live: ['live', 'Live: groeit met de jackpotinzetten van alle spelers'],
      connecting: ['', 'Jackpotstand ophalen…'],
      local: ['', 'Lokale stand · groeit met je eigen jackpotinzetten'],
    }[JP.mode()];
    el.innerHTML = m.map(([k, n, d]) => `<div class="jp${hit === k ? ' hit' : ''}"><small>${n}<i>${d}</i></small><span class="num">${eur2(JP.value(k))}</span></div>`).join('')
      + `<p class="jpnote ${note[0]}"><i></i>${note[1]}</p>`;
  }

  function renderDealer() {
    const el = $('dealer');
    if (S.phase === 'setup') { el.innerHTML = ''; return; }
    const d = S.round ? S.round.dealer : [];
    const nat = d.length === 2 && BJ.dealerBJ(d);
    el.innerHTML = `<div class="lab">Bank</div><div class="cards">${d.map(cardHTML).join('')}</div><div>${badge(d, null, nat)}</div>`;
  }

  function sideSpot(cls, short, amount, res, title) {
    const st = res ? (res.lose ? ' lost' : ' won') : '';
    return `<div class="spot-side ${cls}${st}" title="${title}">${amount ? chip(amount) : `<span>${short}</span>`}</div>`;
  }

  function renderBoxes() {
    const el = $('boxes');
    if (S.phase === 'setup') { el.innerHTML = ''; return; }
    const R = S.round, n = S.settings.boxes;
    let html = '';
    for (let i = 0; i < n; i++) {
      const rb = R ? R.boxes.find((b) => b.i === i) : null;
      const bet = rb ? { main: rb.bet, pair: rb.pair, tripps: rb.tripps, jp: rb.jp } : S.bets[i] || { main: 0, pair: 0, tripps: 0, jp: false };
      const betting = S.phase === 'betting';
      const isTurn = rb && R.active && R.boxes[R.active.b] === rb && S.phase === 'playing';
      const cls = ['box', betting && n > 1 ? 'selectable' : '', betting && n > 1 && S.sel === i ? 'selected' : '', isTurn ? 'turn' : ''].join(' ');
      let hands = '';
      if (rb) {
        hands = rb.hands.map((h, hi) => {
          const now = isTurn && R.active.h === hi;
          let res = '';
          if (h.res) {
            const net = h.res.ret - h.bet;
            const lab = { win: 'Gewonnen', bj: 'Black Jack', push: 'Gelijk', lose: 'Verloren', bust: 'Verloren' }[h.res.outcome];
            const k = net > 0 ? 'win' : net < 0 ? 'lose' : 'push';
            res = `<span class="res ${k}">${lab}${net ? ' ' + eur(net, true) : ''}</span>`;
          }
          const tag = h.doubled ? ' · verdubbeld' : '';
          return `<div class="hand${now ? ' now' : ''}"><div class="cards">${h.cards.map(cardHTML).join('')}</div>
            <div class="meta">${badge(h.cards, h.lockAce, BJ.isNatural(h))}${rb.hands.length > 1 || h.doubled ? `<span class="hb">${eur(h.bet)}${tag}</span>` : ''}</div>${res}</div>`;
        }).join('');
      }
      const side = [];
      if (rb) {
        const line = (label, r) => {
          if (!r || r.lose) return; // verliezende sidebets staan gedimd in hun vak
          side.push(`<li class="win">${label} · ${esc(r.name)} ${r.jackpot ? 'JACKPOT' : r.mult + ':1'} <b>${eur(r.win, true)}</b></li>`);
        };
        line('Pair Pursuit', rb.side.pair); line('Tripps', rb.side.tripps); line('Jackpot', rb.side.jp);
        if (rb.ins) side.push(rb.insRes ? (rb.insRes.win ? `<li class="win">Verzekering 2:1 <b>${eur(rb.insRes.amt, true)}</b></li>` : `<li>Verzekering verloren</li>`) : `<li>Verzekerd voor ${eur(rb.ins)}</li>`);
        if (rb.bonus) side.push(`<li class="win">Bonus 777 <b>${eur(rb.bonus, true)}</b></li>`);
      }
      const sides = [];
      if (S.settings.pair || bet.pair) sides.push(sideSpot('', 'PP', bet.pair, rb && rb.side.pair, 'Pair Pursuit'));
      if (S.settings.tripps || bet.tripps) sides.push(sideSpot('', '3+', bet.tripps, rb && rb.side.tripps, 'Tripps'));
      if (S.settings.jackpot || bet.jp) sides.push(sideSpot('diamond', 'Q', bet.jp ? JP_BET : 0, rb && rb.side.jp, 'Queens Pursuit jackpot'));
      html += `<div class="${cls}" data-act="selbox" data-v="${i}">
        <div class="hands">${hands}</div>
        <div class="spots">
          <div class="spot-main">${bet.main ? chip(bet.main) : '<span class="empty">inzet</span>'}</div>
          ${sides.length ? `<div class="sides">${sides.join('')}</div>` : ''}
        </div>
        ${side.length ? `<ul class="sideres">${side.join('')}</ul>` : ''}
        <div class="boxlab">Box ${i + 1}</div>
      </div>`;
    }
    el.innerHTML = html;
  }

  function renderSetup() {
    const el = $('setup');
    if (S.phase !== 'setup') { el.innerHTML = ''; return; }
    if ($('setupForm')) return; // niet opnieuw opbouwen terwijl iemand het formulier invult
    const st = S.settings;
    const canResume = saved && saved.bankroll > 0 && saved.stats;
    el.innerHTML = `<form class="setup" id="setupForm" novalidate>
      <h1>Kies je tafel</h1>
      <p class="lede">Oefen met de tafelregels van Holland Casino. De bank krijgt pas na de spelers haar tweede kaart, je verdubbelt alleen op 9, 10 of 11 en Black Jack betaalt 3 tot 2.</p>
      <div class="row"><button type="button" class="btn" data-act="sheet" data-v="rules">Spelregels</button><button type="button" class="btn" data-act="sheet" data-v="chart">Strategiekaart</button></div>
      <fieldset class="field"><legend>Minimale inzet</legend>
        <div class="tables">${[20, 50, 100].map((v) => `<label class="tcard"><input type="radio" name="table" id="t${v}" value="${v}" ${st.table === v ? 'checked' : ''}><b>${eur(v)}</b><small>max ${eur(TABLES[v].max)}</small></label>`).join('')}</div>
      </fieldset>
      <div class="field"><label class="flab" for="setBank">Startsaldo</label>
        <div class="bankrow"><div class="euroin"><span>€</span><input id="setBank" type="number" inputmode="numeric" min="20" step="10" value="${st.bankroll}"></div>
        <div class="presets">${[500, 1000, 2500, 5000].map((v) => `<button type="button" class="pill" data-act="preset" data-v="${v}">${nf0.format(v)}</button>`).join('')}</div></div>
        <p class="err" id="bankErr"></p>
      </div>
      <fieldset class="field"><legend>Aantal boxen</legend>
        <div class="seg">${[1, 2, 3].map((v) => `<label><input type="radio" name="boxes" id="bx${v}" value="${v}" ${st.boxes === v ? 'checked' : ''}>${v}</label>`).join('')}</div>
      </fieldset>
      <fieldset class="field"><legend>Sidebets aan tafel</legend>
        <div class="checks">
          <label class="check"><input type="checkbox" id="sPair" ${st.pair ? 'checked' : ''}> Pair Pursuit <small>tot 25:1</small></label>
          <label class="check"><input type="checkbox" id="sTripps" ${st.tripps ? 'checked' : ''}> Tripps <small>tot 30:1</small></label>
          <label class="check"><input type="checkbox" id="sJp" ${st.jackpot ? 'checked' : ''}> Queens Pursuit jackpot <small>€2,50</small></label>
        </div>
      </fieldset>
      <fieldset class="field"><legend>Oefenen</legend>
        <div class="checks">
          <label class="check"><input type="checkbox" id="sTotals" ${st.totals ? 'checked' : ''}> Kaarttotalen tonen <small>uit = zelf tellen</small></label>
        </div>
      </fieldset>
      <div class="field"><label class="flab" for="sCoach">Strategie-coach</label>
        <select id="sCoach">
          <option value="feedback" ${st.coach === 'feedback' ? 'selected' : ''}>Melding bij een afwijkende keuze</option>
          <option value="advies" ${st.coach === 'advies' ? 'selected' : ''}>Advies vooraf tonen</option>
          <option value="uit" ${st.coach === 'uit' ? 'selected' : ''}>Uit (achteraf terugkijken in Analyse)</option>
        </select>
      </div>
      <button type="submit" class="btn primary">Ga aan tafel</button>
      ${canResume ? `<button type="button" class="btn" data-act="resume">Verder met vorige sessie<small>saldo ${eur(saved.bankroll)} · tafel ${eur(saved.settings.table)}</small></button>` : ''}
      <p class="fine">Onofficiële oefensimulator met speelgeld. Geen echt geld, geen winst.</p>
    </form>`;
  }

  function renderDock() {
    const el = $('dock');
    let h = '';
    const R = S.round;
    $('dockwrap').hidden = S.phase === 'setup';
    if (S.phase === 'setup') { el.innerHTML = ''; return; }
    const broke = `<div class="row"><button class="btn" data-act="sheet" data-v="table">Tafel wisselen</button><button class="btn primary" data-act="sheet" data-v="rebuy">Bijkopen</button></div>`;
    if (S.phase === 'betting') {
      const b = S.bets[S.sel], t = tbl(), n = S.settings.boxes;
      const tot = staked(S.bets);
      if (n > 1) h += `<div class="boxtabs">${S.bets.map((x, i) => `<button class="boxtab" data-act="selbox" data-v="${i}" aria-pressed="${S.sel === i}">Box ${i + 1} <b>${x.main ? eur(staked([x])) : '—'}</b></button>`).join('')}</div>`;
      const stepper = (f, label, val, step, max) => `<div class="step">
        <button data-act="bet" data-f="${f}" data-d="-1" aria-label="${label} verlagen" ${val <= 0 ? 'disabled' : ''}>−</button>
        <div class="mid"><small>${label}</small><output class="num">${val ? eur(val) : '—'}</output></div>
        <button data-act="bet" data-f="${f}" data-d="1" aria-label="${label} verhogen" ${val + step > max ? 'disabled' : ''}>+</button></div>`;
      h += `<div class="betgrid">${stepper('main', `Inzet · per ${eur(t.min)}`, b.main, t.min, t.max)}`;
      if (S.settings.pair) h += stepper('pair', 'Pair Pursuit', b.pair, SIDE_STEP, SIDE_MAX);
      if (S.settings.tripps) h += stepper('tripps', 'Tripps', b.tripps, SIDE_STEP, SIDE_MAX);
      if (S.settings.jackpot) h += `<button class="toggle" data-act="jp" aria-pressed="${b.jp}"><span><small>Jackpot</small><span class="num">${eur(JP_BET)}</span></span><span class="sw"></span></button>`;
      h += `</div>`;
      const canRebet = S.lastBets && staked(S.lastBets) > 0 && staked(S.lastBets) <= S.bankroll + 1e-9;
      if (S.bankroll < t.min && tot === 0) {
        h += `<div class="roundres">Je saldo is lager dan de minimale inzet van ${eur(t.min)}.</div>${broke}`;
      } else {
        h += `<div class="row wide2"><button class="btn" data-act="clear" ${tot ? '' : 'disabled'}>Wis</button>
          <button class="btn" data-act="rebet" ${canRebet ? '' : 'disabled'}>Vorige</button>
          <button class="btn primary" data-act="deal" ${tot ? '' : 'disabled'}>Delen<small>${eur(tot)}</small></button></div>`;
      }
    } else if (S.phase === 'insurance') {
      const b = R.boxes[R.insQueue[0]];
      const adv = S.settings.coach === 'advies';
      h += `<div class="who">Bank toont een aas · inzet <b>${eur(b.bet)}</b></div>
        <div class="row"><button class="btn" data-act="ins" data-v="1">Verzekeren<small>${eur(b.bet / 2)}</small></button>
        <button class="btn${adv ? ' hint' : ''}" data-act="ins" data-v="0">Niet verzekeren</button></div>`;
      if (adv) h += `<div class="coach">Advies: niet verzekeren</div>`;
    } else if (S.phase === 'settled') {
      const net = R.net;
      const k = net > 0 ? 'pos' : net < 0 ? 'neg' : 'zero';
      const again = S.lastBets ? staked(S.lastBets) : 0;
      const errs = R.log.filter((x) => !x.ok).length;
      h += `<div class="roundres ${k}">Resultaat deze ronde <b>${eur(net, true)}</b></div>`;
      if (errs && S.settings.coach === 'uit') h += `<div class="coach">${errs === 1 ? '1 keuze week' : errs + ' keuzes weken'} af van de basisstrategie · <button class="tablebtn" style="display:inline" data-act="review">bekijk</button></div>`;
      if (S.bankroll < tbl().min) h += broke;
      else {
        h += `<div class="row"><button class="btn" data-act="change">Inzet wijzigen</button>
          <button class="btn primary" data-act="again" ${again <= S.bankroll + 1e-9 ? '' : 'disabled'}>Herhaal en deel<small>${eur(again)}</small></button></div>`;
      }
    } else {
      // dealing / playing / dealer
      let av = { H: false, S: false, D: false, P: false }, betTxt = '';
      const who = S.phase === 'dealer' ? 'De bank is aan de beurt' : S.phase === 'dealing' ? 'De croupier deelt' : '';
      if (S.phase === 'playing' && R.active && !S.busy) {
        const hd = R.boxes[R.active.b].hands[R.active.h];
        av = available(hd); betTxt = eur(hd.bet);
      }
      const adv = S.settings.coach === 'advies' && S.phase === 'playing' && !S.busy ? S.hint : null;
      const btn = (a, lab, sub) => `<button class="btn${adv === a ? ' hint' : ''}" data-act="play" data-v="${a}" ${av[a] ? '' : 'disabled'}>${lab}${sub ? `<small>${sub}</small>` : ''}</button>`;
      h += `<div class="who">${who}</div>
        <div class="row">${btn('H', 'Kaart')}${btn('S', 'Pas')}${btn('D', 'Verdubbel', av.D ? '+' + betTxt : '9 – 11')}${btn('P', 'Splits', av.P ? '+' + betTxt : '')}</div>`;
      if (adv) h += `<div class="coach">Advies: ${LABEL[adv].toLowerCase()}</div>`;
    }
    el.innerHTML = h;
  }

  function render() {
    renderTop(); renderJackpots(); renderDealer(); renderBoxes(); renderSetup(); renderDock(); renderToast();
    $('msg').innerHTML = S.phase === 'setup' ? '' : S.msg;
    if (S.sheet && !$('sheet').querySelector('select:focus, input:focus')) renderSheet();
  }

  /* ---------- sheets ---------- */
  function openSheet(v) {
    S.sheet = v; S.confirmReset = false;
    if (v === 'rebuy') S.rebuyAmt = S.rebuyAmt || S.startBank || 1000;
    $('sheet').hidden = false; $('sheetBody').scrollTop = 0; renderSheet();
    if (v === 'rebuy') setTimeout(() => { const i = $('rebuyAmt'); if (i) i.focus(); }, 30);
    if (v === 'chart') setTimeout(() => { // spring naar de gemarkeerde cel
      const body = $('sheetBody'), c = body.querySelector('td.cur');
      if (c) body.scrollTop += c.getBoundingClientRect().top - body.getBoundingClientRect().top - body.clientHeight / 2;
    }, 30);
  }
  function closeSheet() { S.sheet = null; $('sheet').hidden = true; }

  function renderSheet() {
    const titles = { rules: 'Spelregels', stats: 'Analyse', settings: 'Instellingen', chart: 'Strategiekaart', table: 'Tafel wisselen', rebuy: 'Bijkopen' };
    $('sheetTitle').textContent = titles[S.sheet];
    const body = $('sheetBody');
    const keep = body.scrollTop;
    const open = [...body.querySelectorAll('details[open]')].map((d) => d.dataset.k);
    const map = { rules: rulesHTML, stats: statsHTML, settings: settingsHTML, chart: chartSheetHTML, table: tableHTML, rebuy: rebuyHTML };
    body.innerHTML = map[S.sheet]();
    open.forEach((k) => { const d = body.querySelector(`details[data-k="${k}"]`); if (d) d.open = true; });
    body.scrollTop = keep;
  }

  /* ---- strategiekaart ---- */
  const UPS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'A'];
  const upCol = (c) => (BJ.val(c) === 1 ? 'A' : BJ.val(c) === 10 ? '10' : c.r);
  function chartKey(h, av) {
    const c = h.cards;
    if (av.P && c.length === 2 && BJ.val(c[0]) === BJ.val(c[1])) {
      const v = BJ.val(c[0]);
      return 'p:' + (v === 1 ? 'A,A' : v === 10 ? '10,10' : `${v},${v}`);
    }
    const t = BJ.total(c, h.lockAce);
    if (t.soft) { const x = t.total - 11; return x >= 2 && x <= 9 ? `s:A,${x}` : null; }
    return 'h:' + (t.total <= 8 ? '5–8' : t.total >= 17 ? '17+' : String(t.total));
  }
  function chartHTML(ctx) {
    let id = -1;
    const hand = (rs) => ({ cards: rs.map((r) => ({ r, s: '♠', id: id-- })) });
    const code = { H: 'K', S: 'P', D: 'D', P: 'S' };
    const row = (kind, label, rs, pair) => {
      const isRow = ctx && ctx.key === `${kind}:${label}`;
      return `<tr><th class="${isRow ? 'cur' : ''}">${label}</th>${UPS.map((u) => {
        const c = code[BJ.strategy(hand(rs), { r: u, s: '♠', id: -999 }, { canDouble: true, canSplit: !!pair })];
        const col = ctx && ctx.up === u;
        return `<td class="${c}${col ? ' col' : ''}${col && isRow ? ' cur' : ''}">${c}</td>`;
      }).join('')}</tr>`;
    };
    const head = `<tr><th></th>${UPS.map((u) => `<th class="${ctx && ctx.up === u ? 'cur' : ''}">${u}</th>`).join('')}</tr>`;
    const hard = [['5–8', ['5', '3']], ['9', ['5', '4']], ['10', ['6', '4']], ['11', ['6', '5']], ['12', ['10', '2']], ['13', ['10', '3']], ['14', ['10', '4']], ['15', ['10', '5']], ['16', ['10', '6']], ['17+', ['10', '7']]];
    const soft = ['2', '3', '4', '5', '6', '7', '8', '9'].map((r) => [`A,${r}`, ['A', r]]);
    const pairs = [['A,A', ['A', 'A']], ['10,10', ['10', 'K']], ['9,9', ['9', '9']], ['8,8', ['8', '8']], ['7,7', ['7', '7']], ['6,6', ['6', '6']], ['5,5', ['5', '5']], ['4,4', ['4', '4']], ['3,3', ['3', '3']], ['2,2', ['2', '2']]];
    const table = (kind, rows, pair) => `<div class="scroll-x"><table class="chart">${head}${rows.map(([l, rs]) => row(kind, l, rs, pair)).join('')}</table></div>`;
    return `<p class="fine">Rij = jouw hand, kolom = eerste kaart van de bank.</p>
      <div class="legend"><span><i style="background:#213a33"></i>K kaart</span><span><i style="background:#c9a75e"></i>P pas</span><span><i style="background:var(--blue)"></i>D dubbel</span><span><i style="background:var(--oxblood)"></i>S splits</span></div>
      <h4 class="fine" style="margin:6px 0 0">Paren</h4>${table('p', pairs, true)}
      <h4 class="fine" style="margin:6px 0 0">Zachte totalen (aas telt als 11)</h4>${table('s', soft)}
      <h4 class="fine" style="margin:6px 0 0">Harde totalen</h4>${table('h', hard)}`;
  }
  function chartSheetHTML() {
    let ctx = null, note = '';
    const R = S.round;
    if (R && S.phase === 'playing' && R.active && !S.busy) {
      const hd = R.boxes[R.active.b].hands[R.active.h];
      ctx = { up: upCol(R.dealer[0]), key: S.settings.totals ? chartKey(hd, available(hd)) : null };
      note = ctx.key
        ? `<p class="chartnote">Je huidige hand is gemarkeerd: ${describe(hd.cards, hd.lockAce)} tegen ${upName(R.dealer[0])}.</p>`
        : `<p class="chartnote">De kolom van de bank (${upName(R.dealer[0])}) is gemarkeerd. Tel je eigen hand en zoek de rij.</p>`;
    }
    return `<section>${note}${chartHTML(ctx)}</section>
      <section><h3>Lezen</h3><ul>
        <li>Heb je een paar, kijk dan eerst bij Paren. Split je niet, lees dan verder bij de zachte of harde totalen.</li>
        <li>D betekent verdubbelen. Mag dat niet (3 of meer kaarten, of je totaal is geen 9, 10 of 11), neem dan een kaart.</li>
        <li>Door de regel zonder dichte kaart verdubbel je 11 niet tegen een 10 of aas, en split je 8,8 niet tegen een 10 of aas en A,A niet tegen een aas.</li>
        <li>Verzekeren is nooit voordelig.</li>
      </ul></section>`;
  }

  function rulesHTML() {
    return `
    <button class="btn" data-act="sheet" data-v="chart">Open de strategiekaart</button>
    <section><h3>Het hoofdspel</h3><ul>
      <li>Gespeeld met 6 decks in een schudmachine. Na elke ronde gaan de kaarten terug in de machine, dus elke ronde komt uit de volle slof.</li>
      <li>Kaarten 2 tot en met 10 tellen hun waarde, boer, vrouw en heer tellen 10, een aas telt 1 of 11.</li>
      <li>Elke box krijgt twee open kaarten, de bank één. <b>De bank neemt geen dichte kaart</b>: haar tweede kaart komt pas nadat alle boxen gespeeld zijn.</li>
      <li>Black Jack (aas plus een 10-waarde als eerste twee kaarten) betaalt 3:2. Overige winst betaalt 1:1. Black Jack wint van een 21 van drie of meer kaarten.</li>
      <li>Bij 21 punten stop je verplicht, ook als je de aas als 1 zou kunnen tellen.</li>
      <li>De bank koopt bij 16 of minder en past bij 17 of meer, ook bij een zachte 17 (aas + 6).</li>
      <li>Gelijk spel, ook Black Jack tegen Black Jack: je krijgt je inzet terug.</li>
      <li>Krijgt de bank Black Jack, dan verlies je alles wat in de box staat, dus ook het extra geld van verdubbelen en splitsen. Dat is het gevolg van de regel zonder dichte kaart.</li>
      <li>Zijn alle handen kapot en heeft niemand verzekerd, dan trekt de bank geen tweede kaart.</li>
      <li>Overgeven (surrender) bestaat niet aan deze tafels.</li>
    </ul></section>
    <section><h3>Verdubbelen</h3><ul>
      <li>Alleen met je eerste twee kaarten en een totaal van 9, 10 of 11. Je krijgt precies één kaart.</li>
      <li>Aas + 8 mag je als 9 verdubbelen. Die aas telt daarna de hele ronde als 1 punt.</li>
      <li>Ook toegestaan op een hand van 9, 10 of 11 na splitsen, maar niet op gesplitste azen.</li>
    </ul></section>
    <section><h3>Splitsen</h3><ul>
      <li>Twee kaarten met dezelfde puntwaarde, dus ook bijvoorbeeld een boer en een heer. De nieuwe hand krijgt dezelfde inzet.</li>
      <li>Vormt een nieuwe kaart weer een paar, dan mag je opnieuw splitsen, zonder limiet.</li>
      <li>Gesplitste azen krijgen elk één kaart. Aas + 10 na splitsen telt als 21, niet als Black Jack, en betaalt 1:1.</li>
    </ul></section>
    <section><h3>Verzekering</h3>
      <p>Is de eerste kaart van de bank een aas, dan mag je je inzet verzekeren voor de helft van je inzet. Krijgt de bank Black Jack, dan betaalt de verzekering 2:1. Anders ben je de verzekering kwijt.</p></section>
    <section><h3>Bonus 777</h3>
      <p>Zijn de eerste drie kaarten in je box elk een 7 (zonder te splitsen), dan krijg je een bonus van één keer je inzet, of je de hand nu wint of niet.</p></section>
    <section><h3>Inzetten en tafels</h3><ul>
      <li>Je zet alleen veelvouden van de minimale inzet in: aan de €20-tafel dus €20, €40, €60 enzovoort.</li>
      <li>Maximum in deze simulator: €1.000 (€20-tafel), €2.500 (€50-tafel) en €5.000 (€100-tafel). In het casino staat het inzetschema bij elke tafel.</li>
      <li>Tussen twee rondes kun je naar een andere tafel. Je saldo gaat mee, zoals je in het casino je fiches meeneemt.</li>
      <li>Sidebets alleen naast een gewone inzet. In deze simulator €5 tot €100 per sidebet, in stappen van €5.</li>
    </ul></section>
    <section><h3>Pair Pursuit</h3>
      <p class="fine">Op je eerste twee kaarten. Alleen dezelfde kaart telt als paar: boer + heer is geen paar.</p>
      <table class="pay">
        <tr><td>Perfect Pursuit<small>zelfde kaart, zelfde symbool (♥ ♥)</small></td><td>25 : 1</td></tr>
        <tr><td>Coloured Pursuit<small>zelfde kaart en kleur, ander symbool (♥ ♦)</small></td><td>12 : 1</td></tr>
        <tr><td>Mixed Pursuit<small>zelfde kaart, andere kleur (♥ ♠)</small></td><td>6 : 1</td></tr>
      </table></section>
    <section><h3>Tripps</h3>
      <p class="fine">Je eerste twee kaarten plus de eerste kaart van de bank. De aas telt hoog of laag (A-2-3 en V-H-A).</p>
      <table class="pay">
        <tr><td>Straight Flush<small>opeenvolgend, zelfde symbool</small></td><td>30 : 1</td></tr>
        <tr><td>Three of a Kind<small>drie dezelfde kaarten</small></td><td>20 : 1</td></tr>
        <tr><td>Straight<small>opeenvolgend, verschillende symbolen</small></td><td>10 : 1</td></tr>
        <tr><td>Flush<small>zelfde symbool</small></td><td>5 : 1</td></tr>
      </table></section>
    <section><h3>Queens Pursuit jackpot (€2,50)</h3>
      <p class="fine">Alleen voor de boxhouder. Per hand één uitbetaling, de hoogste. Drie kaarten = je eerste twee plus de eerste kaart van de bank.</p>
      <table class="pay">
        <tr><td>Drie ruiten vrouwen</td><td>Mega</td></tr>
        <tr><td>Drie vrouwen schoppen, harten of klaveren<small>alle drie hetzelfde symbool</small></td><td>Major</td></tr>
        <tr><td>Drie vrouwen zelfde kleur<small>rood of zwart</small></td><td>Minor</td></tr>
        <tr><td>Drie vrouwen</td><td>100 : 1</td></tr>
        <tr><td>Paar ruiten vrouwen<small>je eerste twee kaarten</small></td><td>80 : 1</td></tr>
        <tr><td>Paar vrouwen zelfde symbool<small>schoppen, harten of klaveren</small></td><td>40 : 1</td></tr>
        <tr><td>Paar vrouwen</td><td>20 : 1</td></tr>
        <tr><td>Eén ruiten vrouw<small>in je eerste twee kaarten</small></td><td>8 : 1</td></tr>
      </table>
      <p class="fine">Startbedragen: Mega €25.000, Major €5.000, Minor €500. In deze simulator gaat van elke jackpotinzet van €2,50 €0,60 naar Mega, €0,25 naar Major en €0,15 naar Minor. De stand is gedeeld tussen alle spelers van deze website en staat los van de echte jackpot in het casino. Valt een jackpot, dan begint die meter weer bij het startbedrag.</p></section>
    <section><h3>Niet in deze simulator</h3>
      <p class="fine">Holland Casino kan aan sommige tafels afwijken: bij Casino 21 wint de bank bij gelijk spel, en er bestaan tafels waar Black Jack 6:5 betaalt. Deze simulator speelt de gewone Black Jack-tafel.</p></section>
    <p class="src">Bron: Holland Casino Spelreglement juli 2026, artikel 1.1 en 3.2 (<a href="https://a.storyblok.com/f/339257/x/5a50cf174f/spelreglement.pdf" target="_blank" rel="noopener">pdf</a>). Jackpotinzet: <a href="https://hc.nl/spelen/jackpots/black-jack-jackpot/" target="_blank" rel="noopener">hc.nl</a>. Onofficiële oefensimulator met speelgeld, niet verbonden aan Holland Casino.</p>`;
  }

  /* ---- analyse ---- */
  function statsHTML() {
    if (S.phase === 'setup') return '<p class="empty-note">Start een sessie om je analyse te zien.</p>';
    const tabs = `<div class="tabs" role="group" aria-label="Analyse"><button data-act="tab" data-v="overzicht" aria-pressed="${S.anaTab === 'overzicht'}">Overzicht</button><button data-act="tab" data-v="handen" aria-pressed="${S.anaTab === 'handen'}">Handen terugkijken</button></div>`;
    return tabs + (S.anaTab === 'handen' ? histHTML() : overviewHTML());
  }
  function overviewHTML() {
    const st = S.stats;
    const net = r2(S.bankroll - S.startBank - S.rebuys);
    const pct = st.coachAll ? Math.round((st.coachOk / st.coachAll) * 100) + '%' : '—';
    const sideNet = r2(st.sideRet - st.sideStake);
    const insNet = r2(st.insRet - st.insStake);
    const tile = (l, v) => `<div class="stat"><small>${l}</small><b>${v}</b></div>`;
    const tone = (v) => (v > 0 ? 'style="color:var(--win)"' : v < 0 ? 'style="color:var(--lose)"' : '');
    return `<div class="stats">
      <div class="stat"><small>Netto resultaat</small><b ${tone(net)}>${eur(net, true)}</b></div>
      ${tile('Saldo', eur(S.bankroll))}
      ${tile('Rondes', nf0.format(st.rounds))}
      ${tile('Handen W / V / G', `${st.won} / ${st.lost} / ${st.push}`)}
      ${tile('Black Jacks', st.bj)}
      ${tile('Strategie juist', `${pct}${st.coachAll ? ` <small style="display:inline;font-size:12px;color:var(--muted)">(${st.coachOk}/${st.coachAll})</small>` : ''}`)}
      <div class="stat"><small>Sidebets netto</small><b ${tone(sideNet)}>${eur(sideNet, true)}</b></div>
      <div class="stat"><small>Verzekering netto</small><b ${tone(insNet)}>${eur(insNet, true)}</b></div>
      ${tile('Beste ronde', eur(st.best, true))}
      ${tile('Slechtste ronde', eur(st.worst, true))}
      ${tile('Hoogste saldo', eur(st.peak))}
      ${tile('Bijgekocht', eur(S.rebuys))}
    </div>
    <section><h3>Verloop saldo</h3>${spark(st.history)}</section>
    <button class="btn" data-act="reset-stats">Analyse wissen</button>`;
  }
  function histHTML() {
    const list = S.onlyErr ? S.hist.filter((r) => r.err) : S.hist;
    const totErr = S.hist.reduce((t, r) => t + r.err, 0);
    const tools = `<div class="histtools"><p class="fine" style="margin:0">Laatste ${S.hist.length} ${S.hist.length === 1 ? 'ronde' : 'rondes'} · ${totErr} ${totErr === 1 ? 'afwijking' : 'afwijkingen'} van de basisstrategie</p>
      <label class="check"><input type="checkbox" id="onlyErr" ${S.onlyErr ? 'checked' : ''}> Alleen rondes met fouten</label></div>`;
    if (!S.hist.length) return tools + '<p class="empty-note">Speel een ronde. Daarna zie je hier per ronde de kaarten, elke keuze die je maakte en wat de basisstrategie zegt.</p>';
    if (!list.length) return tools + '<p class="empty-note">Geen fouten in de bewaarde rondes. Netjes gespeeld.</p>';
    return tools + `<div class="hist">${list.map(roundHTML).join('')}</div>`;
  }
  function roundHTML(r) {
    const cards = (codes) => codes.map(fromCode);
    const tone = r.net > 0 ? 'pos' : r.net < 0 ? 'neg' : 'zero';
    const first = r.boxes[0];
    const summaryHands = r.boxes.length === 1
      ? first.hands.map((h) => mini(h.c)).join(' ')
      : r.boxes.map((b) => `<span class="fine">B${b.i + 1}</span> ${mini(b.hands[0].c)}`).join(' ');
    const flag = r.log.length ? (r.err ? `<span class="flag bad">${r.err} ${r.err === 1 ? 'fout' : 'fouten'}</span>` : '<span class="flag good">✓ goed</span>') : '';
    const dCards = cards(r.dealer);
    const dNat = dCards.length === 2 && BJ.dealerBJ(dCards);
    const outLab = { win: 'Gewonnen', bj: 'Black Jack', push: 'Gelijk', lose: 'Verloren', bust: 'Verloren' };
    const lines = [`<div class="rline"><span class="rl">Bank</span>${mini(r.dealer)} ${badge(dCards, null, dNat, true)}</div>`];
    for (const b of r.boxes) {
      b.hands.forEach((h, hi) => {
        const cs = cards(h.c);
        const lock = h.lock >= 0 ? cs[h.lock].id : null;
        const nat = !h.sp && cs.length === 2 && BJ.total(cs).total === 21;
        const name = `Box ${b.i + 1}${b.hands.length > 1 ? `.${hi + 1}` : ''}`;
        const k = h.net > 0 ? 'win' : h.net < 0 ? 'lose' : 'push';
        lines.push(`<div class="rline"><span class="rl">${name}</span>${mini(h.c)} ${badge(cs, lock, nat, true)} <span class="res ${k}">${outLab[h.o]}${h.net ? ' ' + eur(h.net, true) : ''}</span>${h.d ? '<span class="fine">verdubbeld</span>' : ''}</div>`);
      });
      if (b.side.length) lines.push(`<div class="rline"><span class="rl">Extra</span><span class="fine">${b.side.map(esc).join(' · ')}</span></div>`);
    }
    const dec = r.log.length ? `<ol class="dec">${r.log.map((x) => {
      const cs = cards(x.c);
      const lock = x.lock >= 0 ? cs[x.lock].id : null;
      const where = x.ins ? 'verzekering' : (r.boxes.length > 1 || x.nh > 1 ? `box ${x.b + 1}${x.nh > 1 ? ' · hand ' + (x.h + 1) : ''}` : '');
      const total = x.ins ? '' : `<span class="fine">${describe(cs, lock)}</span>`;
      const verdict = x.ok ? `Jij: <b>${LABEL[x.a]}</b> · klopt met de basisstrategie` : `Jij: <b>${LABEL[x.a]}</b> · advies: <b>${LABEL[x.adv]}</b>`;
      return `<li class="${x.ok ? 'ok' : 'bad'}"><span class="ic" aria-label="${x.ok ? 'goed' : 'fout'}">${x.ok ? '✓' : '✗'}</span><div>
        <div class="d1">${mini(x.c)} ${total} <span class="fine">tegen</span> ${mini([x.up])}${where ? ` <span class="fine">· ${where}</span>` : ''}</div>
        <div class="d2">${verdict}</div></div></li>`;
    }).join('')}</ol>` : '<p class="fine" style="margin:0">Geen keuzes in deze ronde (Black Jack of direct beslist).</p>';
    return `<details class="rnd" data-k="${r.n}"><summary><span class="no">#${r.n}</span><span class="sum">${summaryHands} <span class="fine">tegen</span> ${mini([r.dealer[0]])} ${flag}</span><span class="net ${tone}">${eur(r.net, true)}</span></summary>
      <div class="rbody">${lines.join('')}<div><h4 class="fine" style="margin:0 0 6px">Jouw keuzes</h4>${dec}</div><p class="fine" style="margin:0">Tafel ${eur(r.table)}</p></div></details>`;
  }
  function spark(hist) {
    if (hist.length < 2) return '<p class="fine">Na een paar rondes zie je hier het verloop van je saldo.</p>';
    const W = 600, H = 110, p = 8;
    const lo = Math.min(...hist, S.startBank), hi = Math.max(...hist, S.startBank);
    const span = hi - lo || 1;
    const x = (i) => p + (i / (hist.length - 1)) * (W - 2 * p);
    const y = (v) => H - p - ((v - lo) / span) * (H - 2 * p);
    const pts = hist.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
    const last = hist[hist.length - 1];
    return `<svg class="spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Saldoverloop van ${eur(hist[0])} naar ${eur(last)}">
      <line x1="${p}" x2="${W - p}" y1="${y(S.startBank)}" y2="${y(S.startBank)}" stroke="rgba(217,181,108,.4)" stroke-dasharray="4 4"/>
      <polyline points="${p},${H - p} ${pts} ${W - p},${H - p}" fill="rgba(217,181,108,.12)" stroke="none"/>
      <polyline points="${pts}" fill="none" stroke="#d9b56c" stroke-width="2" vector-effect="non-scaling-stroke"/>
      <circle cx="${x(hist.length - 1)}" cy="${y(last)}" r="4" fill="${last >= S.startBank ? '#74d6a0' : '#ee8a78'}"/>
    </svg><p class="fine">Stippellijn: startsaldo ${eur(S.startBank)}.</p>`;
  }

  /* ---- tafel wisselen ---- */
  function tableHTML() {
    if (S.phase === 'setup') return '<p class="empty-note">Kies je tafel in het startscherm.</p>';
    const ok = between() && !S.busy;
    return `<section><p style="margin:0">Je saldo van <b class="num">${eur(S.bankroll)}</b> gaat mee naar de nieuwe tafel. Je statistiek en handgeschiedenis lopen door.</p></section>
      <div class="tpick">${[20, 50, 100].map((v) => {
        const cur = v === S.settings.table, can = S.bankroll >= TABLES[v].min;
        return `<button data-act="switch" data-v="${v}" aria-pressed="${cur}" ${!ok || cur || !can ? 'disabled' : ''}><b>${eur(v)}</b><small>${cur ? 'huidige tafel' : can ? 'max ' + eur(TABLES[v].max) : 'saldo te laag'}</small></button>`;
      }).join('')}</div>
      ${ok ? '' : '<p class="fine">Wisselen kan tussen twee rondes.</p>'}
      <p class="fine">Je inzet wordt afgerond op een veelvoud van het nieuwe tafelminimum.</p>`;
  }

  /* ---- bijkopen ---- */
  function rebuyHTML() {
    if (S.phase === 'setup') return '<p class="empty-note">Start eerst een sessie.</p>';
    const presets = [...new Set([250, 500, 1000, S.startBank].filter((v) => v > 0))].sort((a, b) => a - b);
    return `<form id="rebuyForm" class="field" novalidate>
      <p style="margin:0 0 6px">Huidig saldo <b class="num">${eur(S.bankroll)}</b>. Hoeveel wil je bijkopen?</p>
      <div class="bankrow"><div class="euroin"><span>€</span><input id="rebuyAmt" type="number" inputmode="numeric" min="1" step="10" value="${S.rebuyAmt}"></div>
      <div class="presets">${presets.map((v) => `<button type="button" class="pill" data-act="rebuy-preset" data-v="${v}">${nf0.format(v)}</button>`).join('')}</div></div>
      <p class="err" id="rebuyErr"></p>
      <button type="submit" class="btn primary">Bijkopen</button>
      <p class="fine">Bijgekocht in deze sessie: ${eur(S.rebuys)}. Je netto resultaat in Analyse houdt hier rekening mee.</p>
    </form>`;
  }

  function settingsHTML() {
    const st = S.settings;
    const inSession = S.phase !== 'setup';
    const betting = S.phase === 'betting';
    return `
    <section><h3>Oefenen</h3>
      <div class="checks"><label class="check"><input type="checkbox" id="cfgTotals" ${st.totals ? 'checked' : ''}> Kaarttotalen tonen <small>uit = zelf tellen</small></label></div>
      <p class="fine">Staan de totalen uit, dan zie je ze terug in Analyse onder Handen terugkijken.</p></section>
    <section><h3>Strategie-coach</h3>
      <select id="cfgCoach">
        <option value="feedback" ${st.coach === 'feedback' ? 'selected' : ''}>Melding bij een afwijkende keuze</option>
        <option value="advies" ${st.coach === 'advies' ? 'selected' : ''}>Advies vooraf tonen</option>
        <option value="uit" ${st.coach === 'uit' ? 'selected' : ''}>Uit (achteraf terugkijken in Analyse)</option>
      </select>
      <p class="fine">Elke keuze wordt vastgelegd, ook als de coach uit staat.</p></section>
    <section><h3>Speeltempo</h3>
      <div class="seg">${Object.keys(SPEEDS).map((v) => `<label><input type="radio" name="speed" id="sp-${v}" value="${v}" ${st.speed === v ? 'checked' : ''}>${v[0].toUpperCase() + v.slice(1)}</label>`).join('')}</div></section>
    <section><h3>Sidebets aan tafel</h3>
      <div class="checks">
        <label class="check"><input type="checkbox" id="cfgPair" ${st.pair ? 'checked' : ''} ${betting || !inSession ? '' : 'disabled'}> Pair Pursuit</label>
        <label class="check"><input type="checkbox" id="cfgTripps" ${st.tripps ? 'checked' : ''} ${betting || !inSession ? '' : 'disabled'}> Tripps</label>
        <label class="check"><input type="checkbox" id="cfgJp" ${st.jackpot ? 'checked' : ''} ${betting || !inSession ? '' : 'disabled'}> Queens Pursuit jackpot</label>
      </div></section>
    ${inSession ? `<section><h3>Aantal boxen</h3>
      <div class="seg">${[1, 2, 3].map((v) => `<label><input type="radio" name="cfgBoxes" id="cb${v}" value="${v}" ${st.boxes === v ? 'checked' : ''} ${betting ? '' : 'disabled'}>${v}</label>`).join('')}</div>
      ${betting ? '' : '<p class="fine">Aanpassen kan tussen twee rondes.</p>'}</section>
    <section><h3>Tafel en saldo</h3>
      <div class="row"><button class="btn" data-act="sheet" data-v="table">Tafel wisselen<small>nu ${eur(st.table)}</small></button>
      <button class="btn" data-act="sheet" data-v="rebuy">Bijkopen<small>zelf bedrag kiezen</small></button></div>
      <button class="btn ${S.confirmReset ? 'primary' : ''}" data-act="new-session" ${S.busy ? 'disabled' : ''}>${S.confirmReset ? 'Tik nogmaals om te stoppen' : 'Nieuwe sessie'}<small>opnieuw beginnen met een ander startsaldo</small></button></section>` : ''}
    <p class="fine">Toetsen op een computer: K kaart · P pas · D verdubbel · S splits · Enter delen of herhalen.</p>`;
  }

  /* ---------- invoer ---------- */
  on('click', (e) => {
    const t = e.target.closest('[data-act]');
    if (!t) { if (e.target === $('sheet')) closeSheet(); return; }
    const a = t.dataset.act, v = t.dataset.v;
    if (t.disabled) return;
    switch (a) {
      case 'bet': changeBet(t.dataset.f, +t.dataset.d); break;
      case 'jp': toggleJp(); break;
      case 'clear': S.bets = emptyBets(S.settings.boxes); render(); break;
      case 'rebet': S.bets = fitBets(S.lastBets); render(); break;
      case 'deal': deal(); break;
      case 'selbox': if (S.phase === 'betting') { S.sel = +v; render(); } break;
      case 'ins': insure(v === '1'); break;
      case 'play': act(v); break;
      case 'change': newRound(false); break;
      case 'again': newRound(true); break;
      case 'resume': startSession(true); break;
      case 'preset': { const inp = $('setBank'); if (inp) inp.value = v; $('bankErr').textContent = ''; break; }
      case 'rebuy-preset': { const inp = $('rebuyAmt'); if (inp) inp.value = v; S.rebuyAmt = +v; $('rebuyErr').textContent = ''; break; }
      case 'switch': switchTable(+v); break;
      case 'sheet': openSheet(v); break;
      case 'close-sheet': closeSheet(); break;
      case 'tab': S.anaTab = v; $('sheetBody').scrollTop = 0; renderSheet(); break;
      case 'review': S.anaTab = 'handen'; openSheet('stats'); { const d = $('sheetBody').querySelector('details'); if (d) d.open = true; } break;
      case 'reset-stats': S.stats = freshStats(S.bankroll); S.hist = []; S.startBank = S.bankroll; S.rebuys = 0; save(); renderSheet(); break;
      case 'new-session':
        if (!S.confirmReset) { S.confirmReset = true; renderSheet(); break; }
        save(); saved = store.get(); closeSheet(); S.phase = 'setup'; S.round = null; S.msg = '';
        render(); break;
    }
  });

  on('submit', (e) => {
    e.preventDefault();
    if (e.target.id === 'rebuyForm') {
      const err = rebuy($('rebuyAmt').value);
      if (err) $('rebuyErr').textContent = err;
      return;
    }
    if (e.target.id !== 'setupForm') return;
    const f = e.target;
    const table = +(f.querySelector('input[name="table"]:checked') || {}).value || 20;
    const bank = Math.floor(+$('setBank').value);
    if (!Number.isFinite(bank) || bank < TABLES[table].min) {
      $('bankErr').textContent = `Kies een startsaldo van minstens ${eur(TABLES[table].min)} voor deze tafel.`;
      return;
    }
    if (bank > 10000000) { $('bankErr').textContent = 'Kies een startsaldo tot €10.000.000.'; return; }
    S.settings = {
      ...S.settings, table, bankroll: bank,
      boxes: +(f.querySelector('input[name="boxes"]:checked') || {}).value || 1,
      pair: $('sPair').checked, tripps: $('sTripps').checked, jackpot: $('sJp').checked, coach: $('sCoach').value, totals: $('sTotals').checked,
    };
    $('setup').innerHTML = '';
    S.rebuyAmt = bank;
    startSession(false);
  });

  on('change', (e) => {
    const t = e.target;
    const st = S.settings;
    if (t.id === 'cfgCoach') st.coach = t.value;
    else if (t.name === 'speed') st.speed = t.value;
    else if (t.id === 'cfgTotals') st.totals = t.checked;
    else if (t.id === 'onlyErr') { S.onlyErr = t.checked; renderSheet(); return; }
    else if (t.id === 'rebuyAmt') { S.rebuyAmt = +t.value || S.rebuyAmt; $('rebuyErr').textContent = ''; return; }
    else if (t.id === 'cfgPair' || t.id === 'cfgTripps' || t.id === 'cfgJp') {
      const key = { cfgPair: 'pair', cfgTripps: 'tripps', cfgJp: 'jackpot' }[t.id];
      st[key] = t.checked;
      if (!t.checked) S.bets.forEach((b) => { if (key === 'jackpot') b.jp = false; else b[key] = 0; });
    } else if (t.name === 'cfgBoxes' && S.phase === 'betting') {
      st.boxes = +t.value;
      const old = S.bets;
      S.bets = emptyBets(st.boxes).map((b, i) => old[i] || b);
      S.sel = Math.min(S.sel, st.boxes - 1);
    } else if (t.id === 'setBank') { $('bankErr').textContent = ''; return; }
    else return;
    if (S.phase === 'setup') { // houd het startformulier gelijk met wat in Instellingen is gekozen
      const m = { sTotals: 'totals', sPair: 'pair', sTripps: 'tripps', sJp: 'jackpot' };
      for (const id in m) if ($(id)) $(id).checked = st[m[id]];
      if ($('sCoach')) $('sCoach').value = st.coach;
    }
    saveSettings(); render();
  });

  on('keydown', (e) => {
    if (e.target.closest('input, select, textarea') || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 'Enter' && e.target.closest('button, summary')) return;
    if (e.key === 'Escape' && S.sheet) return closeSheet();
    if (S.sheet) return;
    const k = e.key.toLowerCase();
    if (S.phase === 'playing') {
      const map = { k: 'H', p: 'S', d: 'D', v: 'D', s: 'P' };
      if (map[k]) { e.preventDefault(); act(map[k]); }
    } else if (S.phase === 'insurance') {
      if (k === 'j') insure(true); else if (k === 'n') insure(false);
    } else if (e.key === 'Enter') {
      if (S.phase === 'betting') { e.preventDefault(); deal(); }
      else if (S.phase === 'settled') { e.preventDefault(); newRound(true); }
    }
  });

  render();
  JP.start();
  return () => {
    JP.stop();
    clearTimeout(toastTimer);
    listeners.forEach(([type, fn]) => document.removeEventListener(type, fn));
  };
}
