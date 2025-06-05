
"use client";

import { useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, Settings, ListChecks, CreditCard, ExternalLink } from 'lucide-react';

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();

  if (authLoading) {
    return (
      <div className="space-y-8">
        <Card className="w-full shadow-lg">
          <CardHeader><Skeleton className="h-8 w-3/4 mb-2" /><Skeleton className="h-4 w-1/2" /></CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-1/4 mt-4" />
          </CardContent>
        </Card>
      </div>
    );
  }

  // AuthContext handles redirection if user is null or profile is incomplete
  if (!user) {
    // This part should ideally not be reached if AuthContext is working correctly,
    // but as a fallback:
    return (
      <div className="flex flex-col items-center justify-center text-center py-12">
         <Card className="w-full max-w-md p-8 shadow-lg">
           <CardHeader>
             <CardTitle className="text-2xl text-primary">Loading...</CardTitle>
           </CardHeader>
          <CardContent>
            <p>Redirecting to login...</p>
          </CardContent>
         </Card>
      </div>
    );
  }
  
   if (!user.isProfileComplete) {
     // Also should be handled by AuthContext, but good to have a fallback UI
    return (
      <div className="flex flex-col items-center justify-center text-center py-12">
        <Card className="w-full max-w-md p-8 shadow-lg">
          <CardHeader>
            <CardTitle className="text-2xl text-primary flex items-center justify-center gap-2">
              <AlertTriangle className="h-6 w-6 text-amber-500" /> Almost there!
            </CardTitle>
            <CardDescription>Please complete your profile setup to use RotaCalc.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="mb-6">Your profile information needs to be configured before you can access the dashboard.</p>
            <Button asChild size="lg">
              <Link href="/profile/setup">
                <Settings className="mr-2 h-5 w-5" /> Go to Profile Setup
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  const isRotaGridEmpty = !user.rotaGrid || Object.keys(user.rotaGrid).length === 0;

  return (
    <div className="space-y-10">
      <Card className="shadow-lg border-primary/20">
        <CardHeader>
          <CardTitle className="text-3xl font-headline text-primary">Welcome to RotaCalc, {user.email}!</CardTitle>
          <CardDescription className="text-md">
            This is your dashboard. Access tools and manage your rota information from here.
          </CardDescription>
        </CardHeader>
        {isRotaGridEmpty && (
             <CardContent>
                <div className="p-4 mb-2 text-sm text-yellow-700 bg-yellow-100 rounded-lg dark:bg-yellow-200 dark:text-yellow-800" role="alert">
                    <span className="font-medium">Rota Not Entered:</span> You haven't entered your rota schedule yet. 
                    You can do this via the <Link href="/profile/setup" className="font-semibold underline hover:text-yellow-800">profile setup</Link> (if completing for the first time) or by visiting the Rota Compliance Checker tool.
                </div>
            </CardContent>
        )}
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="hover:shadow-xl transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl text-accent">
              <ListChecks className="h-6 w-6"/> Rota Compliance Checker
            </CardTitle>
            <CardDescription>
              Analyze your rota against NHS compliance rules. View and edit your current rota schedule.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full bg-accent hover:bg-accent/90 text-accent-foreground">
              <Link href="/rota-checker">
                Open Rota Checker <ExternalLink className="ml-2 h-4 w-4" />
              </Link>
            </Button>
             {isRotaGridEmpty && (
                <p className="text-xs text-amber-600 dark:text-amber-500 mt-3">
                    Your rota grid is currently empty. Please input your rota in the checker.
                </p>
            )}
          </CardContent>
        </Card>

        <Card className="hover:shadow-xl transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl text-primary">
              <CreditCard className="h-6 w-6"/> Pay Checker
            </CardTitle>
            <CardDescription>
              Estimate your salary based on your rota and NHS pay scales. (Coming Soon)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button disabled className="w-full">
              Open Pay Checker (Coming Soon)
            </Button>
          </CardContent>
        </Card>
      </div>

       <Card className="mt-10 shadow-lg">
            <CardHeader>
                <CardTitle className="text-xl font-semibold text-primary flex items-center gap-2">
                    <Settings className="h-5 w-5" /> Manage Your Profile
                </CardTitle>
                <CardDescription>
                    Update your personal details, rota configuration, shift types, and saved rota schedule.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Button asChild variant="outline">
                    <Link href="/profile">
                        Go to Profile <ExternalLink className="ml-2 h-4 w-4" />
                    </Link>
                </Button>
            </CardContent>
        </Card>

    </div>
  );
}
