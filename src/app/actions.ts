
"use server";

import type { RotaInput, ProcessedRotaResult, ComplianceResultDetail, ProcessedShift, ShiftDefinition } from '@/types';
import { z } from 'zod';

// --- Helper Functions ---
const calculateDurationInHours = (start: string | Date, end: string | Date): number => {
  if (!start || !end) return 0;
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return 0;
  return (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60);
};

const getHoursBetween_23_06 = (start: string | Date, end: string | Date): number => {
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return 0;

  let nightHours = 0;
  let current = new Date(startDate);

  while (current < endDate) {
    const hour = current.getHours();
    const nextHour = new Date(current);
    nextHour.setHours(hour + 1, 0, 0, 0);

    if (hour >= 23 || hour < 6) {
      const overlapEnd = Math.min(endDate.getTime(), nextHour.getTime());
      const overlapStart = Math.max(startDate.getTime(), current.getTime());
      if (overlapEnd > overlapStart) {
        nightHours += (overlapEnd - overlapStart) / (1000 * 60 * 60);
      }
    }
    current.setTime(nextHour.getTime());
    if (current.getTime() >= endDate.getTime()) break;
  }
  return nightHours;
};

const isTCSNightShift = (shiftStart: string | Date, shiftEnd: string | Date): boolean => {
    const start = new Date(shiftStart);
    const end = new Date(shiftEnd);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return false;

    const duration = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    if (duration < 8) return false;
    
    return getHoursBetween_23_06(start, end) >= 3;
};


const isWeekendShift = (shift: ProcessedShift): boolean => {
  const start = new Date(shift.start);
  const end = new Date(shift.end);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) return false;

  let current = new Date(start);
  current.setHours(0,0,0,0);

  const endDay = new Date(end);
  endDay.setHours(23,59,59,999);

  while (current <= endDay) {
    const dayOfWeek = current.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) { // 0 = Sunday, 6 = Saturday
      const shiftStartTime = new Date(shift.start).getTime();
      const shiftEndTime = new Date(shift.end).getTime();
      
      const weekendDayStart = new Date(current).setHours(0,0,0,0);
      const weekendDayEnd = new Date(current).setHours(23,59,59,999);

      if (Math.max(shiftStartTime, weekendDayStart) < Math.min(shiftEndTime, weekendDayEnd)) {
        return true;
      }
    }
    current.setDate(current.getDate() + 1);
  }
  return false;
};

const getDayKey = (date: Date | string): string => {
  const d = new Date(date);
  return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
};

// --- Categories for Grouping ---
const CATEGORIES = {
    AVERAGE_HOURS: 'Average Hours',
    MAX_HOURS_SHIFTS: 'Maximum Hours & Shifts',
    ON_CALL: 'On-Call Hours & Shifts',
    REST: 'Rest Requirements',
    WEEKEND_WORK: 'Weekend Work',
    BREAK_ENTITLEMENTS: 'Break Entitlements',
};

