
"use client";

import { useState, useEffect } from 'react';
import RotaInputForm from '@/components/rota/RotaInputForm';
import ComplianceReport from '@/components/rota/ComplianceReport';
import type { ProcessedRotaResult, RotaInput } from '@/types'; // Added RotaInput
import { useAuth } from '@/hooks/useAuth';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowRight, LogIn } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

export default function HomePage() {
  const [rotaResult, setRotaResult] = useState<ProcessedRotaResult | { error: string; fieldErrors?: any[] } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const { user, loading } = useAuth();

  useEffect(() => {
    setRotaResult(null);
  }, [user]);
  
  const handleProcessRota = (result: ProcessedRotaResult | { error: string; fieldErrors?: any[] } | null) => { // Allow null to clear results
    setRotaResult(result);
  };

  if (loading) {
    return (
      <div className="space-y-8">
        <Card className="w-full shadow-lg">
          <CardHeader>
            <Skeleton className="h-8 w-3/4 mb-2" />
            <Skeleton className="h-4 w-1/2" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-1/4 mt-4" />
          </CardContent>
          <CardFooter>
            <Skeleton className="h-10 w-1/3 ml-auto" />
          </CardFooter>
        </Card>
         <Card className="w-full shadow-lg mt-8">
          <CardHeader>
            <Skeleton className="h-8 w-1/2 mb-2" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-20 w-full" />
             <Skeleton className="h-20 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center text-center py-12 sm:py-24">
        <Card className="w-full max-w-2xl p-8 sm:p-12 shadow-xl">
          <CardHeader className="mb-6">
            <h1 className="text-4xl sm:text-5xl font-bold font-headline text-primary mb-4">Welcome to RotaCalc</h1>
            <CardDescription className="text-lg sm:text-xl text-muted-foreground">
              Effortlessly manage your NHS rota, check compliance with guidelines, and estimate your salary.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-md text-foreground">
              RotaCalc helps you understand your work schedule better. Get started by logging in or creating an account.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button asChild size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground">
                <Link href="/login">
                  <LogIn className="mr-2 h-5 w-5" /> Login
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="/signup">
                  Sign Up <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
            </div>
             <div className="mt-8 pt-6 border-t">
                <h3 className="text-lg font-semibold text-primary mb-2">Key Features:</h3>
                <ul className="list-disc list-inside text-left text-muted-foreground space-y-1">
                    <li>Intuitive Rota Data Input with Shift Definitions</li>
                    <li>Automated Worked Hours Calculation</li>
                    <li>NHS Guideline Compliance Checks (based on TCS)</li>
                    <li>Clear, Categorized Violation Reporting</li>
                </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <RotaInputForm 
        onProcessRota={handleProcessRota} 
        isProcessing={isProcessing}
        setIsProcessing={setIsProcessing}
      />
      <ComplianceReport result={rotaResult} isProcessing={isProcessing} />
    </div>
  );
}
