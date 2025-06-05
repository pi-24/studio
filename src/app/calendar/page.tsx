
"use client";

import React, { useState, useMemo, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { DayPicker } from 'react-day-picker';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertCircle, CalendarDays, ChevronLeft, ChevronRight, Loader2, Download } from 'lucide-react';
import type { RotaDocument } from '@/types';
import { parse, format, isSameDay, addMonths, subMonths, startOfMonth } from 'date-fns';
import { enGB } from 'date-fns/locale'; // Import en-GB locale
import CustomCalendarDay from '@/components/calendar/CustomCalendarDay';
import Link from 'next/link';

export interface DisplayEvent {
  id: string;
  title: string;
  dutyCode: string;
  start: Date;
  end: Date;
  rotaName: string;
  site: string;
  type: 'normal' | 'on-call';
  color?: string;
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

// Helper to get pattern day index (Mon=0, ..., Sun=6)
const getPatternDayIndex = (date: Date): number => {
  const day = date.getDay(); // Sunday is 0, Monday is 1, etc.
  return day === 0 ? 6 : day - 1; // Adjust to Mon=0, ..., Sun=6
};

// Helper to format date to ICS UTC format YYYYMMDDTHHMMSSZ
const formatDateToICS = (date: Date): string => {
  const pad = (num: number) => (num < 10 ? '0' : '') + num;
  return (
    date.getUTCFullYear() +
    pad(date.getUTCMonth() + 1) +
    pad(date.getUTCDate()) +
    'T' +
    pad(date.getUTCHours()) +
    pad(date.getUTCMinutes()) +
    pad(date.getUTCSeconds()) +
    'Z'
  );
};

// Generates .ics file content
const generateICSFileContent = (events: DisplayEvent[]): string => {
  let icsString = '';
  icsString += 'BEGIN:VCALENDAR\r\n';
  icsString += 'VERSION:2.0\r\n';
  icsString += 'PRODID:-//RotaCalc//YourApp//EN\r\n';
  icsString += 'CALSCALE:GREGORIAN\r\n';

  events.forEach(event => {
    const descriptionParts = [
      `Rota: ${event.rotaName}`,
      `Site: ${event.site}`,
      `Duty Code: ${event.dutyCode}`,
    ];
    if (event.type === 'on-call') {
      descriptionParts.push('(On-Call)');
    }
    const description = descriptionParts.join('\\n'); // \n for newlines in ICS description

    icsString += 'BEGIN:VEVENT\r\n';
    icsString += `UID:${event.id}@rotacalc.app\r\n`; // Make UID more robust
    icsString += `DTSTAMP:${formatDateToICS(new Date())}\r\n`;
    icsString += `DTSTART:${formatDateToICS(event.start)}\r\n`;
    icsString += `DTEND:${formatDateToICS(event.end)}\r\n`;
    icsString += `SUMMARY:${event.title}\r\n`;
    icsString += `DESCRIPTION:${description}\r\n`;
    icsString += `LOCATION:${event.site}\r\n`;
    icsString += 'END:VEVENT\r\n';
  });

  icsString += 'END:VCALENDAR\r\n';
  return icsString;
};


export default function MyCalendarPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  
  const [currentMonth, setCurrentMonth] = useState<Date>(startOfMonth(new Date()));
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);

  const allEvents = useMemo(() => {
    if (!user || !user.rotas || user.rotas.length === 0) {
      return [];
    }
    colorIndex = 0; 
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

      const overallRotaEndDate = parse(rota.scheduleMeta.endDate, 'yyyy-MM-dd', new Date());
      if (isNaN(overallRotaEndDate.getTime())) return;

      const rotaPatternTotalWeeks = rota.scheduleMeta.scheduleTotalWeeks;
      
      const firstDayOfWorkPatternIndex = getPatternDayIndex(scheduleStartDateObj);

      let currentCalendarDate = new Date(scheduleStartDateObj);

      while (currentCalendarDate <= overallRotaEndDate) {
        const timeDiff = currentCalendarDate.getTime() - scheduleStartDateObj.getTime();
        const daysOffsetFromActualRotaStart = Math.round(timeDiff / (1000 * 60 * 60 * 24));
        const effectiveDayInPatternSequence = firstDayOfWorkPatternIndex + daysOffsetFromActualRotaStart;
        
        const patternWeekIndex = Math.floor(effectiveDayInPatternSequence / 7) % rotaPatternTotalWeeks;
        const patternDayOfWeekIndex = effectiveDayInPatternSequence % 7; 

        const dutyCodeKey = `week_${patternWeekIndex}_day_${patternDayOfWeekIndex}`;
        const dutyCode = rota.rotaGrid[dutyCodeKey];

        if (dutyCode && dutyCode !== "_OFF_") {
          const shiftDef = rota.shiftDefinitions.find(sd => sd.dutyCode === dutyCode);
          if (shiftDef) {
            try {
              const [startHour, startMinute] = shiftDef.startTime.split(':').map(Number);
              const shiftStartDateTime = new Date(currentCalendarDate); 
              shiftStartDateTime.setHours(startHour, startMinute, 0, 0);

              const shiftEndDateTime = new Date(currentCalendarDate); 
              if (shiftDef.finishTime === "24:00") {
                shiftEndDateTime.setDate(currentCalendarDate.getDate() + 1);
                shiftEndDateTime.setHours(0, 0, 0, 0);
              } else {
                const [finishHour, finishMinute] = shiftDef.finishTime.split(':').map(Number);
                shiftEndDateTime.setHours(finishHour, finishMinute, 0, 0);
                if (shiftEndDateTime.getTime() <= shiftStartDateTime.getTime()) {
                  shiftEndDateTime.setDate(currentCalendarDate.getDate() + 1);
                }
              }
              
              if (shiftStartDateTime <= overallRotaEndDate && shiftStartDateTime >= scheduleStartDateObj) {
                   events.push({
                      id: `${rota.id}-${shiftDef.id}-${shiftStartDateTime.toISOString()}`, 
                      title: shiftDef.name,
                      dutyCode: shiftDef.dutyCode,
                      start: new Date(shiftStartDateTime),
                      end: new Date(shiftEndDateTime),
                      rotaName: rota.name,
                      site: rota.scheduleMeta.site,
                      type: shiftDef.type,
                      color: rotaColor,
                  });
              }
            } catch (e) {
              console.error("Error processing shift for calendar:", shiftDef, e);
            }
          }
        }
        const newDate = new Date(currentCalendarDate);
        newDate.setDate(currentCalendarDate.getDate() + 1);
        currentCalendarDate = newDate;
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

  const handleExportToICS = () => {
    if (allEvents.length === 0) {
      alert("No events to export.");
      return;
    }
    const icsContent = generateICSFileContent(allEvents);
    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "rotacalc_shifts.ics");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

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
      <Card className="shadow-lg bg-card text-card-foreground">
        <CardHeader className="border-b border-border">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
            <h2 className="text-xl font-semibold">{format(currentMonth, 'MMMM yyyy', { locale: enGB })}</h2>
            <div className="flex items-center gap-1 sm:gap-2">
              <Button variant="outline" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" onClick={() => setCurrentMonth(startOfMonth(new Date()))}>
                Today
              </Button>
              <Button variant="outline" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button variant="outline" onClick={handleExportToICS} disabled={allEvents.length === 0}>
                <Download className="mr-2 h-4 w-4" /> Export
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <DayPicker
            key={currentMonth.toISOString()}
            locale={enGB} // Set locale to en-GB for Monday start
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
              cell: 'w-[calc(100%/7)] border-r border-border last:border-r-0 h-32 sm:h-36 md:h-40 flex flex-col',
              day: 'h-full',
              day_selected: 'bg-primary/20 text-primary-foreground', // This is overridden by CustomCalendarDay
              day_today: 'bg-accent/20 text-accent-foreground !font-bold', // This is overridden by CustomCalendarDay
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
              Caption: () => null, // Hide default caption (month/year and nav arrows)
            }}
          />
        </CardContent>
      </Card>

      {selectedDate && (
        <Card className="shadow-lg mt-6">
          <CardHeader>
            <CardTitle className="text-xl text-primary">
              Shifts for: {format(selectedDate, 'PPP', { locale: enGB })}
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
                        {!isSameDay(event.start, event.end) && " (next day)"}
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

      {(!user.rotas || user.rotas.length === 0) && (
         <Card className="mt-6">
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-destructive">
                    <AlertCircle /> No Rotas Found
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <p>You haven't uploaded any rotas yet. Please upload a rota to see it on the calendar.</p>
                <Button asChild className="mt-2">
                    <Link href="/upload-rota">Upload New Rota</Link>
                </Button>
            </CardContent>
         </Card>
       )}
    </div>
  );
}
