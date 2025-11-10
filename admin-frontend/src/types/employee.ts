export type Employee = {
  id: number;
  employee_code: string;
  name: string;
  designation: string;
  monthly_salary: string;
  per_day_salary: string | null;
  regular_employee: boolean;
  daily_allowance: string | null;
  advance_payment_received: string | null;
  advance_pending: string | null;
  joining_date: string | null;
  created_at: string;
  updated_at: string;
};

export type PaginatedEmployees = {
  items: Employee[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
};

export type AttendanceRecord = {
  id: number;
  employee_id: number;
  work_date: string;
  clock_in: string;
  clock_out: string | null;
  worked_minutes: number;
  day_type: "pending" | "half" | "full" | string;
};

export type DailyAdvance = {
  id: number;
  employee_id: number;
  amount: string;
  note: string | null;
  recorded_for: string;
  created_at: string;
};

export type PaginatedAttendance = {
  items: AttendanceRecord[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
};

export type PaginatedDailyAdvance = {
  items: DailyAdvance[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
};

export type EmployeeMonthSummary = {
  employee: Employee;
  month: string;
  start_date: string;
  end_date: string;
  present_days: number;
  full_days: number;
  half_days: number;
  total_worked_minutes: number;
  total_worked_hours: number;
  total_advances: string;
  monthly_salary: string;
  net_payable: string;
};

export type LeaveRecord = {
  id: number;
  employee_id: number;
  start_date: string;
  end_date: string;
  leave_type: "paid" | "unpaid";
  reason: string | null;
  created_at: string;
};

export type PaginatedLeaveRecords = {
  items: LeaveRecord[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
};