// --- Limit Definitions ---
const WORKING_LIMITS = [
   {
    id: 'avgWeeklyHoursWithLeaveNHS',
    name: 'Average Weekly Hours (NHS Employers Method)',
    description: 'Average weekly hours, factoring in leave using NHS Employers guidance, should not exceed 48 hours (or 56 if opted out).',
    pdfReference: 'NHS Employers Prospective Cover Guidance, pg 6',
    category: CATEGORIES.AVERAGE_HOURS,
    check: (shifts: ProcessedShift[], B_rotaCycleWeeks: number, wtrOptOut: boolean, A_annualLeaveDays: number, C_hoursInNormalDay: number = 8) => {
      if (!shifts || !shifts.length || !B_rotaCycleWeeks || A_annualLeaveDays === undefined) {
        return { isViolated: false, userValue: 0, limitValue: wtrOptOut ? 56 : 48, difference: 'N/A', details: 'Not enough data for NHS Employers calc.' };
      }

      const D_totalHoursInRotaCycle = shifts.reduce((sum, shift) => sum + calculateDurationInHours(shift.start, shift.end), 0);
      
      const E_leavePerRotaCycleDays = (A_annualLeaveDays * B_rotaCycleWeeks) / 52;
      const F_leavePerRotaCycleWeeks = E_leavePerRotaCycleDays / 5;
      const G_leavePerRotaCycleHours = E_leavePerRotaCycleDays * C_hoursInNormalDay;

      const H_remainingHoursInRota = D_totalHoursInRotaCycle - G_leavePerRotaCycleHours;
      const H_adjusted = Math.max(0, H_remainingHoursInRota);
      
      const I_remainingWeeksInRota = B_rotaCycleWeeks - F_leavePerRotaCycleWeeks;
      const effectiveWeeksForDenominator = I_remainingWeeksInRota > 0 ? I_remainingWeeksInRota : 0.1;
      
      const J_avgWeeklyHours = effectiveWeeksForDenominator > 0 ? H_adjusted / effectiveWeeksForDenominator : (H_adjusted > 0 ? H_adjusted * 1000 : 0);

      const limit = wtrOptOut ? 56 : 48;
      const isViolated = J_avgWeeklyHours > limit;
      return {
        isViolated,
        userValue: parseFloat(J_avgWeeklyHours.toFixed(2)),
        limitValue: limit,
        difference: `${parseFloat((J_avgWeeklyHours - limit).toFixed(2))} hours ${isViolated ? 'over' : 'under/at limit'}`,
        details: `Total Rota Hrs (D): ${D_totalHoursInRotaCycle.toFixed(2)}, Annual Leave (A): ${A_annualLeaveDays}d, Rota Weeks (B): ${B_rotaCycleWeeks}w, Hrs/Day for Leave (C): ${C_hoursInNormalDay}h. Leave in Rota (Days E): ${E_leavePerRotaCycleDays.toFixed(2)}d, (Weeks F): ${F_leavePerRotaCycleWeeks.toFixed(2)}w, (Hours G): ${G_leavePerRotaCycleHours.toFixed(2)}h. Net Worked Hrs (H): ${H_adjusted.toFixed(2)}h, Net Weeks (I): ${I_remainingWeeksInRota.toFixed(2)}w. Avg (J): ${J_avgWeeklyHours.toFixed(2)}h. Limit: ${limit} hrs.`,
      };
    },
  },
  {
    id: 'avgWeeklyHoursNoLeave',
    name: 'Average Weekly Hours (no leave)',
    description: 'Average weekly hours, NOT factoring in leave, should not exceed 48 hours (or 56 if opted out).',
    pdfReference: 'Schedule 3, Para 7',
    category: CATEGORIES.AVERAGE_HOURS,
    check: (shifts: ProcessedShift[], scheduleWeeks: number, wtrOptOut: boolean) => {
      if (!shifts || !shifts.length || !scheduleWeeks) return { isViolated: false, userValue: 0, limitValue: wtrOptOut ? 56 : 48, difference: 'N/A', details: 'Not enough data.' };
      const totalHours = shifts.reduce((sum, shift) => sum + calculateDurationInHours(shift.start, shift.end), 0);
      const avgHours = scheduleWeeks > 0 ? totalHours / scheduleWeeks : totalHours * 1000; // Avoid division by zero
      const limit = wtrOptOut ? 56 : 48;
      const isViolated = avgHours > limit;
      return {
        isViolated,
        userValue: parseFloat(avgHours.toFixed(2)),
        limitValue: limit,
        difference: `${parseFloat((avgHours - limit).toFixed(2))} hours ${isViolated ? 'over' : 'under/at limit'}`,
        details: `Total hours: ${totalHours.toFixed(2)}, Rota Weeks: ${scheduleWeeks}. Limit: ${limit} hrs. (Leave not factored).`,
      };
    },
  },
  {
    id: 'maxHoursIn168ConsecutiveHours',
    name: 'Max Hours in 168 Consecutive Hours',
    description: 'No more than 72 hours actual work in any 168 consecutive hours (7 days).',
    pdfReference: 'Schedule 3, Para 8',
    category: CATEGORIES.MAX_HOURS_SHIFTS,
    check: (shifts: ProcessedShift[]) => {
      if (!shifts || shifts.length < 1) return { isViolated: false, userValue: 0, limitValue: 72, difference: 'N/A', details: 'Not enough data.' };
      let maxHoursInWindow = 0;
      const sortedShifts = [...shifts].sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
      for (let i = 0; i < sortedShifts.length; i++) {
        const windowStart = new Date(sortedShifts[i].start);
        const windowEnd = new Date(windowStart.getTime() + 168 * 60 * 60 * 1000);
        let hoursInCurrentWindow = 0;
        for (const shift of sortedShifts) {
          const shiftStart = new Date(shift.start);
          const shiftEnd = new Date(shift.end);
          const overlapStart = Math.max(windowStart.getTime(), shiftStart.getTime());
          const overlapEnd = Math.min(windowEnd.getTime(), shiftEnd.getTime());
          if (overlapEnd > overlapStart) {
            hoursInCurrentWindow += (overlapEnd - overlapStart) / (1000 * 60 * 60);
          }
        }
        if (hoursInCurrentWindow > maxHoursInWindow) {
          maxHoursInWindow = hoursInCurrentWindow;
        }
      }
      const isViolated = maxHoursInWindow > 72;
      return {
        isViolated,
        userValue: parseFloat(maxHoursInWindow.toFixed(2)),
        limitValue: 72,
        difference: `${parseFloat((maxHoursInWindow - 72).toFixed(2))} hours ${isViolated ? 'over' : 'under/at limit'}`,
        details: `Max hours found in any 168hr window: ${maxHoursInWindow.toFixed(2)}. Limit: 72 hrs.`,
      };
    },
  },
  {
    id: 'maxShiftLength',
    name: 'Maximum Shift Length (Non On-Call)',
    description: 'No standard shift (other than on-call) shall exceed 13 hours.',
    pdfReference: 'Schedule 3, Para 9',
    category: CATEGORIES.MAX_HOURS_SHIFTS,
    check: (shifts: ProcessedShift[]) => {
      if (!shifts) return { isViolated: false, userValue: 0, limitValue: 13, difference: 'N/A', details: 'Not enough data.' };
      let maxShift = 0;
      let violatedShiftDetails = null;
      shifts.filter(s => s.type !== 'on-call').forEach(shift => {
        const duration = calculateDurationInHours(shift.start, shift.end);
        if (duration > maxShift) maxShift = duration;
        if (duration > 13 && !violatedShiftDetails) violatedShiftDetails = `Shift: ${shift.title} on ${new Date(shift.start).toLocaleDateString()}`;
      });
      const isViolated = maxShift > 13;
      return {
        isViolated,
        userValue: parseFloat(maxShift.toFixed(2)),
        limitValue: 13,
        difference: `${parseFloat((maxShift - 13).toFixed(2))} hours ${isViolated ? 'over' : 'under/at limit'}`,
        details: isViolated && violatedShiftDetails ? `Longest non on-call shift: ${maxShift.toFixed(2)} hrs (${violatedShiftDetails}). Limit: 13 hrs.` : `Longest non on-call shift: ${maxShift.toFixed(2)} hrs. Limit: 13 hrs.`,
      };
    },
  },
  {
    id: 'maxConsecutiveShifts',
    name: 'Max 7 Consecutive Days Worked & Rest',
    description: 'Max 7 consecutive days with shifts. Min 48h rest after 7.',
    pdfReference: 'Schedule 3, Para 14',
    category: CATEGORIES.MAX_HOURS_SHIFTS,
    check: (shifts: ProcessedShift[]) => {
        if (!shifts || shifts.length === 0) return { isViolated: false, userValue: 0, limitValue: 7, difference: 'N/A', details: 'No shifts.' };
        const sortedShifts = [...shifts].sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
        let restViolatedAfter7 = false;
        let violationDetails = "";
        const workedDays = new Set<string>();
        sortedShifts.forEach(shift => {
            let dayRunner = new Date(shift.start); dayRunner.setHours(0,0,0,0);
            const endDay = new Date(shift.end); 
            if (endDay.getHours() === 0 && endDay.getMinutes() === 0 && new Date(shift.start).toDateString() !== endDay.toDateString()) {
                endDay.setDate(endDay.getDate() -1); // If ends at midnight, count it as previous day's work
            }
            endDay.setHours(0,0,0,0);

            while(dayRunner <= endDay) {
                workedDays.add(getDayKey(dayRunner));
                dayRunner.setDate(dayRunner.getDate()+1);
            }
        });
        const sortedUniqueWorkedDays = Array.from(workedDays).sort();
        if (sortedUniqueWorkedDays.length === 0) return { isViolated: false, userValue: 0, limitValue: 7, difference: 'N/A', details: 'No worked days.' };
        
        let currentConsecutiveRun = 0; let maxConsecutiveRun = 0;
        let endOfLastDayInRunKey: string | null = null;

        for (let i = 0; i < sortedUniqueWorkedDays.length; i++) {
            if (i === 0) {
                currentConsecutiveRun = 1;
            } else {
                const prevDayDate = new Date(sortedUniqueWorkedDays[i-1]);
                const currentDayDate = new Date(sortedUniqueWorkedDays[i]);
                prevDayDate.setDate(prevDayDate.getDate() + 1);
                if (prevDayDate.toDateString() === currentDayDate.toDateString()) {
                    currentConsecutiveRun++;
                } else {
                    if (currentConsecutiveRun > maxConsecutiveRun) maxConsecutiveRun = currentConsecutiveRun;
                    if (currentConsecutiveRun === 7 && endOfLastDayInRunKey) {
                        let actualEndOf7thDayShift = null;
                        sortedShifts.forEach(s => {
                            if (getDayKey(s.start) === endOfLastDayInRunKey || (new Date(s.start) < new Date(endOfLastDayInRunKey!) && new Date(s.end) >= new Date(endOfLastDayInRunKey!))) {
                                if (!actualEndOf7thDayShift || new Date(s.end) > actualEndOf7thDayShift) {
                                    actualEndOf7thDayShift = new Date(s.end);
                                }
                            }
                        });

                        if (actualEndOf7thDayShift) {
                            const nextWorkDayKey = sortedUniqueWorkedDays[i]; // This is the start of the next work block
                            const firstShiftOfNextBlock = sortedShifts.find(s => getDayKey(s.start) === nextWorkDayKey);
                            if(firstShiftOfNextBlock){
                                const restHours = (new Date(firstShiftOfNextBlock.start).getTime() - actualEndOf7thDayShift.getTime()) / (1000 * 60 * 60);
                                if (restHours < 48) {
                                    restViolatedAfter7 = true;
                                    violationDetails = `Rest after 7 consecutive days was ${restHours.toFixed(1)}h (Limit: 48h). Block ended on ${endOfLastDayInRunKey}.`;
                                }
                            }
                        }
                    }
                    currentConsecutiveRun = 1;
                }
            }
            endOfLastDayInRunKey = sortedUniqueWorkedDays[i];
        }
        if (currentConsecutiveRun > maxConsecutiveRun) maxConsecutiveRun = currentConsecutiveRun;
        if (currentConsecutiveRun === 7 && !restViolatedAfter7 && endOfLastDayInRunKey) {
             let actualEndOf7thDayShift = null;
             sortedShifts.forEach(s => {
                 if (getDayKey(s.start) === endOfLastDayInRunKey || (new Date(s.start) < new Date(endOfLastDayInRunKey!) && new Date(s.end) >= new Date(endOfLastDayInRunKey!))) {
                    if (!actualEndOf7thDayShift || new Date(s.end) > actualEndOf7thDayShift) {
                        actualEndOf7thDayShift = new Date(s.end);
                    }
                 }
             });
             if (actualEndOf7thDayShift) {
                const nextShiftInSchedule = sortedShifts.find(s => new Date(s.start) > actualEndOf7thDayShift!);
                if (!nextShiftInSchedule) {
                    violationDetails = violationDetails ? violationDetails + " Also ends with 7 consecutive days; ensure 48h rest follows." : "Ends with 7 consecutive days; ensure 48h rest follows.";
                }
             }
        }

        const isViolated = maxConsecutiveRun > 7 || restViolatedAfter7;
        let baseDetails = `Max consecutive days worked: ${maxConsecutiveRun}.`;
        if (violationDetails) baseDetails = `${baseDetails} ${violationDetails}`;
        else if (maxConsecutiveRun === 7 && !restViolatedAfter7 && !isViolated) baseDetails += " 48h rest appears met or not checkable at end of schedule.";
        
        return {
            isViolated, userValue: maxConsecutiveRun, limitValue: 7,
            difference: `${maxConsecutiveRun - 7} days ${isViolated && maxConsecutiveRun > 7 ? 'over limit' : ''}${restViolatedAfter7 ? (isViolated && maxConsecutiveRun > 7 ? ', and rest violated' : ', Rest violated') : ''}`,
            details: baseDetails,
        };
    }
  },
  {
    id: 'consecutiveLongShifts',
    name: 'Max 4 Consecutive Long Shifts & Rest',
    description: 'No more than 4 long shifts (>10h) consecutively. Min 48h rest after 4.',
    pdfReference: 'Schedule 3, Para 10',
    category: CATEGORIES.MAX_HOURS_SHIFTS,
    check: (shifts: ProcessedShift[]) => {
      if (!shifts || shifts.length === 0) return { isViolated: false, userValue: 0, limitValue: 4, difference: 'N/A', details: 'No shifts.'};
      const sortedShifts = [...shifts].sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
      
      const longShiftDaysSet = new Set<string>();
      sortedShifts.forEach(shift => {
          const duration = calculateDurationInHours(shift.start, shift.end);
          if (duration > 10) {
              let dayRunner = new Date(shift.start); dayRunner.setHours(0,0,0,0);
              const endDay = new Date(shift.end);
              if (endDay.getHours() === 0 && endDay.getMinutes() === 0 && new Date(shift.start).toDateString() !== endDay.toDateString()) {
                  endDay.setDate(endDay.getDate() -1);
              }
              endDay.setHours(0,0,0,0);
              while(dayRunner <= endDay) {
                  longShiftDaysSet.add(getDayKey(dayRunner));
                  dayRunner.setDate(dayRunner.getDate()+1);
              }
          }
      });

      if (longShiftDaysSet.size === 0) {
          return { isViolated: false, userValue: 0, limitValue: 4, difference: 'N/A', details: "No long shifts (>10h) found." };
      }
      const sortedLongShiftDays = Array.from(longShiftDaysSet).sort();

      let currentConsecutiveRun = 0;
      let maxConsecutiveRun = 0;
      let endOfRunDayKey: string | null = null;
      let restViolated = false;
      let details = "";

      for (let i = 0; i < sortedLongShiftDays.length; i++) {
          if (i === 0) {
              currentConsecutiveRun = 1;
          } else {
              const prevDay = new Date(sortedLongShiftDays[i-1]);
              const currentDay = new Date(sortedLongShiftDays[i]);
              prevDay.setDate(prevDay.getDate() + 1);
              if (prevDay.toDateString() === currentDay.toDateString()) {
                  currentConsecutiveRun++;
              } else {
                  if (currentConsecutiveRun > maxConsecutiveRun) maxConsecutiveRun = currentConsecutiveRun;
                  if (currentConsecutiveRun === 4 && endOfRunDayKey) {
                      let actualEndOf4thDayShift: Date | null = null;
                      sortedShifts.forEach(s => {
                          const duration = calculateDurationInHours(s.start, s.end);
                          if (duration > 10) {
                              if (getDayKey(s.start) === endOfRunDayKey || (new Date(s.start) < new Date(endOfRunDayKey!) && new Date(s.end) >= new Date(endOfRunDayKey!))) {
                                if (!actualEndOf4thDayShift || new Date(s.end) > actualEndOf4thDayShift) {
                                   actualEndOf4thDayShift = new Date(s.end);
                                }
                              }
                          }
                      });
                      const firstShiftAfterBreak = sortedShifts.find(s => new Date(s.start) >= new Date(sortedLongShiftDays[i])); // Shift on the day after the gap
                      if (actualEndOf4thDayShift && firstShiftAfterBreak) {
                          const restTime = (new Date(firstShiftAfterBreak.start).getTime() - actualEndOf4thDayShift.getTime()) / (1000 * 60 * 60);
                          if (restTime < 48) {
                              restViolated = true;
                              details = `48h rest VIOLATED after 4 consecutive long-shift days. Rest was ${restTime.toFixed(1)}h. Block ended on ${endOfRunDayKey}.`;
                          }
                      }
                  }
                  currentConsecutiveRun = 1;
              }
          }
          if (currentConsecutiveRun >= 4) endOfRunDayKey = sortedLongShiftDays[i];
          else endOfRunDayKey = null;
      }
      if (currentConsecutiveRun > maxConsecutiveRun) maxConsecutiveRun = currentConsecutiveRun;
      
      if (currentConsecutiveRun === 4 && !restViolated && endOfRunDayKey) {
          let actualEndOf4thDayShift: Date | null = null;
           sortedShifts.forEach(s => {
                const duration = calculateDurationInHours(s.start, s.end);
                if (duration > 10) {
                    if (getDayKey(s.start) === endOfRunDayKey || (new Date(s.start) < new Date(endOfRunDayKey!) && new Date(s.end) >= new Date(endOfRunDayKey!))) {
                        if (!actualEndOf4thDayShift || new Date(s.end) > actualEndOf4thDayShift) {
                            actualEndOf4thDayShift = new Date(s.end);
                        }
                    }
                }
            });
          const nextShiftInSchedule = sortedShifts.find(s => actualEndOf4thDayShift && new Date(s.start) > actualEndOf4thDayShift);
          if (!nextShiftInSchedule && !details.includes("VIOLATED")) {
              details = `Schedule ends with 4 consecutive long-shift days (max found: ${maxConsecutiveRun}). Ensure 48h rest follows.`;
          }
      }

      if (maxConsecutiveRun === 0 && !restViolated && !details) {
           details = "No long shifts (>10h) found on consecutive days.";
      } else if (!restViolated && !details.includes("VIOLATED") && !details.includes("Schedule ends with")) {
          if (maxConsecutiveRun < 4) {
              details = `Max consecutive days with long shifts (>10h): ${maxConsecutiveRun}.`;
          } else if (maxConsecutiveRun >=4) {
              details = `Max consecutive days with long shifts (>10h): ${maxConsecutiveRun}. 48h rest appears met or not checkable at end.`;
          }
      }
      
      const isViolated = maxConsecutiveRun > 4 || restViolated;
      return {
        isViolated, userValue: maxConsecutiveRun, limitValue: 4,
        difference: `${maxConsecutiveRun - 4} day(s) of long shifts ${isViolated && maxConsecutiveRun > 4 ? 'over limit' : ''}${restViolated ? (isViolated && maxConsecutiveRun > 4 ? ', and rest violated' : '. Rest violated') : ''}`,
        details,
      };
    },
  },
  {
    id: 'consecutiveLateShifts',
    name: 'Max 4 Consecutive Late Shifts & Rest',
    description: 'Max 4 long shifts (>10h) ending after 23:00. Min 48h rest after 4.',
    pdfReference: 'Schedule 3, Para 11',
    category: CATEGORIES.MAX_HOURS_SHIFTS,
    check: (shifts: ProcessedShift[]) => {
        if (!shifts || shifts.length === 0) return { isViolated: false, userValue: 0, limitValue: 4, difference: 'N/A', details: 'Not enough data.' };
        const sortedShifts = [...shifts].sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
        
        const lateLongShiftDaysSet = new Set<string>();
        sortedShifts.forEach(shift => {
            const duration = calculateDurationInHours(shift.start, shift.end);
            const T2300_startDay = new Date(shift.start); T2300_startDay.setHours(23, 0, 0, 0);
            const isLateFinish = new Date(shift.end).getTime() > T2300_startDay.getTime();
            if (duration > 10 && isLateFinish) {
                let dayRunner = new Date(shift.start); dayRunner.setHours(0,0,0,0);
                const endDay = new Date(shift.end);
                if (endDay.getHours() === 0 && endDay.getMinutes() === 0 && new Date(shift.start).toDateString() !== endDay.toDateString()) {
                    endDay.setDate(endDay.getDate() -1);
                }
                endDay.setHours(0,0,0,0);
                while(dayRunner <= endDay) {
                    lateLongShiftDaysSet.add(getDayKey(dayRunner));
                    dayRunner.setDate(dayRunner.getDate()+1);
                }
            }
        });

        if (lateLongShiftDaysSet.size === 0) {
            return { isViolated: false, userValue: 0, limitValue: 4, difference: 'N/A', details: "No late long shifts found." };
        }
        const sortedLateLongShiftDays = Array.from(lateLongShiftDaysSet).sort();

        let currentConsecutiveRun = 0;
        let maxConsecutiveRun = 0;
        let endOfRunDayKey: string | null = null;
        let restViolated = false;
        let details = "";

        for (let i = 0; i < sortedLateLongShiftDays.length; i++) {
            if (i === 0) currentConsecutiveRun = 1;
            else {
                const prevDay = new Date(sortedLateLongShiftDays[i-1]);
                const currentDay = new Date(sortedLateLongShiftDays[i]);
                prevDay.setDate(prevDay.getDate() + 1);
                if (prevDay.toDateString() === currentDay.toDateString()) currentConsecutiveRun++;
                else {
                    if (currentConsecutiveRun > maxConsecutiveRun) maxConsecutiveRun = currentConsecutiveRun;
                    if (currentConsecutiveRun === 4 && endOfRunDayKey) {
                        let actualEndOf4thDayShift: Date | null = null;
                        sortedShifts.forEach(s => {
                            const dur = calculateDurationInHours(s.start, s.end);
                            const T2300 = new Date(s.start); T2300.setHours(23,0,0,0);
                            const late = new Date(s.end).getTime() > T2300.getTime();
                            if (dur > 10 && late) {
                               if (getDayKey(s.start) === endOfRunDayKey || (new Date(s.start) < new Date(endOfRunDayKey!) && new Date(s.end) >= new Date(endOfRunDayKey!))) {
                                  if (!actualEndOf4thDayShift || new Date(s.end) > actualEndOf4thDayShift) actualEndOf4thDayShift = new Date(s.end);
                               }
                            }
                        });
                        const firstShiftAfterBreak = sortedShifts.find(s => new Date(s.start) >= new Date(sortedLateLongShiftDays[i]));
                        if (actualEndOf4thDayShift && firstShiftAfterBreak) {
                            const restTime = (new Date(firstShiftAfterBreak.start).getTime() - actualEndOf4thDayShift.getTime()) / (1000 * 60 * 60);
                            if (restTime < 48) {
                                restViolated = true;
                                details = `48h rest VIOLATED after 4 consecutive late-long-shift days. Rest was ${restTime.toFixed(1)}h. Block ended ${endOfRunDayKey}.`;
                            }
                        }
                    }
                    currentConsecutiveRun = 1;
                }
            }
            if (currentConsecutiveRun >= 4) endOfRunDayKey = sortedLateLongShiftDays[i];
            else endOfRunDayKey = null;
        }
        if (currentConsecutiveRun > maxConsecutiveRun) maxConsecutiveRun = currentConsecutiveRun;

        if (currentConsecutiveRun === 4 && !restViolated && endOfRunDayKey) {
            let actualEndOf4thDayShift: Date | null = null;
            sortedShifts.forEach(s => {
                const dur = calculateDurationInHours(s.start, s.end);
                const T2300 = new Date(s.start); T2300.setHours(23,0,0,0);
                const late = new Date(s.end).getTime() > T2300.getTime();
                if (dur > 10 && late) {
                   if (getDayKey(s.start) === endOfRunDayKey || (new Date(s.start) < new Date(endOfRunDayKey!) && new Date(s.end) >= new Date(endOfRunDayKey!))) {
                     if (!actualEndOf4thDayShift || new Date(s.end) > actualEndOf4thDayShift) actualEndOf4thDayShift = new Date(s.end);
                   }
                }
            });
            const nextShiftInSchedule = sortedShifts.find(s => actualEndOf4thDayShift && new Date(s.start) > actualEndOf4thDayShift);
            if (!nextShiftInSchedule && !details.includes("VIOLATED")) {
                details = `Schedule ends with 4 consecutive late-long-shift days (max found: ${maxConsecutiveRun}). Ensure 48h rest follows.`;
            }
        }
        if (maxConsecutiveRun === 0 && !restViolated && !details) {
            details = "No late long shifts found on consecutive days.";
        } else if (!restViolated && !details.includes("VIOLATED") && !details.includes("Schedule ends with")) {
            if (maxConsecutiveRun < 4) details = `Max consecutive days with late long shifts: ${maxConsecutiveRun}.`;
            else if (maxConsecutiveRun >=4) details = `Max consecutive days with late long shifts: ${maxConsecutiveRun}. 48h rest appears met or not checkable at end.`;
        }
        
        const isViolated = maxConsecutiveRun > 4 || restViolated;
        return {
            isViolated, userValue: maxConsecutiveRun, limitValue: 4,
            difference: `${maxConsecutiveRun - 4} day(s) of late long shifts ${isViolated && maxConsecutiveRun > 4 ? 'over limit' : ''}${restViolated ? (isViolated && maxConsecutiveRun > 4 ? ', and rest violated' : '. Rest violated') : ''}`,
            details,
        };
    }
  },
  {
    id: 'consecutiveNightShifts',
    name: 'Max 4 Consecutive Night Shifts',
    description: 'No more than 4 shifts with >=3h work between 23:00-06:00 consecutively.',
    pdfReference: 'Schedule 3, Para 12',
    category: CATEGORIES.MAX_HOURS_SHIFTS,
    check: (shifts: ProcessedShift[]) => {
        if (!shifts || shifts.length === 0) return { isViolated: false, userValue: 0, limitValue: 4, difference: 'N/A', details: 'Not enough data.' };
        const sortedShifts = [...shifts].sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
        
        const nightShiftDaysSet = new Set<string>();
        sortedShifts.forEach(shift => {
            const nightHours = getHoursBetween_23_06(shift.start, shift.end);
            if (nightHours >= 3) {
                let dayRunner = new Date(shift.start); dayRunner.setHours(0,0,0,0);
                const endDay = new Date(shift.end);
                if (endDay.getHours() === 0 && endDay.getMinutes() === 0 && new Date(shift.start).toDateString() !== endDay.toDateString()) {
                    endDay.setDate(endDay.getDate() -1);
                }
                endDay.setHours(0,0,0,0);
                while(dayRunner <= endDay) {
                    nightShiftDaysSet.add(getDayKey(dayRunner));
                    dayRunner.setDate(dayRunner.getDate()+1);
                }
            }
        });
        if (nightShiftDaysSet.size === 0) {
            return { isViolated: false, userValue: 0, limitValue: 4, difference: 'N/A', details: "No night shifts (>=3h between 23:00-06:00) found." };
        }
        const sortedNightShiftDays = Array.from(nightShiftDaysSet).sort();

        let currentConsecutiveRun = 0;
        let maxConsecutiveRun = 0;

        for (let i = 0; i < sortedNightShiftDays.length; i++) {
            if (i === 0) currentConsecutiveRun = 1;
            else {
                const prevDay = new Date(sortedNightShiftDays[i-1]);
                const currentDay = new Date(sortedNightShiftDays[i]);
                prevDay.setDate(prevDay.getDate() + 1);
                if (prevDay.toDateString() === currentDay.toDateString()) currentConsecutiveRun++;
                else {
                    if (currentConsecutiveRun > maxConsecutiveRun) maxConsecutiveRun = currentConsecutiveRun;
                    currentConsecutiveRun = 1;
                }
            }
        }
        if (currentConsecutiveRun > maxConsecutiveRun) maxConsecutiveRun = currentConsecutiveRun;
        
        const isViolated = maxConsecutiveRun > 4;
        const details = `Max consecutive days with night shifts (>=3h between 23:00-06:00): ${maxConsecutiveRun}. Limit: 4.`;
        return {
            isViolated,
            userValue: maxConsecutiveRun,
            limitValue: 4,
            difference: `${maxConsecutiveRun - 4} days of night shifts ${isViolated ? 'over' : 'under/at limit'}`,
            details,
        };
    },
  },
    {
    id: 'nonConsecutiveOnCallMidweek',
    name: 'Non-Consecutive On-Call (Mon-Fri)',
    description: 'On-call periods Mon-Fri should not be consecutive (implying sufficient rest between).',
    pdfReference: 'Schedule 3, Para 27',
    category: CATEGORIES.ON_CALL,
    check: (shifts: ProcessedShift[]) => {
        if (!shifts) return { isViolated: false, userValue: "N/A", details: 'No shifts data.' };
        const sortedOnCallShifts = shifts.filter(s => s.type === 'on-call').sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
        let violationFound = false;
        let details = "On-call shifts Mon-Fri appear non-consecutive or not present.";

        for (let i = 0; i < sortedOnCallShifts.length - 1; i++) {
            const shift1 = sortedOnCallShifts[i];
            const shift2 = sortedOnCallShifts[i+1];
            
            const shift1End = new Date(shift1.end);
            const shift2Start = new Date(shift2.start);

            const shift1EndDayOfWeek = shift1End.getDay(); // 0=Sun, 1=Mon ... 6=Sat
            const shift2StartDayOfWeek = shift2Start.getDay();

            // Check if both shifts are within Mon-Fri
            const isShift1EndMidweek = shift1EndDayOfWeek >= 1 && shift1EndDayOfWeek <= 5;
            const isShift2StartMidweek = shift2StartDayOfWeek >= 1 && shift2StartDayOfWeek <= 5;
            
            if (isShift1EndMidweek && isShift2StartMidweek) {
                // Check if they are on consecutive days
                // Example: Shift1 ends Mon, Shift2 starts Tue
                const dayAfterShift1End = new Date(shift1End);
                dayAfterShift1End.setHours(0,0,0,0);
                dayAfterShift1End.setDate(dayAfterShift1End.getDate() + 1); 

                const shift2StartDateOnly = new Date(shift2Start);
                shift2StartDateOnly.setHours(0,0,0,0);
                
                if (dayAfterShift1End.toDateString() === shift2StartDateOnly.toDateString()) {
                     // Para 27 implies that there should be an 11-hour rest period between these on-call shifts.
                     // If shift1 ends at 17:00 Mon, shift2 cannot start before 04:00 Tue.
                    const restBetween = (shift2Start.getTime() - shift1End.getTime()) / (1000 * 60 * 60);
                    if (restBetween < 11) {
                        violationFound = true;
                        details = `Consecutive midweek on-call: Shift ending ${shift1End.toLocaleString()} and shift starting ${shift2Start.toLocaleString()} have only ${restBetween.toFixed(1)}h rest. Limit: 11h.`;
                        break;
                    }
                }
            }
        }
        return {
            isViolated: violationFound,
            userValue: violationFound ? "Violation" : "OK",
            limitValue: "Non-Consecutive (with 11h rest)",
            difference: violationFound ? "Consecutive on-calls midweek with insufficient rest" : "N/A",
            details,
        };
    }
  },
  {
    id: 'maxOnCallFrequency',
    name: 'Max On-Call Frequency',
    description: 'No more than 3 on-call periods in any 7 consecutive days.',
    pdfReference: 'Schedule 3, Para 28',
    category: CATEGORIES.ON_CALL,
    check: (shifts: ProcessedShift[]) => {
        if (!shifts || shifts.length === 0) return { isViolated: false, userValue: 0, limitValue: 3, difference: 'N/A', details: 'No shifts data.' };
        const onCallShifts = shifts.filter(s => s.type === 'on-call').sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
        if (onCallShifts.length === 0) return { isViolated: false, userValue: 0, limitValue: 3, difference: 'N/A', details: 'No on-call shifts.' };
        let maxOnCallsInWindow = 0;
        for (let i = 0; i < onCallShifts.length; i++) {
            const windowStart = new Date(onCallShifts[i].start);
            const windowEnd = new Date(windowStart.getTime() + 7 * 24 * 60 * 60 * 1000);
            let currentOnCallsInWindow = 0;
            for (const ocShift of onCallShifts) {
                const ocShiftStart = new Date(ocShift.start);
                if (ocShiftStart >= windowStart && ocShiftStart < windowEnd) {
                    currentOnCallsInWindow++;
                }
            }
            if (currentOnCallsInWindow > maxOnCallsInWindow) {
                maxOnCallsInWindow = currentOnCallsInWindow;
            }
        }
        const isViolated = maxOnCallsInWindow > 3;
        return {
            isViolated,
            userValue: maxOnCallsInWindow,
            limitValue: 3,
            difference: `${maxOnCallsInWindow - 3} on-calls ${isViolated ? 'over' : 'under/at limit'}`,
            details: `Max on-calls found in any 7-day window: ${maxOnCallsInWindow}. Limit: 3.`,
        };
    }
  },
  {
    id: 'maxShiftLengthAfterOnCall',
    name: 'Max Shift Length After On-Call',
    description: 'Shift on day following an on-call period must not exceed 10 hours.',
    pdfReference: 'Schedule 3, Para 29',
    category: CATEGORIES.ON_CALL,
    check: (shifts: ProcessedShift[]) => {
        if (!shifts || shifts.length < 2) return { isViolated: false, userValue: "N/A", details: 'Need at least 2 shifts.' };
        const sortedShifts = [...shifts].sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
        let violationFound = false;
        let details = "Post on-call shift lengths appear compliant or not applicable.";
        for (let i = 0; i < sortedShifts.length; i++) {
            if (sortedShifts[i].type === 'on-call') {
                const onCallEnd = new Date(sortedShifts[i].end);
                for (let j = i + 1; j < sortedShifts.length; j++) {
                    const nextShiftStart = new Date(sortedShifts[j].start);
                    const dayAfterOnCallEnd = new Date(onCallEnd); dayAfterOnCallEnd.setHours(0,0,0,0); dayAfterOnCallEnd.setDate(dayAfterOnCallEnd.getDate() + 1);
                    const nextShiftStartDateOnly = new Date(nextShiftStart); nextShiftStartDateOnly.setHours(0,0,0,0);
                    if (nextShiftStartDateOnly.toDateString() === dayAfterOnCallEnd.toDateString()) { // Check if next shift is on the day immediately following on-call end
                        const duration = calculateDurationInHours(sortedShifts[j].start, sortedShifts[j].end);
                        if (duration > 10) {
                            violationFound = true;
                            details = `Shift on ${nextShiftStart.toLocaleDateString()} after on-call (ending ${onCallEnd.toLocaleString()}) is ${duration.toFixed(1)}h long. Limit 10h.`;
                            break;
                        }
                    }
                    // If the next shift is beyond the day after on-call, we can stop checking for *this* on-call
                    if (nextShiftStartDateOnly > dayAfterOnCallEnd) break;
                }
            }
            if (violationFound) break;
        }
        return {
            isViolated: violationFound, userValue: violationFound ? "Violation" : "OK", limitValue: "10h",
            difference: violationFound ? "Exceeds 10h" : "N/A", details,
        };
    }
  },
  {
    id: 'maxOnCallLength',
    name: 'Maximum On-Call Period Length',
    description: 'Individual on-call duty period should not exceed 24 hours (can be extended for handover).',
    pdfReference: 'Schedule 3, Para 26',
    category: CATEGORIES.ON_CALL,
    check: (shifts: ProcessedShift[]) => {
      if (!shifts) return { isViolated: false, userValue: 0, limitValue: 24, difference: 'N/A', details: 'Not enough data.' };
      let maxOnCallDuration = 0; let violatedShiftDetails = null;
      shifts.filter(s => s.type === 'on-call').forEach(shift => {
        const duration = calculateDurationInHours(shift.start, shift.end);
        if (duration > maxOnCallDuration) maxOnCallDuration = duration;
        if (duration > 25) violatedShiftDetails = `On-call starting ${new Date(shift.start).toLocaleString()}`; // 24h + 1h handover allowance
      });
      const isViolated = maxOnCallDuration > 25;
      return {
        isViolated, userValue: parseFloat(maxOnCallDuration.toFixed(2)), limitValue: 24,
        difference: `${parseFloat((maxOnCallDuration - 24).toFixed(2))} hours ${isViolated ? 'over (even with max 1hr handover allowance)' : 'under/at limit (handover considered)'}`,
        details: isViolated && violatedShiftDetails ? `Longest on-call: ${maxOnCallDuration.toFixed(2)} hrs (${violatedShiftDetails}). Limit: 24 hrs + up to 1hr handover.` : `Longest on-call: ${maxOnCallDuration.toFixed(2)} hrs. Limit: 24 hrs + up to 1hr handover.`,
      };
    },
  },
  {
    id: 'restAfterNightShifts',
    name: 'Rest After Night Shifts',
    description: 'Minimum 46-hour rest period after one or more consecutive night shifts (>=3h between 23:00-06:00).',
    pdfReference: 'Schedule 3, Para 13',
    category: CATEGORIES.REST,
    check: (shifts: ProcessedShift[]) => {
      if (!shifts || shifts.length < 1) return { isViolated: false, userValue: "N/A", limitValue: 46, difference: 'N/A', details: 'Not enough data.' };
      const sortedShifts = [...shifts].sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
      let violationFound = false; let details = "No night shift sequences found or rest is adequate.";
      let lastNightShiftEnd: Date | null = null; let inNightShiftSequence = false;
      for (let i = 0; i < sortedShifts.length; i++) {
        const shift = sortedShifts[i];
        const nightHours = getHoursBetween_23_06(shift.start, shift.end);
        if (nightHours >= 3) {
          inNightShiftSequence = true; lastNightShiftEnd = new Date(shift.end);
        } else { // Current shift is not a night shift
          if (inNightShiftSequence && lastNightShiftEnd) { // This means a night shift sequence just ended
            const nextShift = sortedShifts[i]; // This is the first non-night shift after the sequence
            const restTime = (new Date(nextShift.start).getTime() - lastNightShiftEnd.getTime()) / (1000 * 60 * 60);
            if (restTime < 46) {
              violationFound = true;
              details = `Rest of ${restTime.toFixed(1)}h after night shift sequence ending ${lastNightShiftEnd.toLocaleString()}. Limit: 46h. Next shift: ${new Date(nextShift.start).toLocaleString()}`;
              break;
            }
          }
          inNightShiftSequence = false; lastNightShiftEnd = null;
        }
      }
      // Check if schedule ends with a night shift sequence
      if (inNightShiftSequence && lastNightShiftEnd && !violationFound) {
        const nextShiftInSchedule = sortedShifts.find(s => new Date(s.start) > lastNightShiftEnd!);
        if (!nextShiftInSchedule) { // No more shifts in the schedule
            details = `Schedule ends with a night shift sequence. Ensure 46h rest follows. Last night shift ended: ${lastNightShiftEnd.toLocaleString()}`;
        }
      }
      return {
        isViolated: violationFound, userValue: violationFound ? "Violated" : "OK/Not Applicable", limitValue: 46,
        difference: violationFound ? "Less than 46h rest" : "N/A", details,
      };
    }
  },
  {
    id: 'minRestBetweenShifts',
    name: 'Minimum Rest Between Shifts',
    description: 'Normally 11 hours continuous rest between rostered shifts.',
    pdfReference: 'Schedule 3, Para 19',
    category: CATEGORIES.REST,
    check: (shifts: ProcessedShift[]) => {
        if (!shifts || shifts.length < 2) return { isViolated: false, userValue: 'N/A', limitValue: 11, difference: 'N/A', details: 'Need at least 2 shifts.' };
        const sortedShifts = [...shifts].sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
        let minRest = Infinity; let violationDetail = "All rest periods meet 11h minimum.";
        for (let i = 0; i < sortedShifts.length - 1; i++) {
            const rest = (new Date(sortedShifts[i+1].start).getTime() - new Date(sortedShifts[i].end).getTime()) / (1000 * 60 * 60);
            if (rest < 0) continue; // Skip overlapping shifts for this check.
            if (rest < minRest) minRest = rest;
            if (rest < 11) {
                 violationDetail = `Found rest period of ${rest.toFixed(2)}h between shift ending ${new Date(sortedShifts[i].end).toLocaleString()} and shift starting ${new Date(sortedShifts[i+1].start).toLocaleString()}. Limit: 11 hrs.`;
                 minRest = rest; break;
            }
        }
        const isViolated = minRest < 11;
        return {
            isViolated, userValue: isViolated ? parseFloat(minRest.toFixed(2)) : (minRest === Infinity ? 'N/A' : parseFloat(minRest.toFixed(2))),
            limitValue: 11, difference: isViolated ? `${parseFloat((11 - minRest).toFixed(2))} hours short` : 'Met',
            details: isViolated ? violationDetail : `Shortest rest period: ${minRest === Infinity ? 'N/A (or only one shift)' : minRest.toFixed(2)} hrs. Limit: 11 hrs.`,
        };
    },
  },
  {
    id: 'weekendFrequency',
    name: 'Weekend Work Frequency',
    description: 'Work no more than 1 in 3 weekends (max 1 in 2).',
    pdfReference: 'Schedule 3, Para 16 & 18',
    category: CATEGORIES.WEEKEND_WORK,
    check: (shifts: ProcessedShift[], scheduleWeeks: number) => {
        if (!shifts || !shifts.length || !scheduleWeeks || scheduleWeeks < 1) return { isViolated: false, userValue: 'N/A', limitValue: '1 in 3 (max 1 in 2)', difference: 'N/A', details: 'Not enough data.' };
        
        const weekendsWorked = new Set<string>();
        shifts.forEach(shift => {
            if (isWeekendShift(shift)) {
                const shiftStartDate = new Date(shift.start);
                const dayOfWeek = shiftStartDate.getDay();
                const saturdayDate = new Date(shiftStartDate);
                saturdayDate.setDate(shiftStartDate.getDate() - dayOfWeek + (dayOfWeek === 0 ? -1 : 6));
                saturdayDate.setHours(0,0,0,0);
                weekendsWorked.add(saturdayDate.toISOString().split('T')[0]);
            }
        });
        
        const numWeekendsWorked = weekendsWorked.size;
        const totalWeekendsInSchedule = scheduleWeeks;
        
        let frequencyText = 'N/A';
        if (numWeekendsWorked > 0 && totalWeekendsInSchedule > 0) {
          frequencyText = `1 in ${(totalWeekendsInSchedule / numWeekendsWorked).toFixed(1)}`;
        } else if (numWeekendsWorked === 0) {
          frequencyText = '0 weekends worked';
        }

        const violates1in3Guideline = numWeekendsWorked > 0 && totalWeekendsInSchedule > 0 ? (totalWeekendsInSchedule / numWeekendsWorked) < 3 : false;
        const violates1in2AbsoluteMax = numWeekendsWorked > 0 && totalWeekendsInSchedule > 0 ? (totalWeekendsInSchedule / numWeekendsWorked) < 2 : false;
        
        const isActuallyViolated = violates1in3Guideline; // Flag violation if 1-in-3 guideline is breached.
        let violationSummary = '';

        if (violates1in2AbsoluteMax) {
            violationSummary = 'Exceeds 1 in 2 limit (absolute max).';
        } else if (violates1in3Guideline) {
            violationSummary = 'Exceeds 1 in 3 guidance.';
        }
        
        const details = `Worked ${numWeekendsWorked} weekends in ${totalWeekendsInSchedule} weeks (${frequencyText}).`;
        
        return {
            isViolated: isActuallyViolated,
            userValue: frequencyText, 
            limitValue: '1 in 3 (max 1 in 2)',
            difference: violationSummary || 'Met', 
            details,
        };
    },
  },
  {
    id: 'breakEntitlementSingle',
    name: 'Break Entitlement (Single)',
    description: 'Shifts >5h and <=9h are entitled to one 30-min paid break.',
    pdfReference: 'Schedule 3, Para 21',
    category: CATEGORIES.BREAK_ENTITLEMENTS,
    check: (shifts: ProcessedShift[]) => {
        if (!shifts) return { isViolated: false, userValue: "N/A", details: "No shifts to check."};
        const relevantShifts = shifts.filter(s => {
            const duration = calculateDurationInHours(s.start, s.end);
            return duration > 5 && duration <= 9;
        });
        return {
            isViolated: false, // Informational
            userValue: relevantShifts.length > 0 ? `${relevantShifts.length} shifts` : "None",
            limitValue: "1x 30min/shift",
            difference: "Entitlement Info",
            details: relevantShifts.length > 0
                ? `${relevantShifts.length} shift(s) found of this length, entitling to one 30-min break each.`
                : "No shifts of 5-9 hours found."
        };
    }
  },
  {
    id: 'breakEntitlementDouble',
    name: 'Break Entitlement (Double)',
    description: 'Shifts >9h are entitled to two 30-min paid breaks (total 60 mins).',
    pdfReference: 'Schedule 3, Para 22',
    category: CATEGORIES.BREAK_ENTITLEMENTS,
    check: (shifts: ProcessedShift[]) => {
        if (!shifts) return { isViolated: false, userValue: "N/A", details: "No shifts to check."};
        const relevantShifts = shifts.filter(s => calculateDurationInHours(s.start, s.end) > 9);
        return {
            isViolated: false, // Informational
            userValue: relevantShifts.length > 0 ? `${relevantShifts.length} shifts` : "None",
            limitValue: "2x 30min/shift",
            difference: "Entitlement Info",
            details: relevantShifts.length > 0
                ? `${relevantShifts.length} shift(s) found >9 hours long, entitling to two 30-min breaks each.`
                : "No shifts found >9 hours long."
        };
    }
  },
  {
    id: 'breakEntitlementNightShift',
    name: 'Break Entitlement (Night Shift >=12h)',
    description: 'TCS Night shifts (as per Sch 2, Para 17) rostered for >=12h are entitled to a third 30-min paid break (total 90 mins).',
    pdfReference: 'Schedule 3, Para 23 & Sch 2, Para 17',
    category: CATEGORIES.BREAK_ENTITLEMENTS,
    check: (shifts: ProcessedShift[]) => {
        if (!shifts) return { isViolated: false, userValue: "N/A", details: "No shifts to check."};
        const relevantShifts = shifts.filter(s => {
            const duration = calculateDurationInHours(s.start, s.end);
            return duration >= 12 && isTCSNightShift(s.start, s.end);
        });
        return {
            isViolated: false, // Informational
            userValue: relevantShifts.length > 0 ? `${relevantShifts.length} shifts` : "None",
            limitValue: "3x 30min/shift",
            difference: "Entitlement Info",
            details: relevantShifts.length > 0
                ? `${relevantShifts.length} TCS Night Shift(s) >=12 hours found, entitling to three 30-min breaks each.`
                : "No TCS Night Shifts >=12 hours found."
        };
    }
  },
];


