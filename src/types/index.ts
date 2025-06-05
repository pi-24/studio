
export interface User {
  id: string;
  email: string;
  // Add other profile fields if needed, e.g., name, NHS pay band
}

export interface ShiftData {
  id: string; // For react-hook-form field array key
  date: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  breakMinutes: number;
}

export interface RotaInput {
  shifts: ShiftData[];
}

export interface ComplianceMessage {
  type: 'success' | 'warning' | 'error' | 'info';
  text: string;
  icon?: React.ComponentType<{ className?: string }>;
}

export interface ProcessedRotaResult {
  totalHours: number;
  totalBreakHours: number;
  payableHours: number;
  complianceSummary: string; // e.g., "Compliant", "Partially Compliant", "Non-Compliant"
  complianceMessages: ComplianceMessage[];
  estimatedSalary: number; 
}

// For AI interaction (example, might differ based on actual AI flow)
export interface AIShiftInput {
  date: Date;
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  breakDurationMinutes: number;
}

export interface AIComplianceOutput {
  isCompliantOverall: boolean;
  rulesViolated: Array<{ rule: string; details: string; severity: 'warning' | 'error' }>;
  rulesComplied: Array<{ rule: string; details: string }>;
  // Potentially other metrics from AI
}
