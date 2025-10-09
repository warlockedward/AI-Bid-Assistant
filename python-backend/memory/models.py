"""
Memory system SQLAlchemy models for tenant-aware preference and feedback storage.
"""
import uuid
from datetime import datetime
from typing import Optional, Dict, Any
from sqlalchemy import Column, String, DateTime, JSON, ForeignKey, Text, Boolean, Integer, Float
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship, validates
from sqlalchemy.sql import func

Base = declarative_base()


class UserMemory(Base):
    """
    Core user memory model for storing interaction history and learned preferences.
    Provides tenant isolation for all memory operations.
    """
    __tablename__ = "user_memories"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    memory_type = Column(String(50), nullable=False)  # preference, feedback, interaction, learned_pattern
    memory_key = Column(String(255), nullable=False)  # Unique identifier for this memory
    memory_data = Column(JSON, nullable=False, default=dict)
    context_tags = Column(JSON, nullable=True, default=list)  # Tags for contextual retrieval
    confidence_score = Column(Float, nullable=True, default=1.0)  # Confidence in this memory (0.0-1.0)
    usage_count = Column(Integer, nullable=False, default=0)  # How many times this memory was accessed
    last_accessed = Column(DateTime(timezone=True), nullable=True)
    expires_at = Column(DateTime(timezone=True), nullable=True)  # Optional expiration
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    feedbacks = relationship("UserFeedback", back_populates="memory", cascade="all, delete-orphan")
    preferences = relationship("UserPreference", back_populates="memory", cascade="all, delete-orphan")

    @validates('memory_type')
    def validate_memory_type(self, key, memory_type):
        valid_types = {"preference", "feedback", "interaction", "learned_pattern", "rejection_history"}
        if memory_type not in valid_types:
            raise ValueError(f"Memory type must be one of: {valid_types}")
        return memory_type

    @validates('confidence_score')
    def validate_confidence_score(self, key, score):
        if score is not None and (score < 0.0 or score > 1.0):
            raise ValueError("Confidence score must be between 0.0 and 1.0")
        return score

    def increment_usage(self):
        """Increment usage count and update last accessed time."""
        self.usage_count += 1
        self.last_accessed = datetime.utcnow()

    def is_expired(self) -> bool:
        """Check if this memory has expired."""
        if not self.expires_at:
            return False
        return datetime.utcnow() > self.expires_at

    def add_context_tag(self, tag: str):
        """Add a context tag for better retrieval."""
        if not self.context_tags:
            self.context_tags = []
        if tag not in self.context_tags:
            self.context_tags.append(tag)

    def __repr__(self):
        return f"<UserMemory(id={self.id}, type='{self.memory_type}', key='{self.memory_key}')>"


class UserFeedback(Base):
    """
    User feedback model for tracking user responses to generated content.
    Enables learning from user preferences and rejection patterns.
    """
    __tablename__ = "user_feedbacks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    memory_id = Column(UUID(as_uuid=True), ForeignKey("user_memories.id"), nullable=False)
    tenant_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    workflow_id = Column(UUID(as_uuid=True), nullable=True)  # Associated workflow if applicable
    feedback_type = Column(String(50), nullable=False)  # approval, rejection, modification, rating
    feedback_value = Column(String(20), nullable=False)  # positive, negative, neutral, or numeric rating
    content_type = Column(String(100), nullable=False)  # bid_section, proposal_text, analysis_result
    original_content = Column(Text, nullable=True)  # The content that was presented to user
    modified_content = Column(Text, nullable=True)  # User's modifications if any
    feedback_reason = Column(Text, nullable=True)  # User's explanation for the feedback
    context_data = Column(JSON, nullable=True, default=dict)  # Additional context about the feedback
    agent_name = Column(String(100), nullable=True)  # Which agent generated the content
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    memory = relationship("UserMemory", back_populates="feedbacks")

    @validates('feedback_type')
    def validate_feedback_type(self, key, feedback_type):
        valid_types = {"approval", "rejection", "modification", "rating", "preference_update"}
        if feedback_type not in valid_types:
            raise ValueError(f"Feedback type must be one of: {valid_types}")
        return feedback_type

    @validates('feedback_value')
    def validate_feedback_value(self, key, feedback_value):
        if not feedback_value or len(feedback_value.strip()) < 1:
            raise ValueError("Feedback value is required")
        return feedback_value.strip()

    def is_positive(self) -> bool:
        """Check if this feedback is positive."""
        positive_values = {"positive", "approval", "accepted"}
        return self.feedback_value.lower() in positive_values or (
            self.feedback_value.isdigit() and int(self.feedback_value) >= 4
        )

    def is_negative(self) -> bool:
        """Check if this feedback is negative."""
        negative_values = {"negative", "rejection", "rejected"}
        return self.feedback_value.lower() in negative_values or (
            self.feedback_value.isdigit() and int(self.feedback_value) <= 2
        )

    def __repr__(self):
        return f"<UserFeedback(id={self.id}, type='{self.feedback_type}', value='{self.feedback_value}')>"


