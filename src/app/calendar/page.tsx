
"use client";

import React, { useState, useMemo, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { DayPicker, type DateRange } from 'react-day-picker';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertCircle, CalendarDays, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import type { RotaDocument } from '@/types';
import { format, isSameDay, parse, addMonths, subMonths, startOfMonth } from 'date-fns';
import CustomCalendarDay from '@/components/calendar/CustomCalendarDay';

export interface DisplayEvent {
  id: string;
  title: string;
  dutyCode: string;
  start: Date;
  end: Date;
  rotaName: string;
  site: string;
  type: 'normal' | 'on-call';
  color?: string; // Optional color for event styling
}

const eventColors = [
  'bg-sky-500',
  'bg-green-500',
  'bg-yellow-500',
  'bg-purple-500',
  'bg-pink-500',
  'bg-indigo-500',
  'bg-teal-500',
];
let colorIndex = 0;

export default function MyCalendarPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  
  const [currentMonth, setCurrentMonth] = useState<Date>(startOfMonth(new Date()));
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);

  const allEvents = useMemo(() => {
    if (!user || !user.rotas || user.rotas.length === 0) {
      return [];
    }
    colorIndex = 0; // Reset color index for each calculation
    const rotaColorMap = new Map<string, string>();

    const events: DisplayEvent[] = [];
    user.rotas.forEach((rota: RotaDocument) => {
      if (!rota.scheduleMeta || !rota.rotaGrid || !rota.shiftDefinitions) return;

      if (!rotaColorMap.has(rota.id)) {
        rotaColorMap.set(rota.id, eventColors[colorIndex % eventColors.length]);
        colorIndex++;
      }
      const rotaColor = rotaColorMap.get(rota.id);

      const scheduleStartDateObj = parse(rota.scheduleMeta.scheduleStartDate, 'yyyy-MM-dd', new Date());
      if (isNaN(scheduleStartDateObj.getTime())) return; 

      for (let w = 0; w < rota.scheduleMeta.scheduleTotalWeeks; w++) {
        for (let d = 0; d < 7; d++) { 
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
                        color: rotaColor,
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

  const eventsByDay = useMemo(() => {
    const grouped = new Map<string, DisplayEvent[]>();
    allEvents.forEach(event => {
      const dayKey = format(event.start, 'yyyy-MM-dd');
      if (!grouped.has(dayKey)) {
        grouped.set(dayKey, []);
      }
      grouped.get(dayKey)!.push(event);
    });
    return grouped;
  }, [allEvents]);

  const handleDayClick = useCallback((day: Date) => {
    setSelectedDate(day);
  }, []);
  
  const eventsOnSelectedDay = useMemo(() => {
    if (!selectedDate) return [];
    const dayKey = format(selectedDate, 'yyyy-MM-dd');
    return eventsByDay.get(dayKey) || [];
  }, [eventsByDay, selectedDate]);


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
      <Card className="shadow-lg bg-card text-card-foreground dark-calendar-theme">
        <CardHeader className="border-b border-border">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">{format(currentMonth, 'MMMM yyyy')}</h2>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" onClick={() => setCurrentMonth(startOfMonth(new Date()))}>
                Today
              </Button>
              <Button variant="outline" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <DayPicker
            key={currentMonth.toISOString()} // Force re-render on month change to ensure styles apply correctly
            mode="single"
            month={currentMonth}
            onMonthChange={setCurrentMonth}
            selected={selectedDate}
            showOutsideDays
            fixedWeeks
            className="rota-calendar"
            classNames={{
              table: 'w-full border-collapse',
              head_row: 'flex border-b border-border',
              head_cell: 'w-[calc(100%/7)] p-2 text-xs text-muted-foreground text-center font-medium',
              row: 'flex w-full border-b border-border last:border-b-0',
              cell: 'w-[calc(100%/7)] border-r border-border last:border-r-0 h-32 sm:h-36 md:h-40 flex flex-col', // Fixed height for day cells
              day: 'h-full', // Make day button fill the cell
              day_selected: 'bg-primary/20 text-primary-foreground',
              day_today: 'bg-accent/20 text-accent-foreground !font-bold',
              day_outside: 'text-muted-foreground/50 opacity-50',
            }}
            components={{
              Day: (props) => (
                <CustomCalendarDay
                  {...props}
                  events={eventsByDay.get(format(props.date, 'yyyy-MM-dd')) || []}
                  onDayClick={handleDayClick}
                  isSelected={selectedDate ? isSameDay(props.date, selectedDate) : false}
                />
              ),
            }}
          />
        </CardContent>
      </Card>

      {selectedDate && (
        <Card className="shadow-lg mt-6">
          <CardHeader>
            <CardTitle className="text-xl text-primary">
              Shifts for: {format(selectedDate, 'PPP')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {eventsOnSelectedDay.length > 0 ? (
              <ScrollArea className="h-[200px] pr-3">
                <ul className="space-y-3">
                  {eventsOnSelectedDay.map(event => (
                    <li key={event.id} className={`p-3 border-l-4 rounded-r-lg shadow-sm bg-card hover:bg-muted/50 transition-colors`} style={{borderColor: event.color?.startsWith('bg-') ? `hsl(var(--${event.color.substring(3).replace('-500','')}))` : event.color}}>
                       <div className="flex items-center gap-2">
                         <span className={`h-2.5 w-2.5 rounded-full ${event.color || 'bg-primary'}`} />
                         <p className="font-semibold text-accent">
                            {event.title} <span className="text-xs text-muted-foreground">({event.dutyCode})</span>
                         </p>
                       </div>
                      <p className="text-sm ml-5">
                        Time: {format(event.start, 'HH:mm')} - {format(event.end, 'HH:mm')}
                        {event.end < event.start && " (next day)"}
                      </p>
                      <p className="text-xs text-muted-foreground ml-5">Rota: {event.rotaName} ({event.site})</p>
                      {event.type === 'on-call' && (
                        <span className="text-xs font-medium text-amber-600 dark:text-amber-500 ml-5">(On-Call)</span>
                      )}
                    </li>
                  ))}
                </ul>
              </ScrollArea>
            ) : (
              <p className="text-muted-foreground mt-4 text-center py-6">
                No shifts scheduled for this day.
              </p>
            )}
          </CardContent>
        </Card>
      )}

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

    