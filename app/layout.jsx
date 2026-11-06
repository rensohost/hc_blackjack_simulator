/* Lettertype Open Sans komt mee met de site zelf (geen verbinding met Google nodig, dus ook geen IP-adres naar Google). */
import '@fontsource/open-sans/400.css';
import '@fontsource/open-sans/400-italic.css';
import '@fontsource/open-sans/500.css';
import '@fontsource/open-sans/600.css';
import '@fontsource/open-sans/700.css';
import '@fontsource/open-sans/800.css';
import './globals.css';

export const metadata = {
  title: 'Blackjack Oefentafel',
  description:
    'Oefen blackjack met de tafelregels van Holland Casino: tafels van €20, €50 en €100, sidebets, gedeelde jackpot en een strategie-coach. Speelgeld, geen echt geld. Onofficieel, niet verbonden aan Holland Casino.',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#17181a',
};

export default function RootLayout({ children }) {
  return (
    <html lang="nl">
      <body>{children}</body>
    </html>
  );
}
