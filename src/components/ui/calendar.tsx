
"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker, DropdownProps } from "react-day-picker"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select"
import { ScrollArea } from "./scroll-area"

export type CalendarProps = React.ComponentProps<typeof DayPicker>

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  captionLayout = "dropdown-buttons", // Default to dropdown for year/month
  fromYear = new Date().getFullYear() - 100, // Default fromYear
  toYear = new Date().getFullYear() + 10,   // Default toYear
  ...props
}: CalendarProps) {
  
  const handleCalendarChange = (
    _month: Date,
    e: React.ChangeEvent<HTMLSelectElement>
  ) => {
    const newMonth = new Date(_month);
    if (e.target.name === "months") {
      newMonth.setMonth(parseInt(e.target.value, 10));
    } else if (e.target.name === "years") {
      newMonth.setFullYear(parseInt(e.target.value, 10));
    }
    if (props.onMonthChange) {
      props.onMonthChange(newMonth);
    }
  };

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
        months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
        month: "space-y-4",
        caption: "flex justify-center pt-1 relative items-center",
        caption_label: captionLayout === "dropdown-buttons" ? "hidden": "text-sm font-medium", // Hide default label if using dropdowns
        caption_dropdowns: "flex gap-2 items-center", // Class for dropdown container
        nav: "space-x-1 flex items-center",
        nav_button: cn(
          buttonVariants({ variant: "outline" }),
          "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100"
        ),
        nav_button_previous: "absolute left-1",
        nav_button_next: "absolute right-1",
        table: "w-full border-collapse space-y-1",
        head_row: "flex",
        head_cell:
          "text-muted-foreground rounded-md w-9 font-normal text-[0.8rem]",
        row: "flex w-full mt-2",
        cell: "h-9 w-9 text-center text-sm p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-outside)]:bg-accent/50 [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
        day: cn(
          buttonVariants({ variant: "ghost" }),
          "h-9 w-9 p-0 font-normal aria-selected:opacity-100"
        ),
        day_range_end: "day-range-end",
        day_selected:
          "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
        day_today: "bg-accent text-accent-foreground",
        day_outside:
          "day-outside text-muted-foreground opacity-50 aria-selected:bg-accent/50 aria-selected:text-muted-foreground ", // Removed ! from opacity to allow custom styling to override
        day_disabled: "text-muted-foreground opacity-50",
        day_range_middle:
          "aria-selected:bg-accent aria-selected:text-accent-foreground",
        day_hidden: "invisible",
        dropdown_month: "flex gap-2", // For month/year dropdowns
        dropdown_year: "flex gap-2",
        dropdown: "text-sm px-2 py-1 border rounded-md bg-background", // Style for the select itself
        ...classNames,
      }}
      components={{
        IconLeft: ({ className: cName, ...restProps }) => (
          <ChevronLeft className={cn("h-4 w-4", cName)} {...restProps} />
        ),
        IconRight: ({ className: cName, ...restProps }) => (
          <ChevronRight className={cn("h-4 w-4", cName)} {...restProps} />
        ),
        Dropdown: (dropdownProps: DropdownProps) => {
          const { name, value, onChange, children, ...rest } = dropdownProps;
          const options = React.Children.toArray(children) as React.ReactElement<React.HTMLProps<HTMLOptionElement>>[];
          const currentYear = new Date().getFullYear();
          const selectValue = String(value);

          return (
            <Select
              name={name}
              value={selectValue}
              onValueChange={(val) => {
                 if (onChange) {
                    // Simulate event object for DayPicker's internal handler
                    const simulatedEvent = { target: { value: val, name } } as React.ChangeEvent<HTMLSelectElement>;
                    onChange(simulatedEvent);
                  }
              }}
            >
              <SelectTrigger className="w-[120px] text-sm h-8 focus:ring-0 focus:ring-offset-0">
                <SelectValue>
                  {options.find(option => option.props.value === selectValue)?.props.children}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="max-h-[200px]">
                <ScrollArea className="h-full">
                {options.map((option) => (
                  <SelectItem
                    key={option.props.value}
                    value={String(option.props.value)}
                  >
                    {option.props.children}
                  </SelectItem>
                ))}
                </ScrollArea>
              </SelectContent>
            </Select>
          );
        },
      }}
      captionLayout={captionLayout}
      fromYear={fromYear}
      toYear={toYear}
      {...props}
    />
  )
}
Calendar.displayName = "Calendar"

export { Calendar }

    