// Schema for RotaInput validation (simplified, as full validation is complex)
const rotaInputSchema = z.object({
  scheduleMeta: z.object({
    wtrOptOut: z.boolean(),
    scheduleTotalWeeks: z.number().min(1).max(52),
    scheduleStartDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    annualLeaveEntitlement: z.number().min(0),
    hoursInNormalDay: z.number().min(0).max(24),
  }),
  shiftDefinitions: z.array(z.object({
    id: z.string(),
    dutyCode: z.string().min(1),
    name: z.string().min(1),
    type: z.enum(['normal', 'on-call']),
    startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
    finishTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$|^24:00$/),
    durationStr: z.string(),
  })).min(1),
  rotaGrid: z.record(z.string()), // week_X_day_Y: dutyCode
});


export async function processRota(data: RotaInput): Promise<ProcessedRotaResult | { error: string; fieldErrors?: z.ZodIssue[]; }> {
  const validation = rotaInputSchema.safeParse(data);
  if (!validation.success) {
    return {
      error: 'Invalid input. Please check the fields.',
      fieldErrors: validation.error.errors,
    };
  }

  const { scheduleMeta, shiftDefinitions, rotaGrid } = validation.data;

  // 1. Process Rota Grid into a flat list of ProcessedShift objects
  const processedShifts: ProcessedShift[] = [];
  const scheduleStartDateObj = new Date(scheduleMeta.scheduleStartDate);
  if (isNaN(scheduleStartDateObj.getTime())) {
      return { error: "Invalid Rota Start Date." };
  }

  const defMap = shiftDefinitions.reduce((acc, def) => {
      if(def.dutyCode) acc[def.dutyCode] = def;
      return acc;
  }, {} as Record<string, ShiftDefinition>);

  for (let w = 0; w < scheduleMeta.scheduleTotalWeeks; w++) {
      for (let d = 0; d < 7; d++) { // Mon to Sun (0 to 6 if getDay() is used, assuming d is 0-indexed for day of week)
          const dutyCode = rotaGrid[`week_${w}_day_${d}`];
          if (dutyCode && defMap[dutyCode]) {
              const def = defMap[dutyCode];
              const shiftDate = new Date(scheduleStartDateObj);
              shiftDate.setDate(scheduleStartDateObj.getDate() + w * 7 + d);

              const [startHour, startMinute] = def.startTime.split(':').map(Number);
              
              const startDateTime = new Date(shiftDate);
              startDateTime.setHours(startHour, startMinute, 0, 0);
              
              const endDateTime = new Date(shiftDate);
              if (def.finishTime === "24:00") {
                  endDateTime.setDate(endDateTime.getDate() + 1);
                  endDateTime.setHours(0,0,0,0);
              } else {
                  const [finishHour, finishMinute] = def.finishTime.split(':').map(Number);
                  endDateTime.setHours(finishHour, finishMinute, 0, 0);
                  if (endDateTime.getTime() <= startDateTime.getTime()) {
                      endDateTime.setDate(endDateTime.getDate() + 1);
                  }
              }
              
              processedShifts.push({
                  id: crypto.randomUUID(),
                  title: `${def.name} (${def.dutyCode})`,
                  start: startDateTime,
                  end: endDateTime,
                  type: def.type,
                  resource: { dutyCode: def.dutyCode }
              });
          }
      }
  }
  
  // 2. Run Compliance Checks
  const complianceResultDetails: ComplianceResultDetail[] = WORKING_LIMITS.map(limitRule => {
    const checkResult = limitRule.check(
        processedShifts,
        scheduleMeta.scheduleTotalWeeks,
        scheduleMeta.wtrOptOut,
        scheduleMeta.annualLeaveEntitlement,
        scheduleMeta.hoursInNormalDay
    );
    return {
        ...checkResult,
        id: limitRule.id,
        name: limitRule.name,
        description: limitRule.description,
        pdfReference: limitRule.pdfReference,
        category: limitRule.category
    };
  });

  const overallSummary = complianceResultDetails.some(cr => cr.isViolated) ? "Review Needed" : "Compliant";

  // Calculate total hours (example, can be refined)
  const totalHoursWorked = processedShifts.reduce((sum, shift) => sum + calculateDurationInHours(shift.start, shift.end), 0);

  return {
    totalHours: parseFloat(totalHoursWorked.toFixed(2)),
    totalBreakHours: 0, // Placeholder, break logic is part of compliance checks not direct sum
    payableHours: parseFloat(totalHoursWorked.toFixed(2)), // Placeholder
    complianceSummary: overallSummary,
    complianceMessages: complianceResultDetails,
    estimatedSalary: 0, // Placeholder
  };
}

