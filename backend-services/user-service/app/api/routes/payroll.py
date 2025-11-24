from calendar import monthrange
from datetime import date, datetime
from decimal import Decimal
from math import ceil
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_super_admin, get_db
from app.db import (
    count_employees,
    count_salary_payments,
    create_salary_payment,
    get_employee,
    get_salary_payment_for_month,
    list_employees,
    list_salary_payments,
    update_employee,
)
from app.schemas import (
    EmployeeMonthlySummary,
    PaginatedEmployeeMonthlySummaries,
    PaginatedSalaryPayments,
    SalaryPaymentCreate,
    SalaryPaymentResponse,
)
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
        month_token = month or start_date.strftime("%Y-%m")
        payload["month"] = month_token
        payment = get_salary_payment_for_month(
            db,
            employee_id=employee.id,
            month=month_token,
        )
        payload["salary_paid"] = bool(payment)
        payload["salary_paid_on"] = payment.paid_on if payment else None
        payload["salary_paid_amount"] = payment.paid_amount if payment else None
        payload["salary_payment_id"] = payment.id if payment else None
        payload["salary_paid_note"] = payment.note if payment else None
        payload["salary_paid_additional_advance"] = payment.additional_advance if payment else None
        payload["salary_paid_advance_reduction"] = payment.advance_reduction_amount if payment else None
        payload["salary_remaining_initial_advance"] = payment.initial_advance_after if payment else None
        payload["salary_pending_advance_after"] = payment.pending_advance_after if payment else None
        if payment:
            payload["pending_advances_balance"] = Decimal(payment.pending_advance_after or 0)
            payload["total_advances"] = payload["initial_advance"] + payload["pending_advances_balance"] + payload["total_month_advances"]
        summaries.append(EmployeeMonthlySummary(**payload))

    return PaginatedEmployeeMonthlySummaries(
        items=summaries,
        total=total,
        page=current_page,
        page_size=page_size,
        pages=pages,
    )


def _validate_month(month_str: Optional[str]) -> str:
    if month_str:
        _get_month_range(month_str)
        return month_str
    today = date.today()
    return f"{today.year}-{today.month:02d}"


@router.post(
    "/payments/{employee_id}",
    response_model=SalaryPaymentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Mark salary as paid for an employee",
)
def create_salary_payment_entry(
    employee_id: int,
    payload: SalaryPaymentCreate,
    *,
    db: Session = Depends(get_db),
    _super_admin=Depends(get_current_super_admin),
):
    employee = get_employee(db, employee_id)
    if not employee:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found")
    month_token = _validate_month(payload.month)
    start_date, end_date = _get_month_range(month_token)

    existing = get_salary_payment_for_month(
        db,
        employee_id=employee_id,
        month=month_token,
    )
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Salary already paid for this month")

    summary = build_employee_month_summary(
        db,
        employee=employee,
        start_date=start_date,
        end_date=end_date,
    )
    additional = Decimal(payload.additional_advance or 0)
    net_payable = Decimal(summary["net_payable"])
    initial_before = Decimal(employee.advance_payment_received or 0)
    paid_amount = net_payable if net_payable > 0 else Decimal("0")
    carry_forward = Decimal("0")
    advance_reduction = Decimal("0")

    if net_payable > 0:
        if payload.paid_amount is not None:
            paid_amount = Decimal(payload.paid_amount)
        if paid_amount < 0 or paid_amount > net_payable:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Paid amount must be between 0 and net payable",
            )
        advance_reduction = net_payable - paid_amount
        if advance_reduction > initial_before:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot retain more than outstanding advance",
            )
    else:
        carry_forward = abs(net_payable)
        paid_amount = Decimal("0")

    new_initial = initial_before - advance_reduction

    pending_after = carry_forward + additional - advance_reduction
    update_employee(
        db,
        employee,
        {
            "advance_pending": pending_after,
        },
    )

    payment = create_salary_payment(
        db,
        employee_id=employee_id,
        month=month_token,
        period_start=start_date,
        period_end=end_date,
        present_days=summary["present_days"],
        full_days=summary["full_days"],
        half_days=summary["half_days"],
        paid_leave_days=summary["paid_leave_days"],
        unpaid_leave_days=summary["unpaid_leave_days"],
        penalty_fridays=summary["penalty_fridays"],
        overtime_full_days=summary["overtime_full_days"],
        overtime_total_minutes=summary["overtime_total_minutes"],
        overtime_total_hours=Decimal(str(summary["overtime_total_hours"])),
        total_worked_minutes=summary["total_worked_minutes"],
        total_worked_hours=Decimal(str(summary["total_worked_hours"])),
        monthly_salary=summary["monthly_salary"],
        per_day_salary=summary["per_day_salary_for_month"],
        total_advances=summary["total_advances"],
        initial_advance=summary["initial_advance"],
        total_month_advances=summary["total_month_advances"],
        penalty_deduction_amount=summary["penalty_deduction_amount"],
        overtime_credit_amount=summary["overtime_credit_amount"],
        net_payable=summary["net_payable"],
        paid_amount=paid_amount,
        additional_advance=additional,
        advance_reduction_amount=advance_reduction,
        initial_advance_after=new_initial,
        carry_forward_advance=carry_forward,
        pending_advance_after=pending_after,
        note=payload.note,
        paid_on=datetime.utcnow(),
    )
    return payment


@router.get(
    "/payments",
    response_model=PaginatedSalaryPayments,
    summary="List salary payments",
)
def list_salary_payment_records(
    *,
    db: Session = Depends(get_db),
    _super_admin=Depends(get_current_super_admin),
    employee_id: Optional[int] = Query(default=None),
    month: Optional[str] = Query(default=None),
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
):
    if month:
        _get_month_range(month)
    total = count_salary_payments(db, employee_id=employee_id, month=month)
    pages = max(ceil(total / page_size), 1) if total else 1
    current_page = min(page, pages) if total else 1
    skip = (current_page - 1) * page_size
    items = list_salary_payments(
        db,
        employee_id=employee_id,
        month=month,
        skip=skip,
        limit=page_size,
    )
    return PaginatedSalaryPayments(
        items=items,
        total=total,
        page=current_page,
        page_size=page_size,
        pages=pages,
    )
