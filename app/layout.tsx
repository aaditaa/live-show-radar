import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { Sidebar } from '@/components/sidebar';
import { getArtistStats, getUser } from '@/lib/queries';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Live Show Radar',
  description:
    'Live concert and festival alerts in India for the artists Karan follows, with early-bird ticket windows.',
};

export default async function RootLayout({ children }: LayoutProps<'/'>) {
  // The sidebar shows the watch summary, so it needs the same live counts the
  // dashboard uses. Both read from the database on every request.
  const [user, stats] = await Promise.all([getUser(), getArtistStats()]);

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <div className="flex min-h-screen flex-col lg:flex-row">
          <Sidebar homeCity={user?.homeCity ?? 'Bengaluru'} artistCount={stats.active} />
          <main className="min-w-0 flex-1 px-5 py-6 sm:px-8">{children}</main>
        </div>
      </body>
    </html>
  );
}
