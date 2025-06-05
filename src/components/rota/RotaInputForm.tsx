
"use client";

import type { SubmitHandler } from 'react-hook-form';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { CalendarDays, Clock, Coffee, PlusCircle, Trash2, Send, Save, ListChecks, Settings, Info, AlertCircle as AlertIconLucide, XCircle } from 'lucide-react'; // Renamed AlertCircle to avoid conflict
import type { RotaInput, ProcessedRotaResult, ShiftDefinition, ScheduleMetadata, RotaGridInput } from '@/types';
import { processRota } from '@/app/actions';
import React, { useState, useEffect } from 'react';
import { useToast } from "@/hooks/use-toast";

const shiftDefinitionSchema = z.object({
  id: z.string(),
  dutyCode: z.string().min(1, 'Duty Code required').regex(/^[a-zA-Z0-9]+$/, 'Alphanumeric only'),
  name: z.string().min(1, 'Name required'),
  type: z.enum(['normal', 'on-call']),
  startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Start HH:MM'),
  finishTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$|^24:00$/, 'Finish HH:MM or 24:00'),
  durationStr: z.string(),
});

const scheduleMetadataSchema = z.object({
  wtrOptOut: z.boolean(),
  scheduleTotalWeeks: z.number().min(1).max(52),
  scheduleStartDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date YYYY-MM-DD'),
  annualLeaveEntitlement: z.number().min(0),
  hoursInNormalDay: z.number().min(1).max(24),
});

const rotaFormSchema = z.object({
  scheduleMeta: scheduleMetadataSchema,
  shiftDefinitions: z.array(shiftDefinitionSchema).min(1, 'At least one shift definition is required')
    .refine(items => new Set(items.map(item => item.dutyCode)).size === items.length, {
      message: 'Duty Codes must be unique',
      path: ['shiftDefinitions'] 
    }),
  rotaGrid: z.record(z.string()), // Dynamic keys like week_0_day_0
});

type RotaFormValues = z.infer<typeof rotaFormSchema>;

interface RotaInputFormProps {
  onProcessRota: (result: ProcessedRotaResult | { error: string; fieldErrors?: z.ZodIssue[] }) => void;
  isProcessing: boolean;
  setIsProcessing: (isProcessing: boolean) => void;
}

const calculateShiftDurationString = (startTimeStr: string, finishTimeStr: string): string => {
    if (!startTimeStr || !finishTimeStr) return "0h 0m";
    
    let [startH, startM] = startTimeStr.split(':').map(Number);
    let [finishH, finishM] = finishTimeStr.split(':').map(Number);

    if (isNaN(startH) || isNaN(startM) || isNaN(finishH) || isNaN(finishM)) return "Invalid";

    if (finishTimeStr === "24:00") { 
        finishH = 24;
        finishM = 0;
    }
    
    let startTotalMinutes = startH * 60 + startM;
    let finishTotalMinutes = finishH * 60 + finishM;

    if (finishTotalMinutes < startTotalMinutes) { // Handles overnight shifts automatically
        finishTotalMinutes += 24 * 60; 
    } else if (finishTotalMinutes === startTotalMinutes && startTimeStr !== finishTimeStr) { // e.g. 09:00 to 09:00 is 24h unless it's explicitly 0h (which is covered by first condition)
        // This case means it's likely intended as a 24h shift, or it's an error.
        // Given "24:00" is a special case, if start and end are identical and not "00:00" to "00:00", assume 24h for now or flag.
        // Let's assume it's 24h if they are identical and not both "00:00"
         if (startTimeStr !== "00:00" || finishTimeStr !== "00:00") {
           finishTotalMinutes += 24 * 60;
         }
    }
    
    let durationMinutes = finishTotalMinutes - startTotalMinutes;
    if (durationMinutes < 0) durationMinutes = 0; 

    const durationH = Math.floor(durationMinutes / 60);
    const durationM = durationMinutes % 60;
    
    return `${durationH}h ${durationM}m`;
};


