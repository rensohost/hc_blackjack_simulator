/* Tafelgeometrie en vilt-opdruk, naar de blackjacktafel van Holland Casino.
   Alles staat in de coördinaten van het laken (breed: 1440 × 760, smal: 390 × 560).
   De pagina schaalt dat geheel naar de beschikbare breedte.

   Elke box ligt op een "baan" die vanaf een middelpunt boven de tafel naar buiten loopt.
   Binnen een baan rekenen we met t (dwars, naar rechts) en u (naar buiten, vanaf de boog). */

export const GEOMS = {
  wide: {
    name: 'wide', W: 1440, H: 760, core: 575, cx: 720, cy: -1250, R: 1660, step: 7.5, lanes: 9,
    card: { w: 66, h: 92, dx: 20, dy: 12 },
    dealer: { x: 720, y: 68 },
    msgY: 158, msgW: 560,
    text: { r: [1490, 1516], size: [22, 12], spacing: [4, 4] },
    lane: {
      cardU: -70, metaU: -12,
      box: { u: 62, r: 36 }, mees: [{ u: 144, r: 29 }, { u: 224, r: 29 }],
      tripps: { t: -70, u: 40, r: 17, fs: 12 },
      coin: { t: 78, u: 32, r: 19, r2: 12.5 },
      pill: { t: 51, u: 68, w: 54, h: 200 }, pp: { t: 78, u: 302, fs: 22 }, ppChip: { t: 78, u: 108 },
      ins: { t: -64, u: -16 },
    },
    chip: { main: 52, side: 40, coin: 32, tripps: 30, ins: 32 },
    sideText: false, // teksten in de hoeken (bank koopt tot 16, Pair Pursuit-uitbetalingen): staan al in de spelregels
  },
  narrow: {
    name: 'narrow', W: 390, H: 560, core: 440, cx: 195, cy: -664, R: 1000, step: 6.5, lanes: 7,
    card: { w: 46, h: 64, dx: 14, dy: 8 },
    dealer: { x: 195, y: 58 },
    msgY: 112, msgW: 300,
    text: { r: [820, 840], size: [13, 8], spacing: [2, 2.5] },
    lane: {
      cardU: -62, metaU: -16,
      box: { u: 44, r: 26 }, mees: [{ u: 106, r: 20 }, { u: 160, r: 20 }],
      tripps: { t: -40, u: 20, r: 11, fs: 8.5 },
      coin: { t: 46, u: 20, r: 13, r2: 8.5 },
      pill: { t: 30, u: 42, w: 32, h: 124 }, pp: { t: 46, u: 188, fs: 14 }, ppChip: { t: 46, u: 70 },
      ins: { t: -42, u: -12 },
    },
    chip: { main: 38, side: 28, coin: 22, tripps: 20, ins: 22 },
    sideText: false,
  },
};

/* Telefoon liggend: dezelfde brede tafel, maar we schalen op het middenstuk (x 240 tot 1200),
   zodat drie boxen groot in beeld staan. De bediening staat dan rechts naast de tafel.
   Deze mediaquery staat ook in globals.css; houd ze gelijk. */
export const LAND_MQ = '(orientation: landscape) and (max-height: 500px) and (min-width: 560px)';
export const LAND_VIEW = { x0: 240, w: 960, core: 545, msgW: 440 };

const rad = (d) => (d * Math.PI) / 180;
const f1 = (n) => Math.round(n * 10) / 10;

/* Hoeken van alle banen op de tafel. Bij een even aantal boxen schuiven de banen een halve stap op,
   zodat de gekozen boxen altijd symmetrisch in het midden liggen. */
export function laneAngles(g, boxes) {
  const even = boxes % 2 === 0;
  const count = even ? g.lanes + 1 : g.lanes;
  const half = (count - 1) / 2;
  const all = Array.from({ length: count }, (_, k) => (half - k) * g.step); // links (positief) naar rechts
  const first = Math.round(half - (boxes - 1) / 2);
  return { all, active: all.slice(first, first + boxes) };
}

/* Punt in een baan: phi = hoek van de baan, t = dwars, u = vanaf de boog naar buiten */
export function lanePoint(g, phi, t, u) {
  const a = rad(phi), r = g.R + u;
  return { x: g.cx - r * Math.sin(a) + t * Math.cos(a), y: g.cy + r * Math.cos(a) + t * Math.sin(a) };
}

function arc(g, R, x0, x1) {
  const y = (x) => f1(g.cy + Math.sqrt(R * R - (x - g.cx) * (x - g.cx)));
  return `M ${x0} ${y(x0)} A ${R} ${R} 0 0 0 ${x1} ${y(x1)}`;
}

const INK = '#f4f0e8', RED = '#c8412f';
const SERIF = "'Open Sans', 'Helvetica Neue', Arial, sans-serif"; // teksten op het laken
const SANS = "'Open Sans', 'Helvetica Neue', Arial, sans-serif";

