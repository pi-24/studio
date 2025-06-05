
export type UserGrade = 'F1' | 'F2' | 'CT1' | 'CT2' | 'CT3+' | 'ST1' | 'ST2' | 'ST3+' | 'SpecialtyDoctor' | 'Consultant' | 'Other';
export type UKRegion = 'London' | 'SouthEast' | 'SouthWest' | 'EastOfEngland' | 'Midlands' | 'NorthEastAndYorkshire' | 'NorthWest' | 'Scotland' | 'Wales' | 'NorthernIreland' | 'Other';

export interface ScheduleMetadata {
  wtrOptOut: boolean;
  scheduleTotalWeeks: number;
  scheduleStartDate: string; // YYYY-MM-DD
  annualLeaveEntitlement: number; // days per year
  hoursInNormalDay: number; // for leave calculation
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

// Represents the user's input for the rota grid
export interface RotaGridInput {
  [weekDayKey: string]: string; // e.g., "week_0_day_0": "S1"
}

export interface UserProfileData {
  grade?: UserGrade;
  region?: UKRegion;
  taxCode?: string;
  hasStudentLoan?: boolean;
  hasPostgraduateLoan?: boolean;
  nhsPensionOptIn?: boolean;
  isProfileComplete: boolean;
  scheduleMeta?: ScheduleMetadata;
  shiftDefinitions?: ShiftDefinition[];
  rotaGrid?: RotaGridInput; // Added rotaGrid
}

export interface User extends UserProfileData {
  id: string;
  email: string;
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
  totalHours: number;
  totalBreakHours: number;
  payableHours: number;
  complianceSummary: string;
  complianceMessages: ComplianceResultDetail[];
  estimatedSalary: number;
}

// For raw shift data (if needed for any direct input, though new form focuses on definitions)
export interface ShiftData {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  breakMinutes: number;
}
