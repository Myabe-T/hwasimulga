export const runtime = 'edge';
import WatchClient from './WatchClient';

export default async function WatchPage({ searchParams }) {
  const params = await searchParams;
  const shareToken = params?.v || null;
  return <WatchClient shareToken={shareToken} />;
}
