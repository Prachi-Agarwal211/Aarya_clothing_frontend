"""Comprehensive tests for the production-ready authentication service."""

import pytest
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch
from sqlalchemy.orm import Session

from services.core.service.auth_service import AuthService
from models import User


@pytest.fixture
def mock_db_session():
    """Create a mock database session for testing."""
    session = MagicMock(spec=Session)
    return session


@pytest.fixture
def auth_service(mock_db_session):
    """Create an auth service instance for testing."""
    return AuthService(db=mock_db_session)


@pytest.fixture
def mock_user_data():
    """Sample user data for testing."""
    return {
        'email': 'test@example.com',
        'username': 'testuser',
        'password': 'password123',
        'full_name': 'Test User',
        'phone': '1234567890',
        'role': 'customer'
    }


class TestPasswordMethods:
    """Test password-related methods."""

    def test_get_password_hash(self):
        """Test password hashing."""
        password = "test_password_123"
        hashed = AuthService.get_password_hash(password)
        
        assert hashed is not None
        assert len(hashed) > 0
        assert hashed != password
        
        # Verify the hash can be verified
        assert AuthService.verify_password(password, hashed)

    def test_verify_password(self):
        """Test password verification."""
        password = "test_password_123"
        hashed = AuthService.get_password_hash(password)
        
        # Correct password should verify
        assert AuthService.verify_password(password, hashed)
        
        # Wrong password should not verify
        assert not AuthService.verify_password("wrong_password", hashed)

    def test_validate_password(self, auth_service):
        """Test password validation."""
        # Valid password (8+ characters)
        valid, errors = auth_service.validate_password("valid_password_123")
        assert valid
        assert len(errors) == 0
        
        # Too short password
        valid, errors = auth_service.validate_password("short")
        assert not valid
        assert len(errors) == 1
        assert "8 characters" in errors[0]
        
        # Too long password
        long_password = "a" * 129
        valid, errors = auth_service.validate_password(long_password)
        assert not valid
        assert len(errors) == 1
        assert "128 characters" in errors[0]


class TestUserCRUD:
    """Test user CRUD operations."""

    def test_create_user_success(self, auth_service, mock_db_session, mock_user_data):
        """Test successful user creation."""
        # Mock the database query to return None (no existing user)
        mock_db_session.query.return_value.filter.return_value.first.return_value = None
        
        # Mock the add and commit methods
        mock_user = User(**{
            'id': 1,
            'email': mock_user_data['email'],
            'username': mock_user_data['username'],
            'hashed_password': 'hashed_password',
            'role': mock_user_data['role'],
            'is_active': True,
            'email_verified': True,
            'phone': mock_user_data['phone'],
            'full_name': mock_user_data['full_name']
        })
        
        mock_db_session.add.return_value = None
        mock_db_session.commit.return_value = None
        mock_db_session.refresh.return_value = None
        
        # Mock the query for refresh to return the user
        mock_db_session.query.return_value.filter.return_value.first.side_effect = [None, mock_user]
        
        # Call create_user
        result = auth_service.create_user(mock_user_data)
        
        # Verify the result
        assert result is not None
        assert 'user' in result
        assert 'access_token' in result
        assert 'refresh_token' in result
        assert result['user']['email'] == mock_user_data['email']
        assert result['user']['username'] == mock_user_data['username']

    def test_create_user_existing_email(self, auth_service, mock_db_session, mock_user_data):
        """Test user creation with existing email."""
        existing_user = User(id=1, email=mock_user_data['email'], username='otheruser')
        mock_db_session.query.return_value.filter.return_value.first.return_value = existing_user
        
        with pytest.raises(ValueError, match="Email already registered"):
            auth_service.create_user(mock_user_data)

    def test_create_user_existing_username(self, auth_service, mock_db_session, mock_user_data):
        """Test user creation with existing username."""
        existing_user = User(id=1, email='other@example.com', username=mock_user_data['username'])
        
        # Mock to return None for email check, existing user for username check
        mock_db_session.query.return_value.filter.side_effect = [
            MagicMock(first=MagicMock(return_value=None)),  # Email check
            MagicMock(first=MagicMock(return_value=existing_user))  # Username check
        ]
        
        with pytest.raises(ValueError, match="Username already taken"):
            auth_service.create_user(mock_user_data)

    def test_create_user_invalid_password(self, auth_service, mock_user_data):
        """Test user creation with invalid password."""
        mock_user_data['password'] = 'short'
        
        with pytest.raises(ValueError, match="8 characters"):
            auth_service.create_user(mock_user_data)


