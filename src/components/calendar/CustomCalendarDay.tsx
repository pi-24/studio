
import React from 'react';
import { format, isSameDay, isToday } from 'date-fns';
import { cn } from '@/lib/utils';
import type { DayProps } from 'react-day-picker';
import type { DisplayEvent } from '@/app/calendar/page'; 

interface CustomCalendarDayProps extends DayProps {
  events: DisplayEvent[];
  onDayClick: (date: Date) => void;
  isSelected: boolean;
}

const CustomCalendarDay: React.FC<CustomCalendarDayProps> = ({
  date,
  displayMonth,
  events,
  onDayClick,
  isSelected,
}) => {
  const isCurrentMonth = date.getMonth() === displayMonth.getMonth();
  const MAX_EVENTS_VISIBLE = 2;

  const dayEvents = events.filter(event => isSameDay(event.start, date));
  const visibleEvents = dayEvents.slice(0, MAX_EVENTS_VISIBLE);
  const hiddenEventsCount = Math.max(0, dayEvents.length - MAX_EVENTS_VISIBLE);

  // For dynamic height calculation:
  // Approximate usable content height within a cell (e.g., h-36 is 144px total, minus day number area and padding).
  const CELL_CONTENT_HEIGHT_FOR_24_HOURS_PX = 120; 
  const PX_PER_HOUR = CELL_CONTENT_HEIGHT_FOR_24_HOURS_PX / 24; // Approx 5px per hour
  // Minimum height for an event lozenge, enough for two lines of text-xxs (0.5rem font + 0.65rem line height => ~10.4px per line * 2 lines + padding)
  const MIN_EVENT_HEIGHT_PX = Math.ceil(0.65 * 16 * 2 + 4); // approx 25px (16 is typical base font size)


  const handleCellClick = () => {
    onDayClick(date);
  };
  
  return (
    <div
      onClick={handleCellClick}
      className={cn(
        "rota-calendar-day flex flex-col h-full p-1.5 overflow-hidden cursor-pointer relative",
        !isCurrentMonth && "text-muted-foreground/30 dark:text-muted-foreground/20 bg-muted/10 dark:bg-muted/5",
        isCurrentMonth && "hover:bg-primary/10 dark:hover:bg-primary/15",
        isSelected && isCurrentMonth && "bg-primary/20 dark:bg-primary/25 ring-1 ring-primary",
        isToday(date) && "relative"
      )}
    >
      <div className={cn(
        "flex justify-end text-xs font-medium mb-1",
         isToday(date) && !isSelected && "text-accent dark:text-accent-foreground font-bold",
         isSelected && isToday(date) && "text-primary-foreground font-bold", // Assuming primary has contrasting foreground for selection
         isSelected && !isToday(date) && (isCurrentMonth ? "text-primary-foreground" : "text-primary/70 dark:text-primary/60"), // Use primary-foreground if selected in current month
         !isSelected && !isToday(date) && (isCurrentMonth ? "text-card-foreground dark:text-card-foreground" : "text-muted-foreground/50 dark:text-muted-foreground/40")
      )}>
        {isToday(date) && (
          <span className={cn(
            "absolute top-1 right-1.5 flex h-5 w-5 items-center justify-center rounded-full text-xs",
             isSelected && isCurrentMonth ? "bg-primary-foreground text-primary" : "bg-accent text-accent-foreground"
          )}>
            {format(date, 'd')}
          </span>
        )}
        {!isToday(date) && format(date, 'd')}
      </div>

      {isCurrentMonth && (
        <div className="space-y-0.5 flex-grow overflow-y-auto custom-scrollbar-small">
          {visibleEvents.map((event) => {
            const durationHours = (event.end.getTime() - event.start.getTime()) / (1000 * 60 * 60);
            
            let eventHeightStyle = {};
            const calculatedHeight = Math.max(MIN_EVENT_HEIGHT_PX, durationHours * PX_PER_HOUR);
            eventHeightStyle = { height: `${calculatedHeight}px` };

            return (
              <div
                key={event.id}
                className={cn(
                  "text-xxs p-0.5 rounded-sm text-white dark:text-opacity-90 overflow-hidden flex flex-col",
                  event.color || 'bg-primary'
                )}
                style={eventHeightStyle}
                title={`${event.title}\n${format(event.start, 'HH:mm')} - ${format(event.end, 'HH:mm')}${!isSameDay(event.start, event.end) ? " (next day)" : ""}`}
              >
                <div className="font-medium truncate">{event.title}</div>
                <div className="text-white/70 dark:text-white/60">
                  {format(event.start, 'HH:mm')} - {format(event.end, 'HH:mm')}
                  {!isSameDay(event.start, event.end) && " (next day)"}
                </div>
              </div>
            );
          })}
          {hiddenEventsCount > 0 && (
            <div className="text-xxs text-muted-foreground dark:text-muted-foreground/70 mt-1">
              {hiddenEventsCount} more...
            </div>
          )}
        </div>
      )}
       {!isCurrentMonth && dayEvents.length > 0 && (
         <div className="text-xxs text-muted-foreground/50 dark:text-muted-foreground/40 mt-1">
            {dayEvents.length} event{dayEvents.length > 1 ? 's' : ''}
          </div>
       )}
    </div>
  );
};

export default CustomCalendarDay;
