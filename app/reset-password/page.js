'use client';
export const runtime = 'edge';

import { useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

function ResetPasswordRedirectContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const oobCode = searchParams.get('oobCode') || searchParams.get('token') || '';
    if (oobCode) {
      router.replace(`/auth/action?mode=resetPassword&oobCode=${encodeURIComponent(oobCode)}`);
    } else {
      router.replace('/forgot-password');
    }
  }, [searchParams, router]);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0e0713', color: '#fff' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>🔑</div>
        <p style={{ fontSize: 14, color: 'rgba(255,255,255,.7)' }}>Redirecting to secure reset...</p>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: '#0e0713' }} />}>
      <ResetPasswordRedirectContent />
    </Suspense>
  );
}
