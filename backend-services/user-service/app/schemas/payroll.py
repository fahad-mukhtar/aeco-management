from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, Field


class SalaryPaymentCreate(BaseModel):
    month: Optional[str] = Field(default=None, pattern=r"^\d{4}-\d{2}$")
    paid_amount: Optional[Decimal] = Field(default=None, ge=0)
    additional_advance: Decimal = Field(default=Decimal("0"), ge=0)
    note: Optional[str] = Field(default=None, max_length=512)


class SalaryPaymentResponse(BaseModel):
    id: int
    employee_id: int
    month: str
    period_start: date
    period_end: date
    present_days: int
    full_days: int
    half_days: int
    paid_leave_days: int
    unpaid_leave_days: int
    penalty_fridays: int
    overtime_full_days: int
    overtime_total_minutes: int
    overtime_total_hours: Decimal
    total_worked_minutes: int
    total_worked_hours: Decimal
    monthly_salary: Decimal
    per_day_salary: Decimal
    total_advances: Decimal
    initial_advance: Decimal
    total_month_advances: Decimal
    penalty_deduction_amount: Decimal
    overtime_credit_amount: Decimal
    net_payable: Decimal
    paid_amount: Decimal
    additional_advance: Decimal
    advance_reduction_amount: Decimal
    initial_advance_after: Decimal
    carry_forward_advance: Decimal
    pending_advance_after: Decimal
    status: str
    note: Optional[str]
    paid_on: datetime
    created_at: datetime

    class Config:
        from_attributes = True


class PaginatedSalaryPayments(BaseModel):
    items: list[SalaryPaymentResponse]
    total: int
    page: int
    page_size: int
    pages: int
