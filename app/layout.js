import './globals.css';
import SecurityGuard from '@/components/SecurityGuard';
import IdmGuardian from '@/components/IdmGuardian';

export const metadata = {
  title: 'DesiHawas — Adult Site | Free Desi MMS & Viral Videos',
  description: 'DesiHawas — Premium Adult Entertainment & Viral MMS Videos. Free HD streaming, fast playback, no ads.',
  robots: 'index, follow',
  keywords: 'desihawas, desi mms, viral videos, adult entertainment, desi porn, free hd videos',
  openGraph: {
    title: 'DesiHawas — Adult Site | Free Desi MMS & Viral Videos',
    description: 'Watch free trending desi viral MMS, popular spicy videos and exclusive HD clips online.',
    type: 'website',
    siteName: 'DesiHawas',
  },
};

// Proper mobile viewport — prevents the "zoomed out" / tiny text issue on phones
export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
      </head>
      <body>
        <SecurityGuard />
        <IdmGuardian />
        {children}
      </body>
    </html>
  );
}
