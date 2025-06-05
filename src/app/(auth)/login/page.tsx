import LoginForm from '@/components/auth/LoginForm';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Login - RotaCalc',
  description: 'Login to your RotaCalc account.',
};

export default function LoginPage() {
  return <LoginForm />;
}
