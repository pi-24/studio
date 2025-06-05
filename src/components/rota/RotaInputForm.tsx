
"use client";

import type { SubmitHandler } from 'react-hook-form';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { CalendarDays, Send, XCircle, AlertCircle as AlertIconLucide } from 'lucide-react';
import type { RotaInput, ProcessedRotaResult, ShiftDefinition, ScheduleMetadata, RotaGridInput } from '@/types';
import { processRota } from '@/app/actions';
import React from 'react';
import { useToast } from "@/hooks/use-toast";

// Schema for the rota grid part of the form
const rotaGridFormSchema = z.object({
  rotaGrid: z.record(z.string()), // Dynamic keys like week_0_day_0
});

type RotaGridFormValues = z.infer<typeof rotaGridFormSchema>;

interface RotaInputFormProps {
  scheduleMeta: ScheduleMetadata | undefined; // Now passed as prop
  shiftDefinitions: ShiftDefinition[] | undefined; // Now passed as prop
  onProcessRota: (result: ProcessedRotaResult | { error: string; fieldErrors?: z.ZodIssue[] } | null) => void;
  isProcessing: boolean;
  setIsProcessing: (isProcessing: boolean) => void;
}

export default function RotaInputForm({ scheduleMeta, shiftDefinitions, onProcessRota, isProcessing, setIsProcessing }: RotaInputFormProps) {
  const { toast } = useToast();

  const { control, handleSubmit, reset, formState: { errors: formErrors }, setError: setFormError } = useForm<RotaGridFormValues>({
    resolver: zodResolver(rotaGridFormSchema),
    defaultValues: {
      rotaGrid: {},
    },
  });

  const onSubmitGrid: SubmitHandler<RotaGridFormValues> = async (data) => {
    if (!scheduleMeta || !shiftDefinitions || shiftDefinitions.length === 0) {
      toast({ title: "Missing Configuration", description: "Schedule setup or shift definitions are missing. Please complete your profile.", variant: "destructive" });
      onProcessRota({ error: "Schedule setup or shift definitions are missing." });
      return;
    }

    setIsProcessing(true);
    const fullRotaInput: RotaInput = {
      scheduleMeta,
      shiftDefinitions,
      rotaGrid: data.rotaGrid,
    };
    const result = await processRota(fullRotaInput);
    onProcessRota(result);
    setIsProcessing(false);

    if ('error' in result) {
      toast({ title: "Processing Error", description: result.error, variant: "destructive" });
      if (result.fieldErrors) {
        result.fieldErrors.forEach(fieldError => {
          const path = fieldError.path.join('.') as any;
          setFormError(path, { type: 'server', message: fieldError.message });
        });
      }
    } else {
      toast({ title: "Rota Processed", description: "Compliance checks complete.", variant: "default" });
    }
  };
  
  const handleClearGrid = () => {
    reset({ rotaGrid: {} });
    onProcessRota(null); // Clear results view
    toast({ title: "Rota Grid Cleared", description: "Your rota inputs have been reset." });
  };
  
  const daysOfWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  if (!scheduleMeta || !shiftDefinitions) {
    return (
        <Card className="w-full shadow-lg my-8">
            <CardHeader>
                <CardTitle className="text-2xl font-headline flex items-center gap-2"><CalendarDays className="text-primary"/>Input Weekly Rota</CardTitle>
                <CardDescription>Loading schedule configuration...</CardDescription>
            </CardHeader>
            <CardContent>
                <p className="text-muted-foreground text-center py-6">Please complete your profile setup to configure schedule parameters and shift types.</p>
            </CardContent>
        </Card>
    );
  }

  return (
    <Card className="w-full shadow-lg my-8">
      <CardHeader>
        <CardTitle className="text-2xl font-headline flex items-center gap-2"><CalendarDays className="text-primary"/>Input Weekly Rota</CardTitle>
        <CardDescription>Select the defined shift for each day of your rota cycle. Schedule configuration and shift types are managed in your profile.</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit(onSubmitGrid)}>
        <CardContent className="space-y-6">
          {shiftDefinitions.length === 0 || shiftDefinitions.every(d => !d.dutyCode) ? (
                <p className="text-amber-500 flex items-center"><AlertIconLucide size={18} className="mr-2"/>No shift types defined. Please add shift definitions in your profile.</p>
            ) : (
            <div className="overflow-x-auto custom-scrollbar">
                <table className="min-w-full divide-y divide-border border border-border">
                    <thead className="bg-muted/50">
                        <tr>
                            <th className="px-2 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Week</th>
                            {daysOfWeek.map(day => <th key={day} className="px-2 py-2.5 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider">{day}</th>)}
                        </tr>
                    </thead>
                    <tbody className="bg-card divide-y divide-border">
                        {Array.from({ length: scheduleMeta.scheduleTotalWeeks || 0 }, (_, weekIndex) => (
                            <tr key={weekIndex}>
                                <td className="px-2 py-2 whitespace-nowrap text-sm font-medium text-foreground">Week {weekIndex + 1}</td>
                                {daysOfWeek.map((_, dayIndex) => (
                                    <td key={dayIndex} className="px-1 py-1 whitespace-nowrap text-center">
                                        <Controller
                                            name={`rotaGrid.week_${weekIndex}_day_${dayIndex}`}
                                            control={control}
                                            defaultValue=""
                                            render={({ field }) => (
                                                <Select onValueChange={field.onChange} value={field.value || ""}>
                                                    <SelectTrigger className="w-full min-w-[100px] sm:min-w-[120px] h-9 text-xs">
                                                        <SelectValue placeholder="OFF" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {shiftDefinitions.filter(d => d.dutyCode).map(def => (
                                                            <SelectItem key={def.id} value={def.dutyCode}>
                                                                {def.dutyCode} - {def.name.substring(0,12)}{def.name.length > 12 ? '...' : ''}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            )}
                                        />
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
          )}
          {formErrors.rotaGrid && <p className="text-sm text-destructive mt-1">{typeof formErrors.rotaGrid.message === 'string' ? formErrors.rotaGrid.message : 'Error in rota grid.'}</p>}
        </CardContent>
        <CardFooter className="flex flex-col sm:flex-row justify-end gap-3 pt-6 border-t">
            <AlertDialog>
                <AlertDialogTrigger asChild>
                    <Button type="button" variant="destructive" disabled={isProcessing}>
                        <XCircle className="mr-2 h-4 w-4"/> Clear Rota Grid
                    </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                    <AlertDialogHeader>
                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                        This will reset all rota inputs in the grid above. Schedule setup and shift definitions will remain. This action cannot be undone for the grid.
                    </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleClearGrid} className="bg-destructive hover:bg-destructive/90">Yes, Clear Grid</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            <Button type="submit" className="w-full sm:w-auto bg-accent hover:bg-accent/90 text-accent-foreground" disabled={isProcessing || shiftDefinitions.length === 0}>
                <Send className="mr-2 h-4 w-4" /> {isProcessing ? 'Processing...' : 'Calculate & Check Compliance'}
            </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