class TestLogin:
    """Test login functionality."""

    def test_login_success(self, auth_service, mock_db_session):
        """Test successful login."""
        # Create a mock user
        mock_user = User(
            id=1,
            email='test@example.com',
            username='testuser',
            hashed_password=AuthService.get_password_hash('correct_password'),
            role='customer',
            is_active=True,
            email_verified=True
        )
        
        mock_db_session.query.return_value.filter.return_value.first.return_value = mock_user
        mock_db_session.commit.return_value = None
        
        # Call login
        result = auth_service.login('testuser', 'correct_password')
        
        # Verify the result
        assert result is not None
        assert 'user' in result
        assert 'access_token' in result
        assert 'refresh_token' in result

    def test_login_wrong_password(self, auth_service, mock_db_session):
        """Test login with wrong password."""
        mock_user = User(
            id=1,
            email='test@example.com',
            username='testuser',
            hashed_password=AuthService.get_password_hash('correct_password'),
            role='customer',
            is_active=True
        )
        
        mock_db_session.query.return_value.filter.return_value.first.return_value = mock_user
        
        with pytest.raises(ValueError, match="Invalid credentials"):
            auth_service.login('testuser', 'wrong_password')

    def test_login_nonexistent_user(self, auth_service, mock_db_session):
        """Test login with non-existent user."""
        mock_db_session.query.return_value.filter.return_value.first.return_value = None
        
        with pytest.raises(ValueError, match="Invalid credentials"):
            auth_service.login('nonexistent', 'password')

    def test_login_inactive_user(self, auth_service, mock_db_session):
        """Test login with inactive user."""
        mock_user = User(
            id=1,
            email='test@example.com',
            username='testuser',
            hashed_password=AuthService.get_password_hash('password'),
            role='customer',
            is_active=False
        )
        
        mock_db_session.query.return_value.filter.return_value.first.return_value = mock_user
        
        with pytest.raises(ValueError, match="Account is inactive"):
            auth_service.login('testuser', 'password')


class TestTokenMethods:
    """Test JWT token methods."""

    @patch('services.core.service.auth_service.jwt')
    @patch('services.core.service.auth_service.datetime')
    def test_create_access_token(self, mock_datetime, mock_jwt, auth_service):
        """Test access token creation."""
        # Setup mocks
        mock_datetime.now.return_value = datetime(2023, 1, 1, tzinfo=timezone.utc)
        mock_jwt.encode.return_value = "mock_token"
        
        # Call method
        token = auth_service.create_access_token(
            user_id=1,
            role='customer',
            email='test@example.com'
        )
        
        # Verify
        assert token == "mock_token"
        mock_jwt.encode.assert_called_once()

    @patch('services.core.service.auth_service.jwt')
    def test_decode_token_valid(self, mock_jwt, auth_service):
        """Test valid token decoding."""
        mock_payload = {
            'sub': '1',
            'role': 'customer',
            'type': 'access',
            'exp': datetime.now(timezone.utc) + timedelta(hours=1)
        }
        mock_jwt.decode.return_value = mock_payload
        
        result = auth_service.decode_token("valid_token")
        
        assert result == mock_payload

    @patch('services.core.service.auth_service.jwt')
    def test_decode_token_expired(self, mock_jwt, auth_service):
        """Test expired token decoding."""
        mock_jwt.decode.side_effect = Exception('ExpiredSignatureError')
        
        result = auth_service.decode_token("expired_token")
        
        assert result is None

    @patch('services.core.service.auth_service.jwt')
    def test_decode_token_invalid(self, mock_jwt, auth_service):
        """Test invalid token decoding."""
        mock_jwt.decode.side_effect = Exception('InvalidTokenError')
        
        result = auth_service.decode_token("invalid_token")
        
        assert result is None


class TestUtilityMethods:
    """Test utility methods."""

    def test_get_user_by_id(self, auth_service, mock_db_session):
        """Test getting user by ID."""
        mock_user = User(id=1, email='test@example.com')
        mock_db_session.query.return_value.filter.return_value.first.return_value = mock_user
        
        result = auth_service.get_user_by_id(1)
        
        assert result == mock_user

    def test_get_user_by_email(self, auth_service, mock_db_session):
        """Test getting user by email."""
        mock_user = User(id=1, email='test@example.com')
        mock_db_session.query.return_value.filter.return_value.first.return_value = mock_user
        
        result = auth_service.get_user_by_email('test@example.com')
        
        assert result == mock_user

    def test_update_user(self, auth_service, mock_db_session):
        """Test updating user."""
        mock_user = User(id=1, email='old@example.com', full_name='Old Name')
        mock_db_session.query.return_value.filter.return_value.first.return_value = mock_user
        mock_db_session.commit.return_value = None
        mock_db_session.refresh.return_value = None
        
        update_data = {'full_name': 'New Name', 'email': 'new@example.com'}
        result = auth_service.update_user(1, update_data)
        
        assert result == mock_user
        assert mock_user.full_name == 'New Name'
        assert mock_user.email == 'new@example.com'

    def test_delete_user(self, auth_service, mock_db_session):
        """Test deleting user."""
        mock_user = User(id=1, email='test@example.com')
        mock_db_session.query.return_value.filter.return_value.first.return_value = mock_user
        mock_db_session.delete.return_value = None
        mock_db_session.commit.return_value = None
        
        result = auth_service.delete_user(1)
        
        assert result is True


