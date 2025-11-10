from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, Field


class EmployeeBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    designation: str = Field(..., min_length=1, max_length=255)
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
    total_worked_minutes: int
    total_worked_hours: float
    total_advances: Decimal
    monthly_salary: Decimal
    net_payable: Decimal
