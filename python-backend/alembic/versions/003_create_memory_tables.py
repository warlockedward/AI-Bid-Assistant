"""Create memory tables

Revision ID: 003
Revises: 002
Create Date: 2024-01-15 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '003'
down_revision = '002'
branch_labels = None
depends_on = None


def upgrade():
    # Create user_memories table
    op.create_table('user_memories',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('memory_type', sa.String(length=50), nullable=False),
        sa.Column('memory_key', sa.String(length=255), nullable=False),
        sa.Column('memory_data', sa.JSON(), nullable=False),
        sa.Column('context_tags', sa.JSON(), nullable=True),
        sa.Column('confidence_score', sa.Float(), nullable=True),
        sa.Column('usage_count', sa.Integer(), nullable=False),
        sa.Column('last_accessed', sa.DateTime(timezone=True), nullable=True),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_user_memories_tenant_id'), 'user_memories', ['tenant_id'], unique=False)
    op.create_index(op.f('ix_user_memories_user_id'), 'user_memories', ['user_id'], unique=False)

    # Create user_feedbacks table
    op.create_table('user_feedbacks',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('memory_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('workflow_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('feedback_type', sa.String(length=50), nullable=False),
        sa.Column('feedback_value', sa.String(length=20), nullable=False),
        sa.Column('content_type', sa.String(length=100), nullable=False),
        sa.Column('original_content', sa.Text(), nullable=True),
        sa.Column('modified_content', sa.Text(), nullable=True),
        sa.Column('feedback_reason', sa.Text(), nullable=True),
        sa.Column('context_data', sa.JSON(), nullable=True),
        sa.Column('agent_name', sa.String(length=100), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['memory_id'], ['user_memories.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_user_feedbacks_tenant_id'), 'user_feedbacks', ['tenant_id'], unique=False)
    op.create_index(op.f('ix_user_feedbacks_user_id'), 'user_feedbacks', ['user_id'], unique=False)

    # Create user_preferences table
    op.create_table('user_preferences',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('memory_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('preference_category', sa.String(length=100), nullable=False),
        sa.Column('preference_key', sa.String(length=255), nullable=False),
        sa.Column('preference_value', sa.JSON(), nullable=False),
        sa.Column('priority', sa.Integer(), nullable=False),
        sa.Column('scope', sa.String(length=50), nullable=False),
        sa.Column('scope_identifier', sa.String(length=255), nullable=True),
        sa.Column('learned_from_feedback', sa.Boolean(), nullable=False),
        sa.Column('confidence_level', sa.Float(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['memory_id'], ['user_memories.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_user_preferences_tenant_id'), 'user_preferences', ['tenant_id'], unique=False)
    op.create_index(op.f('ix_user_preferences_user_id'), 'user_preferences', ['user_id'], unique=False)

    # Create memory_indexes table
    op.create_table('memory_indexes',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('memory_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('index_type', sa.String(length=50), nullable=False),
        sa.Column('index_value', sa.String(length=255), nullable=False),
        sa.Column('relevance_score', sa.Float(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['memory_id'], ['user_memories.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_memory_indexes_tenant_id'), 'memory_indexes', ['tenant_id'], unique=False)
    op.create_index(op.f('ix_memory_indexes_user_id'), 'memory_indexes', ['user_id'], unique=False)
    op.create_index(op.f('ix_memory_indexes_index_type'), 'memory_indexes', ['index_type'], unique=False)
    op.create_index(op.f('ix_memory_indexes_index_value'), 'memory_indexes', ['index_value'], unique=False)


def downgrade():
    # Drop tables in reverse order
    op.drop_table('memory_indexes')
    op.drop_table('user_preferences')
    op.drop_table('user_feedbacks')
    op.drop_table('user_memories')