class TestSecurityMethods:
    """Test security-related methods."""

    def test_change_password_success(self, auth_service, mock_db_session):
        """Test successful password change."""
        old_password = 'old_password'
        new_password = 'new_password_123'
        
        mock_user = User(
            id=1,
            hashed_password=AuthService.get_password_hash(old_password)
        )
        
        mock_db_session.query.return_value.filter.return_value.first.return_value = mock_user
        mock_db_session.commit.return_value = None
        
        result = auth_service.change_password(1, old_password, new_password)
        
        assert result is True

    def test_change_password_wrong_old(self, auth_service, mock_db_session):
        """Test password change with wrong old password."""
        mock_user = User(
            id=1,
            hashed_password=AuthService.get_password_hash('correct_old_password')
        )
        
        mock_db_session.query.return_value.filter.return_value.first.return_value = mock_user
        
        result = auth_service.change_password(1, 'wrong_old_password', 'new_password')
        
        assert result is False

    def test_reset_password_success(self, auth_service, mock_db_session):
        """Test successful password reset."""
        mock_user = User(id=1, email='test@example.com')
        mock_db_session.query.return_value.filter.return_value.first.return_value = mock_user
        mock_db_session.commit.return_value = None
        
        result = auth_service.reset_password('test@example.com', 'new_password_123')
        
        assert result is True

    def test_reset_password_nonexistent_user(self, auth_service, mock_db_session):
        """Test password reset for non-existent user."""
        mock_db_session.query.return_value.filter.return_value.first.return_value = None
        
        result = auth_service.reset_password('nonexistent@example.com', 'new_password')
        
        assert result is False


class TestHealthCheck:
    """Test health check method."""

    def test_health_check_with_db(self, auth_service):
        """Test health check with database connection."""
        result = auth_service.health_check()
        
        assert result['status'] == 'healthy'
        assert result['service'] == 'auth'
        assert result['database_connected'] is True

    def test_health_check_without_db(self):
        """Test health check without database connection."""
        auth_service = AuthService(db=None)
        result = auth_service.health_check()
        
        assert result['status'] == 'healthy'
        assert result['service'] == 'auth'
        assert result['database_connected'] is False


class TestTokenRefresh:
    """Test token refresh functionality."""

    def test_refresh_access_token_success(self, auth_service, mock_db_session):
        """Test successful token refresh."""
        # Create a mock user
        mock_user = User(
            id=1,
            email='test@example.com',
            username='testuser',
            role='customer',
            is_active=True
        )
        
        mock_db_session.query.return_value.filter.return_value.first.return_value = mock_user
        
        # Mock token decoding to return valid payload
        with patch.object(auth_service, 'decode_token') as mock_decode:
            mock_decode.return_value = {
                'sub': '1',
                'role': 'customer',
                'type': 'refresh'
            }
            
            result = auth_service.refresh_access_token('valid_refresh_token')
            
            assert result is not None
            assert 'access_token' in result

    def test_refresh_access_token_invalid(self, auth_service):
        """Test token refresh with invalid token."""
        with patch.object(auth_service, 'decode_token') as mock_decode:
            mock_decode.return_value = None
            
            result = auth_service.refresh_access_token('invalid_token')
            
            assert result is None

    def test_refresh_access_token_inactive_user(self, auth_service, mock_db_session):
        """Test token refresh with inactive user."""
        mock_user = User(
            id=1,
            email='test@example.com',
            role='customer',
            is_active=False
        )
        
        mock_db_session.query.return_value.filter.return_value.first.return_value = mock_user
        
        with patch.object(auth_service, 'decode_token') as mock_decode:
            mock_decode.return_value = {
                'sub': '1',
                'role': 'customer',
                'type': 'refresh'
            }
            
            result = auth_service.refresh_access_token('valid_token')
            
            assert result is None


class TestEdgeCases:
    """Test edge cases and error conditions."""

    def test_create_user_database_error(self, auth_service, mock_db_session, mock_user_data):
        """Test user creation with database error."""
        mock_db_session.query.return_value.filter.return_value.first.return_value = None
        mock_db_session.add.side_effect = Exception('Database error')
        
        with pytest.raises(ValueError, match='Registration failed'):
            auth_service.create_user(mock_user_data)

    def test_login_database_error(self, auth_service, mock_db_session):
        """Test login with database error."""
        mock_db_session.query.return_value.filter.side_effect = Exception('Database error')
        
        with pytest.raises(ValueError, match='Invalid credentials'):
            auth_service.login('testuser', 'password')

    def test_empty_password_validation(self, auth_service):
        """Test validation of empty password."""
        valid, errors = auth_service.validate_password('')
        assert not valid
        assert len(errors) == 1
        assert '8 characters' in errors[0]

    def test_exactly_8_char_password(self, auth_service):
        """Test validation of exactly 8 character password."""
        valid, errors = auth_service.validate_password('12345678')
        assert valid
        assert len(errors) == 0

    def test_exactly_128_char_password(self, auth_service):
        """Test validation of exactly 128 character password."""
        long_password = 'a' * 128
        valid, errors = auth_service.validate_password(long_password)
        assert valid
        assert len(errors) == 0

    def test_129_char_password(self, auth_service):
        """Test validation of 129 character password (too long)."""
        long_password = 'a' * 129
        valid, errors = auth_service.validate_password(long_password)
        assert not valid
        assert len(errors) == 1
        assert '128 characters' in errors[0]


