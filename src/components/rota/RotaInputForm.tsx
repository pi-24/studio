
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
import { CalendarDays, Send, XCircle, AlertCircle as AlertIconLucide, Edit } from 'lucide-react';
import type { RotaInput, ProcessedRotaResult, ShiftDefinition, ScheduleMetadata, RotaGridInput } from '@/types';
import React, { useEffect } from 'react';
import { useToast } from "@/hooks/use-toast";
import Link from 'next/link';

// Schema for the rota grid part of the form
const rotaGridFormSchema = z.object({
  rotaGrid: z.record(z.string()), // Dynamic keys like week_0_day_0
});

type RotaGridFormValues = z.infer<typeof rotaGridFormSchema>;

interface RotaInputFormProps {
  scheduleMeta: ScheduleMetadata; 
  shiftDefinitions: ShiftDefinition[];
  initialRotaGrid?: RotaGridInput; // For pre-filling the grid
  onProcessRota: (fullRotaInput: RotaInput) => Promise<void>; // Expects the full input
  isProcessing: boolean;
  setIsProcessing: (isProcessing: boolean) => void;
  isEditing: boolean; // New prop to control edit mode
}

export default function RotaInputForm({ 
    scheduleMeta, 
    shiftDefinitions, 
    initialRotaGrid, 
    onProcessRota, 
    isProcessing, 
    setIsProcessing,
    isEditing // Destructure new prop
}: RotaInputFormProps) {
  const { toast } = useToast();

  const { control, handleSubmit, reset, formState: { errors: formErrors }, setError: setFormError } = useForm<RotaGridFormValues>({
    resolver: zodResolver(rotaGridFormSchema),
    defaultValues: {
      rotaGrid: initialRotaGrid || {},
    },
  });

  useEffect(() => {
    reset({ rotaGrid: initialRotaGrid || {} });
  }, [initialRotaGrid, reset]);


  const onSubmitGrid: SubmitHandler<RotaGridFormValues> = async (data) => {
    if (!scheduleMeta || !shiftDefinitions || shiftDefinitions.length === 0) {
      toast({ title: "Missing Configuration", description: "Schedule setup or shift definitions are missing. Please complete your profile.", variant: "destructive" });
      return;
    }

    const fullRotaInput: RotaInput = {
      scheduleMeta,
      shiftDefinitions,
      rotaGrid: data.rotaGrid,
    };
    await onProcessRota(fullRotaInput); // Parent handles setting results and errors
  };
  
  const handleClearGrid = () => {
    reset({ rotaGrid: {} });
    const clearedFullRotaInput: RotaInput = {
        scheduleMeta,
        shiftDefinitions,
        rotaGrid: {}
    };
    onProcessRota(clearedFullRotaInput); 
    toast({ title: "Rota Grid Cleared", description: "Your rota inputs have been reset. Click 'Calculate & Check' to re-process." });
  };
  
  const daysOfWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  if (!scheduleMeta || !shiftDefinitions) {
    return (
        <CardContent>
            <p className="text-muted-foreground text-center py-6">
                Schedule configuration or shift types are missing. 
                Please <Link href="/profile" className="underline text-primary">update your profile</Link>.
            </p>
        </CardContent>
    );
  }

  return (
      <form onSubmit={handleSubmit(onSubmitGrid)}>
        <CardContent className="space-y-6 pt-6"> {/* Added pt-6 for spacing from header */}
          {shiftDefinitions.length === 0 || shiftDefinitions.every(d => !d.dutyCode) ? (
                <div className="p-4 text-amber-600 dark:text-amber-500 bg-amber-50 dark:bg-amber-900/30 border border-amber-300 dark:border-amber-700 rounded-md">
                    <p className="flex items-center"><AlertIconLucide size={18} className="mr-2"/>No shift types defined. Please <Link href="/profile" className="font-semibold underline hover:text-amber-700 dark:hover:text-amber-400">add shift definitions in your profile</Link>.</p>
                </div>
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
                                            render={({ field }) => (
                                                <Select 
                                                    onValueChange={field.onChange} 
                                                    value={field.value || ""}
                                                    disabled={!isEditing} // Disable select if not in edit mode
                                                >
                                                    <SelectTrigger 
                                                        className="w-full min-w-[100px] sm:min-w-[120px] h-9 text-xs"
                                                        disabled={!isEditing} // Also disable trigger visually
                                                    >
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
        {isEditing && (
            <CardFooter className="flex flex-col sm:flex-row justify-end gap-3 pt-6 border-t">
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button type="button" variant="destructive" disabled={isProcessing || !isEditing}>
                            <XCircle className="mr-2 h-4 w-4"/> Clear Rota Grid
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will reset all your rota inputs in the grid above. This action cannot be undone for the grid data.
                        </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleClearGrid} className="bg-destructive hover:bg-destructive/90">Yes, Clear Grid</AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
                <Button type="submit" className="w-full sm:w-auto bg-accent hover:bg-accent/90 text-accent-foreground" disabled={isProcessing || shiftDefinitions.length === 0 || !isEditing}>
                    <Send className="mr-2 h-4 w-4" /> {isProcessing ? 'Processing...' : 'Calculate & Check Compliance'}
                </Button>
            </CardFooter>
        )}
      </form>
  );
}

