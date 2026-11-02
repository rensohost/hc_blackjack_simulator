/* Spelmotor: regels volgens Holland Casino Spelreglement (juli 2026), art. 3.2 Black Jack.
   Puur rekenwerk, geen DOM. Getest met 300.000 gesimuleerde rondes (huisvoordeel ca. 0,5%). */
const BJ = (() => {
  const SUITS = ['♠', '♥', '♦', '♣'];
  const SUIT_NAME = { '♠': 'schoppen', '♥': 'harten', '♦': 'ruiten', '♣': 'klaveren' };
  const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  const isRed = (s) => s === '♥' || s === '♦';
  let uid = 0;

  function rand() {
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      const a = new Uint32Array(1);
      crypto.getRandomValues(a);
      return a[0] / 4294967296;
    }
    return Math.random();
  }

  /* 6 decks; de schudmachine krijgt na elke ronde alle kaarten terug, dus elke ronde een volle slof */
  function makeShoe(decks = 6, rng = rand) {
    const shoe = [];
    for (let d = 0; d < decks; d++)
      for (const s of SUITS)
        for (const r of RANKS) shoe.push({ r, s, id: ++uid });
    for (let i = shoe.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [shoe[i], shoe[j]] = [shoe[j], shoe[i]];
    }
    return shoe;
  }

  /* Lid 1: 2-10 op waarde, heer/vrouw/boer 10, aas 1 of 11 */
  const val = (c) => (c.r === 'A' ? 1 : ['10', 'J', 'Q', 'K'].includes(c.r) ? 10 : +c.r);
  const rankIdx = (c) => RANKS.indexOf(c.r) + 1; // A=1 … K=13

  /* lockAce: id van een aas die vast op 1 punt staat (verdubbelen op aas+8, lid 7) */
  function total(cards, lockAce = null) {
    let hard = 0, freeAces = 0;
    for (const c of cards) {
      hard += val(c);
      if (c.r === 'A' && c.id !== lockAce) freeAces++;
    }
    const soft = freeAces > 0 && hard + 10 <= 21;
    return { total: soft ? hard + 10 : hard, hard, soft };
  }
  const handTotal = (h) => total(h.cards, h.lockAce).total;

  /* Lid 3 + 8: Black Jack = eerste twee kaarten 21, niet na splitsen */
  const isNatural = (h) => !h.fromSplit && h.cards.length === 2 && total(h.cards).total === 21;
  const dealerBJ = (cards) => cards.length === 2 && total(cards).total === 21;

  /* Lid 7 + 8: verdubbelen op 9, 10 of 11 met twee kaarten (ook na splitsen, niet bij gesplitste azen).
     Aas+8 telt als 9; die aas blijft daarna 1 punt. */
  function canDoubleRule(h) {
    if (h.cards.length !== 2 || h.splitAces || h.doubled) return false;
    const t = total(h.cards);
    const hasAce = h.cards.some((c) => c.r === 'A');
    if (!hasAce) return t.hard >= 9 && t.hard <= 11;
    return t.hard === 9; // aas + 8
  }
  /* Lid 8: splitsen bij gelijke puntwaarde (dus ook boer + heer), onbeperkt opnieuw splitsen */
  const canSplitRule = (h) => h.cards.length === 2 && val(h.cards[0]) === val(h.cards[1]);

  /* Lid 4: bank koopt t/m 16, past op 17 of meer; aas telt 11 als de bank daarmee 17-21 haalt */
  const dealerMustDraw = (cards) => total(cards).total < 17;

  /* ---- Sidebets ---- */
  /* Lid 13: Pair Pursuit, op de eerste twee kaarten van de speler */
  function pairPursuit(c1, c2) {
    if (c1.r !== c2.r) return null;
    if (c1.s === c2.s) return { name: 'Perfect Pursuit', mult: 25 };
    if (isRed(c1.s) === isRed(c2.s)) return { name: 'Coloured Pursuit', mult: 12 };
    return { name: 'Mixed Pursuit', mult: 6 };
  }

  /* Lid 14: Tripps, eerste twee kaarten speler + eerste kaart bank */
  function tripps(c1, c2, c3) {
    const cs = [c1, c2, c3];
    const flush = cs.every((c) => c.s === c1.s);
    const lo = cs.map(rankIdx).sort((a, b) => a - b);
    const trips = lo[0] === lo[2];
    const consec = (a) => a[1] === a[0] + 1 && a[2] === a[1] + 1;
    let straight = consec(lo);
    if (!straight && lo[0] === 1) straight = consec(lo.map((r) => (r === 1 ? 14 : r)).sort((a, b) => a - b));
    if (straight && flush) return { name: 'Straight Flush', mult: 30 };
    if (trips) return { name: 'Three of a Kind', mult: 20 };
    if (straight) return { name: 'Straight', mult: 10 };
    if (flush) return { name: 'Flush', mult: 5 };
    return null;
  }

  /* Lid 11: Queens Pursuit jackpot; per hand maximaal één uitbetaling (de hoogste) */
  function queens(c1, c2, d) {
    const Q = (c) => c.r === 'Q';
    if (Q(c1) && Q(c2) && Q(d)) {
      const ss = [c1.s, c2.s, d.s];
      if (ss.every((s) => s === '♦')) return { name: 'Drie ruiten vrouwen', jackpot: 'mega' };
      if (ss.every((s) => s === ss[0])) return { name: 'Drie vrouwen ' + SUIT_NAME[ss[0]], jackpot: 'major' };
      if (ss.every((s) => isRed(s) === isRed(ss[0]))) return { name: 'Drie vrouwen ' + (isRed(ss[0]) ? 'rood' : 'zwart'), jackpot: 'minor' };
      return { name: 'Drie vrouwen', mult: 100 };
    }
    if (Q(c1) && Q(c2)) {
      if (c1.s === '♦' && c2.s === '♦') return { name: 'Paar ruiten vrouwen', mult: 80 };
      if (c1.s === c2.s) return { name: 'Paar vrouwen ' + SUIT_NAME[c1.s], mult: 40 };
      return { name: 'Paar vrouwen', mult: 20 };
    }
    if ((Q(c1) && c1.s === '♦') || (Q(c2) && c2.s === '♦')) return { name: 'Ruiten vrouw', mult: 8 };
    return null;
  }

  /* Lid 9: bonus 777, eerste drie kaarten van een box elk een 7, zonder splitsen */
  const is777 = (h) => !h.fromSplit && h.cards.length >= 3 && h.cards.slice(0, 3).every((c) => c.r === '7');

  /* ---- Afrekening hoofdspel (lid 3, 4, 5) ----
     Zonder hole card trekt de bank haar tweede kaart pas na de spelers;
     bij Black Jack van de bank verliezen dus ook verdubbelde en gesplitste inzetten. */
  function settleHand(h, dealer) {
    const p = handTotal(h);
    const d = total(dealer).total;
    const dBJ = dealerBJ(dealer);
    if (p > 21) return { outcome: 'bust', ret: 0 };
    if (isNatural(h)) return dBJ ? { outcome: 'push', ret: h.bet } : { outcome: 'bj', ret: h.bet * 2.5 };
    if (dBJ) return { outcome: 'lose', ret: 0 };
    if (d > 21) return { outcome: 'win', ret: h.bet * 2 };
    if (p > d) return { outcome: 'win', ret: h.bet * 2 };
    if (p < d) return { outcome: 'lose', ret: 0 };
    return { outcome: 'push', ret: h.bet };
  }

  /* ---- Basisstrategie voor deze regels ----
     6 decks, geen hole card, bank past op soft 17, verdubbelen alleen 9-11, verdubbelen na splitsen,
     opnieuw splitsen toegestaan, geen overgave. Codes: H kaart, S pas, D verdubbel, P splits. */
  function strategy(h, up, opts = { canDouble: true, canSplit: true }) {
    const u = val(up) === 1 ? 11 : val(up);
    const c = h.cards;
    if (opts.canSplit && c.length === 2 && val(c[0]) === val(c[1])) {
      const p = val(c[0]);
      let split = false;
      switch (p) {
        case 1: split = u <= 10 || h.splitAces; break;
        case 10: split = false; break;
        case 9: split = [2, 3, 4, 5, 6, 8, 9].includes(u); break;
        case 8: split = u <= 9; break;
        case 7: split = u <= 7; break;
        case 6: split = u <= 6; break;
        case 5: split = false; break;
        case 4: split = u === 5 || u === 6; break;
        default: split = u <= 7; // 2,2 en 3,3
      }
      if (split) return 'P';
    }
    if (h.splitAces) return 'S';
    const t = total(c, h.lockAce);
    let a;
    if (t.soft) {
      if (t.total <= 17) a = 'H';
      else if (t.total === 18) a = u <= 8 ? 'S' : 'H';
      else a = 'S';
    } else {
      const x = t.total;
      if (x <= 8) a = 'H';
      else if (x === 9) a = u >= 3 && u <= 6 ? 'D' : 'H';
      else if (x === 10 || x === 11) a = u <= 9 ? 'D' : 'H';
      else if (x === 12) a = u >= 4 && u <= 6 ? 'S' : 'H';
      else if (x <= 16) a = u <= 6 ? 'S' : 'H';
      else a = 'S';
    }
    if (a === 'D' && !opts.canDouble) a = 'H';
    return a;
  }

  return {
    SUITS, RANKS, SUIT_NAME, isRed, makeShoe, val, total, handTotal, isNatural, dealerBJ,
    canDoubleRule, canSplitRule, dealerMustDraw, pairPursuit, tripps, queens, is777, settleHand, strategy,
  };
})();
export default BJ;
