import SignupForm from '@/components/auth/SignupForm';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sign Up - RotaCalc',
  description: 'Create a new RotaCalc account.',
};

export default function SignupPage() {
  return <SignupForm />;
}
