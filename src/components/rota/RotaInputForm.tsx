
"use client";

import type { SubmitHandler } from 'react-hook-form';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { CardContent, CardFooter } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { XCircle, Save, AlertTriangle } from 'lucide-react';
import type { ShiftDefinition, RotaGridInput } from '@/types';
import React, { useEffect } from 'react';
import { useToast } from "@/hooks/use-toast";
import Link from 'next/link';

const OFF_VALUE = "_OFF_"; 

const rotaGridFormSchema = z.object({
  rotaGrid: z.record(z.string()),
});

type RotaGridFormValues = z.infer<typeof rotaGridFormSchema>;

interface RotaInputFormProps {
  scheduleMetaConfig: { // Simplified config for grid display
    scheduleTotalWeeks: number;
    scheduleStartDate: string; // Needed to display week numbers if desired, or could be omitted if only total weeks is used
  };
  shiftDefinitions: ShiftDefinition[];
  initialRotaGrid?: RotaGridInput;
  onProcessRota: (rotaGrid: RotaGridInput) => Promise<void>; // Now only expects the grid
  isProcessing: boolean;
  isEditing: boolean;
}

export default function RotaInputForm({ 
    scheduleMetaConfig, 
    shiftDefinitions, 
    initialRotaGrid, 
    onProcessRota, 
    isProcessing,
    isEditing
}: RotaInputFormProps) {
  const { toast } = useToast();

  const { control, handleSubmit, reset, formState: { errors: formErrors, isDirty } } = useForm<RotaGridFormValues>({
    resolver: zodResolver(rotaGridFormSchema),
    defaultValues: {
      rotaGrid: {}, // Initialize empty, useEffect will populate
    },
  });

  useEffect(() => {
    const displayGrid: RotaGridInput = {};
    if (initialRotaGrid) {
        for (const key in initialRotaGrid) {
            displayGrid[key] = initialRotaGrid[key] === "" ? OFF_VALUE : initialRotaGrid[key];
        }
    } else {
        // If no initial grid, create a default OFF grid based on scheduleMetaConfig
        if (scheduleMetaConfig) {
            for (let w = 0; w < scheduleMetaConfig.scheduleTotalWeeks; w++) {
                for (let d = 0; d < 7; d++) {
                    displayGrid[`week_${w}_day_${d}`] = OFF_VALUE;
                }
            }
        }
    }
    reset({ rotaGrid: displayGrid });
  }, [initialRotaGrid, scheduleMetaConfig, reset]);


  const onSubmitGrid: SubmitHandler<RotaGridFormValues> = async (data) => {
    if (!scheduleMetaConfig || !shiftDefinitions || shiftDefinitions.length === 0) {
      toast({ title: "Missing Configuration", description: "Schedule setup or shift definitions are missing.", variant: "destructive" });
      return;
    }

    const processedGrid: RotaGridInput = {};
    for (const key in data.rotaGrid) {
        processedGrid[key] = data.rotaGrid[key] === OFF_VALUE ? "" : data.rotaGrid[key];
    }
    await onProcessRota(processedGrid); // Pass only the grid
  };
  
  const handleClearGrid = () => {
    const clearedDisplayGrid: RotaGridInput = {};
     if(scheduleMetaConfig) {
        for(let w=0; w < scheduleMetaConfig.scheduleTotalWeeks; w++) {
            for(let d=0; d<7; d++) {
                clearedDisplayGrid[`week_${w}_day_${d}`] = OFF_VALUE;
            }
        }
    }
    reset({ rotaGrid: clearedDisplayGrid });
    // Note: onProcessRota is NOT called here. Clearing is a form reset. Submission will process.
    toast({ title: "Rota Grid Cleared", description: "Your rota inputs have been reset. Click 'Save Rota and Check Compliance' to save and process." });
  };
  
  const daysOfWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  if (!scheduleMetaConfig || !shiftDefinitions) {
    return (
        <CardContent>
            <p className="text-muted-foreground text-center py-6">
                Rota configuration or shift types are missing. 
                This might be an issue with the selected rota.
            </p>
        </CardContent>
    );
  }
  
  if (shiftDefinitions.length === 0 || shiftDefinitions.every(d => !d.dutyCode)) {
     return (
        <CardContent>
            <div className="p-4 text-amber-600 dark:text-amber-500 bg-amber-50 dark:bg-amber-900/30 border border-amber-300 dark:border-amber-700 rounded-md">
                <p className="flex items-center"><AlertTriangle size={18} className="mr-2"/>No shift types defined for this rota. Please <Link href="/upload-rota" className="font-semibold underline hover:text-amber-700 dark:hover:text-amber-400">edit this rota or upload a new one with shift definitions</Link>.</p>
            </div>
        </CardContent>
    );
  }

  return (
      <form onSubmit={handleSubmit(onSubmitGrid)}>
        <CardContent className="space-y-6 pt-6">
            <div className="overflow-x-auto custom-scrollbar">
                <table className="min-w-full divide-y divide-border border border-border">
                    <thead className="bg-muted/50">
                        <tr>
                            <th className="px-2 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Week</th>
                            {daysOfWeek.map(day => <th key={day} className="px-2 py-2.5 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider">{day}</th>)}
                        </tr>
                    </thead>
                    <tbody className="bg-card divide-y divide-border">
                        {Array.from({ length: scheduleMetaConfig.scheduleTotalWeeks || 0 }, (_, weekIndex) => (
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
                                                    value={field.value || OFF_VALUE}
                                                    disabled={!isEditing || isProcessing}
                                                >
                                                    <SelectTrigger 
                                                        className="w-full min-w-[100px] sm:min-w-[120px] h-9 text-xs"
                                                        disabled={!isEditing || isProcessing}
                                                    >
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
                    <Save className="mr-2 h-4 w-4" /> {isProcessing ? 'Saving & Processing...' : 'Save Rota and Check Compliance'}
                </Button>
            </CardFooter>
        )}
      </form>
  );
}