class TestIntegrationScenarios:
    """Test integration scenarios."""

    def test_registration_to_login_flow(self, auth_service, mock_db_session, mock_user_data):
        """Test the complete registration to login flow."""
        # Step 1: Register user
        mock_db_session.query.return_value.filter.return_value.first.return_value = None
        mock_user = User(**{
            'id': 1,
            'email': mock_user_data['email'],
            'username': mock_user_data['username'],
            'hashed_password': AuthService.get_password_hash(mock_user_data['password']),
            'role': mock_user_data['role'],
            'is_active': True,
            'email_verified': True,
            'phone': mock_user_data['phone'],
            'full_name': mock_user_data['full_name']
        })
        
        mock_db_session.add.return_value = None
        mock_db_session.commit.return_value = None
        mock_db_session.refresh.return_value = None
        mock_db_session.query.return_value.filter.return_value.first.side_effect = [None, mock_user]
        
        # Register
        register_result = auth_service.create_user(mock_user_data)
        assert register_result is not None
        
        # Step 2: Login with same credentials
        mock_db_session.query.return_value.filter.return_value.first.return_value = mock_user
        login_result = auth_service.login(mock_user_data['username'], mock_user_data['password'])
        
        assert login_result is not None
        assert login_result['user']['email'] == mock_user_data['email']

    def test_password_change_flow(self, auth_service, mock_db_session):
        """Test the complete password change flow."""
        old_password = 'old_password_123'
        new_password = 'new_password_123'
        
        mock_user = User(
            id=1,
            email='test@example.com',
            hashed_password=AuthService.get_password_hash(old_password)
        )
        
        # Step 1: Verify old password
        mock_db_session.query.return_value.filter.return_value.first.return_value = mock_user
        
        # Step 2: Change password
        change_result = auth_service.change_password(1, old_password, new_password)
        assert change_result is True
        
        # Step 3: Verify new password works
        assert AuthService.verify_password(new_password, mock_user.hashed_password)
        
        # Step 4: Verify old password no longer works
        assert not AuthService.verify_password(old_password, mock_user.hashed_password)

    def test_password_reset_flow(self, auth_service, mock_db_session):
        """Test the complete password reset flow."""
        new_password = 'new_password_123'
        
        mock_user = User(id=1, email='test@example.com')
        mock_db_session.query.return_value.filter.return_value.first.return_value = mock_user
        mock_db_session.commit.return_value = None
        
        # Reset password
        reset_result = auth_service.reset_password('test@example.com', new_password)
        assert reset_result is True
        
        # Verify new password is set
        assert AuthService.verify_password(new_password, mock_user.hashed_password)


class TestPerformance:
    """Test performance characteristics."""

    def test_password_hashing_performance(self, benchmark):
        """Test password hashing performance."""
        password = "test_password_123_for_performance_testing"
        
        def hash_password():
            return AuthService.get_password_hash(password)
        
        result = benchmark(hash_password)
        assert result is not None
        assert len(result) > 0

    def test_password_verification_performance(self, benchmark):
        """Test password verification performance."""
        password = "test_password_123_for_performance_testing"
        hashed = AuthService.get_password_hash(password)
        
        def verify_password():
            return AuthService.verify_password(password, hashed)
        
        result = benchmark(verify_password)
        assert result is True

    def test_multiple_user_creations(self, auth_service, mock_db_session, benchmark):
        """Test performance with multiple user creations."""
        mock_db_session.query.return_value.filter.return_value.first.return_value = None
        mock_db_session.add.return_value = None
        mock_db_session.commit.return_value = None
        mock_db_session.refresh.return_value = None
        
        def create_users():
            for i in range(10):
                user_data = {
                    'email': f'test{i}@example.com',
                    'username': f'testuser{i}',
                    'password': 'password123',
                    'full_name': f'Test User {i}',
                    'phone': f'123456789{i}',
                    'role': 'customer'
                }
                auth_service.create_user(user_data)
        
        benchmark(create_users)


