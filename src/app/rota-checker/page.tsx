
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import RotaInputForm from '@/components/rota/RotaInputForm';
import ComplianceReport from '@/components/rota/ComplianceReport';
import type { ProcessedRotaResult, RotaInput, UserProfileData, RotaGridInput, ScheduleMetadata, ShiftDefinition } from '@/types';
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


  // This function is called by RotaInputForm when the user submits changes to the grid
  const handleRotaGridSubmit = useCallback(async (submittedRotaGrid: RotaGridInput) => {
    if (!user || !user.scheduleMeta || !user.shiftDefinitions) {
      setRotaResult({ error: "User profile data is incomplete. Cannot process rota." });
      setIsProcessing(false); // Ensure processing state is reset
      return;
    }
    setIsProcessing(true);

    const fullRotaInput: RotaInput = {
        scheduleMeta: user.scheduleMeta,
        shiftDefinitions: user.shiftDefinitions,
        rotaGrid: submittedRotaGrid,
    };

    const result = await processRota(fullRotaInput);
    setRotaResult(result);
    setIsProcessing(false);

    if ('error' in result) {
      toast({ title: "Processing Error", description: result.error, variant: "destructive" });
    } else {
      toast({ title: "Rota Processed", description: "Compliance checks updated." });
      // Only update profile if the submitted grid is different from what's currently stored for the user
      const currentGridString = user.rotaGrid ? JSON.stringify(user.rotaGrid) : "{}";
      const submittedGridString = JSON.stringify(submittedRotaGrid);

      if (currentGridString !== submittedGridString) {
        updateUserProfile({ rotaGrid: submittedRotaGrid });
      }
    }
  }, [user, toast, updateUserProfile]);


  // Effect for initial load processing when the page mounts or critical user data changes
  useEffect(() => {
    if (!authLoading && user && user.isProfileComplete && user.scheduleMeta && user.shiftDefinitions) {
      if (user.rotaGrid && Object.keys(user.rotaGrid).length > 0) {
        const processInitialData = async () => {
          setIsProcessing(true); // Use general isProcessing here for consistency
          const initialFullRotaInput: RotaInput = {
            scheduleMeta: user.scheduleMeta as ScheduleMetadata, // Cast as non-null
            shiftDefinitions: user.shiftDefinitions as ShiftDefinition[], // Cast
            rotaGrid: user.rotaGrid as RotaGridInput, // Cast
          };
          const result = await processRota(initialFullRotaInput);
          setRotaResult(result);
          setIsProcessing(false);
          setInitialLoadProcessing(false);
          // No toast for initial load to avoid annoyance, or a very subtle one
          // if ('error' in result) {
          //   toast({ title: "Initial Rota Load Error", description: result.error, variant: "destructive" });
          // }
        };
        processInitialData();
      } else {
        setInitialLoadProcessing(false);
        setRotaResult(null); // Ensure report is cleared if grid is empty
      }
    } else if (!authLoading && (!user || !user.isProfileComplete)) {
      router.push('/profile/setup');
    } else if (!authLoading && user && (!user.scheduleMeta || !user.shiftDefinitions)) {
      setInitialLoadProcessing(false);
      toast({title: "Configuration Error", description: "Rota settings or shift types are missing. Please update your profile.", variant: "destructive"});
      setRotaResult({ error: "Rota settings or shift types are missing. Please update your profile."});
    } else if (authLoading) {
      // Still loading, do nothing yet, wait for auth state to resolve
    } else {
      // Catch-all for other states, e.g. user is null but auth not loading (should be caught by login redirect)
      setInitialLoadProcessing(false);
    }
  }, [user, authLoading, router, toast]); // Dependencies for initial load


  if (authLoading || initialLoadProcessing) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-10rem)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-lg text-muted-foreground">Loading Rota Checker...</p>
      </div>
    );
  }

  if (!user) {
    return <p>Redirecting to login...</p>; // Should be handled by AuthProvider
  }

  if (!user.isProfileComplete) {
    return <p>Redirecting to profile setup...</p>; // Should be handled by AuthProvider
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
        onProcessRota={handleRotaGridSubmit} 
        isProcessing={isProcessing}
        setIsProcessing={setIsProcessing} 
      />
      <ComplianceReport result={rotaResult} isProcessing={isProcessing} />
    </div>
  );
}
