'use client';

import { useEffect } from 'react';
import { startGame } from '../lib/game';

/* De tafel zelf: een vaste opbouw waarin lib/game.js de kaarten, inzetten en panelen tekent. */
export default function Game() {
  useEffect(() => startGame(), []);

  return (
    <>
      <div className="app">
        <header className="bar pad">
          <div className="brand">
            <span className="mark" aria-hidden="true">♠</span>
            <div style={{ minWidth: 0 }}>
              <b>Blackjack Oefentafel</b>
              <small id="tableLabel">Regels Holland Casino · speelgeld</small>
              <button id="tableBtn" className="tablebtn" data-act="sheet" data-v="table" hidden>
                Tafel
              </button>
            </div>
          </div>
          <div className="iconbtns">
            <button className="iconbtn" data-act="sheet" data-v="rules" aria-label="Spelregels en uitbetalingen" title="Spelregels">
              <svg viewBox="0 0 24 24">
                <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z" />
                <path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5" />
                <path d="M8 7h8M8 11h6" />
              </svg>
            </button>
            <button className="iconbtn" data-act="sheet" data-v="chart" aria-label="Strategiekaart" title="Strategiekaart">
              <svg viewBox="0 0 24 24">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path d="M3 9h18M3 15h18M9 3v18M15 3v18" />
              </svg>
            </button>
            <button className="iconbtn" data-act="sheet" data-v="stats" aria-label="Analyse" title="Analyse">
              <svg viewBox="0 0 24 24">
                <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
              </svg>
            </button>
            <button className="iconbtn" data-act="sheet" data-v="settings" aria-label="Instellingen" title="Instellingen">
              <svg viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
              </svg>
            </button>
          </div>
        </header>

        <div className="bankbar pad" id="bankbar">
          <div>
            <small>Saldo</small>
            <output id="bankroll" className="num">€ 0</output>
          </div>
          <span className="staked" id="staked"></span>
        </div>

        <section className="jackpots pad" id="jackpots" aria-label="Queens Pursuit jackpots"></section>

        <div className="feltwrap pad">
          <main className="felt" id="felt">
            <div className="dealer" id="dealer"></div>
            <svg className="inscr" viewBox="0 0 400 104" aria-label="Black Jack betaalt 3 tot 2. Verzekering betaalt 2 tot 1.">
              <defs>
                <path id="arcA" d="M 24 14 Q 200 96 376 14" />
                <path id="arcB" d="M 78 54 Q 200 110 322 54" />
              </defs>
              <text className="big">
                <textPath href="#arcA" startOffset="50%" textAnchor="middle">BLACK JACK BETAALT 3 TOT 2</textPath>
              </text>
              <text className="small">
                <textPath href="#arcB" startOffset="50%" textAnchor="middle">VERZEKERING BETAALT 2 TOT 1</textPath>
              </text>
            </svg>
            <div className="ruleline">Bank koopt tot en met 16 en past op alle 17</div>
            <div className="msg" id="msg" role="status" aria-live="polite"></div>
            <div className="boxes" id="boxes"></div>
            <div id="setup"></div>
          </main>
        </div>

        <div id="toast" className="toast" hidden role="status" aria-live="polite"></div>
        <footer className="dock" id="dockwrap">
          <div className="dock-in pad" id="dock"></div>
        </footer>
      </div>

      <div className="sheet" id="sheet" hidden>
        <div className="sheet-panel" role="dialog" aria-modal="true" aria-labelledby="sheetTitle">
          <div className="sheet-head">
            <h2 id="sheetTitle">Spelregels</h2>
            <button className="iconbtn" data-act="close-sheet" aria-label="Sluiten">
              <svg viewBox="0 0 24 24">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>
          <div className="sheet-body" id="sheetBody"></div>
        </div>
      </div>
    </>
  );
}