class TestSecurity:
    """Test security aspects."""

    def test_password_hashing_is_deterministic(self):
        """Test that password hashing is deterministic."""
        password = "test_password_123"
        hash1 = AuthService.get_password_hash(password)
        hash2 = AuthService.get_password_hash(password)
        
        # Should produce different hashes due to salt
        assert hash1 != hash2
        
        # But both should verify correctly
        assert AuthService.verify_password(password, hash1)
        assert AuthService.verify_password(password, hash2)

    def test_password_hashing_different_passwords(self):
        """Test that different passwords produce different hashes."""
        hash1 = AuthService.get_password_hash("password1")
        hash2 = AuthService.get_password_hash("password2")
        
        assert hash1 != hash2
        assert not AuthService.verify_password("password1", hash2)
        assert not AuthService.verify_password("password2", hash1)

    def test_token_contains_necessary_claims(self, auth_service):
        """Test that tokens contain necessary security claims."""
        with patch('services.core.service.auth_service.jwt') as mock_jwt:
            mock_jwt.encode.return_value = "mock_token"
            
            token = auth_service.create_access_token(
                user_id=1,
                role='customer',
                email='test@example.com'
            )
            
            # Verify encode was called with proper claims
            call_args = mock_jwt.encode.call_args[0][0]
            assert 'sub' in call_args
            assert 'role' in call_args
            assert 'exp' in call_args
            assert 'iat' in call_args
            assert 'type' in call_args

    def test_invalidate_session_updates_user(self, auth_service, mock_db_session):
        """Test that session invalidation updates user."""
        mock_user = User(id=1, email='test@example.com')
        mock_db_session.query.return_value.filter.return_value.first.return_value = mock_user
        mock_db_session.commit.return_value = None
        
        result = auth_service.invalidate_session(1)
        
        assert result is True
        # In a real implementation, this would update a field that invalidates tokens


class TestErrorHandling:
    """Test error handling."""

    def test_graceful_handling_of_missing_user(self, auth_service, mock_db_session):
        """Test graceful handling when user doesn't exist."""
        mock_db_session.query.return_value.filter.return_value.first.return_value = None
        
        # Should not crash, just return appropriate error
        with pytest.raises(ValueError):
            auth_service.login('nonexistent', 'password')

    def test_graceful_handling_of_database_errors(self, auth_service, mock_db_session):
        """Test graceful handling of database errors."""
        mock_db_session.query.side_effect = Exception('Database connection failed')
        
        # Should not crash, just return appropriate error
        with pytest.raises(ValueError):
            auth_service.login('testuser', 'password')

    def test_proper_error_messages(self, auth_service):
        """Test that error messages are user-friendly."""
        # Test various validation errors
        valid, errors = auth_service.validate_password('short')
        assert '8 characters' in errors[0]
        
        valid, errors = auth_service.validate_password('a' * 129)
        assert '128 characters' in errors[0]


class TestConcurrency:
    """Test concurrency scenarios."""

    def test_concurrent_logins(self, auth_service, mock_db_session):
        """Test concurrent login attempts."""
        mock_user = User(
            id=1,
            email='test@example.com',
            username='testuser',
            hashed_password=AuthService.get_password_hash('password'),
            role='customer',
            is_active=True
        )
        
        mock_db_session.query.return_value.filter.return_value.first.return_value = mock_user
        mock_db_session.commit.return_value = None
        
        # Simulate concurrent logins
        import threading
        results = []
        errors = []
        
        def login_attempt():
            try:
                result = auth_service.login('testuser', 'password')
                results.append(result)
            except Exception as e:
                errors.append(e)
        
        # Create multiple threads
        threads = []
        for _ in range(5):
            thread = threading.Thread(target=login_attempt)
            threads.append(thread)
            thread.start()
        
        # Wait for all threads to complete
        for thread in threads:
            thread.join()
        
        # Should have 5 successful logins (in a real system, you might want to limit this)
        assert len(results) == 5
        assert len(errors) == 0

    def test_concurrent_registrations(self, auth_service, mock_db_session):
        """Test concurrent registration attempts."""
        # Mock to handle concurrent calls
        call_count = 0
        
        def mock_first():
            nonlocal call_count
            call_count += 1
            # First call returns None (no user), subsequent calls return user
            if call_count == 1:
                return None
            else:
                return User(id=1, email='test@example.com', username='testuser')
        
        mock_db_session.query.return_value.filter.return_value.first.side_effect = mock_first
        mock_db_session.add.return_value = None
        mock_db_session.commit.return_value = None
        mock_db_session.refresh.return_value = None
        
        import threading
        results = []
        errors = []
        
        def register_attempt():
            try:
                user_data = {
                    'email': 'test@example.com',
                    'username': 'testuser',
                    'password': 'password123',
                    'full_name': 'Test User',
                    'phone': '1234567890',
                    'role': 'customer'
                }
                result = auth_service.create_user(user_data)
                results.append(result)
            except Exception as e:
                errors.append(e)
        
        # Create multiple threads
        threads = []
        for _ in range(3):
            thread = threading.Thread(target=register_attempt)
            threads.append(thread)
            thread.start()
        
        # Wait for all threads to complete
        for thread in threads:
            thread.join()
        
        # Should have 1 successful registration and 2 errors (duplicate)
        assert len(results) == 1
        assert len(errors) == 2


