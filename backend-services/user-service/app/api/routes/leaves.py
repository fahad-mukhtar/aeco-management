from calendar import monthrange
from datetime import date, datetime, time
from math import ceil
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_active_user, get_current_super_admin
from app.db import (
    LeaveRecord,
    LeaveType,
    create_leave_record,
    create_penalty_override,
    delete_leave_record,
    get_db,
    get_employee,
    get_leave_record,
    list_leave_records,
    update_leave_record,
)
from app.schemas import LeaveCreate, LeaveResponse, LeaveUpdate, PaginatedLeaveResponse
from app.services import build_employee_month_summary

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


@router.put(
    "/{leave_id}",
    response_model=LeaveResponse,
    summary="Update a leave entry",
)
def update_leave(
    leave_id: int,
    payload: LeaveUpdate,
    db: Session = Depends(get_db),
    _super_admin=Depends(get_current_super_admin),
):
    record = get_leave_record(db, leave_id)
    if not record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Leave entry not found")
    start_date = payload.start_date or record.start_date
    end_date = payload.end_date or record.end_date
    if end_date < start_date:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="End date must be >= start date")

    updated = update_leave_record(
        db,
        record,
        start_date=payload.start_date,
        end_date=payload.end_date,
        leave_type=LeaveType(payload.leave_type) if payload.leave_type else None,
        reason=payload.reason,
    )
    return updated


@router.delete(
    "/{leave_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a leave entry",
)
def remove_leave(
    leave_id: int,
    db: Session = Depends(get_db),
    _super_admin=Depends(get_current_super_admin),
) -> None:
    record = get_leave_record(db, leave_id)
    if not record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Leave entry not found")
    delete_leave_record(db, record)


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
    employee = get_employee(db, employee_id)
    if not employee:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found")

    db_items = list_leave_records(
        db,
        employee_id=employee_id,
        start_date=start_date,
        end_date=end_date,
    )
    response_items = [LeaveResponse.model_validate(item, from_attributes=True) for item in db_items]

    summary_payload = build_employee_month_summary(
        db,
        employee=employee,
        start_date=start_date,
        end_date=end_date,
    )
    penalty_dates = summary_payload.get("penalty_friday_dates", [])
    penalty_items = [
        LeaveResponse(
            id=-(idx + 1),
            employee_id=employee_id,
            start_date=penalty_date,
            end_date=penalty_date,
            leave_type=LeaveType.UNPAID.value,
            reason="Penalty Friday (auto-generated)",
            created_at=datetime.combine(penalty_date, time.min),
            is_penalty=True,
        )
        for idx, penalty_date in enumerate(penalty_dates)
    ]

    combined_items = response_items + penalty_items
    combined_items.sort(key=lambda item: (item.start_date, item.created_at), reverse=True)

    total = len(combined_items)
    pages = max(ceil(total / page_size), 1)
    current_page = min(page, pages)
    start_index = (current_page - 1) * page_size
    end_index = start_index + page_size
    paginated_items = combined_items[start_index:end_index]

    return PaginatedLeaveResponse(
        items=paginated_items,
        total=total,
        page=current_page,
        page_size=page_size,
        pages=pages,
    )


@router.delete(
    "/penalties/{employee_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Remove a penalty leave for a specific date",
)
def forgive_penalty_leave(
    employee_id: int,
    *,
    penalty_date: date = Query(..., description="Penalty date (YYYY-MM-DD)"),
    db: Session = Depends(get_db),
    _super_admin=Depends(get_current_super_admin),
) -> None:
    employee = get_employee(db, employee_id)
    if not employee:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found")

    month_token = penalty_date.strftime("%Y-%m")
    start_date, end_date = _get_month_range(month_token)
    summary_payload = build_employee_month_summary(
        db,
        employee=employee,
        start_date=start_date,
        end_date=end_date,
    )
    penalty_dates = {entry for entry in summary_payload.get("penalty_friday_dates", [])}
    if penalty_date not in penalty_dates:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No penalty recorded for this date")

    create_penalty_override(db, employee_id=employee_id, penalty_date=penalty_date)
