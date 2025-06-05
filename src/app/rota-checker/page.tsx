
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
import { AlertCircle, Loader2, Edit, Check } from 'lucide-react';
import Link from 'next/link';
import { useToast } from "@/hooks/use-toast";

export default function RotaCheckerPage() {
  const { user, loading: authLoading, updateUserProfile } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [rotaResult, setRotaResult] = useState<ProcessedRotaResult | { error: string; fieldErrors?: any[] } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [initialLoadProcessing, setInitialLoadProcessing] = useState(true);
  const [isEditingRota, setIsEditingRota] = useState(false);


  const handleProcessRota = useCallback(async (submittedFullRotaInput: RotaInput) => {
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
      
      const currentGridString = user.rotaGrid ? JSON.stringify(user.rotaGrid) : "{}";
      const submittedGridDataString = JSON.stringify(submittedFullRotaInput.rotaGrid);

      // Only update profile if the grid data has actually changed
      if (currentGridString !== submittedGridDataString) {
        updateUserProfile({ rotaGrid: submittedFullRotaInput.rotaGrid });
      }
    }
  }, [user, toast, updateUserProfile]);


  useEffect(() => {
    if (!authLoading && user && user.isProfileComplete && user.scheduleMeta && user.shiftDefinitions) {
      if (user.rotaGrid && Object.keys(user.rotaGrid).length > 0) {
        const processInitialData = async () => {
          if(initialLoadProcessing) setIsProcessing(true); // Only show processing for the very first load
          const initialFullRotaInput: RotaInput = {
            scheduleMeta: user.scheduleMeta as ScheduleMetadata,
            shiftDefinitions: user.shiftDefinitions as ShiftDefinition[],
            rotaGrid: user.rotaGrid as RotaGridInput, 
          };
          const result = await processRota(initialFullRotaInput);
          setRotaResult(result);
          if(initialLoadProcessing) setIsProcessing(false);
          setInitialLoadProcessing(false);
        };
        processInitialData();
      } else {
        setInitialLoadProcessing(false);
        setRotaResult(null); 
      }
    } else if (!authLoading && (!user || !user.isProfileComplete)) {
      router.push('/profile/setup');
    } else if (!authLoading && user && (!user.scheduleMeta || !user.shiftDefinitions)) {
      setInitialLoadProcessing(false);
      toast({title: "Configuration Error", description: "Rota settings or shift types are missing. Please update your profile.", variant: "destructive"});
      setRotaResult({ error: "Rota settings or shift types are missing. Please update your profile."});
    } else if (authLoading) {
      // Still loading
    } else { // Not loading, no user data, or profile incomplete but not caught by other conditions
      setInitialLoadProcessing(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading, router, toast ]); // Removed handleProcessRota, initialLoadProcessing from deps


  if (authLoading || (initialLoadProcessing && user?.rotaGrid && Object.keys(user.rotaGrid).length > 0)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-10rem)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-lg text-muted-foreground">Loading Rota Checker...</p>
      </div>
    );
  }

  if (!user) {
     // This should ideally be caught by AuthContext, but as a fallback
    router.push('/login');
    return <p>Redirecting to login...</p>; 
  }

  if (!user.isProfileComplete) {
    // This should ideally be caught by AuthContext, but as a fallback
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
    // If moving from editing to view mode, and changes were made,
    // the user should use "Calculate & Check" to save and process.
    // If simply cancelling edits without saving, the form will retain edits until page reload or re-process
  };

  return (
    <div className="space-y-8">
      <Card className="w-full shadow-lg my-8">
        <CardHeader>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <CardTitle className="text-2xl font-headline text-primary">Your Rota Schedule</CardTitle>
                    <CardDescription>
                        View your current rota below. Click "Edit Rota" to make changes.
                        Schedule settings (weeks, start date) and shift types are managed in your <Link href="/profile" className="underline text-primary hover:text-primary/80">profile</Link>.
                    </CardDescription>
                </div>
                <Button onClick={handleEditToggle} variant={isEditingRota ? "default" : "outline"} className="w-full sm:w-auto">
                    {isEditingRota ? <Check className="mr-2 h-4 w-4" /> : <Edit className="mr-2 h-4 w-4" />}
                    {isEditingRota ? 'Done Editing' : 'Edit Rota Schedule'}
                </Button>
            </div>
        </CardHeader>
        <RotaInputForm
          scheduleMeta={user.scheduleMeta}
          shiftDefinitions={user.shiftDefinitions}
          initialRotaGrid={user.rotaGrid || {}}
          onProcessRota={handleProcessRota} 
          isProcessing={isProcessing}
          setIsProcessing={setIsProcessing}
          isEditing={isEditingRota}
        />
      </Card>
      <ComplianceReport result={rotaResult} isProcessing={isProcessing && !initialLoadProcessing} />
    </div>
  );
}

