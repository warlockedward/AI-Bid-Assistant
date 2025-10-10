"""Create workflow tables

Revision ID: 002
Revises: 001
Create Date: 2024-01-02 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '002'
down_revision = '001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create workflow_states table
    op.create_table('workflow_states',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('workflow_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('workflow_type', sa.String(length=100), nullable=False),
        sa.Column('current_step', sa.String(length=100), nullable=False),
        sa.Column('status', sa.String(length=50), nullable=False),
        sa.Column('state_data', sa.JSON(), nullable=False),
        sa.Column('workflow_metadata', sa.JSON(), nullable=True),
        sa.Column('error_info', sa.JSON(), nullable=True),
        sa.Column('timeout_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('workflow_id')
    )
    
    # Create workflow_checkpoints table
    op.create_table('workflow_checkpoints',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('workflow_state_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('step_name', sa.String(length=100), nullable=False),
        sa.Column('step_index', sa.Integer(), nullable=False),
        sa.Column('checkpoint_data', sa.JSON(), nullable=False),
        sa.Column('agent_outputs', sa.JSON(), nullable=True),
        sa.Column('execution_time_ms', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['workflow_state_id'], ['workflow_states.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create indexes for better performance
    op.create_index('idx_workflow_states_tenant_id', 'workflow_states', ['tenant_id'])
    op.create_index('idx_workflow_states_user_id', 'workflow_states', ['user_id'])
    op.create_index('idx_workflow_states_workflow_id', 'workflow_states', ['workflow_id'])
    op.create_index('idx_workflow_states_status', 'workflow_states', ['status'])
    op.create_index('idx_workflow_states_workflow_type', 'workflow_states', ['workflow_type'])
    op.create_index('idx_workflow_states_timeout_at', 'workflow_states', ['timeout_at'])
    op.create_index('idx_workflow_checkpoints_workflow_state_id', 'workflow_checkpoints', ['workflow_state_id'])
    op.create_index('idx_workflow_checkpoints_step_index', 'workflow_checkpoints', ['step_index'])


def downgrade() -> None:
    # Drop indexes
    op.drop_index('idx_workflow_checkpoints_step_index', table_name='workflow_checkpoints')
    op.drop_index('idx_workflow_checkpoints_workflow_state_id', table_name='workflow_checkpoints')
    op.drop_index('idx_workflow_states_timeout_at', table_name='workflow_states')
    op.drop_index('idx_workflow_states_workflow_type', table_name='workflow_states')
    op.drop_index('idx_workflow_states_status', table_name='workflow_states')
    op.drop_index('idx_workflow_states_workflow_id', table_name='workflow_states')
    op.drop_index('idx_workflow_states_user_id', table_name='workflow_states')
    op.drop_index('idx_workflow_states_tenant_id', table_name='workflow_states')
    
    # Drop tables in reverse order
    op.drop_table('workflow_checkpoints')
    op.drop_table('workflow_states')