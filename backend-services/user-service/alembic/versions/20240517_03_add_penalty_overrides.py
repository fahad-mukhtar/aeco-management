"""Add penalty overrides table"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '20240517_03'
down_revision = '20240517_02'
branch_labels = None
depends_on = None

def upgrade():
    op.create_table(
        'penalty_overrides',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('employee_id', sa.Integer(), nullable=False),
        sa.Column('penalty_date', sa.Date(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['employee_id'], ['employees.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_penalty_overrides_employee_id'), 'penalty_overrides', ['employee_id'], unique=False)
    op.create_unique_constraint('uq_penalty_override', 'penalty_overrides', ['employee_id', 'penalty_date'])


def downgrade():
    op.drop_constraint('uq_penalty_override', 'penalty_overrides', type_='unique')
    op.drop_index(op.f('ix_penalty_overrides_employee_id'), table_name='penalty_overrides')
    op.drop_table('penalty_overrides')

