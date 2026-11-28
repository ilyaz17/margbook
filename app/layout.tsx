import type { Metadata, Viewport } from 'next';
import { MargBooksProvider } from '../src/components/MargBooksContext';
import './globals.css';

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#047857' },
    { media: '(prefers-color-scheme: dark)', color: '#0B1120' },
  ],
  width: 'device-width',
  initialScale: 1,
};

export const metadata: Metadata = {
  title: 'MargBooks Cloud ERP & Retail POS',
  description:
    'High-speed Indian supermarket POS, barcode & loose-weight kg/gm billing, offline checkout queue, wastage tracking, multi-lane checkout, GST filing, and cloud ERP.',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'FreshMart POS',
  },
  icons: {
    icon: '/icon.svg',
    apple: '/apple-touch-icon.png',
  },
  openGraph: {
    title: 'MargBooks Cloud ERP & Retail POS',
    description:
      'High-speed Indian supermarket POS, barcode & loose-weight kg/gm billing, offline checkout queue, wastage tracking, multi-lane checkout, GST filing, and cloud ERP.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'MargBooks Cloud ERP & Retail POS',
    description:
      'High-speed Indian supermarket POS, barcode & loose-weight kg/gm billing, offline checkout queue, wastage tracking, multi-lane checkout, GST filing, and cloud ERP.',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&family=Plus+Jakarta+Sans:wght@500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body
        suppressHydrationWarning
        className="font-sans bg-slate-50 dark:bg-[#0B1120] text-slate-900 dark:text-slate-100 antialiased selection:bg-emerald-100 dark:selection:bg-emerald-900/50 selection:text-emerald-900 dark:selection:text-emerald-100 transition-colors"
      >
        <MargBooksProvider>{children}</MargBooksProvider>
      </body>
    </html>
  );
}
