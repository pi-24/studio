
"use client";

import React, { useEffect } from 'react';
import { useForm, useFieldArray, Controller, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { UserCircle, Mail, LogOut, Briefcase, MapPin, Percent, Landmark, ShieldCheck, Settings2, Trash2, PlusCircle, Save, CalendarDays, Edit } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { UserProfileData, UserGrade, UKRegion, ShiftDefinition as ShiftDefinitionType, ScheduleMetadata as ScheduleMetadataType, RotaGridInput } from '@/types';
import { useToast } from "@/hooks/use-toast";

const userGradeOptions: UserGrade[] = ['F1', 'F2', 'CT1', 'CT2', 'CT3+', 'ST1', 'ST2', 'ST3+', 'SpecialtyDoctor', 'Consultant', 'Other'];
const ukRegionOptions: UKRegion[] = ['London', 'SouthEast', 'SouthWest', 'EastOfEngland', 'Midlands', 'NorthEastAndYorkshire', 'NorthWest', 'Scotland', 'Wales', 'NorthernIreland', 'Other'];

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

const rotaGridSchema = z.record(z.string());

const profileEditSchema = z.object({
  grade: z.enum(userGradeOptions).optional().or(z.literal('')),
  region: z.enum(ukRegionOptions).optional().or(z.literal('')),
  taxCode: z.string().optional(),
  hasStudentLoan: z.boolean().optional(),
  hasPostgraduateLoan: z.boolean().optional(),
  nhsPensionOptIn: z.boolean().optional(),
  scheduleMeta: scheduleMetadataSchema.optional(),
  shiftDefinitions: z.array(shiftDefinitionSchema).min(1, 'At least one shift definition is required')
    .refine(items => new Set(items.map(item => item.dutyCode)).size === items.length, {
      message: 'Duty Codes must be unique',
      path: ['shiftDefinitions']
    }).optional(),
  rotaGrid: rotaGridSchema.optional(),
});

type ProfileEditFormValues = z.infer<typeof profileEditSchema>;

const calculateShiftDurationString = (startTimeStr: string, finishTimeStr: string): string => {
    if (!startTimeStr || !finishTimeStr) return "0h 0m";
    let [startH, startM] = startTimeStr.split(':').map(Number);
    let [finishH, finishM] = finishTimeStr.split(':').map(Number);
    if (isNaN(startH) || isNaN(startM) || isNaN(finishH) || isNaN(finishM)) return "Invalid";
    if (finishTimeStr === "24:00") { finishH = 24; finishM = 0; }
    let startTotalMinutes = startH * 60 + startM;
    let finishTotalMinutes = finishH * 60 + finishM;
    if (finishTotalMinutes < startTotalMinutes) { finishTotalMinutes += 24 * 60; }
     else if (finishTotalMinutes === startTotalMinutes && startTimeStr !== finishTimeStr) {
         if (startTimeStr !== "00:00" || finishTimeStr !== "00:00") { finishTotalMinutes += 24 * 60; }
    }
    let durationMinutes = finishTotalMinutes - startTotalMinutes;
    if (durationMinutes < 0) durationMinutes = 0;
    const durationH = Math.floor(durationMinutes / 60);
    const durationM = durationMinutes % 60;
    return `${durationH}h ${durationM}m`;
};

const daysOfWeekGrid = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const defaultScheduleMetaValues: ScheduleMetadataType = {
   wtrOptOut: false, scheduleTotalWeeks: 4, scheduleStartDate: new Date().toISOString().split('T')[0], annualLeaveEntitlement: 27, hoursInNormalDay: 8
};
const defaultShiftDefinitionsValues: ShiftDefinitionType[] = [
  { id: crypto.randomUUID(), dutyCode: 'S1', name: 'Standard Day', type: 'normal', startTime: '09:00', finishTime: '17:00', durationStr: '8h 0m' }
];

export default function ProfilePage() {
  const { user, logout, updateUserProfile, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const { control, handleSubmit, register, formState: { errors, isSubmitting, isDirty }, reset, watch, setValue } = useForm<ProfileEditFormValues>({
    resolver: zodResolver(profileEditSchema),
    defaultValues: {
      grade: undefined, // Use undefined so RHF treats it as initially unset
      region: undefined, // Use undefined
      taxCode: '',
      hasStudentLoan: false,
      hasPostgraduateLoan: false,
      nhsPensionOptIn: true,
      scheduleMeta: defaultScheduleMetaValues,
      shiftDefinitions: defaultShiftDefinitionsValues,
      rotaGrid: {},
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'shiftDefinitions',
  });

  const watchedShiftDefinitions = watch('shiftDefinitions');


  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    } else if (user) {
      reset({
        grade: user.grade || '', // Use '' if undefined/null from user
        region: user.region || '', // Use '' if undefined/null from user
        taxCode: user.taxCode || '',
        hasStudentLoan: user.hasStudentLoan || false,
        hasPostgraduateLoan: user.hasPostgraduateLoan || false,
        nhsPensionOptIn: user.nhsPensionOptIn === undefined ? true : user.nhsPensionOptIn,
        scheduleMeta: user.scheduleMeta || defaultScheduleMetaValues,
        shiftDefinitions: user.shiftDefinitions && user.shiftDefinitions.length > 0 ? user.shiftDefinitions : defaultShiftDefinitionsValues,
        rotaGrid: user.rotaGrid || {},
      });
    }
  }, [user, authLoading, router, reset]);
  
  useEffect(() => {
    if (watchedShiftDefinitions) {
        watchedShiftDefinitions.forEach((def, index) => {
          if(def) {
            const newDuration = calculateShiftDurationString(def.startTime, def.finishTime);
            if (def.durationStr !== newDuration) {
              setValue(`shiftDefinitions.${index}.durationStr`, newDuration, { shouldValidate: false, shouldDirty: true });
            }
          }
        });
    }
  }, [watchedShiftDefinitions, setValue]);


  const onSubmit: SubmitHandler<ProfileEditFormValues> = (data) => {
    if (user) {
      const profileUpdateData: Partial<UserProfileData> = {
        ...data, 
        grade: data.grade === '' ? undefined : data.grade, // Convert '' back to undefined for storage if desired
        region: data.region === '' ? undefined : data.region,
        isProfileComplete: true, 
      };
      updateUserProfile(profileUpdateData);
      toast({ title: "Profile Updated", description: "Your changes have been saved." });
      reset(data); 
    }
  };

  const addShiftDefinition = () => {
    append({ id: crypto.randomUUID(), dutyCode: `S${fields.length + 1}`, name: '', type: 'normal', startTime: '09:00', finishTime: '17:00', durationStr: '8h 0m' });
  };

  if (authLoading || !user) {
    return (
      <div className="flex justify-center py-12">
        <Card className="w-full max-w-2xl shadow-xl">
          <CardHeader className="items-center text-center">
            <Skeleton className="h-24 w-24 rounded-full" />
            <Skeleton className="h-8 w-48 mt-4" />
            <Skeleton className="h-4 w-64 mt-2" />
          </CardHeader>
          <CardContent className="space-y-6"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></CardContent>
        </Card>
      </div>
    );
  }

  const userInitial = user.email ? user.email.charAt(0).toUpperCase() : '?';
  const shiftDefMap = user.shiftDefinitions?.reduce((acc, def) => {
    if (def && def.dutyCode) {
      acc[def.dutyCode] = def.name;
    }
    return acc;
  }, {} as Record<string, string>) || {};


  return (
    <div className="flex justify-center py-8">
      <Card className="w-full max-w-2xl shadow-xl">
        <CardHeader className="items-center text-center">
          <Avatar className="w-24 h-24 text-3xl mb-4">
            <AvatarImage src={`https://placehold.co/100x100.png?text=${userInitial}`} alt={user.email || 'User'} data-ai-hint="abstract letter" />
            <AvatarFallback>{userInitial}</AvatarFallback>
          </Avatar>
          <CardTitle className="text-3xl font-headline flex items-center gap-2"><UserCircle className="text-primary h-8 w-8"/>User Profile</CardTitle>
          <CardDescription>Manage your RotaCalc account details and preferences.</CardDescription>
        </CardHeader>
        
        <form onSubmit={handleSubmit(onSubmit)}>
          <CardContent className="space-y-8 pt-6">
            {/* Email (Read-only) */}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-muted-foreground flex items-center gap-2"><Mail className="h-4 w-4"/>Email</Label>
              <p id="email" className="text-lg p-3 border rounded-md bg-muted/30">{user.email}</p>
            </div>

            {/* Professional Details */}
            <section className="space-y-4 border-t pt-6">
              <h3 className="text-xl font-semibold text-primary flex items-center gap-2"><Briefcase />Professional Details</h3>
              <div>
                <Label htmlFor="grade">Grade</Label>
                <Controller name="grade" control={control} render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger id="grade"><SelectValue placeholder="Select grade" /></SelectTrigger>
                      <SelectContent>{userGradeOptions.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                    </Select> )}
                />
                {errors.grade && <p className="text-sm text-destructive mt-1">{errors.grade.message}</p>}
              </div>
              <div>
                <Label htmlFor="region">Region of Work (UK)</Label>
                <Controller name="region" control={control} render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger id="region"><SelectValue placeholder="Select region" /></SelectTrigger>
                      <SelectContent>{ukRegionOptions.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                    </Select> )}
                />
                 {errors.region && <p className="text-sm text-destructive mt-1">{errors.region.message}</p>}
              </div>
            </section>

            {/* Financial Details */}
            <section className="space-y-4 border-t pt-6">
              <h3 className="text-xl font-semibold text-primary flex items-center gap-2"><Landmark />Financial Details</h3>
              <div>
                <Label htmlFor="taxCode">Tax Code (Optional)</Label>
                <Input id="taxCode" {...register('taxCode')} placeholder="e.g., 1257L" />
                {errors.taxCode && <p className="text-sm text-destructive mt-1">{errors.taxCode.message}</p>}
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Controller name="hasStudentLoan" control={control} render={({ field }) => (<Checkbox id="hasStudentLoan" checked={field.value} onCheckedChange={field.onChange} />)} />
                  <Label htmlFor="hasStudentLoan">Paying Student Loan?</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Controller name="hasPostgraduateLoan" control={control} render={({ field }) => (<Checkbox id="hasPostgraduateLoan" checked={field.value} onCheckedChange={field.onChange} />)} />
                  <Label htmlFor="hasPostgraduateLoan">Paying Postgraduate Loan?</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Controller name="nhsPensionOptIn" control={control} render={({ field }) => (<Checkbox id="nhsPensionOptIn" checked={field.value} onCheckedChange={field.onChange} />)} />
                  <Label htmlFor="nhsPensionOptIn">Opted-in to NHS Pension?</Label>
                </div>
              </div>
            </section>

            {/* Schedule Configuration */}
            <section className="space-y-4 border-t pt-6">
                <h3 className="text-xl font-semibold text-primary flex items-center gap-2"><Settings2 />Rota Configuration</h3>
                <div>
                  <Label htmlFor="scheduleMeta.scheduleStartDate">Rota Start Date</Label>
                  <Input type="date" id="scheduleMeta.scheduleStartDate" {...register('scheduleMeta.scheduleStartDate')} />
                  {errors.scheduleMeta?.scheduleStartDate && <p className="text-sm text-destructive mt-1">{errors.scheduleMeta.scheduleStartDate.message}</p>}
                </div>
                <div>
                  <Label htmlFor="scheduleMeta.scheduleTotalWeeks">Number of Weeks in Rota Cycle</Label>
                  <Input type="number" id="scheduleMeta.scheduleTotalWeeks" {...register('scheduleMeta.scheduleTotalWeeks', { valueAsNumber: true })} min="1" max="52"/>
                  {errors.scheduleMeta?.scheduleTotalWeeks && <p className="text-sm text-destructive mt-1">{errors.scheduleMeta.scheduleTotalWeeks.message}</p>}
                </div>
                <div>
                  <Label htmlFor="scheduleMeta.annualLeaveEntitlement">Annual Leave (days/year)</Label>
                  <Input type="number" id="scheduleMeta.annualLeaveEntitlement" {...register('scheduleMeta.annualLeaveEntitlement', { valueAsNumber: true })} min="0"/>
                  {errors.scheduleMeta?.annualLeaveEntitlement && <p className="text-sm text-destructive mt-1">{errors.scheduleMeta.annualLeaveEntitlement.message}</p>}
                </div>
                <div>
                  <Label htmlFor="scheduleMeta.hoursInNormalDay">Hours/Normal Day (for leave calc)</Label>
                  <Input type="number" id="scheduleMeta.hoursInNormalDay" {...register('scheduleMeta.hoursInNormalDay', { valueAsNumber: true })} min="1" max="24" step="0.1"/>
                  {errors.scheduleMeta?.hoursInNormalDay && <p className="text-sm text-destructive mt-1">{errors.scheduleMeta.hoursInNormalDay.message}</p>}
                </div>
                <div className="flex items-center space-x-2 pt-2">
                  <Controller name="scheduleMeta.wtrOptOut" control={control} render={({ field }) => (<Checkbox id="scheduleMeta.wtrOptOut" checked={!!field.value} onCheckedChange={field.onChange} />)} />
                  <Label htmlFor="scheduleMeta.wtrOptOut">WTR 48-hour average opt-out agreed?</Label>
                </div>
            </section>

            {/* Shift Definitions */}
            <section className="space-y-4 border-t pt-6">
              <h3 className="text-xl font-semibold text-primary flex items-center gap-2"><Briefcase />Shift Definitions</h3>
               {errors.shiftDefinitions && typeof errors.shiftDefinitions.message === 'string' && (
                  <p className="text-sm text-destructive mb-2">{errors.shiftDefinitions.message}</p>
              )}
              <div className="overflow-x-auto custom-scrollbar">
                <table className="min-w-full">
                  <thead className="bg-muted/50">
                    <tr>{['Duty Code', 'Name', 'Type', 'Start Time', 'Finish Time', 'Duration', 'Actions'].map(h=><th key={h} className="px-3 py-2 text-left text-xs font-medium">{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {fields.map((item, index) => (
                      <tr key={item.id}>
                        <td><Input {...register(`shiftDefinitions.${index}.dutyCode`)} placeholder="S1" className="w-20"/></td>
                        <td><Input {...register(`shiftDefinitions.${index}.name`)} placeholder="Day Shift" className="w-36"/></td>
                        <td>
                          <Controller name={`shiftDefinitions.${index}.type`} control={control} render={({ field: cf }) => (
                            <Select onValueChange={cf.onChange} value={cf.value}>
                              <SelectTrigger className="w-28"><SelectValue/></SelectTrigger>
                              <SelectContent><SelectItem value="normal">Normal</SelectItem><SelectItem value="on-call">On-Call</SelectItem></SelectContent>
                            </Select> )}
                          />
                        </td>
                        <td><Input type="time" {...register(`shiftDefinitions.${index}.startTime`)} className="w-28"/></td>
                        <td><Input type="text" {...register(`shiftDefinitions.${index}.finishTime`)} placeholder="HH:MM or 24:00" className="w-32"/></td>
                        <td className="text-sm pl-2">{watch(`shiftDefinitions.${index}.durationStr`)}</td>
                        <td>{fields.length > 1 && <Button type="button" variant="ghost" size="icon" onClick={()=>remove(index)}><Trash2 className="h-4 w-4 text-destructive"/></Button>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {errors.shiftDefinitions && errors.shiftDefinitions.root && <p className="text-sm text-destructive mt-1">{errors.shiftDefinitions.root.message}</p>}
              {Array.isArray(errors.shiftDefinitions) && errors.shiftDefinitions.map((err, i) => (
                err && typeof err === 'object' && Object.values(err).map((fieldError: any) => fieldError && typeof fieldError === 'object' && fieldError.message && <p key={`${i}-${fieldError.message}`} className="text-sm text-destructive mt-1">{fieldError.message}</p>)
              ))}
              <Button type="button" variant="outline" onClick={addShiftDefinition}><PlusCircle className="mr-2 h-4 w-4" /> Add Shift Type</Button>
            </section>

             {/* Current Rota Schedule Display */}
            <section className="space-y-4 border-t pt-6">
                <div className="flex justify-between items-center">
                    <h3 className="text-xl font-semibold text-primary flex items-center gap-2"><CalendarDays />Current Rota Schedule</h3>
                    <Button variant="outline" size="sm" asChild>
                        <Link href="/rota-checker">
                            <Edit className="mr-2 h-4 w-4" /> Edit Rota
                        </Link>
                    </Button>
                </div>
                {(!user.rotaGrid || Object.keys(user.rotaGrid).length === 0) ? (
                    <p className="text-muted-foreground">No rota schedule entered yet. You can input your rota in the Rota Compliance Checker tool.</p>
                ) : (
                    <div className="overflow-x-auto custom-scrollbar border rounded-lg p-2 bg-muted/20">
                        <table className="min-w-full text-xs">
                            <thead className="bg-muted/50">
                                <tr>
                                    <th className="px-1.5 py-1 text-left font-medium">Week</th>
                                    {daysOfWeekGrid.map(day => <th key={day} className="px-1.5 py-1 text-center font-medium">{day}</th>)}
                                </tr>
                            </thead>
                            <tbody>
                                {Array.from({ length: user.scheduleMeta?.scheduleTotalWeeks || 0 }, (_, weekIndex) => (
                                    <tr key={weekIndex} className="border-b border-border last:border-b-0">
                                        <td className="px-1.5 py-1 font-medium">W{weekIndex + 1}</td>
                                        {daysOfWeekGrid.map((_, dayIndex) => {
                                            const dutyCode = user.rotaGrid?.[`week_${weekIndex}_day_${dayIndex}`];
                                            const shiftName = dutyCode ? (shiftDefMap[dutyCode] || dutyCode) : 'OFF';
                                            return (
                                                <td key={dayIndex} className="px-1.5 py-1 text-center whitespace-nowrap" title={shiftName !== dutyCode && dutyCode ? shiftName : undefined}>
                                                    {dutyCode ? dutyCode : <span className="text-muted-foreground/70">OFF</span>}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>


          </CardContent>
          <CardFooter className="flex flex-col sm:flex-row justify-between items-center pt-6 border-t mt-8">
            <Button onClick={logout} variant="destructive" className="w-full sm:w-auto mb-4 sm:mb-0">
              <LogOut className="mr-2 h-4 w-4" /> Logout
            </Button>
            <Button type="submit" disabled={isSubmitting || !isDirty} className="w-full sm:w-auto bg-accent hover:bg-accent/90 text-accent-foreground">
              <Save className="mr-2 h-4 w-4" /> {isSubmitting ? 'Saving...' : 'Save Changes'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
