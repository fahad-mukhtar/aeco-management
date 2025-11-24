export type Employee = {
  id: number;
  employee_code: string;
  name: string;
  designation: string;
  phone_number: string | null;
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
  paid_leave_days: number;
  unpaid_leave_days: number;
  penalty_fridays: number;
  penalty_friday_dates: string[];
  overtime_full_days: number;
  overtime_total_minutes: number;
  overtime_total_hours: number;
  friday_bonus_days: string;
  total_worked_minutes: number;
  total_worked_hours: number;
  total_advances: string;
  initial_advance: string | null;
  total_month_advances: string;
  base_pay_for_period: string;
  pending_advances_balance: string;
  per_day_salary_for_month: string;
  monthly_salary: string;
  net_payable: string;
  penalty_deduction_amount: string;
  overtime_credit_amount: string;
  salary_paid: boolean;
  salary_paid_on: string | null;
  salary_paid_amount: string | null;
  salary_payment_id: number | null;
  salary_paid_note: string | null;
  salary_paid_additional_advance: string | null;
  salary_paid_advance_reduction: string | null;
  salary_remaining_initial_advance: string | null;
  salary_pending_advance_after: string | null;
};

export type LeaveRecord = {
  id: number;
  employee_id: number;
  start_date: string;
  end_date: string;
  leave_type: "paid" | "unpaid";
  reason: string | null;
  created_at: string;
  is_penalty?: boolean;
};

export type PaginatedLeaveRecords = {
  items: LeaveRecord[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
};

export type PaginatedPayroll = {
  items: EmployeeMonthSummary[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
};

export type SalaryPayment = {
  id: number;
  employee_id: number;
  month: string;
  period_start: string;
  period_end: string;
  paid_amount: string;
  additional_advance: string;
  advance_reduction_amount: string;
  initial_advance_after: string;
  carry_forward_advance: string;
  pending_advance_after: string;
  status: string;
  note: string | null;
  paid_on: string;
  created_at: string;
};

export type PaginatedSalaryPayments = {
  items: SalaryPayment[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
};
