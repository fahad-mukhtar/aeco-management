from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, Field


class AttendanceClockInRequest(BaseModel):
    employee_id: int
    timestamp: Optional[datetime] = Field(default=None, description="Defaults to current UTC time")


class AttendanceClockOutRequest(BaseModel):
    employee_id: int
    timestamp: Optional[datetime] = Field(default=None, description="Defaults to current UTC time")


class AttendanceRecordResponse(BaseModel):
    id: int
    employee_id: int
    work_date: date
    clock_in: datetime
    clock_out: Optional[datetime] = None
    worked_minutes: int
    day_type: str

    class Config:
        from_attributes = True


class DailyAdvanceCreate(BaseModel):
    employee_id: int
    amount: Decimal = Field(..., gt=0)
    note: Optional[str] = Field(default=None, max_length=512)
    recorded_for: Optional[date] = Field(default=None)


class DailyAdvanceResponse(BaseModel):
    id: int
    employee_id: int
    amount: Decimal
    note: Optional[str] = None
    recorded_for: date
    created_at: datetime

    class Config:
        from_attributes = True


class PaginatedAttendance(BaseModel):
    items: list[AttendanceRecordResponse]
    total: int
    page: int
    page_size: int
    pages: int


class PaginatedDailyAdvanceResponse(BaseModel):
    items: list[DailyAdvanceResponse]
    total: int
    page: int
    page_size: int
    pages: int


class AttendanceUpdateRequest(BaseModel):
    clock_in: Optional[datetime] = None
    clock_out: Optional[datetime] = None


class LeaveCreate(BaseModel):
    employee_id: int
    start_date: date
    end_date: date
    leave_type: str = Field(..., pattern="^(paid|unpaid)$")
    reason: Optional[str] = Field(default=None, max_length=512)


class LeaveUpdate(BaseModel):
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    leave_type: Optional[str] = Field(default=None, pattern="^(paid|unpaid)$")
    reason: Optional[str] = Field(default=None, max_length=512)


class LeaveResponse(BaseModel):
    id: int
    employee_id: int
    start_date: date
    end_date: date
    leave_type: str
    reason: Optional[str] = None
    created_at: datetime
    is_penalty: bool = False

    class Config:
        from_attributes = True


class PaginatedLeaveResponse(BaseModel):
    items: list[LeaveResponse]
    total: int
    page: int
    page_size: int
    pages: int