export default function RotaInputForm({ onProcessRota, isProcessing, setIsProcessing }: RotaInputFormProps) {
  const { toast } = useToast();
  const [showInfoModal, setShowInfoModal] = useState(false);

  const { control, handleSubmit, register, formState: { errors }, reset, watch, setValue, setError: setFormError } = useForm<RotaFormValues>({
    resolver: zodResolver(rotaFormSchema),
    defaultValues: {
      scheduleMeta: {
        wtrOptOut: false,
        scheduleTotalWeeks: 4,
        scheduleStartDate: new Date().toISOString().split('T')[0],
        annualLeaveEntitlement: 27,
        hoursInNormalDay: 8,
      },
      shiftDefinitions: [{ id: crypto.randomUUID(), dutyCode: 'S1', name: 'Standard Day', type: 'normal', startTime: '09:00', finishTime: '17:00', durationStr: '8h 0m' }],
      rotaGrid: {},
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'shiftDefinitions',
  });

  const scheduleMetaValues = watch('scheduleMeta');
  const shiftDefinitionsValues = watch('shiftDefinitions');

  useEffect(() => {
    // Update duration string when start/finish times change
    shiftDefinitionsValues.forEach((def, index) => {
      const newDuration = calculateShiftDurationString(def.startTime, def.finishTime);
      if (def.durationStr !== newDuration) {
        setValue(`shiftDefinitions.${index}.durationStr`, newDuration, { shouldValidate: false, shouldDirty: false });
      }
    });
  }, [shiftDefinitionsValues, setValue]);


  const onSubmit: SubmitHandler<RotaFormValues> = async (data) => {
    setIsProcessing(true);
    const result = await processRota(data);
    onProcessRota(result);
    setIsProcessing(false);
    if ('error' in result) {
      toast({ title: "Processing Error", description: result.error, variant: "destructive" });
      if (result.fieldErrors) {
        result.fieldErrors.forEach(fieldError => {
          const path = fieldError.path.join('.') as any; // Adjust type as necessary
          setFormError(path, { type: 'server', message: fieldError.message });
        });
      }
    } else {
      toast({ title: "Rota Processed", description: "Compliance checks complete.", variant: "default" });
    }
  };

  const addShiftDefinition = () => {
    append({ id: crypto.randomUUID(), dutyCode: `S${fields.length + 1}`, name: '', type: 'normal', startTime: '09:00', finishTime: '17:00', durationStr: '8h 0m' });
  };

  const handleClearAll = () => {
    reset({
      scheduleMeta: {
        wtrOptOut: false,
        scheduleTotalWeeks: 4,
        scheduleStartDate: new Date().toISOString().split('T')[0],
        annualLeaveEntitlement: 27,
        hoursInNormalDay: 8,
      },
      shiftDefinitions: [{ id: crypto.randomUUID(), dutyCode: 'S1', name: 'Standard Day', type: 'normal', startTime: '09:00', finishTime: '17:00', durationStr: '8h 0m' }],
      rotaGrid: {},
    });
    onProcessRota(null); // Clear results
    toast({ title: "Form Cleared", description: "All inputs have been reset." });
  };
  
  const daysOfWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  return (
    <>
    <Card className="w-full shadow-lg mb-8">
      <CardHeader>
        <CardTitle className="text-2xl font-headline flex items-center gap-2"><Settings className="text-primary"/>Schedule Setup</CardTitle>
        <CardDescription>Configure overall schedule parameters. 
            <Button variant="link" className="p-0 h-auto ml-2 text-sm" onClick={() => setShowInfoModal(true)}>
                <Info size={14} className="mr-1"/> How to use
            </Button>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div>
                <Label htmlFor="scheduleMeta.scheduleStartDate">Rota Start Date</Label>
                <Input type="date" id="scheduleMeta.scheduleStartDate" {...register('scheduleMeta.scheduleStartDate')} />
                {errors.scheduleMeta?.scheduleStartDate && <p className="text-sm text-destructive mt-1">{errors.scheduleMeta.scheduleStartDate.message}</p>}
            </div>
            <div>
                <Label htmlFor="scheduleMeta.scheduleTotalWeeks">Number of Weeks in Rota</Label>
                <Input type="number" id="scheduleMeta.scheduleTotalWeeks" {...register('scheduleMeta.scheduleTotalWeeks', { valueAsNumber: true })} min="1" max="52"/>
                {errors.scheduleMeta?.scheduleTotalWeeks && <p className="text-sm text-destructive mt-1">{errors.scheduleMeta.scheduleTotalWeeks.message}</p>}
            </div>
            <div>
                <Label htmlFor="scheduleMeta.annualLeaveEntitlement">Annual Leave (days/year)</Label>
                <Input type="number" id="scheduleMeta.annualLeaveEntitlement" {...register('scheduleMeta.annualLeaveEntitlement', { valueAsNumber: true })} min="0" />
                {errors.scheduleMeta?.annualLeaveEntitlement && <p className="text-sm text-destructive mt-1">{errors.scheduleMeta.annualLeaveEntitlement.message}</p>}
            </div>
            <div>
                <Label htmlFor="scheduleMeta.hoursInNormalDay">Hrs/Normal Day (for leave calc)</Label>
                <Input type="number" id="scheduleMeta.hoursInNormalDay" {...register('scheduleMeta.hoursInNormalDay', { valueAsNumber: true })} min="1" max="24" step="0.1" />
                {errors.scheduleMeta?.hoursInNormalDay && <p className="text-sm text-destructive mt-1">{errors.scheduleMeta.hoursInNormalDay.message}</p>}
            </div>
            <div className="flex items-center space-x-2 pt-6">
                <Controller
                    name="scheduleMeta.wtrOptOut"
                    control={control}
                    render={({ field }) => (
                        <Checkbox id="scheduleMeta.wtrOptOut" checked={field.value} onCheckedChange={field.onChange} />
                    )}
                />
                <Label htmlFor="scheduleMeta.wtrOptOut" className="text-sm font-medium">WTR 48-hour average opt-out</Label>
            </div>
        </div>
      </CardContent>
    </Card>

    {showInfoModal && (
        <AlertDialog open={showInfoModal} onOpenChange={setShowInfoModal}>
            <AlertDialogContent className="max-w-lg">
                <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center"><Info size={20} className="mr-2 text-primary"/>App Information & Disclaimer</AlertDialogTitle>
                    <AlertDialogDescription className="text-left max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                        <p className="mb-3">This tool helps F1 doctors check schedules against NHS TCS 2016 (Version 11, Sch 3) and related guidance.</p>
                        <p className="font-semibold mb-1">Instructions:</p>
                        <ol className="list-decimal list-inside ml-4 space-y-1 text-sm">
                            <li>Set your Rota Start Date, Number of Weeks in Rota, and WTR Opt-out status in "Schedule Setup".</li>
                            <li>Input your total Annual Leave Entitlement (days) and the typical Hours in a Normal Day for leave calculation.</li>
                            <li>In "Define Shift Types", add each unique shift pattern. Provide a short, unique Duty Code (e.g., D, N, LD1), a descriptive Name, select Type (normal/on-call), and set Start/Finish times (HH:MM). Use "24:00" for shifts ending at midnight next day. Duration is auto-calculated.</li>
                            <li>In "Input Weekly Rota", select the appropriate Duty Code for each day of each week. "OFF" means no shift.</li>
                            <li>Click "Calculate & Check Compliance" to process the rota and see compliance results.</li>
                        </ol>
                        <p className="mt-3 font-semibold text-amber-500">Disclaimer:</p>
                        <p className="text-sm">This tool is for informational and illustrative purposes only. It is not a substitute for professional advice or official NHS guidance. Always consult the latest official NHS Terms and Conditions of Service (TCS), relevant Trust policies, and seek advice from BMA or medical staffing for definitive compliance and contractual matters. The accuracy of this tool depends on the correctness of your input and the implemented logic, which is based on interpretation of publicly available documents.</p>
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogAction onClick={() => setShowInfoModal(false)}>Close</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    )}

    <Card className="w-full shadow-lg mb-8">
      <CardHeader>
        <CardTitle className="text-2xl font-headline flex items-center gap-2"><ListChecks className="text-primary"/>Define Shift Types</CardTitle>
        <CardDescription>Add or remove shift patterns used in your rota.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {errors.shiftDefinitions && typeof errors.shiftDefinitions.message === 'string' && (
            <p className="text-sm text-destructive mb-2">{errors.shiftDefinitions.message}</p>
        )}
        <div className="overflow-x-auto custom-scrollbar">
            <table className="min-w-full">
                <thead className="bg-muted/50">
                    <tr>
                        {['Duty Code', 'Name', 'Type', 'Start Time', 'Finish Time', 'Duration', 'Actions'].map(header => (
                            <th key={header} className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">{header}</th>
                        ))}
                    </tr>
                </thead>
                <tbody className="divide-y divide-border">
                    {fields.map((field, index) => (
                        <tr key={field.id}>
                            <td className="px-3 py-2 whitespace-nowrap">
                                <Input {...register(`shiftDefinitions.${index}.dutyCode`)} placeholder="e.g., D1" className="w-24"/>
                                {errors.shiftDefinitions?.[index]?.dutyCode && <p className="text-xs text-destructive mt-1">{errors.shiftDefinitions[index]?.dutyCode?.message}</p>}
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap">
                                <Input {...register(`shiftDefinitions.${index}.name`)} placeholder="e.g., Day Shift" className="w-40"/>
                                {errors.shiftDefinitions?.[index]?.name && <p className="text-xs text-destructive mt-1">{errors.shiftDefinitions[index]?.name?.message}</p>}
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap">
                                <Controller
                                    name={`shiftDefinitions.${index}.type`}
                                    control={control}
                                    render={({ field: controllerField }) => (
                                        <Select onValueChange={controllerField.onChange} defaultValue={controllerField.value}>
                                            <SelectTrigger className="w-32">
                                                <SelectValue placeholder="Select type" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="normal">Normal</SelectItem>
                                                <SelectItem value="on-call">On-Call</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    )}
                                />
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap">
                                <Input type="time" {...register(`shiftDefinitions.${index}.startTime`)} className="w-28"/>
                                {errors.shiftDefinitions?.[index]?.startTime && <p className="text-xs text-destructive mt-1">{errors.shiftDefinitions[index]?.startTime?.message}</p>}
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap">
                                <Input type="text" {...register(`shiftDefinitions.${index}.finishTime`)} placeholder="HH:MM or 24:00" className="w-32"/>
                                {errors.shiftDefinitions?.[index]?.finishTime && <p className="text-xs text-destructive mt-1">{errors.shiftDefinitions[index]?.finishTime?.message}</p>}
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap text-sm">
                                {watch(`shiftDefinitions.${index}.durationStr`)}
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap">
                                {fields.length > 1 && (
                                    <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} className="text-destructive hover:bg-destructive/10">
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                )}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
        <Button type="button" variant="outline" onClick={addShiftDefinition}>
            <PlusCircle className="mr-2 h-4 w-4" /> Add Shift Type
        </Button>
      </CardContent>
    </Card>

    <Card className="w-full shadow-lg">
      <CardHeader>
        <CardTitle className="text-2xl font-headline flex items-center gap-2"><CalendarDays className="text-primary"/>Input Weekly Rota</CardTitle>
        <CardDescription>Select the defined shift for each day of your rota cycle.</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit(onSubmit)}>
        <CardContent className="space-y-6">
          {shiftDefinitionsValues.length === 0 || shiftDefinitionsValues.every(d => !d.dutyCode) ? (
                <p className="text-amber-500 flex items-center"><AlertIconLucide size={18} className="mr-2"/>Please define shift types with Duty Codes above before inputting the rota.</p>
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
                        {Array.from({ length: scheduleMetaValues.scheduleTotalWeeks || 0 }, (_, weekIndex) => (
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
                                                        <SelectItem value="">OFF</SelectItem>
                                                        {shiftDefinitionsValues.filter(d => d.dutyCode).map(def => (
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
        </CardContent>
        <CardFooter className="flex flex-col sm:flex-row justify-end gap-3 pt-6 border-t">
            <AlertDialog>
                <AlertDialogTrigger asChild>
                    <Button type="button" variant="destructive" disabled={isProcessing}>
                        <XCircle className="mr-2 h-4 w-4"/> Clear All Data
                    </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                    <AlertDialogHeader>
                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                        This will reset all schedule setup, shift definitions, and rota inputs. This action cannot be undone.
                    </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleClearAll} className="bg-destructive hover:bg-destructive/90">Yes, Clear Data</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            <Button type="submit" className="w-full sm:w-auto bg-accent hover:bg-accent/90 text-accent-foreground" disabled={isProcessing || shiftDefinitionsValues.length === 0}>
                <Send className="mr-2 h-4 w-4" /> {isProcessing ? 'Processing...' : 'Calculate & Check Compliance'}
            </Button>
        </CardFooter>
      </form>
    </Card>
    </>
  );
}
