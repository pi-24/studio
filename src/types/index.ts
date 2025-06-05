
export type UserGrade = 'F1' | 'F2' | 'CT1' | 'CT2' | 'CT3+' | 'ST1' | 'ST2' | 'ST3+' | 'SpecialtyDoctor' | 'Consultant' | 'Other';
export type UKRegion = 'London' | 'SouthEast' | 'SouthWest' | 'EastOfEngland' | 'Midlands' | 'NorthEastAndYorkshire' | 'NorthWest' | 'Scotland' | 'Wales' | 'NorthernIreland' | 'Other';

// General schedule metadata, some parts might be per-rota
export interface ScheduleMetadata {
  wtrOptOut: boolean;
  scheduleTotalWeeks: number; // Can be derived from start/end for a specific rota
  scheduleStartDate: string; // YYYY-MM-DD, can be specific rota start
  annualLeaveEntitlement: number; // days per year
  hoursInNormalDay: number; // for leave calculation
}

// Metadata specific to a single Rota document
export interface RotaSpecificScheduleMetadata extends ScheduleMetadata {
  site: string;
  specialty: string;
  endDate: string; // YYYY-MM-DD, specific end date for this rota
  rotaName?: string; // Optional user-defined name for the rota
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

export interface RotaGridInput {
  [weekDayKey: string]: string; // e.g., "week_0_day_0": "S1" (dutyCode) or "" for OFF
}

export interface RotaDocument {
  id: string; // Unique ID for this rota instance
  name: string; // User-defined name for the rota, e.g., "Aug-Oct ST3 Gen Surg"
  scheduleMeta: RotaSpecificScheduleMetadata;
  shiftDefinitions: ShiftDefinition[];
  rotaGrid: RotaGridInput;
  createdAt: string; // ISO date string
}

export interface UserProfileData {
  grade?: UserGrade;
  region?: UKRegion;
  taxCode?: string;
  hasStudentLoan?: boolean;
  hasPostgraduateLoan?: boolean;
  nhsPensionOptIn?: boolean;
  isProfileComplete: boolean; // True after initial "About You" setup
  rotas?: RotaDocument[]; // Array of different rotas the user has uploaded
}

export interface User extends UserProfileData {
  id: string;
  email: string;
}

// Input for processing a single rota document for compliance
export interface RotaProcessingInput {
  scheduleMeta: RotaSpecificScheduleMetadata; // The specific metadata for the rota being checked
  shiftDefinitions: ShiftDefinition[]; // Shifts defined for that rota
  rotaGrid: RotaGridInput; // The grid for that rota
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
