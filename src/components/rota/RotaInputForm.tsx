
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
import { CalendarDays, Send, XCircle, AlertCircle as AlertIconLucide, Edit, Save } from 'lucide-react';
import type { RotaInput, ProcessedRotaResult, ShiftDefinition, ScheduleMetadata, RotaGridInput } from '@/types';
import React, { useEffect } from 'react';
import { useToast } from "@/hooks/use-toast";
import Link from 'next/link';

const OFF_VALUE = "_OFF_"; // Special value for the "OFF" SelectItem

const rotaGridFormSchema = z.object({
  rotaGrid: z.record(z.string()),
});

type RotaGridFormValues = z.infer<typeof rotaGridFormSchema>;

interface RotaInputFormProps {
  scheduleMeta: ScheduleMetadata; 
  shiftDefinitions: ShiftDefinition[];
  initialRotaGrid?: RotaGridInput;
  onProcessRota: (fullRotaInput: RotaInput) => Promise<void>;
  isProcessing: boolean;
  setIsProcessing: (isProcessing: boolean) => void;
  isEditing: boolean;
}

export default function RotaInputForm({ 
    scheduleMeta, 
    shiftDefinitions, 
    initialRotaGrid, 
    onProcessRota, 
    isProcessing, 
    setIsProcessing,
    isEditing
}: RotaInputFormProps) {
  const { toast } = useToast();

  const { control, handleSubmit, reset, formState: { errors: formErrors, isDirty } } = useForm<RotaGridFormValues>({
    resolver: zodResolver(rotaGridFormSchema),
    defaultValues: {
      rotaGrid: initialRotaGrid || {},
    },
  });

  useEffect(() => {
    // Pre-process initialRotaGrid: map empty strings to OFF_VALUE for display
    const displayGrid = { ...initialRotaGrid };
    if (initialRotaGrid) {
        for (const key in initialRotaGrid) {
            if (initialRotaGrid[key] === "") {
                displayGrid[key] = OFF_VALUE;
            }
        }
    }
    reset({ rotaGrid: displayGrid });
  }, [initialRotaGrid, reset]);


  const onSubmitGrid: SubmitHandler<RotaGridFormValues> = async (data) => {
    if (!scheduleMeta || !shiftDefinitions || shiftDefinitions.length === 0) {
      toast({ title: "Missing Configuration", description: "Schedule setup or shift definitions are missing. Please complete your profile.", variant: "destructive" });
      return;
    }

    // Convert OFF_VALUE back to empty string for processing/saving
    const processedGrid: RotaGridInput = {};
    for (const key in data.rotaGrid) {
        processedGrid[key] = data.rotaGrid[key] === OFF_VALUE ? "" : data.rotaGrid[key];
    }

    const fullRotaInput: RotaInput = {
      scheduleMeta,
      shiftDefinitions,
      rotaGrid: processedGrid,
    };
    await onProcessRota(fullRotaInput);
  };
  
  const handleClearGrid = () => {
    // Reset form fields to OFF_VALUE for display
    const clearedDisplayGrid: RotaGridInput = {};
     if(scheduleMeta) {
        for(let w=0; w < scheduleMeta.scheduleTotalWeeks; w++) {
            for(let d=0; d<7; d++) {
                clearedDisplayGrid[`week_${w}_day_${d}`] = OFF_VALUE;
            }
        }
    }
    reset({ rotaGrid: clearedDisplayGrid });

    // Prepare cleared data for processing (empty strings for OFF)
    const clearedProcessingGrid: RotaGridInput = {};
     if(scheduleMeta) {
        for(let w=0; w < scheduleMeta.scheduleTotalWeeks; w++) {
            for(let d=0; d<7; d++) {
                clearedProcessingGrid[`week_${w}_day_${d}`] = "";
            }
        }
    }
    const clearedFullRotaInput: RotaInput = {
        scheduleMeta,
        shiftDefinitions,
        rotaGrid: clearedProcessingGrid
    };
    onProcessRota(clearedFullRotaInput); 
    toast({ title: "Rota Grid Cleared", description: "Your rota inputs have been reset. Click 'Save Rota and Check Compliance' to save and re-process." });
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
        <CardContent className="space-y-6 pt-6">
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
                                                    value={field.value || OFF_VALUE} // Default to OFF_VALUE if field.value is empty or undefined
                                                    disabled={!isEditing}
                                                >
                                                    <SelectTrigger 
                                                        className="w-full min-w-[100px] sm:min-w-[120px] h-9 text-xs"
                                                        disabled={!isEditing}
                                                    >
                                                        {/* Display "OFF" if current value is OFF_VALUE, otherwise SelectValue handles it */}
                                                        {field.value === OFF_VALUE ? "OFF" : <SelectValue placeholder="OFF" />}
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value={OFF_VALUE}>OFF</SelectItem>
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
                <Button type="submit" className="w-full sm:w-auto bg-accent hover:bg-accent/90 text-accent-foreground" disabled={isProcessing || shiftDefinitions.length === 0 || !isEditing || !isDirty}>
                    <Save className="mr-2 h-4 w-4" /> {isProcessing ? 'Processing...' : 'Save Rota and Check Compliance'}
                </Button>
            </CardFooter>
        )}
      </form>
  );
}

