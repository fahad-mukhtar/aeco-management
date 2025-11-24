from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, Field


class EmployeeBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    designation: str = Field(..., min_length=1, max_length=255)
    phone_number: Optional[str] = Field(default=None, max_length=32)
    monthly_salary: Decimal = Field(..., ge=0)
    per_day_salary: Optional[Decimal] = Field(default=None, ge=0)
    regular_employee: bool = True
    daily_allowance: Optional[Decimal] = Field(default=None, ge=0)
    advance_payment_received: Optional[Decimal] = Field(default=None)
    advance_pending: Optional[Decimal] = Field(default=None)
    joining_date: Optional[date] = None


class EmployeeCreate(EmployeeBase):
    pass


class EmployeeUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    designation: Optional[str] = Field(default=None, min_length=1, max_length=255)
    phone_number: Optional[str] = Field(default=None, max_length=32)
    monthly_salary: Optional[Decimal] = Field(default=None, ge=0)
    per_day_salary: Optional[Decimal] = Field(default=None, ge=0)
    regular_employee: Optional[bool] = None
    daily_allowance: Optional[Decimal] = Field(default=None, ge=0)
    advance_payment_received: Optional[Decimal] = Field(default=None)
    advance_pending: Optional[Decimal] = Field(default=None)
    joining_date: Optional[date] = None


class EmployeeResponse(EmployeeBase):
    id: int
    employee_code: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class PaginatedEmployees(BaseModel):
    items: list[EmployeeResponse]
    total: int
    page: int
    page_size: int
    pages: int


class EmployeeMonthlySummary(BaseModel):
    employee: EmployeeResponse
    month: str
    start_date: date
    end_date: date
    present_days: int
    full_days: int
    half_days: int
    penalty_fridays: int
    penalty_friday_dates: list[date]
    overtime_full_days: int
    overtime_total_minutes: int
    overtime_total_hours: float
    friday_bonus_days: Decimal
    paid_leave_days: int
    unpaid_leave_days: int
    total_worked_minutes: int
    total_worked_hours: float
    total_advances: Decimal
    initial_advance: Decimal | None
    total_month_advances: Decimal
    base_pay_for_period: Decimal
    pending_advances_balance: Decimal
    monthly_salary: Decimal
    per_day_salary_for_month: Decimal
    net_payable: Decimal
    penalty_deduction_amount: Decimal
    overtime_credit_amount: Decimal
    salary_paid: bool = False
    salary_paid_on: Optional[datetime] = None
    salary_paid_amount: Optional[Decimal] = None
    salary_payment_id: Optional[int] = None
    salary_paid_note: Optional[str] = None
    salary_paid_additional_advance: Optional[Decimal] = None
    salary_paid_advance_reduction: Optional[Decimal] = None
    salary_remaining_initial_advance: Optional[Decimal] = None
    salary_pending_advance_after: Optional[Decimal] = None


class PaginatedEmployeeMonthlySummaries(BaseModel):
    items: list[EmployeeMonthlySummary]
    total: int
    page: int
    page_size: int
    pages: int
