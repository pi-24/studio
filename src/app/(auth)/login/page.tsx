import LoginForm from '@/components/auth/LoginForm';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Login - OnTheDoc',
  description: 'Login to your OnTheDoc account.',
};

export default function LoginPage() {
  return <LoginForm />;
}
