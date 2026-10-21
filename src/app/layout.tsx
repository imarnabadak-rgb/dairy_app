import type { Metadata, Viewport } from 'next';
import { JetBrains_Mono, Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-jakarta',
  display: 'swap',
});

const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-jetbrains',
  display: 'swap',
});

const description =
  'Comprehensive dairy farm management system for milk production, cattle herd registry, daily customer supply logs, revenue tracking, and veterinary vaccination schedules.';

export const metadata: Metadata = {
  title: 'DairyFlow - Farm & Supply Management ERP',
  description,
  applicationName: 'DairyFlow',
  openGraph: {
    title: 'DairyFlow - Farm & Supply Management ERP',
    description,
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DairyFlow - Farm & Supply Management ERP',
    description,
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#047857',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${jakarta.variable} ${jetbrains.variable}`}>
      <body className="bg-neutral-50 text-neutral-900 antialiased selection:bg-emerald-600 selection:text-white">
        {children}
      </body>
    </html>
  );
}
