import type { Metadata } from 'next';
import { DM_Sans, JetBrains_Mono, Plus_Jakarta_Sans } from 'next/font/google';
import { MargBooksProvider } from '../src/components/MargBooksContext';
import './globals.css';

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-display',
});

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-mono',
});

export const metadata: Metadata = {
  title: 'MargBooks Cloud ERP & Retail POS',
  description:
    'High-speed Indian supermarket POS, barcode & loose-weight kg/gm billing, multi-lane checkout, MRP savings thermal receipts, GST filing, and cloud ERP.',
  openGraph: {
    title: 'MargBooks Cloud ERP & Retail POS',
    description:
      'High-speed Indian supermarket POS, barcode & loose-weight kg/gm billing, multi-lane checkout, MRP savings thermal receipts, GST filing, and cloud ERP.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'MargBooks Cloud ERP & Retail POS',
    description:
      'High-speed Indian supermarket POS, barcode & loose-weight kg/gm billing, multi-lane checkout, MRP savings thermal receipts, GST filing, and cloud ERP.',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${plusJakarta.variable} ${dmSans.variable} ${jetbrainsMono.variable}`}
    >
      <body
        suppressHydrationWarning
        className="font-sans bg-slate-50 dark:bg-[#0B1120] text-slate-900 dark:text-slate-100 antialiased selection:bg-emerald-100 dark:selection:bg-emerald-900/50 selection:text-emerald-900 dark:selection:text-emerald-100 transition-colors"
      >
        <MargBooksProvider>{children}</MargBooksProvider>
      </body>
    </html>
  );
}
