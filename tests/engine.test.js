/* Controleert de spelregels en uitbetalingen. Draaien met: npm test */
import test from 'node:test';
import assert from 'node:assert/strict';
import BJ from '../lib/engine.js';

let id = 1000;
const C = (r, s = '♠') => ({ r, s, id: ++id });
const H = (cards, o = {}) => ({ cards, bet: 20, ...o });

test('kaarttotalen', () => {
  assert.equal(BJ.total([C('A'), C('6')]).total, 17);
  assert.equal(BJ.total([C('A'), C('6'), C('10')]).total, 17);
  assert.equal(BJ.total([C('A'), C('A'), C('9')]).total, 21);
});

test('bank past op zachte 17 en koopt op 16', () => {
  assert.equal(BJ.dealerMustDraw([C('A'), C('6')]), false);
  assert.equal(BJ.dealerMustDraw([C('10'), C('6')]), true);
});

test('verdubbelen alleen op 9, 10 of 11', () => {
  assert.equal(BJ.canDoubleRule(H([C('5'), C('4')])), true);
  assert.equal(BJ.canDoubleRule(H([C('6'), C('6')])), false);
  assert.equal(BJ.canDoubleRule(H([C('4'), C('4')])), false);
  assert.equal(BJ.canDoubleRule(H([C('A'), C('8')])), true, 'aas + 8 telt als 9');
  assert.equal(BJ.canDoubleRule(H([C('A'), C('9')])), false);
  assert.equal(BJ.canDoubleRule(H([C('A'), C('K')], { fromSplit: true, splitAces: true })), false);
  assert.equal(BJ.canDoubleRule(H([C('5'), C('3'), C('2')])), false);
  const a = C('A');
  assert.equal(BJ.handTotal(H([a, C('8'), C('2')], { lockAce: a.id })), 11, 'aas blijft 1 na verdubbelen');
});

test('splitsen op gelijke puntwaarde', () => {
  assert.equal(BJ.canSplitRule(H([C('J'), C('K')])), true);
  assert.equal(BJ.canSplitRule(H([C('9'), C('K')])), false);
  assert.equal(BJ.isNatural(H([C('A'), C('Q')], { fromSplit: true })), false, 'na splitsen geen Black Jack');
});

test('sidebets', () => {
  assert.equal(BJ.pairPursuit(C('K', '♠'), C('K', '♠')).mult, 25);
  assert.equal(BJ.pairPursuit(C('K', '♥'), C('K', '♦')).mult, 12);
  assert.equal(BJ.pairPursuit(C('K', '♥'), C('K', '♣')).mult, 6);
  assert.equal(BJ.pairPursuit(C('K', '♥'), C('Q', '♥')), null);
  assert.equal(BJ.tripps(C('5', '♥'), C('6', '♥'), C('7', '♥')).mult, 30);
  assert.equal(BJ.tripps(C('8', '♥'), C('8', '♣'), C('8', '♥')).mult, 20);
  assert.equal(BJ.tripps(C('Q', '♥'), C('K', '♣'), C('A', '♥')).mult, 10);
  assert.equal(BJ.tripps(C('A', '♥'), C('2', '♣'), C('3', '♥')).mult, 10);
  assert.equal(BJ.tripps(C('2', '♥'), C('9', '♥'), C('K', '♥')).mult, 5);
  assert.equal(BJ.tripps(C('K', '♥'), C('A', '♣'), C('2', '♥')), null);
});

test('Queens Pursuit', () => {
  assert.equal(BJ.queens(C('Q', '♦'), C('Q', '♦'), C('Q', '♦')).jackpot, 'mega');
  assert.equal(BJ.queens(C('Q', '♣'), C('Q', '♣'), C('Q', '♣')).jackpot, 'major');
  assert.equal(BJ.queens(C('Q', '♥'), C('Q', '♦'), C('Q', '♦')).jackpot, 'minor');
  assert.equal(BJ.queens(C('Q', '♠'), C('Q', '♦'), C('Q', '♠')).mult, 100);
  assert.equal(BJ.queens(C('Q', '♦'), C('Q', '♦'), C('5')).mult, 80);
  assert.equal(BJ.queens(C('Q', '♥'), C('Q', '♥'), C('5')).mult, 40);
  assert.equal(BJ.queens(C('Q', '♥'), C('Q', '♠'), C('5')).mult, 20);
  assert.equal(BJ.queens(C('3', '♥'), C('Q', '♦'), C('Q', '♦')).mult, 8);
  assert.equal(BJ.queens(C('3', '♥'), C('Q', '♥'), C('5')), null);
});

test('uitbetalingen', () => {
  assert.deepEqual(BJ.settleHand(H([C('A'), C('K')]), [C('9'), C('8')]), { outcome: 'bj', ret: 50 });
  assert.deepEqual(BJ.settleHand(H([C('A'), C('K')]), [C('A'), C('K')]), { outcome: 'push', ret: 20 });
  assert.deepEqual(BJ.settleHand(H([C('10'), C('K')], { bet: 40 }), [C('A'), C('K')]), { outcome: 'lose', ret: 0 }, 'Black Jack van de bank neemt ook verdubbelde inzet');
  assert.deepEqual(BJ.settleHand(H([C('7'), C('7'), C('7')]), [C('A'), C('K')]), { outcome: 'lose', ret: 0 });
  assert.deepEqual(BJ.settleHand(H([C('10'), C('8'), C('5')]), [C('10'), C('6'), C('9')]), { outcome: 'bust', ret: 0 });
  assert.deepEqual(BJ.settleHand(H([C('A'), C('K')], { fromSplit: true }), [C('10'), C('9')]), { outcome: 'win', ret: 40 });
  assert.equal(BJ.is777(H([C('7'), C('7'), C('7')])), true);
});

test('basisstrategie zonder dichte kaart', () => {
  assert.equal(BJ.strategy(H([C('6'), C('5')]), C('10')), 'H');
  assert.equal(BJ.strategy(H([C('6'), C('5')]), C('9')), 'D');
  assert.equal(BJ.strategy(H([C('8'), C('8')]), C('10')), 'H');
  assert.equal(BJ.strategy(H([C('A'), C('A')]), C('A')), 'H');
  assert.equal(BJ.strategy(H([C('A'), C('7')]), C('9')), 'H');
  assert.equal(BJ.strategy(H([C('10'), C('2')]), C('3')), 'H');
});
