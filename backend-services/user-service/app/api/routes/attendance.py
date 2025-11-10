from calendar import monthrange
from datetime import date, datetime, time, timezone
from decimal import Decimal
from math import ceil
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_active_user, get_current_super_admin
from app.db import (
    AttendanceRecord,
    DailyAdvance,
    count_attendance_records,
    count_daily_advances,
    create_attendance_entry,
    create_daily_advance,
    delete_attendance,
    get_attendance_by_date,
    get_db,
    get_employee,
    list_attendance_records,
    list_daily_advances,
    update_attendance_entry,
    update_attendance_manual,
)
from app.schemas import (
    AttendanceClockInRequest,
    AttendanceClockOutRequest,
    AttendanceRecordResponse,
    AttendanceUpdateRequest,
    DailyAdvanceCreate,
    DailyAdvanceResponse,
    PaginatedAttendance,
    PaginatedDailyAdvanceResponse,
)

router = APIRouter()

WORK_DAY_START = time(8, 0)
WORK_DAY_END = time(17, 0)
BREAK_START = time(13, 0)
BREAK_END = time(14, 0)


def _ensure_utc(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _get_timestamp(ts: Optional[datetime]) -> datetime:
    return _ensure_utc(ts) if ts else datetime.now(timezone.utc)


def _calculate_worked_minutes(clock_in: datetime, clock_out: datetime) -> int:
    clock_in = _ensure_utc(clock_in)
    clock_out = _ensure_utc(clock_out)
    if clock_out <= clock_in:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Clock out must be after clock in")

    total_minutes = int((clock_out - clock_in).total_seconds() // 60)

    break_start_dt = datetime.combine(clock_in.date(), BREAK_START, tzinfo=timezone.utc)
    break_end_dt = datetime.combine(clock_in.date(), BREAK_END, tzinfo=timezone.utc)
    overlap_start = max(clock_in, break_start_dt)
    overlap_end = min(clock_out, break_end_dt)
    break_minutes = int(max((overlap_end - overlap_start).total_seconds() // 60, 0))

    worked_minutes = max(total_minutes - break_minutes, 0)
    return worked_minutes


def _determine_day_type(clock_out: datetime) -> str:
    clock_out = _ensure_utc(clock_out)
    return "full" if clock_out.time() >= BREAK_START else "half"


def _get_month_range(month_str: Optional[str]) -> tuple[date, date]:
    if month_str:
        try:
            year, month = map(int, month_str.split("-"))
            start = date(year, month, 1)
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid month format") from exc
    else:
        today = date.today()
        start = date(today.year, today.month, 1)
    last_day = monthrange(start.year, start.month)[1]
    end = date(start.year, start.month, last_day)
    return start, end


@router.post(
    "/attendance/clock-in",
    response_model=AttendanceRecordResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Clock in an employee for the day",
)
def clock_in_employee(
    payload: AttendanceClockInRequest,
    db: Session = Depends(get_db),
    _super_admin=Depends(get_current_super_admin),
):
    employee = get_employee(db, payload.employee_id)
    if not employee:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found")

    timestamp = _get_timestamp(payload.timestamp)
    work_day = timestamp.date()
    existing = get_attendance_by_date(db, employee.id, work_day)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Attendance already recorded for this day",
        )
    record = create_attendance_entry(db, employee_id=employee.id, work_date=work_day, clock_in=timestamp)
    return record


@router.post(
    "/attendance/clock-out",
    response_model=AttendanceRecordResponse,
    summary="Clock out an employee for the day",
)
def clock_out_employee(
    payload: AttendanceClockOutRequest,
    db: Session = Depends(get_db),
    _super_admin=Depends(get_current_super_admin),
):
    employee = get_employee(db, payload.employee_id)
    if not employee:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found")

    timestamp = _get_timestamp(payload.timestamp)
    work_day = timestamp.date()
    record = get_attendance_by_date(db, employee.id, work_day)
    if not record:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Employee has not clocked in for this day",
        )
    if record.clock_out:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Employee already clocked out")

    worked_minutes = _calculate_worked_minutes(record.clock_in, timestamp)
    day_type = _determine_day_type(timestamp)
    record = update_attendance_entry(
        db,
        record,
        clock_out=timestamp,
        worked_minutes=worked_minutes,
        day_type=day_type,
    )
    return record


@router.get(
    "/attendance",
    response_model=list[AttendanceRecordResponse],
    summary="List attendance records",
)
def list_attendance(
    db: Session = Depends(get_db),
    _current_user=Depends(get_current_active_user),
    employee_id: Optional[int] = Query(default=None),
    start_date: Optional[date] = Query(default=None),
    end_date: Optional[date] = Query(default=None),
):
    records = list_attendance_records(
        db,
        employee_id=employee_id,
        start_date=start_date,
        end_date=end_date,
    )
    return records


@router.patch(
    "/attendance/{record_id}",
    response_model=AttendanceRecordResponse,
    summary="Update an attendance record",
)
def update_attendance(
    record_id: int,
    payload: AttendanceUpdateRequest,
    db: Session = Depends(get_db),
    _super_admin=Depends(get_current_super_admin),
):
    record = db.get(AttendanceRecord, record_id)
    if not record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Attendance record not found")

    new_clock_in = payload.clock_in or record.clock_in
    new_clock_out = payload.clock_out or record.clock_out

    worked_minutes = record.worked_minutes
    day_type = record.day_type

    if new_clock_out:
        worked_minutes = _calculate_worked_minutes(new_clock_in, new_clock_out)
        day_type = _determine_day_type(new_clock_out)
    else:
        day_type = "pending"

    updated = update_attendance_manual(
        db,
        record,
        clock_in=payload.clock_in,
        clock_out=payload.clock_out,
        worked_minutes=worked_minutes,
        day_type=day_type,
    )
    return updated


@router.delete(
    "/attendance/{record_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete an attendance record",
)
def delete_attendance_record(
    record_id: int,
    db: Session = Depends(get_db),
    _super_admin=Depends(get_current_super_admin),
) -> None:
    record = db.get(AttendanceRecord, record_id)
    if not record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Attendance record not found")
    delete_attendance(db, record)


@router.get(
    "/attendance/by-employee/{employee_id}",
    response_model=PaginatedAttendance,
    summary="Paginated attendance records for an employee",
)
def attendance_by_employee(
    employee_id: int,
    *,
    db: Session = Depends(get_db),
    _current_user=Depends(get_current_active_user),
    month: Optional[str] = Query(default=None),
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
):
    start_date, end_date = _get_month_range(month)
    total = count_attendance_records(
        db,
        employee_id=employee_id,
        start_date=start_date,
        end_date=end_date,
    )
    pages = max(ceil(total / page_size), 1) if total else 1
    current_page = min(page, pages) if total else 1
    skip = (current_page - 1) * page_size
    items = list_attendance_records(
        db,
        employee_id=employee_id,
        start_date=start_date,
        end_date=end_date,
        skip=skip,
        limit=page_size,
    )
    return PaginatedAttendance(
        items=items,
        total=total,
        page=current_page,
        page_size=page_size,
        pages=pages,
    )


@router.post(
    "/attendance/advances",
    response_model=DailyAdvanceResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Record a daily advance/allowance",
)
def create_daily_allowance(
    payload: DailyAdvanceCreate,
    db: Session = Depends(get_db),
    _super_admin=Depends(get_current_super_admin),
):
    employee = get_employee(db, payload.employee_id)
    if not employee:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found")

    recorded_for = payload.recorded_for or datetime.utcnow().date()
    advance = create_daily_advance(
        db,
        employee_id=employee.id,
        amount=payload.amount,
        note=payload.note,
        recorded_for=recorded_for,
    )
    return advance


@router.get(
    "/attendance/advances",
    response_model=list[DailyAdvanceResponse],
    summary="List daily advances",
)
def list_daily_allowances(
    db: Session = Depends(get_db),
    _current_user=Depends(get_current_active_user),
    employee_id: Optional[int] = Query(default=None),
    start_date: Optional[date] = Query(default=None),
    end_date: Optional[date] = Query(default=None),
):
    entries = list_daily_advances(
        db,
        employee_id=employee_id,
        start_date=start_date,
        end_date=end_date,
    )
    return entries


@router.get(
    "/attendance/advances/by-employee/{employee_id}",
    response_model=PaginatedDailyAdvanceResponse,
    summary="Paginated daily advances for an employee",
)
def daily_advances_by_employee(
    employee_id: int,
    *,
    db: Session = Depends(get_db),
    _current_user=Depends(get_current_active_user),
    month: Optional[str] = Query(default=None),
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
):
    start_date, end_date = _get_month_range(month)
    total = count_daily_advances(
        db,
        employee_id=employee_id,
        start_date=start_date,
        end_date=end_date,
    )
    pages = max(ceil(total / page_size), 1) if total else 1
    current_page = min(page, pages) if total else 1
    skip = (current_page - 1) * page_size
    items = list_daily_advances(
        db,
        employee_id=employee_id,
        start_date=start_date,
        end_date=end_date,
        skip=skip,
        limit=page_size,
    )
    return PaginatedDailyAdvanceResponse(
        items=items,
        total=total,
        page=current_page,
        page_size=page_size,
        pages=pages,
    )
