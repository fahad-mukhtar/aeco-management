"""Add leave records table

Revision ID: 20240517_02
Revises: 20240517_01
Create Date: 2025-05-17 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect
from sqlalchemy.dialects import postgresql


revision = "20240517_02"
down_revision = "20240517_01"
branch_labels = None
depends_on = None

# Base enum definitions
leave_type_enum = sa.Enum("paid", "unpaid", name="leave_type")
leave_type_enum_pg = postgresql.ENUM("paid", "unpaid", name="leave_type", create_type=False)


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    if bind.dialect.name == "postgresql":
        op.execute(
            """
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_type WHERE typname = 'leave_type'
                ) THEN
                    CREATE TYPE leave_type AS ENUM ('paid', 'unpaid');
                END IF;
            END$$;
            """
        )
        column_enum = leave_type_enum_pg
    else:
        leave_type_enum.create(bind, checkfirst=True)
        column_enum = leave_type_enum

    if "leave_records" not in inspector.get_table_names():
        op.create_table(
            "leave_records",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("employee_id", sa.Integer(), sa.ForeignKey("employees.id", ondelete="CASCADE"), nullable=False),
            sa.Column("start_date", sa.Date(), nullable=False),
            sa.Column("end_date", sa.Date(), nullable=False),
            sa.Column("leave_type", column_enum, nullable=False),
            sa.Column("reason", sa.Text()),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
            sa.Index("ix_leave_records_employee_id", "employee_id"),
            sa.Index("ix_leave_records_start_date", "start_date"),
        )


def downgrade() -> None:
    op.drop_table("leave_records")
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        op.execute("DROP TYPE IF EXISTS leave_type")
    else:
        leave_type_enum.drop(bind, checkfirst=True)
