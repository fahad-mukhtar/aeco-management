"""Add day_type column to attendance_records

Revision ID: 20240517_01
Revises: 
Create Date: 2025-05-17 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20240517_01"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "attendance_records",
        sa.Column("day_type", sa.String(length=16), nullable=False, server_default="pending"),
    )
    op.execute("UPDATE attendance_records SET day_type = 'pending' WHERE day_type IS NULL")
    op.alter_column("attendance_records", "day_type", server_default=None)


def downgrade() -> None:
    op.drop_column("attendance_records", "day_type")