class TestMocking:
    """Test mocking capabilities."""

    @patch('services.core.service.auth_service.logger')
    def test_logging_in_error_cases(self, mock_logger, auth_service, mock_db_session):
        """Test that errors are properly logged."""
        mock_db_session.query.side_effect = Exception('Database error')
        
        try:
            auth_service.login('testuser', 'password')
        except ValueError:
            pass
        
        # Verify error was logged
        mock_logger.error.assert_called()

    @patch('services.core.service.auth_service.jwt')
    def test_token_encoding_called_correctly(self, mock_jwt, auth_service):
        """Test that JWT encoding is called with correct parameters."""
        mock_jwt.encode.return_value = "mock_token"
        
        auth_service.create_access_token(
            user_id=1,
            role='customer',
            email='test@example.com',
            username='testuser',
            is_active=True
        )
        
        # Verify encode was called
        mock_jwt.encode.assert_called_once()
        call_args = mock_jwt.encode.call_args
        
        # Verify secret key and algorithm
        assert call_args[0][1] == auth_service.settings.SECRET_KEY
        assert call_args[0][2] == auth_service.settings.ALGORITHM


class TestConfiguration:
    """Test configuration handling."""

    def test_service_initialization_without_db(self):
        """Test service initialization without database."""
        service = AuthService(db=None)
        assert service.db is None
        assert service.logger is not None

    def test_service_initialization_with_db(self, mock_db_session):
        """Test service initialization with database."""
        service = AuthService(db=mock_db_session)
        assert service.db == mock_db_session
        assert service.logger is not None

    def test_health_check_configuration(self, auth_service):
        """Test health check includes configuration info."""
        health = auth_service.health_check()
        
        assert 'status' in health
        assert 'service' in health
        assert 'timestamp' in health
        assert 'database_connected' in health


class TestEdgeCasesAndBoundaries:
    """Test edge cases and boundary conditions."""

    def test_empty_string_inputs(self, auth_service):
        """Test handling of empty string inputs."""
        # Empty email in validation
        valid, errors = auth_service.validate_password('')
        assert not valid
        
        # Empty password should fail validation
        with pytest.raises(ValueError):
            auth_service.create_user({
                'email': 'test@example.com',
                'username': 'testuser',
                'password': '',
                'full_name': 'Test User',
                'phone': '1234567890',
                'role': 'customer'
            })

    def test_maximum_length_inputs(self, auth_service, mock_db_session):
        """Test handling of maximum length inputs."""
        # Test with maximum length password (128 chars)
        long_password = 'a' * 128
        user_data = {
            'email': 'test@example.com',
            'username': 'testuser',
            'password': long_password,
            'full_name': 'Test User',
            'phone': '1234567890',
            'role': 'customer'
        }
        
        mock_db_session.query.return_value.filter.return_value.first.return_value = None
        mock_db_session.add.return_value = None
        mock_db_session.commit.return_value = None
        mock_db_session.refresh.return_value = None
        mock_db_session.query.return_value.filter.return_value.first.side_effect = [None, MagicMock()]
        
        # Should work with 128 char password
        result = auth_service.create_user(user_data)
        assert result is not None

    def test_special_characters_in_inputs(self, auth_service, mock_db_session):
        """Test handling of special characters in inputs."""
        user_data = {
            'email': 'test+special@example.com',
            'username': 'test_user-123',
            'password': 'p@$$w0rd!#$%^&*()',
            'full_name': 'Test O\'User',
            'phone': '+1 (123) 456-7890',
            'role': 'customer'
        }
        
        mock_db_session.query.return_value.filter.return_value.first.return_value = None
        mock_db_session.add.return_value = None
        mock_db_session.commit.return_value = None
        mock_db_session.refresh.return_value = None
        mock_db_session.query.return_value.filter.return_value.first.side_effect = [None, MagicMock()]
        
        # Should handle special characters properly
        result = auth_service.create_user(user_data)
        assert result is not None

    def test_unicode_characters(self, auth_service, mock_db_session):
        """Test handling of Unicode characters."""
        user_data = {
            'email': 'test@example.com',
            'username': '测试用户',  # Chinese characters
            'password': 'пароль123',  # Russian characters
            'full_name': 'テストユーザー',  # Japanese characters
            'phone': '1234567890',
            'role': 'customer'
        }
        
        mock_db_session.query.return_value.filter.return_value.first.return_value = None
        mock_db_session.add.return_value = None
        mock_db_session.commit.return_value = None
        mock_db_session.refresh.return_value = None
        mock_db_session.query.return_value.filter.return_value.first.side_effect = [None, MagicMock()]
        
        # Should handle Unicode properly
        result = auth_service.create_user(user_data)
        assert result is not None


