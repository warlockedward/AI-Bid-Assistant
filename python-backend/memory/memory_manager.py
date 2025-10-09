"""
Memory manager for tenant-aware memory operations.
Provides high-level interface for storing and retrieving user memories, preferences, and feedback.
"""
import uuid
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, desc, func

from tenants.context import TenantContext
from .models import UserMemory, UserFeedback, UserPreference, MemoryIndex


class MemoryManager:
    """
    High-level memory management interface with tenant isolation.
    Handles storage, retrieval, and learning from user interactions.
    """

    def __init__(self, db_session: Session):
        self.db = db_session

    def store_memory(
        self,
        context: TenantContext,
        memory_type: str,
        memory_key: str,
        memory_data: Dict[str, Any],
        context_tags: Optional[List[str]] = None,
        confidence_score: float = 1.0,
        expires_in_days: Optional[int] = None
    ) -> UserMemory:
        """
        Store a new memory with tenant isolation.
        
        Args:
            context: Tenant context for isolation
            memory_type: Type of memory (preference, feedback, interaction, etc.)
            memory_key: Unique identifier for this memory
            memory_data: The actual memory data
            context_tags: Optional tags for contextual retrieval
            confidence_score: Confidence in this memory (0.0-1.0)
            expires_in_days: Optional expiration in days
            
        Returns:
            Created UserMemory instance
        """
        expires_at = None
        if expires_in_days:
            expires_at = datetime.utcnow() + timedelta(days=expires_in_days)

        memory = UserMemory(
            tenant_id=context.tenant_id,
            user_id=context.user_id,
            memory_type=memory_type,
            memory_key=memory_key,
            memory_data=memory_data,
            context_tags=context_tags or [],
            confidence_score=confidence_score,
            expires_at=expires_at
        )

        self.db.add(memory)
        self.db.flush()  # Get the ID without committing

        # Create indexes for efficient retrieval
        self._create_memory_indexes(memory, context_tags or [])

        return memory

    def get_memory(
        self,
        context: TenantContext,
        memory_key: str,
        memory_type: Optional[str] = None
    ) -> Optional[UserMemory]:
        """
        Retrieve a specific memory by key with tenant isolation.
        
        Args:
            context: Tenant context for isolation
            memory_key: The memory key to retrieve
            memory_type: Optional memory type filter
            
        Returns:
            UserMemory instance if found, None otherwise
        """
        query = self.db.query(UserMemory).filter(
            and_(
                UserMemory.tenant_id == context.tenant_id,
                UserMemory.user_id == context.user_id,
                UserMemory.memory_key == memory_key
            )
        )

        if memory_type:
            query = query.filter(UserMemory.memory_type == memory_type)

        memory = query.first()
        
        if memory and not memory.is_expired():
            memory.increment_usage()
            return memory
        elif memory and memory.is_expired():
            # Clean up expired memory
            self.db.delete(memory)
            
        return None

    def search_memories(
        self,
        context: TenantContext,
        memory_type: Optional[str] = None,
        context_tags: Optional[List[str]] = None,
        min_confidence: float = 0.0,
        limit: int = 50
    ) -> List[UserMemory]:
        """
        Search memories with various filters and tenant isolation.
        
        Args:
            context: Tenant context for isolation
            memory_type: Optional memory type filter
            context_tags: Optional context tags to match
            min_confidence: Minimum confidence score
            limit: Maximum number of results
            
        Returns:
            List of matching UserMemory instances
        """
        query = self.db.query(UserMemory).filter(
            and_(
                UserMemory.tenant_id == context.tenant_id,
                UserMemory.user_id == context.user_id,
                UserMemory.confidence_score >= min_confidence,
                or_(
                    UserMemory.expires_at.is_(None),
                    UserMemory.expires_at > datetime.utcnow()
                )
            )
        )

        if memory_type:
            query = query.filter(UserMemory.memory_type == memory_type)

        if context_tags:
            # Search for memories that have any of the specified tags
            tag_conditions = []
            for tag in context_tags:
                tag_conditions.append(UserMemory.context_tags.contains([tag]))
            query = query.filter(or_(*tag_conditions))

        return query.order_by(desc(UserMemory.confidence_score), desc(UserMemory.last_accessed)).limit(limit).all()

    def store_feedback(
        self,
        context: TenantContext,
        feedback_type: str,
        feedback_value: str,
        content_type: str,
        original_content: Optional[str] = None,
        modified_content: Optional[str] = None,
        feedback_reason: Optional[str] = None,
        context_data: Optional[Dict[str, Any]] = None,
        agent_name: Optional[str] = None,
        workflow_id: Optional[uuid.UUID] = None
    ) -> UserFeedback:
        """
        Store user feedback with automatic memory creation/update.
        
        Args:
            context: Tenant context for isolation
            feedback_type: Type of feedback (approval, rejection, etc.)
            feedback_value: Value of feedback (positive, negative, etc.)
            content_type: Type of content being rated
            original_content: The original content presented
            modified_content: User's modifications if any
            feedback_reason: User's explanation
            context_data: Additional context
            agent_name: Name of agent that generated content
            workflow_id: Associated workflow ID
            
        Returns:
            Created UserFeedback instance
        """
        # Create or update memory for this feedback
        memory_key = f"feedback_{content_type}_{agent_name or 'unknown'}"
        memory = self.get_memory(context, memory_key, "feedback")
        
        if not memory:
            memory = self.store_memory(
                context=context,
                memory_type="feedback",
                memory_key=memory_key,
                memory_data={
                    "content_type": content_type,
                    "agent_name": agent_name,
                    "feedback_history": []
                },
                context_tags=[content_type, agent_name] if agent_name else [content_type]
            )

        # Create feedback record
        feedback = UserFeedback(
            memory_id=memory.id,
            tenant_id=context.tenant_id,
            user_id=context.user_id,
            workflow_id=workflow_id,
            feedback_type=feedback_type,
            feedback_value=feedback_value,
            content_type=content_type,
            original_content=original_content,
            modified_content=modified_content,
            feedback_reason=feedback_reason,
            context_data=context_data or {},
            agent_name=agent_name
        )

        self.db.add(feedback)
        self.db.flush()

        # Update memory with feedback history
        if "feedback_history" not in memory.memory_data:
            memory.memory_data["feedback_history"] = []
        
        memory.memory_data["feedback_history"].append({
            "feedback_id": str(feedback.id),
            "type": feedback_type,
            "value": feedback_value,
            "timestamp": datetime.utcnow().isoformat(),
            "is_positive": feedback.is_positive()
        })

        # Update confidence based on feedback
        if feedback.is_positive():
            memory.confidence_score = min(1.0, memory.confidence_score + 0.1)
        elif feedback.is_negative():
            memory.confidence_score = max(0.0, memory.confidence_score - 0.1)

        return feedback

    def store_preference(
        self,
        context: TenantContext,
        category: str,
        preference_key: str,
        preference_value: Any,
        scope: str = "global",
        scope_identifier: Optional[str] = None,
        priority: int = 1,
        learned_from_feedback: bool = False,
        confidence_level: float = 1.0
    ) -> UserPreference:
        """
        Store or update a user preference with tenant isolation.
        
        Args:
            context: Tenant context for isolation
            category: Preference category
            preference_key: Specific preference key
            preference_value: The preference value
            scope: Scope of preference (global, workflow_type, etc.)
            scope_identifier: Specific scope ID if not global
            priority: Priority level (1-10)
            learned_from_feedback: Whether this was learned automatically
            confidence_level: Confidence in this preference
            
        Returns:
            Created or updated UserPreference instance
        """
        # Create or get memory for this preference category
        memory_key = f"preference_{category}_{scope}_{scope_identifier or 'global'}"
        memory = self.get_memory(context, memory_key, "preference")
        
        if not memory:
            memory = self.store_memory(
                context=context,
                memory_type="preference",
                memory_key=memory_key,
                memory_data={
                    "category": category,
                    "scope": scope,
                    "scope_identifier": scope_identifier,
                    "preferences": {}
                },
                context_tags=[category, scope]
            )

        # Check if preference already exists
        existing_pref = self.db.query(UserPreference).filter(
            and_(
                UserPreference.memory_id == memory.id,
                UserPreference.preference_key == preference_key
            )
        ).first()

        if existing_pref:
            # Update existing preference
            existing_pref.preference_value = preference_value
            existing_pref.priority = priority
            existing_pref.confidence_level = confidence_level
            existing_pref.updated_at = datetime.utcnow()
            preference = existing_pref
        else:
            # Create new preference
            preference = UserPreference(
                memory_id=memory.id,
                tenant_id=context.tenant_id,
                user_id=context.user_id,
                preference_category=category,
                preference_key=preference_key,
                preference_value=preference_value,
                priority=priority,
                scope=scope,
                scope_identifier=scope_identifier,
                learned_from_feedback=learned_from_feedback,
                confidence_level=confidence_level
            )
            self.db.add(preference)

        # Update memory data
        if "preferences" not in memory.memory_data:
            memory.memory_data["preferences"] = {}
        
        memory.memory_data["preferences"][preference_key] = {
            "value": preference_value,
            "priority": priority,
            "confidence": confidence_level,
            "updated_at": datetime.utcnow().isoformat()
        }

        return preference

    def get_preferences(
        self,
        context: TenantContext,
        category: Optional[str] = None,
        scope: Optional[str] = None,
        scope_identifier: Optional[str] = None
    ) -> List[UserPreference]:
        """
        Retrieve user preferences with tenant isolation and scope filtering.
        
        Args:
            context: Tenant context for isolation
            category: Optional category filter
            scope: Optional scope filter
            scope_identifier: Optional scope identifier filter
            
        Returns:
            List of matching UserPreference instances
        """
        query = self.db.query(UserPreference).filter(
            and_(
                UserPreference.tenant_id == context.tenant_id,
                UserPreference.user_id == context.user_id
            )
        )

        if category:
            query = query.filter(UserPreference.preference_category == category)
        
        if scope:
            query = query.filter(UserPreference.scope == scope)
            
        if scope_identifier:
            query = query.filter(UserPreference.scope_identifier == scope_identifier)

        return query.order_by(desc(UserPreference.priority), desc(UserPreference.confidence_level)).all()

    def get_rejection_history(
        self,
        context: TenantContext,
        content_type: Optional[str] = None,
        agent_name: Optional[str] = None,
        days_back: int = 30
    ) -> List[UserFeedback]:
        """
        Get user's rejection history to avoid repeating mistakes.
        
        Args:
            context: Tenant context for isolation
            content_type: Optional content type filter
            agent_name: Optional agent name filter
            days_back: Number of days to look back
            
        Returns:
            List of negative feedback instances
        """
        since_date = datetime.utcnow() - timedelta(days=days_back)
        
        query = self.db.query(UserFeedback).filter(
            and_(
                UserFeedback.tenant_id == context.tenant_id,
                UserFeedback.user_id == context.user_id,
                UserFeedback.created_at >= since_date
            )
        )

        if content_type:
            query = query.filter(UserFeedback.content_type == content_type)
            
        if agent_name:
            query = query.filter(UserFeedback.agent_name == agent_name)

        # Filter for negative feedback
        negative_feedbacks = []
        for feedback in query.all():
            if feedback.is_negative():
                negative_feedbacks.append(feedback)

        return negative_feedbacks

    def learn_from_feedback(
        self,
        context: TenantContext,
        feedback: UserFeedback,
        learning_rate: float = 0.1
    ) -> List[UserPreference]:
        """
        Automatically learn preferences from user feedback.
        
        Args:
            context: Tenant context for isolation
            feedback: The feedback to learn from
            learning_rate: Rate of learning (0.0-1.0)
            
        Returns:
            List of preferences that were created or updated
        """
        learned_preferences = []

        # Learn content preferences from modifications
        if feedback.modified_content and feedback.original_content:
            # Analyze differences and create preferences
            # This is a simplified example - in practice, you'd use NLP to analyze changes
            
            if len(feedback.modified_content) < len(feedback.original_content):
                # User prefers shorter content
                pref = self.store_preference(
                    context=context,
                    category="content_focus",
                    preference_key="content_length",
                    preference_value="concise",
                    scope="content_type",
                    scope_identifier=feedback.content_type,
                    learned_from_feedback=True,
                    confidence_level=0.7
                )
                learned_preferences.append(pref)

        # Learn from rejection reasons
        if feedback.is_negative() and feedback.feedback_reason:
            reason_lower = feedback.feedback_reason.lower()
            
            if "too formal" in reason_lower or "stiff" in reason_lower:
                pref = self.store_preference(
                    context=context,
                    category="writing_style",
                    preference_key="tone",
                    preference_value="casual",
                    scope="agent_specific",
                    scope_identifier=feedback.agent_name,
                    learned_from_feedback=True,
                    confidence_level=0.8
                )
                learned_preferences.append(pref)
            
            elif "too casual" in reason_lower or "unprofessional" in reason_lower:
                pref = self.store_preference(
                    context=context,
                    category="writing_style",
                    preference_key="tone",
                    preference_value="formal",
                    scope="agent_specific",
                    scope_identifier=feedback.agent_name,
                    learned_from_feedback=True,
                    confidence_level=0.8
                )
                learned_preferences.append(pref)

        return learned_preferences

    def cleanup_expired_memories(self, context: TenantContext) -> int:
        """
        Clean up expired memories for a tenant/user.
        
        Args:
            context: Tenant context for isolation
            
        Returns:
            Number of memories cleaned up
        """
        expired_memories = self.db.query(UserMemory).filter(
            and_(
                UserMemory.tenant_id == context.tenant_id,
                UserMemory.user_id == context.user_id,
                UserMemory.expires_at <= datetime.utcnow()
            )
        ).all()

        count = len(expired_memories)
        for memory in expired_memories:
            self.db.delete(memory)

        return count

    def _create_memory_indexes(self, memory: UserMemory, context_tags: List[str]):
        """Create indexes for efficient memory retrieval."""
        # Index by memory type
        type_index = MemoryIndex(
            memory_id=memory.id,
            tenant_id=memory.tenant_id,
            user_id=memory.user_id,
            index_type="category",
            index_value=memory.memory_type,
            relevance_score=1.0
        )
        self.db.add(type_index)

        # Index by context tags
        for tag in context_tags:
            tag_index = MemoryIndex(
                memory_id=memory.id,
                tenant_id=memory.tenant_id,
                user_id=memory.user_id,
                index_type="tag",
                index_value=tag,
                relevance_score=0.8
            )
            self.db.add(tag_index)

        # Index by memory key
        key_index = MemoryIndex(
            memory_id=memory.id,
            tenant_id=memory.tenant_id,
            user_id=memory.user_id,
            index_type="context",
            index_value=memory.memory_key,
            relevance_score=1.0
        )
        self.db.add(key_index)