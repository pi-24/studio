
export interface User {
  id: string;
  email: string;
}

export interface ShiftDefinition {
  id: string;
  dutyCode: string;
  name: string;
  type: 'normal' | 'on-call';
  startTime: string; // HH:MM
  finishTime: string; // HH:MM or 24:00
  durationStr: string; // e.g., "8h 0m"
}

export interface ScheduleMetadata {
  wtrOptOut: boolean;
  scheduleTotalWeeks: number;
  scheduleStartDate: string; // YYYY-MM-DD
  annualLeaveEntitlement: number; // days per year
  hoursInNormalDay: number; // for leave calculation
}

// Represents the user's input for the rota grid
export interface RotaGridInput {
  [weekDayKey: string]: string; // e.g., "week_0_day_0": "S1"
}

export interface RotaInput {
  scheduleMeta: ScheduleMetadata;
  shiftDefinitions: ShiftDefinition[];
  rotaGrid: RotaGridInput;
}

// Represents a processed, flattened shift instance for compliance checks
export interface ProcessedShift {
  id: string;
  title: string; // From shift definition name + duty code
  start: Date;
  end: Date;
  type: 'normal' | 'on-call'; // From shift definition
  resource?: { dutyCode: string };
  // Potentially other properties derived from ShiftDefinition
}

export interface ComplianceResultDetail {
  id: string; // Rule ID
  name: string; // Rule name
  description: string;
  pdfReference?: string;
  category: string;
  isViolated: boolean;
  userValue: string | number | null | undefined;
  limitValue: string | number | null | undefined;
  difference: string | number | null | undefined;
  details: string;
}

export interface ProcessedRotaResult {
  totalHours: number; // This might be less relevant with detailed checks, or could be overall scheduled hours
  totalBreakHours: number; // This was a mock, actual break handling needs to be clarified for compliance
  payableHours: number; // Mock
  complianceSummary: string; // e.g., "Compliant", "Review Needed"
  complianceMessages: ComplianceResultDetail[]; // Changed from ComplianceMessage
  estimatedSalary: number; // Mock
  // Potentially add processedShifts if needed by report
  // processedShifts?: ProcessedShift[]; 
}

// For raw shift data (if needed for any direct input, though new form focuses on definitions)
export interface ShiftData {
  id: string;
  date: string; 
  startTime: string;
  endTime: string;
  breakMinutes: number;
}