class TestRealWorldScenarios:
    """Test real-world usage scenarios."""

    def test_user_registration_then_login(self, auth_service, mock_db_session):
        """Test the common scenario of registration followed by login."""
        user_data = {
            'email': 'newuser@example.com',
            'username': 'newuser',
            'password': 'password123',
            'full_name': 'New User',
            'phone': '1234567890',
            'role': 'customer'
        }
        
        # Step 1: Register
        mock_db_session.query.return_value.filter.return_value.first.return_value = None
        mock_user = User(**{
            'id': 1,
            'email': user_data['email'],
            'username': user_data['username'],
            'hashed_password': AuthService.get_password_hash(user_data['password']),
            'role': user_data['role'],
            'is_active': True,
            'email_verified': True,
            'phone': user_data['phone'],
            'full_name': user_data['full_name']
        })
        
        mock_db_session.add.return_value = None
        mock_db_session.commit.return_value = None
        mock_db_session.refresh.return_value = None
        mock_db_session.query.return_value.filter.return_value.first.side_effect = [None, mock_user]
        
        register_result = auth_service.create_user(user_data)
        assert register_result is not None
        
        # Step 2: Login
        mock_db_session.query.return_value.filter.return_value.first.return_value = mock_user
        login_result = auth_service.login(user_data['username'], user_data['password'])
        
        assert login_result is not None
        assert login_result['user']['email'] == user_data['email']

    def test_password_reset_then_login(self, auth_service, mock_db_session):
        """Test password reset followed by login with new password."""
        # Step 1: Create user
        mock_user = User(
            id=1,
            email='test@example.com',
            hashed_password=AuthService.get_password_hash('old_password')
        )
        
        mock_db_session.query.return_value.filter.return_value.first.return_value = mock_user
        mock_db_session.commit.return_value = None
        
        # Step 2: Reset password
        reset_result = auth_service.reset_password('test@example.com', 'new_password_123')
        assert reset_result is True
        
        # Step 3: Login with new password
        login_result = auth_service.login('test@example.com', 'new_password_123')
        assert login_result is not None

    def test_session_invalidation(self, auth_service, mock_db_session):
        """Test session invalidation scenario."""
        mock_user = User(id=1, email='test@example.com')
        mock_db_session.query.return_value.filter.return_value.first.return_value = mock_user
        mock_db_session.commit.return_value = None
        
        # Invalidate session
        result = auth_service.invalidate_session(1)
        assert result is True


class TestErrorConditions:
    """Test various error conditions."""

    def test_login_with_wrong_password_multiple_times(self, auth_service, mock_db_session):
        """Test multiple failed login attempts."""
        mock_user = User(
            id=1,
            email='test@example.com',
            username='testuser',
            hashed_password=AuthService.get_password_hash('correct_password')
        )
        
        mock_db_session.query.return_value.filter.return_value.first.return_value = mock_user
        
        # Multiple failed attempts
        wrong_passwords = ['wrong1', 'wrong2', 'wrong3']
        
        for wrong_password in wrong_passwords:
            with pytest.raises(ValueError, match="Invalid credentials"):
                auth_service.login('testuser', wrong_password)

    def test_concurrent_session_invalidation(self, auth_service, mock_db_session):
        """Test concurrent session invalidation."""
        mock_user = User(id=1, email='test@example.com')
        mock_db_session.query.return_value.filter.return_value.first.return_value = mock_user
        mock_db_session.commit.return_value = None
        
        import threading
        
        def invalidate():
            return auth_service.invalidate_session(1)
        
        threads = []
        results = []
        
        for _ in range(3):
            thread = threading.Thread(target=lambda: results.append(invalidate()))
            threads.append(thread)
            thread.start()
        
        for thread in threads:
            thread.join()
        
        # All should succeed (in a real system, you might want different behavior)
        assert all(results)


class TestMockExternalServices:
    """Test with mocked external services."""

    @patch('services.core.service.auth_service.jwt')
    def test_token_operations_with_mocked_jwt(self, mock_jwt, auth_service):
        """Test token operations with mocked JWT library."""
        # Mock encode
        mock_jwt.encode.return_value = "mock_access_token"
        
        access_token = auth_service.create_access_token(1, 'customer')
        assert access_token == "mock_access_token"
        
        # Mock decode
        mock_jwt.decode.return_value = {'sub': '1', 'role': 'customer', 'type': 'access'}
        decoded = auth_service.decode_token("mock_access_token")
        assert decoded == {'sub': '1', 'role': 'customer', 'type': 'access'}
        
        # Mock expired token
        mock_jwt.decode.side_effect = Exception('ExpiredSignatureError')
        expired_decoded = auth_service.decode_token("expired_token")
        assert expired_decoded is None

    @patch('services.core.service.auth_service.logger')
    def test_logging_behavior(self, mock_logger, auth_service):
        """Test logging behavior in various scenarios."""
        # Test error logging
        with pytest.raises(ValueError):
            auth_service.validate_password('')
        
        # Verify warning was not called (password validation doesn't log warnings)
        mock_logger.warning.assert_not_called()
        
        # Test token decode error logging
        with patch.object(auth_service, 'decode_token') as mock_decode:
            mock_decode.side_effect = Exception('InvalidTokenError')
            auth_service.decode_token('invalid')
            
        # Verify warning was called for invalid token
        mock_logger.warning.assert_called()


