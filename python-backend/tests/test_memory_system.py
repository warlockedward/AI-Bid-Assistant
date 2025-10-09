"""
Unit tests for tenant-aware memory system.
Tests memory storage, retrieval, and tenant isolation.
"""
import uuid
import pytest
from datetime import datetime, timedelta
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from tenants.context import TenantContext
from memory.models import Base, UserMemory, UserFeedback, UserPreference
from memory.memory_manager import MemoryManager
from memory.tenant_memory import TenantMemoryService


@pytest.fixture
def db_session():
    """Create an in-memory SQLite database for testing."""
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = SessionLocal()
    
    yield session
    
    session.close()


@pytest.fixture
def tenant_context():
    """Create a test tenant context."""
    return TenantContext(
        tenant_id=uuid.uuid4(),
        user_id=uuid.uuid4(),
        user_email="test@example.com",
        user_name="Test User",
        tenant_name="Test Tenant"
    )


@pytest.fixture
def other_tenant_context():
    """Create a different tenant context for isolation testing."""
    return TenantContext(
        tenant_id=uuid.uuid4(),
        user_id=uuid.uuid4(),
        user_email="other@example.com",
        user_name="Other User",
        tenant_name="Other Tenant"
    )


@pytest.fixture
def memory_manager(db_session):
    """Create a memory manager instance."""
    return MemoryManager(db_session)


