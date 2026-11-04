import { redirect } from 'next/navigation';

export default async function ResetPasswordRedirect(props) {
  const searchParams = await props.searchParams;
  const oobCode = searchParams?.oobCode || searchParams?.token || '';
  if (oobCode) {
    redirect(`/auth/action?mode=resetPassword&oobCode=${encodeURIComponent(oobCode)}`);
  }
  redirect('/forgot-password');
}
