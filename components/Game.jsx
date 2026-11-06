'use client';

import { useEffect } from 'react';
import { startGame } from '../lib/game';

/* Fichestapels in de fichebak van de croupier (waarde, hoogte in px) */
const TRAY = [['500', 40], ['100', 50], ['50', 58], ['20', 58], ['10', 58], ['5', 52], ['2-5', 46], ['2-5', 46], ['5', 52], ['10', 58], ['20', 58], ['50', 58]];

/* De tafel zelf: een vaste opbouw waarin lib/game.js de kaarten, fiches en panelen tekent. */
export default function Game() {
  useEffect(() => startGame(), []);

  return (
    <>
      <div className="app" id="app">
        <header className="bar">
          <div className="bar-in wrap pad">
            <div className="brand">
              <span className="mark" aria-hidden="true">♠</span>
              <div style={{ minWidth: 0 }}>
                <b><span className="long">Blackjack </span>Oefentafel</b>
                <button id="tableBtn" className="tablebtn" data-act="sheet" data-v="table" hidden>
                  Tafel
                </button>
              </div>
            </div>
            <div className="bank" id="bankbar">
              <span>
                <small>Saldo</small> <output id="bankroll" className="num">€ 0</output>
              </span>
              <span className="staked" id="staked"></span>
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
                  <path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" />
                </svg>
              </button>
            </div>
          </div>
        </header>

        <div className="tabletop">
          <div className="rail">
            <div className="rail-in wrap">
              <div className="tray" aria-hidden="true">
                {TRAY.map(([k, h], i) => (
                  <span key={i} className={`stack c-${k}`} style={{ height: h }} />
                ))}
              </div>
              <div className="shuffler" aria-hidden="true">
                <i />
              </div>
            </div>
          </div>
          <section className="jackpots" id="jackpots" aria-label="Queens Pursuit jackpot"></section>
        </div>

        <div className="feltwrap" id="feltwrap">
          <div className="stage" id="stage">
            <div className="stage-in g-wide" id="stageIn">
              <div id="print"></div>
              <div className="msg" id="msg" role="status" aria-live="polite"></div>
              <div id="dealer"></div>
              <div id="boxes"></div>
            </div>
          </div>
          <div id="setup"></div>
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