class TestMemoryManager:
    """Test cases for MemoryManager class."""

    def test_store_memory(self, memory_manager, tenant_context, db_session):
        """Test storing a memory with tenant isolation."""
        memory_data = {"test_key": "test_value", "number": 42}
        context_tags = ["test", "example"]
        
        memory = memory_manager.store_memory(
            context=tenant_context,
            memory_type="preference",
            memory_key="test_memory",
            memory_data=memory_data,
            context_tags=context_tags,
            confidence_score=0.8
        )
        
        db_session.commit()
        
        assert memory.id is not None
        assert memory.tenant_id == tenant_context.tenant_id
        assert memory.user_id == tenant_context.user_id
        assert memory.memory_type == "preference"
        assert memory.memory_key == "test_memory"
        assert memory.memory_data == memory_data
        assert memory.context_tags == context_tags
        assert memory.confidence_score == 0.8

    def test_get_memory(self, memory_manager, tenant_context, db_session):
        """Test retrieving a memory by key."""
        # Store a memory first
        memory_data = {"retrieved": True}
        memory = memory_manager.store_memory(
            context=tenant_context,
            memory_type="interaction",
            memory_key="retrieve_test",
            memory_data=memory_data
        )
        db_session.commit()
        
        # Retrieve the memory
        retrieved = memory_manager.get_memory(
            context=tenant_context,
            memory_key="retrieve_test",
            memory_type="interaction"
        )
        
        assert retrieved is not None
        assert retrieved.id == memory.id
        assert retrieved.memory_data == memory_data
        assert retrieved.usage_count == 1  # Should increment on access

    def test_tenant_isolation(self, memory_manager, tenant_context, other_tenant_context, db_session):
        """Test that memories are isolated between tenants."""
        # Store memory for first tenant
        memory_manager.store_memory(
            context=tenant_context,
            memory_type="preference",
            memory_key="isolated_memory",
            memory_data={"tenant": "first"}
        )
        db_session.commit()
        
        # Try to retrieve from different tenant
        retrieved = memory_manager.get_memory(
            context=other_tenant_context,
            memory_key="isolated_memory",
            memory_type="preference"
        )
        
        assert retrieved is None  # Should not be accessible

    def test_search_memories(self, memory_manager, tenant_context, db_session):
        """Test searching memories with filters."""
        # Store multiple memories
        memory_manager.store_memory(
            context=tenant_context,
            memory_type="preference",
            memory_key="pref1",
            memory_data={"type": "writing_style"},
            context_tags=["writing", "style"]
        )
        
        memory_manager.store_memory(
            context=tenant_context,
            memory_type="feedback",
            memory_key="feedback1",
            memory_data={"type": "rejection"},
            context_tags=["writing", "rejection"]
        )
        
        memory_manager.store_memory(
            context=tenant_context,
            memory_type="preference",
            memory_key="pref2",
            memory_data={"type": "content_focus"},
            context_tags=["content", "focus"]
        )
        
        db_session.commit()
        
        # Search by type
        prefs = memory_manager.search_memories(
            context=tenant_context,
            memory_type="preference"
        )
        assert len(prefs) == 2
        
        # Search by tags
        writing_memories = memory_manager.search_memories(
            context=tenant_context,
            context_tags=["writing"]
        )
        assert len(writing_memories) == 2

    def test_store_feedback(self, memory_manager, tenant_context, db_session):
        """Test storing user feedback."""
        feedback = memory_manager.store_feedback(
            context=tenant_context,
            feedback_type="rejection",
            feedback_value="negative",
            content_type="bid_section",
            original_content="Original text",
            modified_content="Modified text",
            feedback_reason="Too formal",
            agent_name="content_generator"
        )
        
        db_session.commit()
        
        assert feedback.id is not None
        assert feedback.tenant_id == tenant_context.tenant_id
        assert feedback.user_id == tenant_context.user_id
        assert feedback.feedback_type == "rejection"
        assert feedback.is_negative() is True

    def test_store_preference(self, memory_manager, tenant_context, db_session):
        """Test storing user preferences."""
        preference = memory_manager.store_preference(
            context=tenant_context,
            category="writing_style",
            preference_key="tone",
            preference_value="casual",
            scope="global",
            priority=5,
            confidence_level=0.9
        )
        
        db_session.commit()
        
        assert preference.id is not None
        assert preference.tenant_id == tenant_context.tenant_id
        assert preference.user_id == tenant_context.user_id
        assert preference.preference_category == "writing_style"
        assert preference.preference_key == "tone"
        assert preference.preference_value == "casual"

    def test_get_preferences(self, memory_manager, tenant_context, db_session):
        """Test retrieving user preferences."""
        # Store multiple preferences
        memory_manager.store_preference(
            context=tenant_context,
            category="writing_style",
            preference_key="tone",
            preference_value="formal",
            priority=8
        )
        
        memory_manager.store_preference(
            context=tenant_context,
            category="content_focus",
            preference_key="length",
            preference_value="concise",
            priority=6
        )
        
        db_session.commit()
        
        # Get all preferences
        all_prefs = memory_manager.get_preferences(context=tenant_context)
        assert len(all_prefs) == 2
        
        # Get by category
        writing_prefs = memory_manager.get_preferences(
            context=tenant_context,
            category="writing_style"
        )
        assert len(writing_prefs) == 1
        assert writing_prefs[0].preference_key == "tone"

    def test_rejection_history(self, memory_manager, tenant_context, db_session):
        """Test getting rejection history."""
        # Store some feedback
        memory_manager.store_feedback(
            context=tenant_context,
            feedback_type="rejection",
            feedback_value="negative",
            content_type="bid_section",
            feedback_reason="Too technical",
            agent_name="content_generator"
        )
        
        memory_manager.store_feedback(
            context=tenant_context,
            feedback_type="approval",
            feedback_value="positive",
            content_type="bid_section",
            agent_name="content_generator"
        )
        
        db_session.commit()
        
        # Get rejection history
        rejections = memory_manager.get_rejection_history(
            context=tenant_context,
            content_type="bid_section"
        )
        
        assert len(rejections) == 1  # Only negative feedback
        assert rejections[0].feedback_reason == "Too technical"

    def test_learn_from_feedback(self, memory_manager, tenant_context, db_session):
        """Test automatic learning from feedback."""
        # Create feedback with modification
        feedback = memory_manager.store_feedback(
            context=tenant_context,
            feedback_type="modification",
            feedback_value="modified",
            content_type="bid_section",
            original_content="This is a very long and detailed explanation of our approach.",
            modified_content="This is our approach.",
            feedback_reason="Too verbose",
            agent_name="content_generator"
        )
        
        db_session.commit()
        
        # Learn from feedback
        learned_prefs = memory_manager.learn_from_feedback(
            context=tenant_context,
            feedback=feedback
        )
        
        db_session.commit()
        
        assert len(learned_prefs) > 0
        # Should learn preference for concise content
        concise_pref = next((p for p in learned_prefs if p.preference_value == "concise"), None)
        assert concise_pref is not None

    def test_expired_memory_cleanup(self, memory_manager, tenant_context, db_session):
        """Test cleanup of expired memories."""
        # Store memory that expires soon
        memory = memory_manager.store_memory(
            context=tenant_context,
            memory_type="interaction",
            memory_key="expiring_memory",
            memory_data={"will_expire": True},
            expires_in_days=0  # Expires immediately
        )
        
        # Manually set expiration to past
        memory.expires_at = datetime.utcnow() - timedelta(hours=1)
        db_session.commit()
        
        # Cleanup expired memories
        cleaned_count = memory_manager.cleanup_expired_memories(tenant_context)
        db_session.commit()
        
        assert cleaned_count == 1
        
        # Verify memory is gone
        retrieved = memory_manager.get_memory(
            context=tenant_context,
            memory_key="expiring_memory"
        )
        assert retrieved is None


