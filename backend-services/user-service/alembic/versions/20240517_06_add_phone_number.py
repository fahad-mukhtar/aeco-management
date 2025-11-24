"""Add phone number to employees"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '20240517_06'
down_revision = '20240517_05'
branch_labels = None
depends_on = None

def upgrade():
    op.add_column('employees', sa.Column('phone_number', sa.String(length=32), nullable=True))


def downgrade():
    op.drop_column('employees', 'phone_number')

