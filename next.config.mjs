/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
        ],
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: '/advisor',
        destination: '/admin',
      },
      {
        source: '/profile',
        destination: '/gallery?tab=account',
      },
      {
        source: '/account',
        destination: '/gallery?tab=account',
      },
      {
        source: '/stats',
        destination: '/gallery?tab=stats',
      },
      {
        source: '/sessions',
        destination: '/gallery?tab=sessions',
      },
      {
        source: '/subscriptions',
        destination: '/gallery?tab=subscriptions',
      },
      {
        source: '/extend-premium',
        destination: '/gallery?tab=subscriptions',
      },
      {
        source: '/transactions',
        destination: '/gallery?tab=transactions',
      },
      {
        source: '/support',
        destination: '/gallery?tab=support',
      },
      {
        source: '/help',
        destination: '/gallery?tab=support',
      },
      {
        source: '/profile/:tab',
        destination: '/gallery?tab=:tab',
      },
    ];
  },
};

export default nextConfig;
