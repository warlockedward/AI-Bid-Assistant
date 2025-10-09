"""
Unit tests for tenant models.
"""
import pytest
import uuid
from datetime import datetime
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.exc import IntegrityError

from tenants.models import Base, Tenant, User, TenantConfig


# Test database setup
@pytest.fixture(scope="function")
def db_session():
    """Create a test database session."""
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    yield session
    session.close()


class TestTenantModel:
    """Test cases for Tenant model."""
    
    def test_create_tenant_valid(self, db_session):
        """Test creating a valid tenant."""
        tenant = Tenant(
            name="Test Company",
            domain="test.com",
            config={"feature_flags": {"ai_enabled": True}}
        )
        db_session.add(tenant)
        db_session.commit()
        
        assert tenant.id is not None
        assert tenant.name == "Test Company"
        assert tenant.domain == "test.com"
        assert tenant.is_active is True
        assert tenant.created_at is not None
        assert tenant.config["feature_flags"]["ai_enabled"] is True
    
    def test_tenant_name_validation(self, db_session):
        """Test tenant name validation."""
        # Test empty name
        with pytest.raises(ValueError, match="Tenant name must be at least 2 characters long"):
            tenant = Tenant(name="")
            db_session.add(tenant)
            db_session.commit()
        
        # Test short name
        with pytest.raises(ValueError, match="Tenant name must be at least 2 characters long"):
            tenant = Tenant(name="A")
            db_session.add(tenant)
            db_session.commit()
        
        # Test whitespace-only name
        with pytest.raises(ValueError, match="Tenant name must be at least 2 characters long"):
            tenant = Tenant(name="  ")
            db_session.add(tenant)
            db_session.commit()
    
    def test_tenant_domain_validation(self, db_session):
        """Test tenant domain validation."""
        # Test empty domain (should be converted to None)
        tenant = Tenant(name="Test Company", domain="  ")
        db_session.add(tenant)
        db_session.commit()
        
        assert tenant.domain is None
    
    def test_tenant_unique_constraints(self, db_session):
        """Test tenant unique constraints."""
        # Create first tenant
        tenant1 = Tenant(name="Test Company", domain="test.com")
        db_session.add(tenant1)
        db_session.commit()
        
        # Try to create tenant with same name
        tenant2 = Tenant(name="Test Company", domain="different.com")
        db_session.add(tenant2)
        with pytest.raises(IntegrityError):
            db_session.commit()
        
        db_session.rollback()
        
        # Try to create tenant with same domain
        tenant3 = Tenant(name="Different Company", domain="test.com")
        db_session.add(tenant3)
        with pytest.raises(IntegrityError):
            db_session.commit()
    
    def test_tenant_repr(self, db_session):
        """Test tenant string representation."""
        tenant = Tenant(name="Test Company", domain="test.com")
        db_session.add(tenant)
        db_session.commit()
        
        repr_str = repr(tenant)
        assert "Test Company" in repr_str
        assert "test.com" in repr_str
        assert str(tenant.id) in repr_str


class TestUserModel:
    """Test cases for User model."""
    
    def test_create_user_valid(self, db_session):
        """Test creating a valid user."""
        # Create tenant first
        tenant = Tenant(name="Test Company")
        db_session.add(tenant)
        db_session.commit()
        
        user = User(
            email="test@example.com",
            name="Test User",
            tenant_id=tenant.id,
            sso_provider="auth0",
            sso_id="auth0|123456",
            preferences={"theme": "dark"}
        )
        db_session.add(user)
        db_session.commit()
        
        assert user.id is not None
        assert user.email == "test@example.com"
        assert user.name == "Test User"
        assert user.tenant_id == tenant.id
        assert user.sso_provider == "auth0"
        assert user.is_active is True
        assert user.preferences["theme"] == "dark"
    
    def test_user_email_validation(self, db_session):
        """Test user email validation."""
        tenant = Tenant(name="Test Company")
        db_session.add(tenant)
        db_session.commit()
        
        # Test invalid email
        with pytest.raises(ValueError, match="Valid email address is required"):
            user = User(
                email="invalid-email",
                name="Test User",
                tenant_id=tenant.id
            )
            db_session.add(user)
            db_session.commit()
        
        # Test empty email
        with pytest.raises(ValueError, match="Valid email address is required"):
            user = User(
                email="",
                name="Test User",
                tenant_id=tenant.id
            )
            db_session.add(user)
            db_session.commit()
    
    def test_user_name_validation(self, db_session):
        """Test user name validation."""
        tenant = Tenant(name="Test Company")
        db_session.add(tenant)
        db_session.commit()
        
        # Test empty name
        with pytest.raises(ValueError, match="User name is required"):
            user = User(
                email="test@example.com",
                name="",
                tenant_id=tenant.id
            )
            db_session.add(user)
            db_session.commit()
        
        # Test whitespace-only name
        with pytest.raises(ValueError, match="User name is required"):
            user = User(
                email="test@example.com",
                name="   ",
                tenant_id=tenant.id
            )
            db_session.add(user)
            db_session.commit()
    
    def test_user_email_normalization(self, db_session):
        """Test email normalization (lowercase, trimmed)."""
        tenant = Tenant(name="Test Company")
        db_session.add(tenant)
        db_session.commit()
        
        user = User(
            email="  TEST@EXAMPLE.COM  ",
            name="Test User",
            tenant_id=tenant.id
        )
        db_session.add(user)
        db_session.commit()
        
        assert user.email == "test@example.com"
    
    def test_user_tenant_relationship(self, db_session):
        """Test user-tenant relationship."""
        tenant = Tenant(name="Test Company")
        db_session.add(tenant)
        db_session.commit()
        
        user = User(
            email="test@example.com",
            name="Test User",
            tenant_id=tenant.id
        )
        db_session.add(user)
        db_session.commit()
        
        # Test relationship
        assert user.tenant == tenant
        assert user in tenant.users


