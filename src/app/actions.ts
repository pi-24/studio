"use server";

import type { RotaInput, ProcessedRotaResult, ComplianceMessage, ShiftData } from '@/types';
import { z } from 'zod';
// Actual AI flow import would be:
// import { checkRotaComplianceFlow } from '@/ai/flows'; // Adjust path as needed

// Schema for individual shift validation
const shiftSchema = z.object({
  id: z.string(), // Not strictly validated for content, used as key
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Invalid start time (HH:MM)'),
  endTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Invalid end time (HH:MM)'),
  breakMinutes: z.number().min(0).max(1440), // Max 24 hours break in minutes
});

// Schema for the whole rota input
const rotaSchema = z.object({
  shifts: z.array(shiftSchema).min(1, 'At least one shift is required.'),
});

// Helper to calculate duration of a single shift in minutes, accounting for midnight crossing
function calculateShiftDurationInMinutes(dateStr: string, startTimeStr: string, endTimeStr: string): number {
  const startDate = new Date(dateStr);

  const [startHours, startMinutes] = startTimeStr.split(':').map(Number);
  const [endHours, endMinutes] = endTimeStr.split(':').map(Number);

  const startDateTime = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate(), startHours, startMinutes);
  let endDateTime = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate(), endHours, endMinutes);

  if (endDateTime.getTime() <= startDateTime.getTime()) {
    // Shift crosses midnight
    endDateTime.setDate(endDateTime.getDate() + 1);
  }

  const durationMs = endDateTime.getTime() - startDateTime.getTime();
  return durationMs / (1000 * 60); // Convert milliseconds to minutes
}

export async function processRota(data: RotaInput): Promise<ProcessedRotaResult | { error: string; fieldErrors?: z.ZodIssue[]; }> {
  const validation = rotaSchema.safeParse(data);
  if (!validation.success) {
    return { 
      error: 'Invalid input. Please check the fields.',
      fieldErrors: validation.error.errors,
    };
  }

  const validatedShifts = validation.data.shifts;
  let totalWorkMinutes = 0;
  let totalBreakMinutesInput = 0;

  for (const shift of validatedShifts) {
    const shiftDurationMinutes = calculateShiftDurationInMinutes(shift.date, shift.startTime, shift.endTime);
    
    if (shiftDurationMinutes < 0) {
        // This case should ideally not happen if date/time inputs are sane
        // Or could indicate an issue with date parsing / logic
        return { error: `Error calculating duration for shift on ${shift.date}. End time might be before start time incorrectly.` };
    }

    const workMinutesInShift = shiftDurationMinutes - shift.breakMinutes;
    if (workMinutesInShift > 0) {
      totalWorkMinutes += workMinutesInShift;
    }
    totalBreakMinutesInput += shift.breakMinutes;
  }

  const totalHours = parseFloat((totalWorkMinutes / 60).toFixed(2));
  const totalBreakHours = parseFloat((totalBreakMinutesInput / 60).toFixed(2));

  // --- AI Compliance Check (Mocked) ---
  // In a real scenario, you'd map `validatedShifts` to the AI flow's expected input format
  // and call: const aiResponse = await checkRotaComplianceFlow(aiInput);
  // Then, parse `aiResponse` into `complianceMessages`.

  const complianceMessages: ComplianceMessage[] = [];
  let isCompliantOverall = true;

  // Example Mocked AI-like Rules:
  if (totalHours > 48) {
    complianceMessages.push({ type: 'warning', text: 'Average weekly hours may exceed the 48-hour limit under the Working Time Regulations. Ensure this is within a valid reference period and individual agreement.' });
    isCompliantOverall = false;
  }

  for (const shift of validatedShifts) {
    const shiftDuration = calculateShiftDurationInMinutes(shift.date, shift.startTime, shift.endTime);
    if (shiftDuration > 12 * 60 && shift.breakMinutes < 60) {
      complianceMessages.push({ type: 'warning', text: `Shift on ${shift.date} (${shift.startTime}-${shift.endTime}) is longer than 12 hours but has less than 60 minutes break. Consider increasing break time.` });
      isCompliantOverall = false;
    }
    if (shiftDuration > 6 * 60 && shift.breakMinutes < 30) {
        complianceMessages.push({ type: 'warning', text: `Shift on ${shift.date} (${shift.startTime}-${shift.endTime}) is longer than 6 hours but has less than 30 minutes break. Standard is 20 mins for >6h, but NHS may vary.` });
        isCompliantOverall = false;
    }
  }

  // Add a general compliance message if no specific issues found by mock rules
  if (complianceMessages.length === 0) {
    complianceMessages.push({ type: 'success', text: 'Rota appears compliant based on basic checks. For full compliance, refer to specific NHS contract and WTR.' });
  } else {
     complianceMessages.unshift({ type: isCompliantOverall ? 'success' : 'info', text: 'Compliance check complete. Review messages below.' });
  }
  
  const complianceSummary = isCompliantOverall && complianceMessages.some(cm => cm.type === 'success') ? "Compliant" : (complianceMessages.some(cm => cm.type === 'warning' || cm.type === 'error') ? "Review Needed" : "Information");


  // --- Salary Estimation (Mocked) ---
  // This is highly simplified. Real salary calculation is complex.
  const hourlyRate = 25; // Example: £25/hour
  const estimatedSalary = parseFloat((totalHours * hourlyRate).toFixed(2));

  return {
    totalHours,
    totalBreakHours,
    payableHours: totalHours, // Assuming all worked hours are payable for this mock
    complianceSummary,
    complianceMessages,
    estimatedSalary,
  };
}
