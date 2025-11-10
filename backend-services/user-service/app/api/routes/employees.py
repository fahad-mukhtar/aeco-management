from calendar import monthrange
from datetime import date
from decimal import Decimal
from math import ceil

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_active_user, get_current_super_admin
from app.db import (
    attendance_day_type_counts,
    count_attendance_records,
    count_employees,
    create_employee,
    get_db,
    get_employee,
    list_employees,
    sum_attendance_minutes,
    sum_daily_advances,
    update_employee,
)
from app.schemas import (
    EmployeeCreate,
    EmployeeMonthlySummary,
    EmployeeResponse,
    EmployeeUpdate,
    PaginatedEmployees,
)

router = APIRouter()


def _calculate_per_day_salary(monthly_salary: Decimal, reference_date: date | None) -> Decimal:
    reference = reference_date or date.today()
    days_in_month = monthrange(reference.year, reference.month)[1] or 1
    return (monthly_salary / Decimal(days_in_month)).quantize(Decimal("0.01"))


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


@router.get(
    "/",
    response_model=PaginatedEmployees,
    summary="List employees (paginated)",
)
def list_employee_records(
    *,
    db: Session = Depends(get_db),
    _current_user=Depends(get_current_active_user),
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
):
    total = count_employees(db)
    pages = max(ceil(total / page_size), 1)
    current_page = min(page, pages) if total else 1
    skip = (current_page - 1) * page_size
    items = list_employees(db, skip=skip, limit=page_size)
    return PaginatedEmployees(
        items=items,
        total=total,
        page=current_page,
        page_size=page_size,
        pages=pages,
    )


@router.post(
    "/",
    response_model=EmployeeResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new employee record",
)
def create_employee_record(
    payload: EmployeeCreate,
    db: Session = Depends(get_db),
    _super_admin=Depends(get_current_super_admin),
):
    data = payload.model_dump()
    data["name"] = data["name"].strip()
    data["designation"] = data["designation"].strip()
    monthly_salary: Decimal = data["monthly_salary"]
    joining_date = data.get("joining_date")
    data["per_day_salary"] = _calculate_per_day_salary(monthly_salary, joining_date)

    employee = create_employee(db, **data)
    return employee


@router.get(
    "/{employee_id}",
    response_model=EmployeeResponse,
    summary="Retrieve a single employee",
)
def get_employee_record(
    employee_id: int,
    db: Session = Depends(get_db),
    _current_user=Depends(get_current_active_user),
):
    employee = get_employee(db, employee_id)
    if not employee:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found")
    return employee


@router.get(
    "/{employee_id}/summary",
    response_model=EmployeeMonthlySummary,
    summary="Monthly summary for an employee",
)
def employee_month_summary(
    employee_id: int,
    *,
    db: Session = Depends(get_db),
    _current_user=Depends(get_current_active_user),
    month: Optional[str] = Query(default=None),
):
    employee = get_employee(db, employee_id)
    if not employee:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found")
    start_date, end_date = _get_month_range(month)
    day_counts = attendance_day_type_counts(
        db,
        employee_id=employee_id,
        start_date=start_date,
        end_date=end_date,
    )
    full_days = day_counts.get("full", 0)
    half_days = day_counts.get("half", 0)
    present_days = full_days + half_days
    total_minutes = sum_attendance_minutes(
        db,
        employee_id=employee_id,
        start_date=start_date,
        end_date=end_date,
    )
    total_advances = sum_daily_advances(
        db,
        employee_id=employee_id,
        start_date=start_date,
        end_date=end_date,
    )
    net_payable = (employee.monthly_salary or Decimal("0")) - total_advances
    return EmployeeMonthlySummary(
        employee=employee,
        month=(month or start_date.strftime("%Y-%m")),
        start_date=start_date,
        end_date=end_date,
        present_days=present_days,
        full_days=full_days,
        half_days=half_days,
        total_worked_minutes=total_minutes,
        total_worked_hours=round(total_minutes / 60, 2),
        total_advances=total_advances,
        monthly_salary=employee.monthly_salary,
        net_payable=net_payable,
    )


@router.put(
    "/{employee_id}",
    response_model=EmployeeResponse,
    summary="Update an employee record",
)
def update_employee_record(
    employee_id: int,
    payload: EmployeeUpdate,
    db: Session = Depends(get_db),
    _super_admin=Depends(get_current_super_admin),
):
    employee = get_employee(db, employee_id)
    if not employee:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found")
    data = payload.model_dump(exclude_unset=True)
    if "name" in data and data["name"] is not None:
        data["name"] = data["name"].strip()
    if "designation" in data and data["designation"] is not None:
        data["designation"] = data["designation"].strip()

    if "monthly_salary" in data or "joining_date" in data:
        monthly_value = data.get("monthly_salary", employee.monthly_salary)
        joining_value = data.get("joining_date", employee.joining_date)
        if monthly_value is not None:
            data["per_day_salary"] = _calculate_per_day_salary(Decimal(monthly_value), joining_value)

    employee = update_employee(db, employee, data)
    return employee