/* De opdruk op het laken als SVG-tekst. opts.sideText = false laat de teksten in de hoeken weg (telefoon liggend). */
export function feltPrint(g, boxes, opts = {}) {
  const { all, active } = laneAngles(g, boxes);
  const L = g.lane, cx = g.cx, by = g.cy + g.R; // baan zonder draaiing: recht naar beneden vanaf (cx, by)
  const ext = g.name === 'wide' ? 900 : 420;
  // Banen waar je speelt krijgen de volledige opdruk; de lege banen ernaast staan er rustig en zonder tekst bij.
  const lanes = all.map((phi) => {
    const on = active.includes(phi);
    return `<g transform="rotate(${phi} ${cx} ${g.cy})"${on ? '' : ' opacity=".3"'}>
    <circle cx="${cx}" cy="${by + L.box.u}" r="${L.box.r}" fill="none" stroke="${INK}" stroke-width="${g.name === 'wide' ? 2.5 : 2.2}"/>
    ${on ? L.mees.map((m) => `<circle cx="${cx}" cy="${by + m.u}" r="${m.r}" fill="none" stroke="${INK}" stroke-opacity=".45" stroke-width="1.6"/>`).join('') : ''}
    <circle cx="${cx + L.tripps.t}" cy="${by + L.tripps.u}" r="${L.tripps.r}" fill="none" stroke="${INK}" stroke-width="1.5"/>
    ${on ? `<text x="${cx + L.tripps.t}" y="${f1(by + L.tripps.u + L.tripps.fs * 0.36)}" text-anchor="middle" fill="${INK}" font-family="${SANS}" font-size="${L.tripps.fs}" font-weight="600">3+</text>` : ''}
    <circle cx="${cx + L.coin.t}" cy="${by + L.coin.u}" r="${L.coin.r}" fill="none" stroke="${INK}" stroke-width="1.7"/>
    <circle cx="${cx + L.coin.t}" cy="${by + L.coin.u}" r="${L.coin.r2}" fill="none" stroke="${INK}" stroke-width="1.3"/>
    <rect x="${cx + L.pill.t}" y="${by + L.pill.u}" width="${L.pill.w}" height="${L.pill.h}" rx="${L.pill.w / 2}" fill="none" stroke="${RED}" stroke-width="${g.name === 'wide' ? 3 : 2.5}"/>
    ${on ? `<text x="${cx + L.pp.t}" y="${by + L.pp.u}" text-anchor="middle" fill="${RED}" font-family="${SANS}" font-size="${L.pp.fs}" font-weight="800" letter-spacing="1">PP</text>` : ''}
  </g>`;
  }).join('');
  const t = g.text;
  const side = (opts.sideText ?? g.sideText) ? `
    <text x="48" y="56" fill="${INK}" fill-opacity=".75" font-family="${SERIF}" font-size="12" letter-spacing="2.5">BANK KOOPT TOT EN MET 16</text>
    <text x="48" y="76" fill="${INK}" fill-opacity=".75" font-family="${SERIF}" font-size="12" letter-spacing="2.5">EN PAST OP ALLE 17</text>
    <text x="48" y="104" fill="${INK}" fill-opacity=".75" font-family="${SERIF}" font-size="14" font-style="italic">Bonus 777 · 1 tot 1</text>
    <text x="${g.W - 48}" y="56" text-anchor="end" fill="${RED}" font-family="${SERIF}" font-size="13" font-weight="700" letter-spacing="2.5">PAIR PURSUIT</text>
    <text x="${g.W - 48}" y="78" text-anchor="end" fill="${INK}" fill-opacity=".75" font-family="${SERIF}" font-size="14" font-style="italic">Mixed 6 tot 1</text>
    <text x="${g.W - 48}" y="98" text-anchor="end" fill="${INK}" fill-opacity=".75" font-family="${SERIF}" font-size="14" font-style="italic">Coloured 12 tot 1</text>
    <text x="${g.W - 48}" y="118" text-anchor="end" fill="${INK}" fill-opacity=".75" font-family="${SERIF}" font-size="14" font-style="italic">Perfect 25 tot 1</text>` : '';
  return `<svg class="print" width="${g.W}" height="${g.H}" viewBox="0 0 ${g.W} ${g.H}" aria-hidden="true" focusable="false">
    <defs>
      <path id="arc-main-${g.name}" d="${arc(g, t.r[0], 0, g.W)}"/>
      <path id="arc-sub-${g.name}" d="${arc(g, t.r[1], 0, g.W)}"/>
    </defs>
    <path d="${arc(g, g.R, -ext, g.W + ext)}" fill="none" stroke="${INK}" stroke-opacity=".85" stroke-width="${g.name === 'wide' ? 2.5 : 2}"/>
    <text fill="${INK}" font-family="${SERIF}" font-size="${t.size[0]}" font-weight="700" letter-spacing="${t.spacing[0]}"><textPath href="#arc-main-${g.name}" startOffset="50%" text-anchor="middle">BLACK JACK BETAALT 3 TOT 2</textPath></text>
    <text fill="${INK}" fill-opacity=".6" font-family="${SERIF}" font-size="${t.size[1]}" letter-spacing="${t.spacing[1]}"><textPath href="#arc-sub-${g.name}" startOffset="50%" text-anchor="middle">VERZEKERING BETAALT 2 TOT 1</textPath></text>
    ${side}
    ${lanes}
  </svg>`;
}
