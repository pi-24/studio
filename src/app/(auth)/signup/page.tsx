import SignupForm from '@/components/auth/SignupForm';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sign Up - OnTheDoc',
  description: 'Create a new OnTheDoc account.',
};

export default function SignupPage() {
  return <SignupForm />;
}
