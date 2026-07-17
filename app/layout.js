import './globals.css';

export const metadata = {
  title: 'DesiHawas — Video Gallery',
  description: 'Premium private video gallery. Fast. Beautiful. Secure.',
  robots: 'noindex, nofollow',
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
      <body>{children}</body>
    </html>
  );
}
