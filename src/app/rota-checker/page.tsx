
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useRouter, useSearchParams } from 'next/navigation';

import RotaInputForm from '@/components/rota/RotaInputForm';
import ComplianceReport from '@/components/rota/ComplianceReport';
import type { ProcessedRotaResult, RotaProcessingInput, RotaDocument, RotaGridInput, ShiftDefinition } from '@/types';
import { processRota } from '@/app/actions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, Loader2, Info, Settings2 } from 'lucide-react';
import Link from 'next/link';
import { useToast } from "@/hooks/use-toast";
import { Separator } from '@/components/ui/separator';

export default function RotaCheckerPage() {
  const { user, loading: authLoading, updateRotaDocument } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const [rotaToDisplay, setRotaToDisplay] = useState<RotaDocument | null>(null);
  const [rotaResult, setRotaResult] = useState<ProcessedRotaResult | { error: string; fieldErrors?: any[] } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const performRotaProcessingAndUpdateState = useCallback(async (currentRotaDoc: RotaDocument) => {
    setIsProcessing(true);
    const processingInput: RotaProcessingInput = {
        scheduleMeta: currentRotaDoc.scheduleMeta,
        shiftDefinitions: currentRotaDoc.shiftDefinitions,
        rotaGrid: currentRotaDoc.rotaGrid
    };
    const result = await processRota(processingInput);
    setRotaResult(result);
    setIsProcessing(false);

    if ('error' in result) {
        toast({ title: "Processing Error", description: result.error, variant: "destructive" });
        // Even if processing fails, ensure the display and context have the latest structural data
        // For view-only page, only update if complianceSummary might change or initial load.
        // updateRotaDocument(currentRotaDoc); 
        setRotaToDisplay(currentRotaDoc);
    } else {
        // Only update document if summary changes to avoid unnecessary writes for view-only.
        if (currentRotaDoc.complianceSummary !== result.complianceSummary) {
            const updatedDocWithStatus: RotaDocument = {
                ...currentRotaDoc,
                complianceSummary: result.complianceSummary,
            };
            updateRotaDocument(updatedDocWithStatus);
            setRotaToDisplay(updatedDocWithStatus); 
        } else {
            setRotaToDisplay(currentRotaDoc);
        }
        // toast({ title: "Rota Processed", description: "Compliance checks displayed." }); // Less verbose for view-only
    }
  }, [toast, updateRotaDocument]);


  useEffect(() => {
    if (authLoading || !user) return;

    const rotaId = searchParams.get('rotaId');
    if (!rotaId) {
      if (user.rotas && user.rotas.length > 0) {
        // Redirect to the first rota if no ID is specified, or handle as preferred.
        // For now, let's assume direct navigation with ID is primary.
        // router.replace(`/rota-checker?rotaId=${user.rotas[0].id}`);
         setRotaToDisplay(null);
         setRotaResult({error: "No rota selected. Please select a rota from the dashboard."});
      } else {
        setRotaToDisplay(null);
        setRotaResult({error: "No rotas available. Please upload a rota first."});
      }
      return;
    }

    const foundRota = user.rotas?.find(r => r.id === rotaId);
    if (foundRota) {
      if (rotaToDisplay?.id !== foundRota.id || !rotaResult) { // Process if different rota or no result yet
        setRotaToDisplay(foundRota);
        performRotaProcessingAndUpdateState(foundRota);
      }
    } else {
      setRotaToDisplay(null);
      setRotaResult({error: `Rota with ID "${rotaId}" not found.`});
      toast({ title: "Error", description: `Rota with ID "${rotaId}" not found.`, variant: "destructive"});
    }
  // Simplified dependencies for view-only; mainly reacting to user, authLoading, and rotaId from searchParams
  }, [user, authLoading, searchParams, toast, performRotaProcessingAndUpdateState, rotaToDisplay, rotaResult]); 


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
                    <AlertCircle /> 
                    {rotaResult && 'error' in rotaResult ? 'Error Loading Rota' : 'Rota Not Found or Not Selected'}
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <p>{rotaResult && 'error' in rotaResult ? rotaResult.error : "Please select a rota from your dashboard or upload a new one."}</p>
                <Button asChild>
                    <Link href="/">
                        <Info className="mr-2 h-4 w-4" /> Go to Dashboard
                    </Link>
                </Button>
            </CardContent>
        </Card>
    );
  }
  
  return (
    <div className="space-y-8">
      <Card className="w-full shadow-lg my-6">
        <CardHeader>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <CardTitle className="text-2xl font-headline text-primary flex items-center gap-2">
                        <Settings2 className="h-6 w-6" /> Rota Details
                    </CardTitle>
                    <CardDescription>
                        Viewing details for: <strong>{rotaToDisplay.name}</strong>
                    </CardDescription>
                </div>
            </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-2 text-sm">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
                <p><strong className="font-medium text-muted-foreground">Site:</strong> {rotaToDisplay.scheduleMeta.site}</p>
                <p><strong className="font-medium text-muted-foreground">Specialty:</strong> {rotaToDisplay.scheduleMeta.specialty}</p>
                <p><strong className="font-medium text-muted-foreground">Rota Start Date:</strong> {new Date(rotaToDisplay.scheduleMeta.scheduleStartDate).toLocaleDateString()}</p>
                <p><strong className="font-medium text-muted-foreground">Rota End Date:</strong> {new Date(rotaToDisplay.scheduleMeta.endDate).toLocaleDateString()}</p>
                <p><strong className="font-medium text-muted-foreground">Weeks in Cycle:</strong> {rotaToDisplay.scheduleMeta.scheduleTotalWeeks}</p>
                <p><strong className="font-medium text-muted-foreground">Annual Leave (days):</strong> {rotaToDisplay.scheduleMeta.annualLeaveEntitlement}</p>
                <p><strong className="font-medium text-muted-foreground">Hours/Normal Day (for leave):</strong> {rotaToDisplay.scheduleMeta.hoursInNormalDay}</p>
                <p><strong className="font-medium text-muted-foreground">WTR 48hr Opt-Out:</strong> {rotaToDisplay.scheduleMeta.wtrOptOut ? 'Yes' : 'No'}</p>
            </div>
        </CardContent>
      </Card>

      <Separator className="my-8" />
      
      <Card className="w-full shadow-lg my-6">
        <CardHeader>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <CardTitle className="text-2xl font-headline text-primary">
                        Rota Grid: {rotaToDisplay.name}
                    </CardTitle>
                    <CardDescription>
                        Viewing the rota grid. Shift types are defined when <Link href="/upload-rota" className="underline text-primary hover:text-primary/80">uploading a new rota</Link>.
                    </CardDescription>
                </div>
            </div>
        </CardHeader>
        <RotaInputForm
          key={`${rotaToDisplay.id}-${rotaToDisplay.scheduleMeta.scheduleTotalWeeks}-${rotaToDisplay.scheduleMeta.scheduleStartDate}`} 
          scheduleMetaConfig={{
            scheduleTotalWeeks: rotaToDisplay.scheduleMeta.scheduleTotalWeeks,
            scheduleStartDate: rotaToDisplay.scheduleMeta.scheduleStartDate,
          }}
          shiftDefinitions={rotaToDisplay.shiftDefinitions}
          initialRotaGrid={rotaToDisplay.rotaGrid || {}}
          onProcessRota={async () => { /* No-op in view-only mode from here */ }} 
          isProcessing={isProcessing} 
          isEditing={false} // Always false for view-only
        />
      </Card>
      <ComplianceReport result={rotaResult} isProcessing={isProcessing} />
    </div>
  );
}
