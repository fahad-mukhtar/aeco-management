"""Add salary payments table"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

# revision identifiers, used by Alembic.
revision = '20240517_04'
down_revision = '20240517_03'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = inspect(bind)
    salary_status = sa.Enum('paid', name='salary_payment_status')
    # create enum if missing
    if 'salary_payment_status' not in inspector.get_enums():
        salary_status.create(bind, checkfirst=True)

    if 'salary_payments' not in inspector.get_table_names():
        op.create_table(
            'salary_payments',
            sa.Column('id', sa.Integer(), primary_key=True),
            sa.Column('employee_id', sa.Integer(), sa.ForeignKey('employees.id', ondelete='CASCADE'), nullable=False),
            sa.Column('month', sa.String(length=8), nullable=False),
            sa.Column('period_start', sa.Date(), nullable=False),
            sa.Column('period_end', sa.Date(), nullable=False),
            sa.Column('present_days', sa.Integer(), nullable=False, server_default='0'),
            sa.Column('full_days', sa.Integer(), nullable=False, server_default='0'),
            sa.Column('half_days', sa.Integer(), nullable=False, server_default='0'),
            sa.Column('paid_leave_days', sa.Integer(), nullable=False, server_default='0'),
            sa.Column('unpaid_leave_days', sa.Integer(), nullable=False, server_default='0'),
            sa.Column('penalty_fridays', sa.Integer(), nullable=False, server_default='0'),
            sa.Column('overtime_full_days', sa.Integer(), nullable=False, server_default='0'),
            sa.Column('overtime_total_minutes', sa.Integer(), nullable=False, server_default='0'),
            sa.Column('overtime_total_hours', sa.Numeric(10, 2), nullable=False, server_default='0'),
            sa.Column('total_worked_minutes', sa.Integer(), nullable=False, server_default='0'),
            sa.Column('total_worked_hours', sa.Numeric(10, 2), nullable=False, server_default='0'),
            sa.Column('monthly_salary', sa.Numeric(12, 2), nullable=False),
            sa.Column('per_day_salary', sa.Numeric(12, 2), nullable=False),
            sa.Column('total_advances', sa.Numeric(12, 2), nullable=False),
            sa.Column('initial_advance', sa.Numeric(12, 2), nullable=False),
            sa.Column('total_month_advances', sa.Numeric(12, 2), nullable=False),
            sa.Column('penalty_deduction_amount', sa.Numeric(12, 2), nullable=False),
            sa.Column('overtime_credit_amount', sa.Numeric(12, 2), nullable=False),
            sa.Column('net_payable', sa.Numeric(12, 2), nullable=False),
            sa.Column('paid_amount', sa.Numeric(12, 2), nullable=False),
            sa.Column('additional_advance', sa.Numeric(12, 2), nullable=False, server_default='0'),
            sa.Column('advance_reduction_amount', sa.Numeric(12, 2), nullable=False, server_default='0'),
            sa.Column('initial_advance_after', sa.Numeric(12, 2), nullable=False, server_default='0'),
            sa.Column('carry_forward_advance', sa.Numeric(12, 2), nullable=False, server_default='0'),
            sa.Column('pending_advance_after', sa.Numeric(12, 2), nullable=False, server_default='0'),
            sa.Column('status', salary_status, nullable=False, server_default='paid'),
            sa.Column('note', sa.Text()),
            sa.Column('paid_on', sa.DateTime(), nullable=False, server_default=sa.func.now()),
            sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
            sa.UniqueConstraint('employee_id', 'month', name='uq_salary_payment_employee_month')
        )
        op.create_index(op.f('ix_salary_payments_employee_id'), 'salary_payments', ['employee_id'])


def downgrade():
    bind = op.get_bind()
    inspector = inspect(bind)
    if 'salary_payments' in inspector.get_table_names():
        op.drop_index(op.f('ix_salary_payments_employee_id'), table_name='salary_payments')
        op.drop_table('salary_payments')
    salary_status = sa.Enum('paid', name='salary_payment_status')
    salary_status.drop(bind, checkfirst=True)
