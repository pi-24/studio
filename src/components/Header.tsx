
"use client";

import Link from 'next/link';
import { Logo } from './Logo';
import AuthButtons from './AuthButtons';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { LayoutDashboard } from 'lucide-react';

export default function Header() {
  const { user, loading } = useAuth();

  return (
    <header className="bg-card border-b border-border shadow-sm sticky top-0 z-50">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/">
            <Logo />
          </Link>
          {!loading && user && (
            <Button variant="ghost" asChild size="sm">
              <Link href="/">
                <LayoutDashboard className="mr-2 h-4 w-4" />
                My Dashboard
              </Link>
            </Button>
          )}
        </div>
        <nav>
          <AuthButtons />
        </nav>
      </div>
    </header>
  );
}
