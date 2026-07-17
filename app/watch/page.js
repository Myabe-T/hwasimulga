import WatchClient from './WatchClient';
import { decryptPayload } from '@/lib/crypto';

export default async function WatchPage({ searchParams }) {
  const v = searchParams.v;
  let videoId = null;

  if (v && typeof v === 'string') {
    const parts = v.split('.');
    if (parts.length === 2) {
      try {
        const payload = await decryptPayload(parts[0], parts[1]);
        if (payload && payload.id) {
          videoId = payload.id;
        }
      } catch (e) {
        console.error('Failed to decrypt watch token', e);
      }
    }
  }

  return <WatchClient videoId={videoId} />;
}
