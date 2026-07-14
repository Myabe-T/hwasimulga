import { redirect } from 'next/navigation';

// Root → always send to login (middleware handles redirect to gallery if authed)
export default function Home() {
  redirect('/login');
}
