
"use client";

import { useState, useEffect } from 'react';
import RotaInputForm from '@/components/rota/RotaInputForm';
import ComplianceReport from '@/components/rota/ComplianceReport';
import type { ProcessedRotaResult, RotaInput, User } from '@/types';
import { useAuth } from '@/hooks/useAuth';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowRight, LogIn, AlertTriangle, Settings } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

export default function HomePage() {
  const [rotaResult, setRotaResult] = useState<ProcessedRotaResult | { error: string; fieldErrors?: any[] } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    // Clear results if user changes or logs out
    setRotaResult(null);
  }, [user]);
  
  const handleProcessRota = (result: ProcessedRotaResult | { error: string; fieldErrors?: any[] } | null) => {
    setRotaResult(result);
  };

  if (authLoading) {
    return ( // Skeleton for loading state
      <div className="space-y-8">
        <Card className="w-full shadow-lg">
          <CardHeader><Skeleton className="h-8 w-3/4 mb-2" /><Skeleton className="h-4 w-1/2" /></CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-1/4 mt-4" />
          </CardContent>
        </Card>
         <Card className="w-full shadow-lg mt-8"><CardHeader><Skeleton className="h-8 w-1/2 mb-2" /></CardHeader>
          <CardContent className="space-y-4"><Skeleton className="h-20 w-full" /><Skeleton className="h-20 w-full" /></CardContent>
        </Card>
      </div>
    );
  }

  if (!user) { // User not logged in
    return (
      <div className="flex flex-col items-center justify-center text-center py-12 sm:py-24">
        <Card className="w-full max-w-2xl p-8 sm:p-12 shadow-xl">
          <CardHeader className="mb-6">
            <h1 className="text-4xl sm:text-5xl font-bold font-headline text-primary mb-4">Welcome to RotaCalc</h1>
            <CardDescription className="text-lg sm:text-xl text-muted-foreground">
              Effortlessly manage your NHS rota, check compliance, and estimate your salary.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-md text-foreground">Get started by logging in or creating an account.</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button asChild size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground">
                <Link href="/login"><LogIn className="mr-2 h-5 w-5" /> Login</Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="/signup">Sign Up <ArrowRight className="ml-2 h-5 w-5" /></Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // User is logged in, check if profile is complete
  // AuthContext should redirect to /profile/setup if not complete,
  // but as a fallback or if redirection is still pending:
  if (!user.isProfileComplete) {
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
            <p className="mb-6">Your profile information, schedule settings, and shift types need to be configured.</p>
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
  
  // Profile is complete, this is the "Dashboard" area for now
  // Eventually, this page will have navigation to Rota Checker / Pay Checker
  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
            <CardTitle className="text-2xl font-headline text-primary">Rota Compliance Checker</CardTitle>
            <CardDescription>Input your rota grid below. Your schedule settings and shift definitions are taken from your profile.</CardDescription>
        </CardHeader>
        <CardContent>
             {(!user.scheduleMeta || !user.shiftDefinitions || user.shiftDefinitions.length === 0) && (
                <div className="p-4 mb-4 text-sm text-yellow-700 bg-yellow-100 rounded-lg dark:bg-yellow-200 dark:text-yellow-800" role="alert">
                    <span className="font-medium">Configuration Needed:</span> Schedule settings or shift definitions are missing from your profile. 
                    Please <Link href="/profile" className="font-semibold underline hover:text-yellow-800">update your profile</Link>.
                </div>
            )}
            <RotaInputForm 
                scheduleMeta={user.scheduleMeta}
                shiftDefinitions={user.shiftDefinitions}
                onProcessRota={handleProcessRota} 
                isProcessing={isProcessing}
                setIsProcessing={setIsProcessing}
            />
        </CardContent>
      </Card>
      <ComplianceReport result={rotaResult} isProcessing={isProcessing} />
    </div>
  );
}
