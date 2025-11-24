"""Add salary payment adjustment columns"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

# revision identifiers, used by Alembic.
revision = '20240517_05'
down_revision = '20240517_04'
branch_labels = None
depends_on = None

def upgrade():
    bind = op.get_bind()
    inspector = inspect(bind)
    columns = {col['name'] for col in inspector.get_columns('salary_payments')}
    if 'advance_reduction_amount' not in columns:
        op.add_column('salary_payments', sa.Column('advance_reduction_amount', sa.Numeric(12, 2), nullable=False, server_default='0'))
    if 'initial_advance_after' not in columns:
        op.add_column('salary_payments', sa.Column('initial_advance_after', sa.Numeric(12, 2), nullable=False, server_default='0'))


def downgrade():
    bind = op.get_bind()
    inspector = inspect(bind)
    columns = {col['name'] for col in inspector.get_columns('salary_payments')}
    if 'initial_advance_after' in columns:
        op.drop_column('salary_payments', 'initial_advance_after')
    if 'advance_reduction_amount' in columns:
        op.drop_column('salary_payments', 'advance_reduction_amount')