class UserPreference(Base):
    """
    User preference model for storing learned user preferences and writing styles.
    Supports hierarchical preferences with inheritance and overrides.
    """
    __tablename__ = "user_preferences"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    memory_id = Column(UUID(as_uuid=True), ForeignKey("user_memories.id"), nullable=False)
    tenant_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    preference_category = Column(String(100), nullable=False)  # writing_style, content_focus, format_preference
    preference_key = Column(String(255), nullable=False)  # Specific preference identifier
    preference_value = Column(JSON, nullable=False)  # The actual preference data
    priority = Column(Integer, nullable=False, default=1)  # Higher numbers = higher priority
    scope = Column(String(50), nullable=False, default="global")  # global, workflow_type, agent_specific
    scope_identifier = Column(String(255), nullable=True)  # Specific scope ID if not global
    learned_from_feedback = Column(Boolean, nullable=False, default=False)  # Was this learned automatically?
    confidence_level = Column(Float, nullable=False, default=1.0)  # Confidence in this preference
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    memory = relationship("UserMemory", back_populates="preferences")

    @validates('preference_category')
    def validate_preference_category(self, key, category):
        valid_categories = {
            "writing_style", "content_focus", "format_preference", "tone_preference",
            "industry_focus", "compliance_requirements", "template_preferences",
            "agent_behavior", "workflow_settings"
        }
        if category not in valid_categories:
            raise ValueError(f"Preference category must be one of: {valid_categories}")
        return category

    @validates('scope')
    def validate_scope(self, key, scope):
        valid_scopes = {"global", "workflow_type", "agent_specific", "content_type", "project_specific"}
        if scope not in valid_scopes:
            raise ValueError(f"Scope must be one of: {valid_scopes}")
        return scope

    @validates('priority')
    def validate_priority(self, key, priority):
        if priority < 1 or priority > 10:
            raise ValueError("Priority must be between 1 and 10")
        return priority

    @validates('confidence_level')
    def validate_confidence_level(self, key, confidence):
        if confidence < 0.0 or confidence > 1.0:
            raise ValueError("Confidence level must be between 0.0 and 1.0")
        return confidence

    def matches_scope(self, scope_type: str, scope_id: Optional[str] = None) -> bool:
        """Check if this preference matches the given scope."""
        if self.scope == "global":
            return True
        if self.scope != scope_type:
            return False
        if scope_id and self.scope_identifier != scope_id:
            return False
        return True

    def update_confidence(self, feedback_positive: bool, learning_rate: float = 0.1):
        """Update confidence based on user feedback."""
        if feedback_positive:
            self.confidence_level = min(1.0, self.confidence_level + learning_rate)
        else:
            self.confidence_level = max(0.0, self.confidence_level - learning_rate)

    def __repr__(self):
        return f"<UserPreference(id={self.id}, category='{self.preference_category}', key='{self.preference_key}')>"


class MemoryIndex(Base):
    """
    Index table for fast memory retrieval by various criteria.
    Supports efficient querying of memories by tags, types, and context.
    """
    __tablename__ = "memory_indexes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    memory_id = Column(UUID(as_uuid=True), ForeignKey("user_memories.id"), nullable=False)
    tenant_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    index_type = Column(String(50), nullable=False, index=True)  # tag, category, context, semantic
    index_value = Column(String(255), nullable=False, index=True)  # The indexed value
    relevance_score = Column(Float, nullable=False, default=1.0)  # Relevance for this index
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    memory = relationship("UserMemory")

    @validates('index_type')
    def validate_index_type(self, key, index_type):
        valid_types = {"tag", "category", "context", "semantic", "temporal", "usage_pattern"}
        if index_type not in valid_types:
            raise ValueError(f"Index type must be one of: {valid_types}")
        return index_type

    @validates('relevance_score')
    def validate_relevance_score(self, key, score):
        if score < 0.0 or score > 1.0:
            raise ValueError("Relevance score must be between 0.0 and 1.0")
        return score

    def __repr__(self):
        return f"<MemoryIndex(id={self.id}, type='{self.index_type}', value='{self.index_value}')>"