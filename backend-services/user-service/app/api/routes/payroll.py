from calendar import monthrange
from datetime import date
from math import ceil
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_super_admin, get_db
from app.db import count_employees, list_employees
from app.schemas import EmployeeMonthlySummary, PaginatedEmployeeMonthlySummaries
from app.services import build_employee_month_summary

router = APIRouter()


def _get_month_range(month_str: Optional[str]) -> tuple[date, date]:
    if month_str:
        try:
            year, month = map(int, month_str.split("-"))
            start = date(year, month, 1)
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid month format, expected YYYY-MM",
            ) from exc
    else:
        today = date.today()
        start = date(today.year, today.month, 1)
    last_day = monthrange(start.year, start.month)[1]
    end = date(start.year, start.month, last_day)
    return start, end


@router.get(
    "/",
    response_model=PaginatedEmployeeMonthlySummaries,
    summary="Monthly payroll overview",
)
def payroll_overview(
    *,
    db: Session = Depends(get_db),
    _super_admin=Depends(get_current_super_admin),
    month: Optional[str] = Query(default=None),
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
):
    start_date, end_date = _get_month_range(month)
    total = count_employees(db)
    pages = max(ceil(total / page_size), 1)
    current_page = min(page, pages) if total else 1
    skip = (current_page - 1) * page_size
    employees = list_employees(db, skip=skip, limit=page_size)

    summaries: list[EmployeeMonthlySummary] = []
    for employee in employees:
        payload = build_employee_month_summary(
            db,
            employee=employee,
            start_date=start_date,
            end_date=end_date,
        )
        if month:
            payload["month"] = month
        summaries.append(EmployeeMonthlySummary(**payload))

    return PaginatedEmployeeMonthlySummaries(
        items=summaries,
        total=total,
        page=current_page,
        page_size=page_size,
        pages=pages,
    )
