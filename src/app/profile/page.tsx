"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { UserCircle, Mail, LogOut } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

export default function ProfilePage() {
  const { user, logout, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <div className="flex justify-center py-12">
        <Card className="w-full max-w-lg shadow-xl">
          <CardHeader className="items-center text-center">
            <Skeleton className="h-24 w-24 rounded-full" />
            <Skeleton className="h-8 w-48 mt-4" />
            <Skeleton className="h-4 w-64 mt-2" />
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
             <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  const userInitial = user.email ? user.email.charAt(0).toUpperCase() : '?';

  return (
    <div className="flex justify-center py-12">
      <Card className="w-full max-w-lg shadow-xl">
        <CardHeader className="items-center text-center">
          <Avatar className="w-24 h-24 text-3xl mb-4">
            <AvatarImage src={`https://placehold.co/100x100.png?text=${userInitial}`} alt={user.email} data-ai-hint="abstract letter" />
            <AvatarFallback>{userInitial}</AvatarFallback>
          </Avatar>
          <CardTitle className="text-3xl font-headline flex items-center gap-2"><UserCircle className="text-primary h-8 w-8"/>User Profile</CardTitle>
          <CardDescription>Manage your RotaCalc account details.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-muted-foreground flex items-center gap-2"><Mail className="h-4 w-4"/>Email</Label>
            <p id="email" className="text-lg p-2 border rounded-md bg-muted/50">{user.email}</p>
          </div>
          {/* Add more profile fields here if needed */}
          <Button onClick={logout} variant="destructive" className="w-full">
            <LogOut className="mr-2 h-4 w-4" /> Logout
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// Dummy Label component for ProfilePage example, as it's not using RHF FormLabel
const Label = ({ children, htmlFor, className }: {children: React.ReactNode, htmlFor?: string, className?: string}) => (
  <label htmlFor={htmlFor} className={`block text-sm font-medium text-foreground ${className}`}>
    {children}
  </label>
);
