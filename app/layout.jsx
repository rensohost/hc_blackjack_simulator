import './globals.css';

export const metadata = {
  title: 'Blackjack Oefentafel',
  description:
    'Oefen blackjack met de tafelregels van Holland Casino: tafels van €20, €50 en €100, sidebets, gedeelde jackpot en een strategie-coach. Speelgeld, geen echt geld.',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#0b1714',
};

export default function RootLayout({ children }) {
  return (
    <html lang="nl">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Bodoni+Moda:ital,opsz,wght@0,6..96,500;0,6..96,700;1,6..96,500&family=Instrument+Sans:wght@400;500;600;700&family=Spline+Sans+Mono:wght@400;500;600&display=swap"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
