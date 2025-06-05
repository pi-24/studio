
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
import { AlertCircle, Loader2, Edit, Check, Save } from 'lucide-react';
import Link from 'next/link';
import { useToast } from "@/hooks/use-toast";

export default function RotaCheckerPage() {
  const { user, loading: authLoading, updateUserProfile } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [rotaResult, setRotaResult] = useState<ProcessedRotaResult | { error: string; fieldErrors?: any[] } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [initialLoadProcessingDone, setInitialLoadProcessingDone] = useState(false);
  const [isEditingRota, setIsEditingRota] = useState(false);


  const handleProcessRotaCallback = useCallback(async (submittedFullRotaInput: RotaInput) => {
    if (!user || !user.scheduleMeta || !user.shiftDefinitions) {
      setRotaResult({ error: "User profile data is incomplete. Cannot process rota." });
      setIsProcessing(false);
      return;
    }
    setIsProcessing(true);

    const result = await processRota(submittedFullRotaInput);
    setRotaResult(result);
    setIsProcessing(false);

    if ('error' in result) {
      toast({ title: "Processing Error", description: result.error, variant: "destructive" });
    } else {
      toast({ title: "Rota Processed", description: "Compliance checks updated." });
      
      const currentGridString = JSON.stringify(user.rotaGrid || {});
      const submittedGridDataString = JSON.stringify(submittedFullRotaInput.rotaGrid);

      if (currentGridString !== submittedGridDataString) {
        updateUserProfile({ rotaGrid: submittedFullRotaInput.rotaGrid });
      }
      setIsEditingRota(false); // Switch back to view mode after successful processing
    }
  }, [user, toast, updateUserProfile]);


  useEffect(() => {
    if (!authLoading && user && user.isProfileComplete && user.scheduleMeta && user.shiftDefinitions && !initialLoadProcessingDone) {
      if (user.rotaGrid && Object.keys(user.rotaGrid).length > 0) {
        const processInitialData = async () => {
          setIsProcessing(true);
          const initialFullRotaInput: RotaInput = {
            scheduleMeta: user.scheduleMeta as ScheduleMetadata,
            shiftDefinitions: user.shiftDefinitions as ShiftDefinition[],
            rotaGrid: user.rotaGrid as RotaGridInput, 
          };
          const result = await processRota(initialFullRotaInput);
          setRotaResult(result);
          setIsProcessing(false);
          setInitialLoadProcessingDone(true);
        };
        processInitialData();
      } else {
        setInitialLoadProcessingDone(true);
        setRotaResult(null); 
        setIsEditingRota(true); // If no rota, default to edit mode
      }
    } else if (!authLoading && (!user || !user.isProfileComplete)) {
      router.push('/profile/setup');
    } else if (!authLoading && user && (!user.scheduleMeta || !user.shiftDefinitions)) {
      setInitialLoadProcessingDone(true);
      toast({title: "Configuration Error", description: "Rota settings or shift types are missing. Please update your profile.", variant: "destructive"});
      setRotaResult({ error: "Rota settings or shift types are missing. Please update your profile."});
    } else if (authLoading) {
      // Still loading
    } else { 
      if (!initialLoadProcessingDone) setInitialLoadProcessingDone(true);
    }
  }, [user, authLoading, router, toast, initialLoadProcessingDone]); 


  if (authLoading || (!initialLoadProcessingDone && user?.rotaGrid && Object.keys(user.rotaGrid).length > 0)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-10rem)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-lg text-muted-foreground">Loading Rota Checker...</p>
      </div>
    );
  }

  if (!user) {
    router.push('/login');
    return <p>Redirecting to login...</p>; 
  }

  if (!user.isProfileComplete) {
    router.push('/profile/setup');
    return <p>Redirecting to profile setup...</p>; 
  }
  
  if (!user.scheduleMeta || !user.shiftDefinitions || user.shiftDefinitions.length === 0) {
    return (
         <Card className="w-full max-w-2xl mx-auto mt-10 shadow-lg">
            <CardHeader>
                <CardTitle className="text-2xl text-destructive flex items-center gap-2">
                    <AlertCircle /> Configuration Incomplete
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <p>Essential rota configuration (like schedule settings or shift definitions) is missing from your profile.</p>
                <p>Please ensure you have at least one shift definition.</p>
                <Button asChild>
                    <Link href="/profile">
                        <Edit className="mr-2 h-4 w-4" /> Go to Profile to Update
                    </Link>
                </Button>
            </CardContent>
        </Card>
    );
  }
  
  const handleEditToggle = () => {
    setIsEditingRota(!isEditingRota);
  };

  return (
    <div className="space-y-8">
      <Card className="w-full shadow-lg my-8">
        <CardHeader>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <CardTitle className="text-2xl font-headline text-primary">Your Rota Schedule</CardTitle>
                    <CardDescription>
                        {isEditingRota 
                            ? "Modify your rota grid below. Click 'Save Rota and Check Compliance' to update."
                            : "View your current rota below. Click 'Edit Rota Schedule' to make changes."}
                        Schedule settings (weeks, start date) and shift types are managed in your <Link href="/profile" className="underline text-primary hover:text-primary/80">profile</Link>.
                    </CardDescription>
                </div>
                {!isEditingRota && (
                    <Button onClick={handleEditToggle} variant="outline" className="w-full sm:w-auto">
                        <Edit className="mr-2 h-4 w-4" /> 
                        Edit Rota Schedule
                    </Button>
                )}
            </div>
        </CardHeader>
        <RotaInputForm
          scheduleMeta={user.scheduleMeta}
          shiftDefinitions={user.shiftDefinitions}
          initialRotaGrid={user.rotaGrid || {}}
          onProcessRota={handleProcessRotaCallback} 
          isProcessing={isProcessing}
          setIsProcessing={setIsProcessing}
          isEditing={isEditingRota}
        />
      </Card>
      <ComplianceReport result={rotaResult} isProcessing={isProcessing && initialLoadProcessingDone} />
    </div>
  );
}