class TestTenantConfigModel:
    """Test cases for TenantConfig model."""
    
    def test_create_tenant_config_valid(self, db_session):
        """Test creating a valid tenant config."""
        tenant = Tenant(name="Test Company")
        db_session.add(tenant)
        db_session.commit()
        
        config = TenantConfig(
            tenant_id=tenant.id,
            rag_api_url="https://api.example.com/rag",
            llm_endpoint="https://api.openai.com/v1",
            features={"ai_enabled": True, "advanced_analytics": False},
            workflow_settings={"max_concurrent": 5},
            ui_customization={"theme": "dark", "logo_url": "https://example.com/logo.png"}
        )
        db_session.add(config)
        db_session.commit()
        
        assert config.id is not None
        assert config.tenant_id == tenant.id
        assert config.rag_api_url == "https://api.example.com/rag"
        assert config.features["ai_enabled"] is True
    
    def test_tenant_config_url_validation(self, db_session):
        """Test URL validation for tenant config."""
        tenant = Tenant(name="Test Company")
        db_session.add(tenant)
        db_session.commit()
        
        # Test invalid RAG API URL
        with pytest.raises(ValueError, match="RAG API URL must be a valid HTTP/HTTPS URL"):
            config = TenantConfig(
                tenant_id=tenant.id,
                rag_api_url="invalid-url"
            )
            db_session.add(config)
            db_session.commit()
        
        # Test invalid LLM endpoint
        with pytest.raises(ValueError, match="LLM endpoint must be a valid HTTP/HTTPS URL"):
            config = TenantConfig(
                tenant_id=tenant.id,
                llm_endpoint="ftp://invalid.com"
            )
            db_session.add(config)
            db_session.commit()
    
    def test_feature_flag_methods(self, db_session):
        """Test feature flag helper methods."""
        tenant = Tenant(name="Test Company")
        db_session.add(tenant)
        db_session.commit()
        
        config = TenantConfig(
            tenant_id=tenant.id,
            features={"ai_enabled": True}
        )
        db_session.add(config)
        db_session.commit()
        
        # Test getting existing feature flag
        assert config.get_feature_flag("ai_enabled") is True
        
        # Test getting non-existent feature flag with default
        assert config.get_feature_flag("non_existent", default=False) is False
        assert config.get_feature_flag("non_existent", default=True) is True
        
        # Test setting feature flag
        config.set_feature_flag("new_feature", True)
        assert config.features["new_feature"] is True
        
        # Test setting feature flag when features is None
        config.features = None
        config.set_feature_flag("another_feature", False)
        assert config.features["another_feature"] is False
    
    def test_tenant_config_relationship(self, db_session):
        """Test tenant config relationship."""
        tenant = Tenant(name="Test Company")
        db_session.add(tenant)
        db_session.commit()
        
        config = TenantConfig(tenant_id=tenant.id)
        db_session.add(config)
        db_session.commit()
        
        # Test relationship
        assert config.tenant == tenant
        assert tenant.tenant_config == config
    
    def test_tenant_config_unique_constraint(self, db_session):
        """Test tenant config unique constraint per tenant."""
        tenant = Tenant(name="Test Company")
        db_session.add(tenant)
        db_session.commit()
        
        # Create first config
        config1 = TenantConfig(tenant_id=tenant.id)
        db_session.add(config1)
        db_session.commit()
        
        # Try to create second config for same tenant
        config2 = TenantConfig(tenant_id=tenant.id)
        db_session.add(config2)
        with pytest.raises(IntegrityError):
            db_session.commit()


class TestCascadeDeletes:
    """Test cascade delete behavior."""
    
    def test_tenant_deletion_cascades(self, db_session):
        """Test that deleting a tenant cascades to users and config."""
        tenant = Tenant(name="Test Company")
        db_session.add(tenant)
        db_session.commit()
        
        user = User(
            email="test@example.com",
            name="Test User",
            tenant_id=tenant.id
        )
        config = TenantConfig(tenant_id=tenant.id)
        db_session.add_all([user, config])
        db_session.commit()
        
        # Delete tenant
        db_session.delete(tenant)
        db_session.commit()
        
        # Check that user and config are also deleted
        assert db_session.query(User).filter_by(tenant_id=tenant.id).count() == 0
        assert db_session.query(TenantConfig).filter_by(tenant_id=tenant.id).count() == 0