
"use client";

import React, { useState, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertCircle, CalendarDays, Loader2 } from 'lucide-react';
import type { RotaDocument, ShiftDefinition } from '@/types';
import { format, isSameDay, parse } from 'date-fns';

interface DisplayEvent {
  id: string;
  title: string;
  dutyCode: string;
  start: Date;
  end: Date;
  rotaName: string;
  site: string;
  type: 'normal' | 'on-call';
}

export default function MyCalendarPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());

  const allEvents = useMemo(() => {
    if (!user || !user.rotas || user.rotas.length === 0) {
      return [];
    }

    const events: DisplayEvent[] = [];
    user.rotas.forEach((rota: RotaDocument) => {
      if (!rota.scheduleMeta || !rota.rotaGrid || !rota.shiftDefinitions) return;

      const scheduleStartDateObj = parse(rota.scheduleMeta.scheduleStartDate, 'yyyy-MM-dd', new Date());
      if (isNaN(scheduleStartDateObj.getTime())) return; // Invalid start date for this rota

      for (let w = 0; w < rota.scheduleMeta.scheduleTotalWeeks; w++) {
        for (let d = 0; d < 7; d++) { // Assuming 0 = Monday, ..., 6 = Sunday as per typical grid
          const dutyCode = rota.rotaGrid[`week_${w}_day_${d}`];
          if (dutyCode && dutyCode !== "_OFF_") {
            const shiftDef = rota.shiftDefinitions.find(sd => sd.dutyCode === dutyCode);
            if (shiftDef) {
              try {
                const currentDayBase = new Date(scheduleStartDateObj);
                currentDayBase.setDate(scheduleStartDateObj.getDate() + w * 7 + d);

                const [startHour, startMinute] = shiftDef.startTime.split(':').map(Number);
                const shiftStartDateTime = new Date(currentDayBase);
                shiftStartDateTime.setHours(startHour, startMinute, 0, 0);

                const shiftEndDateTime = new Date(currentDayBase);
                if (shiftDef.finishTime === "24:00") {
                  shiftEndDateTime.setDate(currentDayBase.getDate() + 1);
                  shiftEndDateTime.setHours(0, 0, 0, 0);
                } else {
                  const [finishHour, finishMinute] = shiftDef.finishTime.split(':').map(Number);
                  shiftEndDateTime.setHours(finishHour, finishMinute, 0, 0);
                  if (shiftEndDateTime.getTime() <= shiftStartDateTime.getTime()) {
                    shiftEndDateTime.setDate(currentDayBase.getDate() + 1);
                  }
                }
                
                // Create multiple events if rota repeats over a longer period than its cycle
                const rotaCycleDays = rota.scheduleMeta.scheduleTotalWeeks * 7;
                const overallRotaEndDate = parse(rota.scheduleMeta.endDate, 'yyyy-MM-dd', new Date());
                if (isNaN(overallRotaEndDate.getTime())) continue;

                let iterationStartDate = new Date(shiftStartDateTime);
                let iterationEndDate = new Date(shiftEndDateTime);

                while(iterationStartDate <= overallRotaEndDate) {
                    events.push({
                        id: `${rota.id}-${shiftDef.id}-${iterationStartDate.toISOString()}`,
                        title: shiftDef.name,
                        dutyCode: shiftDef.dutyCode,
                        start: new Date(iterationStartDate),
                        end: new Date(iterationEndDate),
                        rotaName: rota.name,
                        site: rota.scheduleMeta.site,
                        type: shiftDef.type,
                    });
                    iterationStartDate.setDate(iterationStartDate.getDate() + rotaCycleDays);
                    iterationEndDate.setDate(iterationEndDate.getDate() + rotaCycleDays);
                }

              } catch (e) {
                console.error("Error processing shift for calendar:", shiftDef, e);
              }
            }
          }
        }
      }
    });
    return events.sort((a,b) => a.start.getTime() - b.start.getTime());
  }, [user]);

  const daysWithShifts = useMemo(() => {
    return allEvents.map(event => event.start);
  }, [allEvents]);

  const eventsOnSelectedDay = useMemo(() => {
    if (!selectedDate) return [];
    return allEvents.filter(event => isSameDay(event.start, selectedDate));
  }, [allEvents, selectedDate]);

  if (authLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-10rem)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-lg text-muted-foreground">Loading Calendar...</p>
      </div>
    );
  }

  if (!user) {
    router.push('/login');
    return null;
  }
  
  if (!user.isProfileComplete) {
    router.push('/profile/setup');
    return null;
  }

  return (
    <div className="space-y-8">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-3xl font-headline text-primary flex items-center gap-2">
            <CalendarDays className="h-7 w-7" /> My Calendar
          </CardTitle>
          <CardDescription>
            View your upcoming shifts from all your rotas. Days with scheduled shifts are marked.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col md:flex-row gap-6 md:gap-8 items-start">
          <div className="w-full md:w-auto border rounded-md p-1 md:p-2 bg-card shadow-sm self-center md:self-start">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              className="p-0"
              modifiers={{ scheduled: daysWithShifts }}
              modifiersClassNames={{
                scheduled: 'day-scheduled',
              }}
              month={selectedDate}
              onMonthChange={setSelectedDate}
              showOutsideDays
              fixedWeeks
            />
          </div>
          <div className="flex-1 w-full">
            <h3 className="text-xl font-semibold text-primary mb-3 border-b pb-2">
              Shifts for: {selectedDate ? format(selectedDate, 'PPP') : 'No date selected'}
            </h3>
            {eventsOnSelectedDay.length > 0 ? (
              <ScrollArea className="h-[300px] md:h-[400px] pr-3">
                <ul className="space-y-3">
                  {eventsOnSelectedDay.map(event => (
                    <li key={event.id} className="p-3 border rounded-lg shadow-sm bg-card hover:bg-muted/50 transition-colors">
                      <p className="font-semibold text-accent">
                        {event.title} <span className="text-xs text-muted-foreground">({event.dutyCode})</span>
                      </p>
                      <p className="text-sm">
                        Time: {format(event.start, 'HH:mm')} - {format(event.end, 'HH:mm')}
                        {event.end < event.start && " (next day)"}
                      </p>
                      <p className="text-xs text-muted-foreground">Rota: {event.rotaName} ({event.site})</p>
                      {event.type === 'on-call' && (
                        <span className="text-xs font-medium text-amber-600 dark:text-amber-500">(On-Call)</span>
                      )}
                    </li>
                  ))}
                </ul>
              </ScrollArea>
            ) : (
              <p className="text-muted-foreground mt-4 text-center py-6">
                {selectedDate ? "No shifts scheduled for this day." : "Select a day to see scheduled shifts."}
              </p>
            )}
          </div>
        </CardContent>
      </Card>
       {!user.rotas || user.rotas.length === 0 && (
         <Card className="mt-6">
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-destructive">
                    <AlertCircle /> No Rotas Found
                </CardTitle>
            </CardHeader>
            <CardContent>
                <p>You haven't uploaded any rotas yet. Please upload a rota to see it on the calendar.</p>
            </CardContent>
         </Card>
       )}
    </div>
  );
}
