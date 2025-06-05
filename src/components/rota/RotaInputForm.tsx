"use client";

import type { SubmitHandler } from 'react-hook-form';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { CalendarDays, Clock, Coffee, PlusCircle, Trash2, Send } from 'lucide-react';
import type { RotaInput, ProcessedRotaResult, ShiftData } from '@/types';
import { processRota } from '@/app/actions';
import React from 'react';

const shiftSchema = z.object({
  id: z.string(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Start time HH:MM'),
  endTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'End time HH:MM'),
  breakMinutes: z.preprocess(
    (val) => (typeof val === 'string' ? parseInt(val, 10) : val),
    z.number().min(0, 'Break cannot be negative').max(1440, 'Break too long')
  ),
});

const rotaFormSchema = z.object({
  shifts: z.array(shiftSchema).min(1, 'Please add at least one shift.'),
});

type RotaFormValues = z.infer<typeof rotaFormSchema>;

interface RotaInputFormProps {
  onProcessRota: (result: ProcessedRotaResult | { error: string; fieldErrors?: z.ZodIssue[] }) => void;
  isProcessing: boolean;
  setIsProcessing: (isProcessing: boolean) => void;
}

export default function RotaInputForm({ onProcessRota, isProcessing, setIsProcessing }: RotaInputFormProps) {
  const { control, handleSubmit, register, formState: { errors }, reset, setError } = useForm<RotaFormValues>({
    resolver: zodResolver(rotaFormSchema),
    defaultValues: {
      shifts: [{ id: crypto.randomUUID(), date: '', startTime: '', endTime: '', breakMinutes: 0 }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'shifts',
  });

  const onSubmit: SubmitHandler<RotaFormValues> = async (data) => {
    setIsProcessing(true);
    const result = await processRota(data as RotaInput); // Type assertion
    onProcessRota(result);
    setIsProcessing(false);
    if ('error' in result && result.fieldErrors) {
      result.fieldErrors.forEach(fieldError => {
        const path = fieldError.path.join('.') as keyof RotaFormValues; // Adjust type as necessary
        setError(path as any, { type: 'server', message: fieldError.message });
      });
    }
  };

  const addShift = () => {
    append({ id: crypto.randomUUID(), date: '', startTime: '', endTime: '', breakMinutes: 0 });
  };

  return (
    <Card className="w-full shadow-lg">
      <CardHeader>
        <CardTitle className="text-2xl font-headline flex items-center gap-2"><CalendarDays className="text-primary"/>Enter Your Rota</CardTitle>
        <CardDescription>Add your shifts below to calculate hours, check compliance, and estimate salary.</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit(onSubmit)}>
        <CardContent className="space-y-6">
          {fields.map((field, index) => (
            <div key={field.id} className="p-4 border rounded-lg shadow-sm bg-background space-y-4 relative">
              <h3 className="font-medium text-lg text-primary">Shift {index + 1}</h3>
              {fields.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute top-2 right-2 text-destructive hover:bg-destructive/10"
                  onClick={() => remove(index)}
                  aria-label="Remove shift"
                >
                  <Trash2 className="h-5 w-5" />
                </Button>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label htmlFor={`shifts.${index}.date`} className="flex items-center gap-1"><CalendarDays className="h-4 w-4 text-muted-foreground"/>Date</Label>
                  <Input id={`shifts.${index}.date`} type="date" {...register(`shifts.${index}.date`)} />
                  {errors.shifts?.[index]?.date && <p className="text-sm text-destructive">{errors.shifts[index]?.date?.message}</p>}
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`shifts.${index}.breakMinutes`} className="flex items-center gap-1"><Coffee className="h-4 w-4 text-muted-foreground"/>Break (minutes)</Label>
                  <Input id={`shifts.${index}.breakMinutes`} type="number" placeholder="e.g., 30" {...register(`shifts.${index}.breakMinutes`, { valueAsNumber: true })} defaultValue={0} />
                  {errors.shifts?.[index]?.breakMinutes && <p className="text-sm text-destructive">{errors.shifts[index]?.breakMinutes?.message}</p>}
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label htmlFor={`shifts.${index}.startTime`} className="flex items-center gap-1"><Clock className="h-4 w-4 text-muted-foreground"/>Start Time</Label>
                  <Input id={`shifts.${index}.startTime`} type="time" {...register(`shifts.${index}.startTime`)} />
                  {errors.shifts?.[index]?.startTime && <p className="text-sm text-destructive">{errors.shifts[index]?.startTime?.message}</p>}
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`shifts.${index}.endTime`} className="flex items-center gap-1"><Clock className="h-4 w-4 text-muted-foreground"/>End Time</Label>
                  <Input id={`shifts.${index}.endTime`} type="time" {...register(`shifts.${index}.endTime`)} />
                  {errors.shifts?.[index]?.endTime && <p className="text-sm text-destructive">{errors.shifts[index]?.endTime?.message}</p>}
                </div>
              </div>
               {index < fields.length -1 && <Separator className="my-4"/>}
            </div>
          ))}
          {errors.shifts && typeof errors.shifts.message === 'string' && (
            <p className="text-sm text-destructive">{errors.shifts.message}</p>
          )}
          <Button type="button" variant="outline" onClick={addShift} className="w-full sm:w-auto">
            <PlusCircle className="mr-2 h-4 w-4" /> Add Another Shift
          </Button>
        </CardContent>
        <CardFooter className="flex flex-col sm:flex-row justify-end gap-2 pt-6">
           <Button type="button" variant="ghost" onClick={() => reset({ shifts: [{ id: crypto.randomUUID(), date: '', startTime: '', endTime: '', breakMinutes: 0 }] })} disabled={isProcessing}>
            Clear All
          </Button>
          <Button type="submit" className="w-full sm:w-auto bg-accent hover:bg-accent/90 text-accent-foreground" disabled={isProcessing}>
            <Send className="mr-2 h-4 w-4" /> {isProcessing ? 'Processing...' : 'Calculate & Check Compliance'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
