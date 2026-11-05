# Blackjack Oefentafel

Oefen blackjack met de tafelregels van Holland Casino (Spelreglement juli 2026, art. 3.2). Speelgeld, geen echt geld. Onofficieel en niet verbonden aan Holland Casino.

- Tafels van €20, €50 en €100, eigen startsaldo, wisselen van tafel met je saldo
- Sidebets Pair Pursuit en Tripps, Queens Pursuit jackpot (gedeeld tussen alle spelers)
- Strategiekaart, strategie-coach en handen terugkijken in Analyse

## Online zetten (eenmalig)

### 1. Op GitHub zetten
1. Maak een gratis account op [github.com](https://github.com) als je dat nog niet hebt.
2. Klik rechtsboven op **+** → **New repository**. Naam: `blackjack-oefentafel`. Kies Public of Private (allebei werkt). Vink niets aan bij "Initialize this repository". Klik **Create repository**.
3. Klik op de pagina die verschijnt op **uploading an existing file**.
4. Sleep de **inhoud** van deze map (niet de map zelf) in het venster: `app`, `components`, `lib`, `tests`, `package.json`, `package-lock.json`, `next.config.mjs`, `README.md`, `.gitignore`, `.env.example`.
   Op een Mac zie je `.gitignore` en `.env.example` pas na **Cmd + Shift + punt** in Finder.
5. Klik onderaan op **Commit changes**.

### 2. Live zetten met Vercel
1. Ga naar [vercel.com](https://vercel.com) en kies **Sign up** → **Continue with GitHub**. Het gratis Hobby-plan is genoeg.
2. Klik **Add New…** → **Project**, geef Vercel toegang tot je GitHub-repository en klik bij `blackjack-oefentafel` op **Import**.
3. Vercel herkent Next.js vanzelf. Laat alle instellingen staan en klik **Deploy**.
4. Na ongeveer een minuut staat de site online op een adres als `blackjack-oefentafel.vercel.app`. De jackpot werkt nu nog per speler (lokale stand).

### 3. Gedeelde jackpot aanzetten
1. Open je project in Vercel en ga naar het tabblad **Storage**.
2. Kies **Upstash for Redis** (via Create Database of de Marketplace), kies het gratis plan en koppel de database aan dit project.
   Vercel zet de benodigde sleutels (`KV_REST_API_URL` en `KV_REST_API_TOKEN`) dan automatisch klaar.
3. Ga naar **Deployments**, klik bij de bovenste op **⋯** → **Redeploy**.
4. Open de site en start een tafel. Onder de jackpotmeters staat nu een groen bolletje met "Live".

De site gaat zuinig om met de database: de stand wordt via de cache van Vercel opgehaald (hooguit ongeveer drie keer per minuut, hoeveel spelers er ook zijn) en jackpotinzetten worden per speler gebundeld verstuurd. Testversies (branches anders dan `main`) gebruiken een aparte test-jackpot, zodat ze de live meters niet laten groeien.

### 4. Eigen domeinnaam (optioneel)
In Vercel: **Settings** → **Domains** → vul je domein in en volg de DNS-instructies.

## Updates doen

Vercel zet elke wijziging op de `main`-branch van GitHub automatisch live, meestal binnen een minuut. Er zijn drie manieren:

- **Via Claude (makkelijkst):** koppel GitHub in claude.ai onder Instellingen → Connectors. Noem in een gesprek je repository (bijvoorbeeld `jouwnaam/blackjack-oefentafel`) en vraag wat je wilt veranderen. Claude kan de wijziging dan direct naar GitHub zetten.
- **Op github.com:** open een bestand, klik op het potlood, pas aan en klik **Commit changes**. Of upload een nieuwe versie van een bestand via **Add file** → **Upload files**.
- **Eerst proberen:** zet een wijziging op een andere branch dan `main`. Vercel maakt daar een aparte testlink van, zonder dat de echte site verandert.

Gaat er iets mis, dan kun je in Vercel onder **Deployments** een eerdere versie met **Promote to Production** terugzetten.

## Waar zit wat

| Bestand | Wat staat erin |
| --- | --- |
| `lib/engine.js` | Spelregels: totalen, wanneer de bank koopt, verdubbelen, splitsen, sidebets, uitbetalingen, basisstrategie |
| `lib/table.js` | Tafelontwerp: boog, boxen, Pair Pursuit-, Tripps- en jackpotvakken, en waar kaarten en fiches liggen |
| `lib/game.js` | Het spelverloop en alles wat op het scherm getekend wordt, inclusief teksten van spelregels en panelen |
| `lib/jackpot-config.js` | Startbedragen van de jackpots en hoeveel van elke inzet naar de meters gaat |
| `lib/jackpot.js` | Jackpot in de browser: ophalen van de gedeelde stand, inzetten bundelen, lokale terugval |
| `app/api/jackpot/route.js` | Server: bewaart de gedeelde jackpot in Redis, met cache en bescherming tegen nepverzoeken |
| `app/globals.css` | Kleuren, fiches en opmaak, ook de liggende indeling voor telefoons |
| `app/layout.jsx` | Paginatitel en de lettertypes (Libre Baskerville en Archivo, meegeleverd met de site) |
| `components/Game.jsx` | De vaste opbouw van de pagina (balk, laken, knoppen) |
| `tests/engine.test.js` | Controles op de spelregels |

## Zelf draaien op je computer (optioneel)

Nodig: [Node.js](https://nodejs.org) 20.9 of nieuwer.

```bash
npm install
npm run dev      # open http://localhost:3000
npm test         # controleert de spelregels
```

Zonder `.env.local` draait de jackpot lokaal. Wil je lokaal de gedeelde jackpot testen, kopieer dan `.env.example` naar `.env.local` en vul de Upstash-gegevens in.
