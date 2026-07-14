import './globals.css';

export const metadata = {
  title: 'Hwasimulga — Video Gallery',
  description: 'Premium private video gallery. Fast. Beautiful. Secure.',
  robots: 'noindex, nofollow',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
