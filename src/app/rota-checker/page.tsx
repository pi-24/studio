
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm, Controller, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

import RotaInputForm from '@/components/rota/RotaInputForm';
import ComplianceReport from '@/components/rota/ComplianceReport';
import type { ProcessedRotaResult, RotaProcessingInput, RotaDocument, RotaGridInput, RotaSpecificScheduleMetadata, ShiftDefinition } from '@/types';
import { processRota } from '@/app/actions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertCircle, Loader2, Edit, Check, Save, Info, Settings2, X } from 'lucide-react';
import Link from 'next/link';
import { useToast } from "@/hooks/use-toast";
import { Separator } from '@/components/ui/separator';

const rotaDetailsSchema = z.object({
  name: z.string().min(1, "Rota name is required"),
  site: z.string().min(1, "Site is required"),
  specialty: z.string().min(1, "Specialty is required"),
  scheduleStartDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date YYYY-MM-DD'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'End date YYYY-MM-DD'),
  scheduleTotalWeeks: z.number().min(1, "Min 1 week").max(52, "Max 52 weeks"),
  wtrOptOut: z.boolean(),
  annualLeaveEntitlement: z.number().min(0, "Min 0 days"),
  hoursInNormalDay: z.number().min(1, "Min 1 hour").max(24, "Max 24 hours"),
}).refine(data => {
    if (!data.scheduleStartDate || !data.endDate) return true; 
    try {
        return new Date(data.endDate) >= new Date(data.scheduleStartDate);
    } catch (e) {
        return true; 
    }
}, {
    message: "End date must be after or the same as start date",
    path: ["endDate"],
});

type RotaDetailsFormValues = z.infer<typeof rotaDetailsSchema>;