class TestTenantMemoryService:
    """Test cases for TenantMemoryService class."""

    @pytest.fixture
    def memory_service(self):
        """Create a memory service instance with in-memory database."""
        return TenantMemoryService("sqlite:///:memory:")

    def test_store_and_get_preference(self, memory_service, tenant_context):
        """Test storing and retrieving preferences through service."""
        success = memory_service.store_user_preference(
            context=tenant_context,
            category="writing_style",
            key="tone",
            value="professional",
            scope="global"
        )
        
        assert success is True
        
        preferences = memory_service.get_user_preferences(
            context=tenant_context,
            category="writing_style"
        )
        
        assert "writing_style" in preferences
        assert "tone" in preferences["writing_style"]
        assert preferences["writing_style"]["tone"]["value"] == "professional"

    def test_record_feedback(self, memory_service, tenant_context):
        """Test recording feedback through service."""
        success = memory_service.record_user_feedback(
            context=tenant_context,
            feedback_type="rejection",
            feedback_value="negative",
            content_type="proposal_text",
            agent_name="proposal_generator",
            feedback_reason="Too generic"
        )
        
        assert success is True

    def test_rejection_patterns(self, memory_service, tenant_context):
        """Test getting rejection patterns through service."""
        # Record some feedback first
        memory_service.record_user_feedback(
            context=tenant_context,
            feedback_type="rejection",
            feedback_value="negative",
            content_type="proposal_text",
            agent_name="proposal_generator",
            feedback_reason="Lacks specificity"
        )
        
        patterns = memory_service.get_rejection_patterns(
            context=tenant_context,
            content_type="proposal_text"
        )
        
        assert len(patterns) == 1
        assert patterns[0]["feedback_reason"] == "Lacks specificity"

    def test_writing_style_retrieval(self, memory_service, tenant_context):
        """Test getting writing style preferences."""
        # Store some writing style preferences
        memory_service.store_user_preference(
            context=tenant_context,
            category="writing_style",
            key="tone",
            value="conversational"
        )
        
        memory_service.store_user_preference(
            context=tenant_context,
            category="writing_style",
            key="formality",
            value="moderate"
        )
        
        writing_style = memory_service.get_user_writing_style(context=tenant_context)
        
        assert "tone" in writing_style
        assert "formality" in writing_style
        assert writing_style["tone"]["value"] == "conversational"

    def test_memory_stats(self, memory_service, tenant_context):
        """Test getting memory statistics."""
        # Store some data first
        memory_service.store_user_preference(
            context=tenant_context,
            category="test",
            key="test_key",
            value="test_value"
        )
        
        memory_service.record_user_feedback(
            context=tenant_context,
            feedback_type="approval",
            feedback_value="positive",
            content_type="test_content"
        )
        
        stats = memory_service.get_memory_stats(context=tenant_context)
        
        assert stats is not None
        assert "total_memories" in stats
        assert "preferences_count" in stats
        assert stats["total_memories"] >= 2  # At least preference and feedback memories

    def test_tenant_isolation_in_service(self, memory_service, tenant_context, other_tenant_context):
        """Test tenant isolation at service level."""
        # Store preference for first tenant
        memory_service.store_user_preference(
            context=tenant_context,
            category="test",
            key="isolated_pref",
            value="tenant1_value"
        )
        
        # Try to get from second tenant
        prefs = memory_service.get_user_preferences(
            context=other_tenant_context,
            category="test"
        )
        
        # Should not see the other tenant's preferences
        assert "test" not in prefs or "isolated_pref" not in prefs.get("test", {})