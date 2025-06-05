
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useRouter, useSearchParams } from 'next/navigation';
import RotaInputForm from '@/components/rota/RotaInputForm';
import ComplianceReport from '@/components/rota/ComplianceReport';
import type { ProcessedRotaResult, RotaProcessingInput, UserProfileData, RotaDocument, RotaGridInput, RotaSpecificScheduleMetadata, ShiftDefinition } from '@/types';
import { processRota } from '@/app/actions'; // Assuming processRota now takes RotaProcessingInput
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, Loader2, Edit, Check, Save, Info } from 'lucide-react';
import Link from 'next/link';
import { useToast } from "@/hooks/use-toast";

export default function RotaCheckerPage() {
  const { user, loading: authLoading, updateRotaDocument } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const [rotaToDisplay, setRotaToDisplay] = useState<RotaDocument | null>(null);
  const [rotaResult, setRotaResult] = useState<ProcessedRotaResult | { error: string; fieldErrors?: any[] } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isEditingRota, setIsEditingRota] = useState(false);

  useEffect(() => {
    if (authLoading || !user) return;

    const rotaId = searchParams.get('rotaId');
    if (!rotaId) {
      if (user.rotas && user.rotas.length > 0) {
        // Default to the first rota if no ID is provided
        router.replace(`/rota-checker?rotaId=${user.rotas[0].id}`);
      } else {
        setRotaToDisplay(null);
        setRotaResult({error: "No rota selected or available. Please upload a rota first."});
      }
      return;
    }

    const foundRota = user.rotas?.find(r => r.id === rotaId);
    if (foundRota) {
      if (rotaToDisplay?.id !== foundRota.id) { // Process only if rota changes or on initial load
        setRotaToDisplay(foundRota);
        const processingInput: RotaProcessingInput = {
            scheduleMeta: foundRota.scheduleMeta,
            shiftDefinitions: foundRota.shiftDefinitions,
            rotaGrid: foundRota.rotaGrid
        };
        setIsProcessing(true);
        processRota(processingInput).then(result => {
            setRotaResult(result);
            setIsProcessing(false);
            if ('error' in result) {
                toast({ title: "Processing Error", description: result.error, variant: "destructive" });
            }
        });
      }
    } else {
      setRotaToDisplay(null);
      setRotaResult({error: `Rota with ID "${rotaId}" not found.`});
      toast({ title: "Error", description: `Rota with ID "${rotaId}" not found.`, variant: "destructive"});
    }
  // Only re-run if user, authLoading, rotaId changes, or if rotaToDisplay fundamentally changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading, searchParams, router, toast]);


  const handleRotaGridSubmit = useCallback(async (submittedRotaGridInput: RotaGridInput) => {
    if (!user || !rotaToDisplay) {
      setRotaResult({ error: "User or Rota data is incomplete. Cannot process." });
      setIsProcessing(false);
      return;
    }
    setIsProcessing(true);

    const updatedRotaDoc: RotaDocument = {
        ...rotaToDisplay,
        rotaGrid: submittedRotaGridInput
    };

    const processingInput: RotaProcessingInput = {
        scheduleMeta: updatedRotaDoc.scheduleMeta,
        shiftDefinitions: updatedRotaDoc.shiftDefinitions,
        rotaGrid: updatedRotaDoc.rotaGrid,
    };

    const result = await processRota(processingInput);
    setRotaResult(result);
    setIsProcessing(false);

    if ('error' in result) {
      toast({ title: "Processing Error", description: result.error, variant: "destructive" });
    } else {
      toast({ title: "Rota Processed", description: "Compliance checks updated." });
      updateRotaDocument(updatedRotaDoc); // Save the updated grid to the specific RotaDocument
      setIsEditingRota(false);
      setRotaToDisplay(updatedRotaDoc); // Update local state to reflect saved grid
    }
  }, [user, rotaToDisplay, toast, updateRotaDocument]);


  if (authLoading) {
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
  
  if (!rotaToDisplay) {
    return (
         <Card className="w-full max-w-2xl mx-auto mt-10 shadow-lg">
            <CardHeader>
                <CardTitle className="text-2xl text-destructive flex items-center gap-2">
                    <AlertCircle /> Rota Not Found or Not Selected
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <p>Please select a rota from your dashboard or upload a new one.</p>
                <Button asChild>
                    <Link href="/">
                        <Info className="mr-2 h-4 w-4" /> Go to Dashboard
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
                    <CardTitle className="text-2xl font-headline text-primary">
                        Rota Schedule: {rotaToDisplay.name}
                    </CardTitle>
                    <CardDescription>
                        Site: {rotaToDisplay.scheduleMeta.site}, Specialty: {rotaToDisplay.scheduleMeta.specialty} <br/>
                        {isEditingRota 
                            ? "Modify your rota grid below. Click 'Save Rota and Check Compliance' to update."
                            : "View your current rota below. Click 'Edit Rota Schedule' to make changes."}
                        <br/> General rota settings (like name, site, specialty, dates) are managed when <Link href="/upload-rota" className="underline text-primary hover:text-primary/80">uploading a new rota</Link> or by editing it (feature coming soon).
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
          // Pass only the necessary parts for the form, not the whole RotaDocument's scheduleMeta
          scheduleMetaConfig={{
            scheduleTotalWeeks: rotaToDisplay.scheduleMeta.scheduleTotalWeeks,
            scheduleStartDate: rotaToDisplay.scheduleMeta.scheduleStartDate,
          }}
          shiftDefinitions={rotaToDisplay.shiftDefinitions}
          initialRotaGrid={rotaToDisplay.rotaGrid || {}}
          onProcessRota={handleRotaGridSubmit} 
          isProcessing={isProcessing}
          isEditing={isEditingRota}
        />
      </Card>
      <ComplianceReport result={rotaResult} isProcessing={isProcessing} />
    </div>
  );
}
