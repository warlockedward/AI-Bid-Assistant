"""
Tenant-aware memory service providing high-level memory operations.
Integrates with the agent system and provides caching for performance.
"""
import uuid
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from tenants.context import TenantContext
from .memory_manager import MemoryManager
from .models import UserMemory, UserFeedback, UserPreference


class TenantMemoryService:
    """
    High-level memory service with tenant isolation and caching.
    Provides the main interface for agents to interact with user memory.
    """

    def __init__(self, database_url: str):
        self.engine = create_engine(database_url)
        self.SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=self.engine)
        self._memory_cache: Dict[str, Dict[str, Any]] = {}
        self._cache_ttl = timedelta(minutes=15)  # Cache TTL

    def get_session(self) -> Session:
        """Get a database session."""
        return self.SessionLocal()

    def _get_cache_key(self, context: TenantContext, key: str) -> str:
        """Generate cache key with tenant isolation."""
        return f"{context.tenant_id}:{context.user_id}:{key}"

    def _is_cache_valid(self, cache_entry: Dict[str, Any]) -> bool:
        """Check if cache entry is still valid."""
        if "timestamp" not in cache_entry:
            return False
        return datetime.utcnow() - cache_entry["timestamp"] < self._cache_ttl

    def _cache_get(self, cache_key: str) -> Optional[Any]:
        """Get value from cache if valid."""
        if cache_key in self._memory_cache:
            entry = self._memory_cache[cache_key]
            if self._is_cache_valid(entry):
                return entry["data"]
            else:
                del self._memory_cache[cache_key]
        return None

    def _cache_set(self, cache_key: str, data: Any):
        """Set value in cache with timestamp."""
        self._memory_cache[cache_key] = {
            "data": data,
            "timestamp": datetime.utcnow()
        }

    def store_user_preference(
        self,
        context: TenantContext,
        category: str,
        key: str,
        value: Any,
        scope: str = "global",
        scope_id: Optional[str] = None
    ) -> bool:
        """
        Store a user preference with tenant isolation.
        
        Args:
            context: Tenant context for isolation
            category: Preference category (writing_style, content_focus, etc.)
            key: Specific preference key
            value: Preference value
            scope: Scope of preference (global, workflow_type, etc.)
            scope_id: Specific scope identifier
            
        Returns:
            True if successful, False otherwise
        """
        try:
            with self.get_session() as db:
                manager = MemoryManager(db)
                
                preference = manager.store_preference(
                    context=context,
                    category=category,
                    preference_key=key,
                    preference_value=value,
                    scope=scope,
                    scope_identifier=scope_id
                )
                
                db.commit()
                
                # Invalidate cache
                cache_key = self._get_cache_key(context, f"preferences:{category}")
                if cache_key in self._memory_cache:
                    del self._memory_cache[cache_key]
                
                return True
                
        except Exception as e:
            print(f"Error storing preference: {e}")
            return False

    def get_user_preferences(
        self,
        context: TenantContext,
        category: Optional[str] = None,
        scope: Optional[str] = None,
        scope_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Get user preferences with caching and tenant isolation.
        
        Args:
            context: Tenant context for isolation
            category: Optional category filter
            scope: Optional scope filter
            scope_id: Optional scope identifier filter
            
        Returns:
            Dictionary of preferences
        """
        cache_key = self._get_cache_key(
            context, 
            f"preferences:{category or 'all'}:{scope or 'all'}:{scope_id or 'all'}"
        )
        
        # Try cache first
        cached_prefs = self._cache_get(cache_key)
        if cached_prefs is not None:
            return cached_prefs

        try:
            with self.get_session() as db:
                manager = MemoryManager(db)
                
                preferences = manager.get_preferences(
                    context=context,
                    category=category,
                    scope=scope,
                    scope_identifier=scope_id
                )
                
                # Convert to dictionary
                prefs_dict = {}
                for pref in preferences:
                    if pref.preference_category not in prefs_dict:
                        prefs_dict[pref.preference_category] = {}
                    
                    prefs_dict[pref.preference_category][pref.preference_key] = {
                        "value": pref.preference_value,
                        "priority": pref.priority,
                        "confidence": pref.confidence_level,
                        "scope": pref.scope,
                        "scope_id": pref.scope_identifier,
                        "learned": pref.learned_from_feedback
                    }
                
                # Cache the result
                self._cache_set(cache_key, prefs_dict)
                
                return prefs_dict
                
        except Exception as e:
            print(f"Error getting preferences: {e}")
            return {}

    def record_user_feedback(
        self,
        context: TenantContext,
        feedback_type: str,
        feedback_value: str,
        content_type: str,
        agent_name: Optional[str] = None,
        original_content: Optional[str] = None,
        modified_content: Optional[str] = None,
        feedback_reason: Optional[str] = None,
        workflow_id: Optional[uuid.UUID] = None,
        auto_learn: bool = True
    ) -> bool:
        """
        Record user feedback and optionally learn from it.
        
        Args:
            context: Tenant context for isolation
            feedback_type: Type of feedback (approval, rejection, etc.)
            feedback_value: Value of feedback (positive, negative, etc.)
            content_type: Type of content being rated
            agent_name: Name of agent that generated content
            original_content: The original content presented
            modified_content: User's modifications if any
            feedback_reason: User's explanation
            workflow_id: Associated workflow ID
            auto_learn: Whether to automatically learn preferences
            
        Returns:
            True if successful, False otherwise
        """
        try:
            with self.get_session() as db:
                manager = MemoryManager(db)
                
                feedback = manager.store_feedback(
                    context=context,
                    feedback_type=feedback_type,
                    feedback_value=feedback_value,
                    content_type=content_type,
                    original_content=original_content,
                    modified_content=modified_content,
                    feedback_reason=feedback_reason,
                    agent_name=agent_name,
                    workflow_id=workflow_id
                )
                
                # Auto-learn from feedback if enabled
                if auto_learn:
                    learned_prefs = manager.learn_from_feedback(context, feedback)
                    if learned_prefs:
                        print(f"Learned {len(learned_prefs)} preferences from feedback")
                
                db.commit()
                
                # Invalidate relevant caches
                self._invalidate_preference_cache(context)
                
                return True
                
        except Exception as e:
            print(f"Error recording feedback: {e}")
            return False

    def get_rejection_patterns(
        self,
        context: TenantContext,
        content_type: Optional[str] = None,
        agent_name: Optional[str] = None,
        days_back: int = 30
    ) -> List[Dict[str, Any]]:
        """
        Get patterns from user's rejection history to avoid repeating mistakes.
        
        Args:
            context: Tenant context for isolation
            content_type: Optional content type filter
            agent_name: Optional agent name filter
            days_back: Number of days to look back
            
        Returns:
            List of rejection patterns
        """
        cache_key = self._get_cache_key(
            context, 
            f"rejections:{content_type or 'all'}:{agent_name or 'all'}:{days_back}"
        )
        
        # Try cache first
        cached_patterns = self._cache_get(cache_key)
        if cached_patterns is not None:
            return cached_patterns

        try:
            with self.get_session() as db:
                manager = MemoryManager(db)
                
                rejections = manager.get_rejection_history(
                    context=context,
                    content_type=content_type,
                    agent_name=agent_name,
                    days_back=days_back
                )
                
                # Convert to pattern format
                patterns = []
                for rejection in rejections:
                    pattern = {
                        "content_type": rejection.content_type,
                        "agent_name": rejection.agent_name,
                        "feedback_reason": rejection.feedback_reason,
                        "original_content": rejection.original_content,
                        "modified_content": rejection.modified_content,
                        "timestamp": rejection.created_at.isoformat(),
                        "context_data": rejection.context_data
                    }
                    patterns.append(pattern)
                
                # Cache the result
                self._cache_set(cache_key, patterns)
                
                return patterns
                
        except Exception as e:
            print(f"Error getting rejection patterns: {e}")
            return []

    def get_user_writing_style(
        self,
        context: TenantContext,
        scope: str = "global",
        scope_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Get user's learned writing style preferences.
        
        Args:
            context: Tenant context for isolation
            scope: Scope to get preferences for
            scope_id: Specific scope identifier
            
        Returns:
            Dictionary of writing style preferences
        """
        prefs = self.get_user_preferences(
            context=context,
            category="writing_style",
            scope=scope,
            scope_id=scope_id
        )
        
        # Merge with global preferences if not global scope
        if scope != "global":
            global_prefs = self.get_user_preferences(
                context=context,
                category="writing_style",
                scope="global"
            )
            
            # Global preferences as base, specific scope overrides
            merged_prefs = {}
            if "writing_style" in global_prefs:
                merged_prefs.update(global_prefs["writing_style"])
            if "writing_style" in prefs:
                merged_prefs.update(prefs["writing_style"])
            
            return merged_prefs
        
        return prefs.get("writing_style", {})

    def store_interaction_memory(
        self,
        context: TenantContext,
        interaction_type: str,
        interaction_data: Dict[str, Any],
        context_tags: Optional[List[str]] = None,
        expires_in_days: Optional[int] = None
    ) -> bool:
        """
        Store memory of a user interaction.
        
        Args:
            context: Tenant context for isolation
            interaction_type: Type of interaction
            interaction_data: Data about the interaction
            context_tags: Optional tags for retrieval
            expires_in_days: Optional expiration
            
        Returns:
            True if successful, False otherwise
        """
        try:
            with self.get_session() as db:
                manager = MemoryManager(db)
                
                memory_key = f"interaction_{interaction_type}_{datetime.utcnow().isoformat()}"
                
                manager.store_memory(
                    context=context,
                    memory_type="interaction",
                    memory_key=memory_key,
                    memory_data=interaction_data,
                    context_tags=context_tags,
                    expires_in_days=expires_in_days
                )
                
                db.commit()
                return True
                
        except Exception as e:
            print(f"Error storing interaction memory: {e}")
            return False

    def cleanup_expired_memories(self, context: TenantContext) -> int:
        """
        Clean up expired memories for better performance.
        
        Args:
            context: Tenant context for isolation
            
        Returns:
            Number of memories cleaned up
        """
        try:
            with self.get_session() as db:
                manager = MemoryManager(db)
                count = manager.cleanup_expired_memories(context)
                db.commit()
                
                # Clear cache for this user
                self._invalidate_user_cache(context)
                
                return count
                
        except Exception as e:
            print(f"Error cleaning up memories: {e}")
            return 0

    def _invalidate_preference_cache(self, context: TenantContext):
        """Invalidate all preference caches for a user."""
        user_prefix = f"{context.tenant_id}:{context.user_id}:preferences:"
        keys_to_remove = [key for key in self._memory_cache.keys() if key.startswith(user_prefix)]
        for key in keys_to_remove:
            del self._memory_cache[key]

    def _invalidate_user_cache(self, context: TenantContext):
        """Invalidate all caches for a user."""
        user_prefix = f"{context.tenant_id}:{context.user_id}:"
        keys_to_remove = [key for key in self._memory_cache.keys() if key.startswith(user_prefix)]
        for key in keys_to_remove:
            del self._memory_cache[key]

    def get_memory_stats(self, context: TenantContext) -> Dict[str, Any]:
        """
        Get memory usage statistics for a user.
        
        Args:
            context: Tenant context for isolation
            
        Returns:
            Dictionary of memory statistics
        """
        try:
            with self.get_session() as db:
                manager = MemoryManager(db)
                
                # Get counts by memory type
                memories = manager.search_memories(context, limit=1000)
                
                stats = {
                    "total_memories": len(memories),
                    "by_type": {},
                    "cache_size": len([k for k in self._memory_cache.keys() 
                                    if k.startswith(f"{context.tenant_id}:{context.user_id}:")]),
                    "preferences_count": len(manager.get_preferences(context)),
                    "recent_feedback_count": len(manager.get_rejection_history(context, days_back=7))
                }
                
                for memory in memories:
                    memory_type = memory.memory_type
                    if memory_type not in stats["by_type"]:
                        stats["by_type"][memory_type] = 0
                    stats["by_type"][memory_type] += 1
                
                return stats
                
        except Exception as e:
            print(f"Error getting memory stats: {e}")
            return {"error": str(e)}