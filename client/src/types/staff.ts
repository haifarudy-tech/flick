export interface StaffRecord {
  clockedIn: boolean;
  lastClockIn: string | null;
  lastClockOut: string | null;
  hoursToday: number;
  hourlyRate: number;
}

export interface StaffMember {
  id: string;
  name: string;
  email: string;
  role: 'OWNER' | 'MANAGER' | 'CASHIER' | 'KITCHEN';
  avatarInitials: string;
  isActive: boolean;
  staff: StaffRecord | null;
  todayHours: number;
  todaySales: number;
  todayTips: number;
}

export interface StaffListResponse {
  staff: StaffMember[];
}

export interface ShiftRow {
  id: string;
  clockIn: string;
  clockOut: string | null;
  hoursWorked: number | null;
}

export interface TimesheetEntry {
  userId: string;
  userName: string;
  role: string;
  avatarInitials: string;
  clockedIn: boolean;
  hourlyRate: number;
  totalHours: number;
  labourCost: number;
  todaySales: number;
  todayTips: number;
  shifts: ShiftRow[];
}

export interface TimesheetResponse {
  date: string;
  rows: TimesheetEntry[];
}

export interface RosterEntry {
  id: string;
  name: string;
  role: string;
  avatarInitials: string;
  clockedIn: boolean;
  todayHours: number;
}

export interface RosterResponse {
  businessName: string;
  staff: RosterEntry[];
}
