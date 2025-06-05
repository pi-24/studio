"use client";

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { LogIn, LogOut, UserCircle, UserPlus } from 'lucide-react';

export default function AuthButtons() {
  const { user, logout, loading } = useAuth();

  if (loading) {
    return <div className="w-24 h-10 bg-muted rounded-md animate-pulse"></div>;
  }

  if (user) {
    return (
      <div className="flex items-center gap-2">
        <Button variant="ghost" asChild>
          <Link href="/profile">
            <UserCircle className="mr-2 h-4 w-4" />
            Profile
          </Link>
        </Button>
        <Button variant="outline" onClick={logout}>
          <LogOut className="mr-2 h-4 w-4" />
          Logout
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Button variant="ghost" asChild>
        <Link href="/login">
          <LogIn className="mr-2 h-4 w-4" />
          Login
        </Link>
      </Button>
      <Button asChild>
        <Link href="/signup">
          <UserPlus className="mr-2 h-4 w-4" />
          Sign Up
        </Link>
      </Button>
    </div>
  );
}
