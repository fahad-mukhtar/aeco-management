from calendar import monthrange
from datetime import date
from math import ceil
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_active_user, get_current_super_admin
from app.db import (
    LeaveRecord,
    LeaveType,
    count_leave_records,
    create_leave_record,
    get_db,
    get_employee,
    list_leave_records,
)
from app.schemas import LeaveCreate, LeaveResponse, PaginatedLeaveResponse

router = APIRouter()


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
    "/",
    response_model=LeaveResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Record a leave entry",
)
def create_leave(
    payload: LeaveCreate,
    db: Session = Depends(get_db),
    _super_admin=Depends(get_current_super_admin),
):
    employee = get_employee(db, payload.employee_id)
    if not employee:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found")
    if payload.end_date < payload.start_date:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="End date must be >= start date")

    leave = create_leave_record(
        db,
        employee_id=employee.id,
        start_date=payload.start_date,
        end_date=payload.end_date,
        leave_type=LeaveType(payload.leave_type),
        reason=payload.reason,
    )
    return leave


@router.get(
    "/",
    response_model=list[LeaveResponse],
    summary="List leave records",
)
def list_leaves(
    db: Session = Depends(get_db),
    _current_user=Depends(get_current_active_user),
    employee_id: Optional[int] = Query(default=None),
    start_date: Optional[date] = Query(default=None),
    end_date: Optional[date] = Query(default=None),
):
    return list_leave_records(
        db,
        employee_id=employee_id,
        start_date=start_date,
        end_date=end_date,
    )


@router.get(
    "/by-employee/{employee_id}",
    response_model=PaginatedLeaveResponse,
    summary="Paginated leave records for an employee",
)
def leaves_by_employee(
    employee_id: int,
    *,
    db: Session = Depends(get_db),
    _current_user=Depends(get_current_active_user),
    month: Optional[str] = Query(default=None),
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
):
    start_date, end_date = _get_month_range(month)
    total = count_leave_records(
        db,
        employee_id=employee_id,
        start_date=start_date,
        end_date=end_date,
    )
    pages = max(ceil(total / page_size), 1) if total else 1
    current_page = min(page, pages) if total else 1
    skip = (current_page - 1) * page_size
    items = list_leave_records(
        db,
        employee_id=employee_id,
        start_date=start_date,
        end_date=end_date,
        skip=skip,
        limit=page_size,
    )
    return PaginatedLeaveResponse(
        items=items,
        total=total,
        page=current_page,
        page_size=page_size,
        pages=pages,
    )