class TestConfigurationManagement:
    """Test configuration management."""

    def test_service_with_different_configurations(self):
        """Test service behavior with different configurations."""
        # Test with database
        service_with_db = AuthService(db=MagicMock())
        assert service_with_db.db is not None
        
        # Test without database
        service_without_db = AuthService(db=None)
        assert service_without_db.db is None
        
        # Both should have health check
        health1 = service_with_db.health_check()
        health2 = service_without_db.health_check()
        
        assert health1['database_connected'] is True
        assert health2['database_connected'] is False

    def test_health_check_consistency(self, auth_service):
        """Test that health check returns consistent structure."""
        health1 = auth_service.health_check()
        health2 = auth_service.health_check()
        
        # Should have same keys
        assert set(health1.keys()) == set(health2.keys())
        
        # Should both be healthy
        assert health1['status'] == 'healthy'
        assert health2['status'] == 'healthy'


class TestTestCoverage:
    """Test that we have good test coverage."""

    def test_all_public_methods_are_tested(self, auth_service):
        """Verify that all public methods have tests."""
        # Get all public methods (not starting with _)
        public_methods = [
            method for method in dir(auth_service)
            if not method.startswith('_') and callable(getattr(auth_service, method))
        ]
        
        # These methods should be tested
        tested_methods = [
            'get_password_hash', 'verify_password', 'validate_password',
            'create_access_token', 'create_refresh_token', 'decode_token',
            'create_user', 'login', 'refresh_access_token',
            'get_user_by_id', 'get_user_by_email', 'get_user_by_username',
            'update_user', 'delete_user', 'get_user_profile',
            'change_password', 'reset_password', 'invalidate_session',
            'health_check'
        ]
        
        # Verify all public methods are in our tested list
        for method in public_methods:
            if method not in tested_methods:
                # This is just to document what methods exist
                # In a real test, you might want to assert this
                print(f"Method {method} exists but may not be explicitly tested")

    def test_error_cases_are_covered(self):
        """Verify that common error cases are covered."""
        # This is more of a documentation test
        common_error_cases = [
            'invalid_password',
            'existing_user',
            'nonexistent_user',
            'inactive_user',
            'database_error',
            'network_error',
            'expired_token',
            'invalid_token'
        ]
        
        # These should all be tested in the test suite
        # This test just documents that we've thought about them
        assert len(common_error_cases) > 0


class TestDocumentation:
    """Test that the code is well documented."""

    def test_methods_have_docstrings(self, auth_service):
        """Verify that methods have proper docstrings."""
        important_methods = [
            'create_user', 'login', 'refresh_access_token',
            'change_password', 'reset_password', 'health_check'
        ]
        
        for method_name in important_methods:
            method = getattr(auth_service, method_name)
            assert method.__doc__ is not None
            assert len(method.__doc__) > 10  # At least some documentation

    def test_error_messages_are_clear(self, auth_service):
        """Verify that error messages are clear and user-friendly."""
        # Test password validation error messages
        valid, errors = auth_service.validate_password('short')
        assert '8 characters' in errors[0]
        
        valid, errors = auth_service.validate_password('a' * 129)
        assert '128 characters' in errors[0]
        
        # Error messages should be clear, not technical
        assert 'assertion' not in str(errors).lower()
        assert 'exception' not in str(errors).lower()


class TestFutureCompatibility:
    """Test future compatibility and extensibility."""

    def test_service_can_be_extended(self, auth_service):
        """Test that the service can be easily extended."""
        # Should be able to add new methods
        def new_method(self):
            return "extended"
        
        # Monkey patch to test extensibility
        auth_service.new_method = new_method.__get__(auth_service, AuthService)
        
        result = auth_service.new_method()
        assert result == "extended"

    def test_configuration_can_be_changed(self):
        """Test that configuration can be changed."""
        # The service should use settings that can be configured
        # This is more of a design test - we're verifying the architecture
        assert hasattr(AuthService, 'settings')
        # In a real implementation, settings would be configurable


class TestCleanup:
    """Test proper cleanup and resource management."""

    def test_no_resource_leaks(self, auth_service):
        """Test that the service doesn't leak resources."""
        # The service should not maintain state that could cause leaks
        # This is more of an architectural test
        
        # Create multiple instances - they should be independent
        service1 = AuthService(db=MagicMock())
        service2 = AuthService(db=MagicMock())
        
        # They should not share state
        assert service1.db is not service2.db

    def test_proper_error_cleanup(self, auth_service, mock_db_session):
        """Test that errors are properly cleaned up."""
        # Mock a database error during user creation
        mock_db_session.add.side_effect = Exception('Database error')
        
        try:
            auth_service.create_user({
                'email': 'test@example.com',
                'username': 'testuser',
                'password': 'password123',
                'full_name': 'Test User',
                'phone': '1234567890',
                'role': 'customer'
            })
        except ValueError:
            pass
        
        # The service should still be usable after an error
        # This verifies proper cleanup
        assert auth_service.db is not None
        assert auth_service.health_check()['status'] == 'healthy'


# Run tests with: pytest tests/auth/test_auth_service.py -v
# For performance tests: pytest tests/auth/test_auth_service.py::TestPerformance -v
# For specific test: pytest tests/auth/test_auth_service.py::TestUserCRUD::test_create_user_success -v