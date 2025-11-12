from datetime import date, datetime
from decimal import Decimal

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.db import (
    AttendanceRecord,
    DailyAdvance,
    Employee,
    LeaveRecord,
    LeaveType,
    Base,
    count_leave_records,
    create_penalty_override,
    list_leave_records,
)
from app.services import build_employee_month_summary


@pytest.fixture
def db_session() -> Session:
    engine = create_engine("sqlite+pysqlite:///:memory:", future=True)
    TestingSession = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)
    Base.metadata.create_all(bind=engine)
    session = TestingSession()
    try:
        yield session
    finally:
        session.close()


def _create_employee(session: Session) -> Employee:
    employee = Employee(
        employee_code="AECO-9001",
        name="Payroll Tester",
        designation="Operator",
        monthly_salary=Decimal("30000"),
        per_day_salary=Decimal("0"),
        regular_employee=True,
        joining_date=date(2025, 1, 1),
        advance_payment_received=Decimal("2000"),
    )
    session.add(employee)
    session.commit()
    session.refresh(employee)
    return employee


def test_leave_queries_include_overlaps(db_session: Session):
    employee = _create_employee(db_session)
    overlapping_leave = LeaveRecord(
        employee_id=employee.id,
        start_date=date(2025, 1, 28),
        end_date=date(2025, 2, 2),
        leave_type=LeaveType.UNPAID,
        reason="Extended leave",
    )
    db_session.add(overlapping_leave)
    db_session.commit()

    results = list_leave_records(
        db_session,
        employee_id=employee.id,
        start_date=date(2025, 2, 1),
        end_date=date(2025, 2, 28),
    )
    assert len(results) == 1
    assert results[0].id == overlapping_leave.id

    total = count_leave_records(
        db_session,
        employee_id=employee.id,
        start_date=date(2025, 2, 1),
        end_date=date(2025, 2, 28),
    )
    assert total == 1


def test_payroll_summary_includes_penalty_and_overtime(db_session: Session):
    employee = _create_employee(db_session)

    attendance_records = [
        AttendanceRecord(
            employee_id=employee.id,
            work_date=date(2025, 1, 3),
            clock_in=datetime(2025, 1, 3, 8, 0),
            clock_out=datetime(2025, 1, 3, 22, 0),
            worked_minutes=840,
            day_type="full",
        ),
        AttendanceRecord(
            employee_id=employee.id,
            work_date=date(2025, 1, 4),
            clock_in=datetime(2025, 1, 4, 8, 0),
            clock_out=datetime(2025, 1, 4, 12, 0),
            worked_minutes=240,
            day_type="half",
        ),
    ]
    db_session.add_all(attendance_records)

    db_session.add(
        DailyAdvance(
            employee_id=employee.id,
            amount=Decimal("5000"),
            note="Tools",
            recorded_for=date(2025, 1, 5),
        )
    )

    db_session.add(
        LeaveRecord(
            employee_id=employee.id,
            start_date=date(2025, 1, 10),
            end_date=date(2025, 1, 11),
            leave_type=LeaveType.UNPAID,
            reason="Weekend leave",
        )
    )
    db_session.add(
        LeaveRecord(
            employee_id=employee.id,
            start_date=date(2025, 1, 20),
            end_date=date(2025, 1, 21),
            leave_type=LeaveType.PAID,
            reason="Family event",
        )
    )
    db_session.commit()

    summary = build_employee_month_summary(
        db_session,
        employee=employee,
        start_date=date(2025, 1, 1),
        end_date=date(2025, 1, 31),
    )

    assert summary["paid_leave_days"] == 2
    assert summary["unpaid_leave_days"] == 2
    assert summary["penalty_fridays"] == 1
    assert summary["penalty_friday_dates"] == [date(2025, 1, 10)]
    assert summary["overtime_full_days"] == 1

    per_day_salary = summary["per_day_salary_for_month"]
    assert summary["penalty_deduction_amount"] == per_day_salary * summary["penalty_fridays"]
    assert summary["overtime_credit_amount"] == per_day_salary * summary["overtime_full_days"]

    assert summary["total_month_advances"] == Decimal("5000")
    assert summary["total_advances"] == Decimal("7000")

    expected_net = (
        Decimal("30000")
        - Decimal("5000")
        - summary["penalty_deduction_amount"]
        + summary["overtime_credit_amount"]
    )
    assert summary["net_payable"] == expected_net


def test_penalty_override_removes_penalty(db_session: Session):
    employee = _create_employee(db_session)
    db_session.add(
        LeaveRecord(
            employee_id=employee.id,
            start_date=date(2025, 2, 8),  # Saturday
            end_date=date(2025, 2, 8),
            leave_type=LeaveType.UNPAID,
            reason="Absent Saturday",
        )
    )
    db_session.commit()

    summary = build_employee_month_summary(
        db_session,
        employee=employee,
        start_date=date(2025, 2, 1),
        end_date=date(2025, 2, 28),
    )
    assert summary["penalty_fridays"] == 1

    penalty_date = summary["penalty_friday_dates"][0]
    create_penalty_override(db_session, employee_id=employee.id, penalty_date=penalty_date)

    summary_after_override = build_employee_month_summary(
        db_session,
        employee=employee,
        start_date=date(2025, 2, 1),
        end_date=date(2025, 2, 28),
    )
    assert summary_after_override["penalty_fridays"] == 0
    assert summary_after_override["penalty_friday_dates"] == []
