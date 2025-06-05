
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import RotaInputForm from '@/components/rota/RotaInputForm';
import ComplianceReport from '@/components/rota/ComplianceReport';
import type { ProcessedRotaResult, RotaInput, UserProfileData, RotaGridInput } from '@/types';
import { processRota } from '@/app/actions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, Loader2, Edit } from 'lucide-react';
import Link from 'next/link';
import { useToast } from "@/hooks/use-toast";

export default function RotaCheckerPage() {
  const { user, loading: authLoading, updateUserProfile } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [rotaResult, setRotaResult] = useState<ProcessedRotaResult | { error: string; fieldErrors?: any[] } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [initialLoadProcessing, setInitialLoadProcessing] = useState(true);

  const handleProcessRota = useCallback(async (currentRotaInput: RotaInput) => {
    if (!user || !currentRotaInput.scheduleMeta || !currentRotaInput.shiftDefinitions) {
      setRotaResult({ error: "User profile data is incomplete. Cannot process rota." });
      return;
    }
    setIsProcessing(true);
    const result = await processRota(currentRotaInput);
    setRotaResult(result);
    setIsProcessing(false);

    if ('error' in result) {
      toast({ title: "Processing Error", description: result.error, variant: "destructive" });
    } else {
      toast({ title: "Rota Processed", description: "Compliance checks updated." });
      // Save the processed rota grid back to user profile
      if (user && currentRotaInput.rotaGrid) {
          const updatedProfileData: Partial<UserProfileData> = {
            rotaGrid: currentRotaInput.rotaGrid
          };
          updateUserProfile(updatedProfileData);
      }
    }
  }, [user, toast, updateUserProfile]);


  useEffect(() => {
    if (!authLoading && user && user.isProfileComplete && user.scheduleMeta && user.shiftDefinitions && user.rotaGrid) {
      if (Object.keys(user.rotaGrid).length > 0) { // Only auto-process if rota grid is not empty
        const initialFullRotaInput: RotaInput = {
          scheduleMeta: user.scheduleMeta,
          shiftDefinitions: user.shiftDefinitions,
          rotaGrid: user.rotaGrid,
        };
        handleProcessRota(initialFullRotaInput).finally(() => setInitialLoadProcessing(false));
      } else {
        setInitialLoadProcessing(false);
        setRotaResult(null); // Ensure report is cleared if grid is empty
      }
    } else if (!authLoading && (!user || !user.isProfileComplete)) {
      router.push('/profile/setup');
    } else if (!authLoading) {
      // Handle case where user profile is complete but scheduleMeta or shiftDefinitions might be missing (shouldn't happen with proper setup flow)
      setInitialLoadProcessing(false);
      if (!user?.scheduleMeta || !user?.shiftDefinitions) {
          toast({title: "Configuration Error", description: "Rota settings or shift types are missing. Please update your profile.", variant: "destructive"});
          setRotaResult({ error: "Rota settings or shift types are missing. Please update your profile."});
      }
    }
  }, [user, authLoading, router, handleProcessRota, toast]);

  if (authLoading || initialLoadProcessing) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-10rem)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-lg text-muted-foreground">Loading Rota Checker...</p>
      </div>
    );
  }

  if (!user) { // Should be caught by AuthContext, but good for safety
    return <p>Redirecting to login...</p>;
  }

  if (!user.isProfileComplete) { // Should be caught by AuthContext
    return <p>Redirecting to profile setup...</p>;
  }
  
  if (!user.scheduleMeta || !user.shiftDefinitions) {
    return (
         <Card className="w-full max-w-2xl mx-auto mt-10 shadow-lg">
            <CardHeader>
                <CardTitle className="text-2xl text-destructive flex items-center gap-2">
                    <AlertCircle /> Configuration Incomplete
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <p>Essential rota configuration (like schedule settings or shift definitions) is missing from your profile.</p>
                <Button asChild>
                    <Link href="/profile">
                        <Edit className="mr-2 h-4 w-4" /> Go to Profile to Update
                    </Link>
                </Button>
            </CardContent>
        </Card>
    );
  }

  return (
    <div className="space-y-8">
      <RotaInputForm
        scheduleMeta={user.scheduleMeta}
        shiftDefinitions={user.shiftDefinitions}
        initialRotaGrid={user.rotaGrid || {}}
        onProcessRota={handleProcessRota} // RotaInputForm will call this with the full RotaInput object
        isProcessing={isProcessing}
        setIsProcessing={setIsProcessing} // Pass down to RotaInputForm if it manages its own processing state for UI
      />
      <ComplianceReport result={rotaResult} isProcessing={isProcessing} />
    </div>
  );
}
