import { redirect } from 'next/navigation';

export default async function VerifyEmailRedirect(props) {
  const searchParams = await props.searchParams;
  const oobCode = searchParams?.oobCode || searchParams?.token || '';
  if (oobCode) {
    redirect(`/auth/action?mode=verifyEmail&oobCode=${encodeURIComponent(oobCode)}`);
  }
  redirect('/login');
}
