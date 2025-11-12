from collections import defaultdict
from calendar import monthrange
from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy.orm import Session

from app.db import (
    Employee,
    LeaveType,
    attendance_day_type_counts,
    list_attendance_records,
    list_leave_records,
    list_penalty_overrides,
    sum_daily_advances,
)

SixHours = 6 * 60


def _calculate_per_day_salary(monthly_salary: Decimal, reference_date: date | None) -> Decimal:
    reference = reference_date or date.today()
    days_in_month = monthrange(reference.year, reference.month)[1] or 1
    return (monthly_salary / Decimal(days_in_month)).quantize(Decimal("0.01"))


def _clamped_day_count(window_start: date, window_end: date, start_date: date, end_date: date) -> int:
    effective_start = max(window_start, start_date)
    effective_end = min(window_end, end_date)
    if effective_end < effective_start:
        return 0
    return (effective_end - effective_start).days + 1


def build_employee_month_summary(
    db: Session,
    *,
    employee: Employee,
    start_date: date,
    end_date: date,
) -> dict:
    day_counts = attendance_day_type_counts(
        db,
        employee_id=employee.id,
        start_date=start_date,
        end_date=end_date,
    )
    full_days = day_counts.get("full", 0)
    half_days = day_counts.get("half", 0)
    present_days = full_days + half_days

    attendance_records = list_attendance_records(
        db,
        employee_id=employee.id,
        start_date=start_date,
        end_date=end_date,
    )
    total_minutes = sum(record.worked_minutes for record in attendance_records)
    total_month_advances = sum_daily_advances(
        db,
        employee_id=employee.id,
        start_date=start_date,
        end_date=end_date,
    )

    overtime_minutes = sum(max(0, record.worked_minutes - 480) for record in attendance_records)
    overtime_full_days = overtime_minutes // SixHours

    leave_records = list_leave_records(
        db,
        employee_id=employee.id,
        start_date=start_date,
        end_date=end_date,
    )

    unpaid_days = set()
    paid_leave_days = 0
    unpaid_leave_days = 0
    for leave in leave_records:
        day_count = _clamped_day_count(leave.start_date, leave.end_date, start_date, end_date)
        if day_count <= 0:
            continue
        if leave.leave_type == LeaveType.PAID:
            paid_leave_days += day_count
        else:
            unpaid_leave_days += day_count
            current_day = max(leave.start_date, start_date)
            last_day = min(leave.end_date, end_date)
            while current_day <= last_day:
                unpaid_days.add(current_day)
                current_day += timedelta(days=1)

    week_unpaid_counts = defaultdict(int)
    for day in unpaid_days:
        year, week, _ = day.isocalendar()
        week_unpaid_counts[(year, week)] += 1

    penalty_friday_dates: list[date] = []
    current_day = start_date
    while current_day <= end_date:
        if current_day.weekday() == 4:  # Friday
            penalty = False
            saturday = current_day + timedelta(days=1)
            if saturday in unpaid_days:
                penalty = True
            else:
                year, week, _ = current_day.isocalendar()
                if week_unpaid_counts[(year, week)] >= 2:
                    penalty = True
            if penalty:
                penalty_friday_dates.append(current_day)
        current_day += timedelta(days=1)
    overrides = {
        override.penalty_date
        for override in list_penalty_overrides(
            db,
            employee_id=employee.id,
            start_date=start_date,
            end_date=end_date,
        )
    }
    penalty_friday_dates = [penalty for penalty in penalty_friday_dates if penalty not in overrides]
    penalty_fridays = len(penalty_friday_dates)

    initial_advance = employee.advance_payment_received or Decimal("0")
    per_day_salary_for_month = _calculate_per_day_salary(employee.monthly_salary, start_date)
    penalty_deduction = per_day_salary_for_month * penalty_fridays
    overtime_credit = per_day_salary_for_month * overtime_full_days
    net_payable = (employee.monthly_salary or Decimal("0")) - total_month_advances
    net_payable = net_payable - penalty_deduction + overtime_credit

    total_advances = initial_advance + total_month_advances

    return {
        "employee": employee,
        "month": start_date.strftime("%Y-%m"),
        "start_date": start_date,
        "end_date": end_date,
        "present_days": present_days,
        "full_days": full_days,
        "half_days": half_days,
        "penalty_fridays": penalty_fridays,
        "penalty_friday_dates": penalty_friday_dates,
        "overtime_full_days": int(overtime_full_days),
        "total_worked_minutes": total_minutes,
        "total_worked_hours": round(total_minutes / 60, 2),
        "total_advances": total_advances,
        "initial_advance": initial_advance,
        "total_month_advances": total_month_advances,
        "monthly_salary": employee.monthly_salary,
        "per_day_salary_for_month": per_day_salary_for_month,
        "net_payable": net_payable,
        "paid_leave_days": paid_leave_days,
        "unpaid_leave_days": unpaid_leave_days,
        "penalty_deduction_amount": penalty_deduction,
        "overtime_credit_amount": overtime_credit,
    }