export default function RotaCheckerPage() {
  const { user, loading: authLoading, updateRotaDocument } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const [rotaToDisplay, setRotaToDisplay] = useState<RotaDocument | null>(null);
  const [rotaResult, setRotaResult] = useState<ProcessedRotaResult | { error: string; fieldErrors?: any[] } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isEditingRotaGrid, setIsEditingRotaGrid] = useState(false);
  const [isEditingRotaDetails, setIsEditingRotaDetails] = useState(false);

  const { 
    control: detailsControl, 
    handleSubmit: handleDetailsSubmit, 
    register: registerDetails, 
    reset: resetDetailsForm,
    formState: { errors: detailsErrors, isSubmitting: detailsIsSubmitting }
  } = useForm<RotaDetailsFormValues>({
    resolver: zodResolver(rotaDetailsSchema),
    defaultValues: {
        name: '',
        site: '',
        specialty: '',
        scheduleStartDate: new Date().toISOString().split('T')[0],
        endDate: new Date(new Date().setDate(new Date().getDate() + 28)).toISOString().split('T')[0],
        scheduleTotalWeeks: 4,
        wtrOptOut: false,
        annualLeaveEntitlement: 27,
        hoursInNormalDay: 8,
    }
  });

  const performRotaProcessing = useCallback(async (currentRotaDoc: RotaDocument) => {
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
    } else {
        toast({ title: "Rota Processed", description: "Compliance checks updated." });
    }
  }, [toast]);

  useEffect(() => {
    if (authLoading || !user) return;

    const rotaId = searchParams.get('rotaId');
    if (!rotaId) {
      if (user.rotas && user.rotas.length > 0) {
        router.replace(`/rota-checker?rotaId=${user.rotas[0].id}`);
      } else {
        setRotaToDisplay(null);
        setRotaResult({error: "No rota selected or available. Please upload a rota first."});
      }
      return;
    }

    const foundRota = user.rotas?.find(r => r.id === rotaId);
    if (foundRota) {
      if (rotaToDisplay?.id !== foundRota.id || 
          JSON.stringify(rotaToDisplay?.scheduleMeta) !== JSON.stringify(foundRota.scheduleMeta) ||
          JSON.stringify(rotaToDisplay?.rotaGrid) !== JSON.stringify(foundRota.rotaGrid)
         ) {
        setRotaToDisplay(foundRota);
        resetDetailsForm({
            name: foundRota.name,
            site: foundRota.scheduleMeta.site,
            specialty: foundRota.scheduleMeta.specialty,
            scheduleStartDate: foundRota.scheduleMeta.scheduleStartDate,
            endDate: foundRota.scheduleMeta.endDate,
            scheduleTotalWeeks: foundRota.scheduleMeta.scheduleTotalWeeks,
            wtrOptOut: foundRota.scheduleMeta.wtrOptOut,
            annualLeaveEntitlement: foundRota.scheduleMeta.annualLeaveEntitlement,
            hoursInNormalDay: foundRota.scheduleMeta.hoursInNormalDay,
        });
        performRotaProcessing(foundRota);
      }
    } else {
      setRotaToDisplay(null);
      setRotaResult({error: `Rota with ID "${rotaId}" not found.`});
      toast({ title: "Error", description: `Rota with ID "${rotaId}" not found.`, variant: "destructive"});
    }
  }, [user, authLoading, searchParams, router, toast, performRotaProcessing, rotaToDisplay, resetDetailsForm]);


  const handleRotaGridUpdateAndProcess = useCallback(async (submittedRotaGrid: RotaGridInput) => {
    if (!user || !rotaToDisplay) {
      setRotaResult({ error: "User or Rota data is incomplete. Cannot process." });
      return;
    }
    
    const currentGridString = JSON.stringify(rotaToDisplay.rotaGrid);
    const newGridString = JSON.stringify(submittedRotaGrid);

    let updatedRotaDoc = { ...rotaToDisplay, rotaGrid: submittedRotaGrid };

    if (currentGridString !== newGridString) {
      updateRotaDocument(updatedRotaDoc); // Save if grid changed
      setRotaToDisplay(updatedRotaDoc); // Update local state
    }
    
    await performRotaProcessing(updatedRotaDoc);
    setIsEditingRotaGrid(false); // Switch back to view mode for grid
    
  }, [user, rotaToDisplay, toast, updateRotaDocument, performRotaProcessing]);

  const onSaveRotaDetails: SubmitHandler<RotaDetailsFormValues> = async (data) => {
    if (!user || !rotaToDisplay) {
        toast({title: "Error", description: "Cannot save, user or rota data missing.", variant: "destructive"});
        return;
    }
    const updatedScheduleMeta: RotaSpecificScheduleMetadata = {
        site: data.site,
        specialty: data.specialty,
        scheduleStartDate: data.scheduleStartDate,
        endDate: data.endDate,
        scheduleTotalWeeks: data.scheduleTotalWeeks,
        wtrOptOut: data.wtrOptOut,
        annualLeaveEntitlement: data.annualLeaveEntitlement,
        hoursInNormalDay: data.hoursInNormalDay,
    };
    const updatedRotaDoc: RotaDocument = {
        ...rotaToDisplay,
        name: data.name,
        scheduleMeta: updatedScheduleMeta,
    };
    
    updateRotaDocument(updatedRotaDoc);
    setRotaToDisplay(updatedRotaDoc); // Update local state
    await performRotaProcessing(updatedRotaDoc);
    setIsEditingRotaDetails(false);
    toast({title: "Rota Details Saved", description: "The rota's core information has been updated."});
  };


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
  
  const handleToggleEditGrid = () => {
    setIsEditingRotaGrid(!isEditingRotaGrid);
    if (isEditingRotaDetails) setIsEditingRotaDetails(false); // Ensure only one edit mode active
  };

  const handleToggleEditDetails = () => {
    setIsEditingRotaDetails(!isEditingRotaDetails);
    if (isEditingRotaGrid) setIsEditingRotaGrid(false); // Ensure only one edit mode active
    if (!isEditingRotaDetails && rotaToDisplay) { // When toggling to view, reset form to current rota values
        resetDetailsForm({
            name: rotaToDisplay.name,
            site: rotaToDisplay.scheduleMeta.site,
            specialty: rotaToDisplay.scheduleMeta.specialty,
            scheduleStartDate: rotaToDisplay.scheduleMeta.scheduleStartDate,
            endDate: rotaToDisplay.scheduleMeta.endDate,
            scheduleTotalWeeks: rotaToDisplay.scheduleMeta.scheduleTotalWeeks,
            wtrOptOut: rotaToDisplay.scheduleMeta.wtrOptOut,
            annualLeaveEntitlement: rotaToDisplay.scheduleMeta.annualLeaveEntitlement,
            hoursInNormalDay: rotaToDisplay.scheduleMeta.hoursInNormalDay,
        });
    }
  };


  return (
    <div className="space-y-8">
      <Card className="w-full shadow-lg my-6">
        <CardHeader>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <CardTitle className="text-2xl font-headline text-primary flex items-center gap-2">
                        <Settings2 className="h-6 w-6" /> Rota Details
                    </CardTitle>
                    {!isEditingRotaDetails && (
                        <CardDescription>
                            Viewing details for: <strong>{rotaToDisplay.name}</strong> <br/>
                            Site: {rotaToDisplay.scheduleMeta.site}, Specialty: {rotaToDisplay.scheduleMeta.specialty} <br/>
                            Period: {new Date(rotaToDisplay.scheduleMeta.scheduleStartDate).toLocaleDateString()} - {new Date(rotaToDisplay.scheduleMeta.endDate).toLocaleDateString()} ({rotaToDisplay.scheduleMeta.scheduleTotalWeeks} week cycle)
                        </CardDescription>
                    )}
                </div>
                {!isEditingRotaDetails && (
                    <Button onClick={handleToggleEditDetails} variant="outline" className="w-full sm:w-auto">
                        <Edit className="mr-2 h-4 w-4" /> 
                        Edit Rota Details
                    </Button>
                )}
            </div>
        </CardHeader>
        {isEditingRotaDetails && (
            <form onSubmit={handleDetailsSubmit(onSaveRotaDetails)}>
                <CardContent className="space-y-4 pt-2">
                    <div>
                        <Label htmlFor="details.name">Rota Name</Label>
                        <Input id="details.name" {...registerDetails('name')} />
                        {detailsErrors.name && <p className="text-sm text-destructive mt-1">{detailsErrors.name.message}</p>}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <Label htmlFor="details.site">Site</Label>
                            <Input id="details.site" {...registerDetails('site')} />
                            {detailsErrors.site && <p className="text-sm text-destructive mt-1">{detailsErrors.site.message}</p>}
                        </div>
                        <div>
                            <Label htmlFor="details.specialty">Specialty</Label>
                            <Input id="details.specialty" {...registerDetails('specialty')} />
                            {detailsErrors.specialty && <p className="text-sm text-destructive mt-1">{detailsErrors.specialty.message}</p>}
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <Label htmlFor="details.scheduleStartDate">Rota Start Date</Label>
                            <Input type="date" id="details.scheduleStartDate" {...registerDetails('scheduleStartDate')} />
                            {detailsErrors.scheduleStartDate && <p className="text-sm text-destructive mt-1">{detailsErrors.scheduleStartDate.message}</p>}
                        </div>
                        <div>
                            <Label htmlFor="details.endDate">Rota End Date</Label>
                            <Input type="date" id="details.endDate" {...registerDetails('endDate')} />
                            {detailsErrors.endDate && <p className="text-sm text-destructive mt-1">{detailsErrors.endDate.message}</p>}
                        </div>
                    </div>
                     <div>
                        <Label htmlFor="details.scheduleTotalWeeks">Number of Weeks in Rota Cycle</Label>
                        <Input type="number" id="details.scheduleTotalWeeks" {...registerDetails('scheduleTotalWeeks', { valueAsNumber: true })} min="1" max="52" />
                        {detailsErrors.scheduleTotalWeeks && <p className="text-sm text-destructive mt-1">{detailsErrors.scheduleTotalWeeks.message}</p>}
                    </div>
                    <div>
                        <Label htmlFor="details.annualLeaveEntitlement">Annual Leave Entitlement (days per year)</Label>
                        <Input type="number" id="details.annualLeaveEntitlement" {...registerDetails('annualLeaveEntitlement', { valueAsNumber: true })} min="0"/>
                        {detailsErrors.annualLeaveEntitlement && <p className="text-sm text-destructive mt-1">{detailsErrors.annualLeaveEntitlement.message}</p>}
                    </div>
                    <div>
                        <Label htmlFor="details.hoursInNormalDay">Hours in a Normal Working Day (for leave calc)</Label>
                        <Input type="number" step="0.1" id="details.hoursInNormalDay" {...registerDetails('hoursInNormalDay', { valueAsNumber: true })} min="1" max="24"/>
                        {detailsErrors.hoursInNormalDay && <p className="text-sm text-destructive mt-1">{detailsErrors.hoursInNormalDay.message}</p>}
                    </div>
                    <div className="flex items-center space-x-2 pt-2">
                        <Controller name="wtrOptOut" control={detailsControl} render={({ field }) => (<Checkbox id="details.wtrOptOut" checked={field.value} onCheckedChange={field.onChange} />)} />
                        <Label htmlFor="details.wtrOptOut">WTR 48-hour average opt-out agreed?</Label>
                        {detailsErrors.wtrOptOut && <p className="text-sm text-destructive mt-1">{detailsErrors.wtrOptOut.message}</p>}
                    </div>
                </CardContent>
                <CardFooter className="flex justify-end gap-2 pt-4 border-t">
                    <Button type="button" variant="ghost" onClick={handleToggleEditDetails} disabled={detailsIsSubmitting}>Cancel</Button>
                    <Button type="submit" className="bg-accent hover:bg-accent/90 text-accent-foreground" disabled={detailsIsSubmitting}>
                        <Save className="mr-2 h-4 w-4" /> {detailsIsSubmitting ? 'Saving...' : 'Save Rota Details'}
                    </Button>
                </CardFooter>
            </form>
        )}
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
                        {isEditingRotaGrid 
                            ? "Modify your rota grid below. Click 'Save Rota and Check Compliance' to update."
                            : "View your current rota grid. Click 'Edit Rota Grid' to make changes."}
                         Shift types are defined when <Link href="/upload-rota" className="underline text-primary hover:text-primary/80">uploading a new rota</Link> (editing shift types for existing rotas coming soon).
                    </CardDescription>
                </div>
                {!isEditingRotaGrid && (
                    <Button onClick={handleToggleEditGrid} variant="outline" className="w-full sm:w-auto">
                        <Edit className="mr-2 h-4 w-4" /> 
                        Edit Rota Grid
                    </Button>
                )}
            </div>
        </CardHeader>
        <RotaInputForm
          key={`${rotaToDisplay.id}-${rotaToDisplay.scheduleMeta.scheduleTotalWeeks}-${rotaToDisplay.scheduleMeta.scheduleStartDate}`} // Force re-render if key parts change
          scheduleMetaConfig={{
            scheduleTotalWeeks: rotaToDisplay.scheduleMeta.scheduleTotalWeeks,
            scheduleStartDate: rotaToDisplay.scheduleMeta.scheduleStartDate,
          }}
          shiftDefinitions={rotaToDisplay.shiftDefinitions}
          initialRotaGrid={rotaToDisplay.rotaGrid || {}}
          onProcessRota={handleRotaGridUpdateAndProcess} 
          isProcessing={isProcessing || detailsIsSubmitting} // Disable grid form if details are being submitted
          isEditing={isEditingRotaGrid}
        />
      </Card>
      <ComplianceReport result={rotaResult} isProcessing={isProcessing || detailsIsSubmitting} />
    </div>
  );
}

