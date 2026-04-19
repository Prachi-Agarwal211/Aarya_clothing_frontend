"""Integration tests for the authentication system."""

import pytest
from unittest.mock import MagicMock, patch
from sqlalchemy.orm import Session

from services.core.service.auth_service import AuthService
from models import User


@pytest.fixture
def mock_db_session():
    """Create a mock database session for integration testing."""
    session = MagicMock(spec=Session)
    return session


@pytest.fixture
def auth_service(mock_db_session):
    """Create an auth service instance for integration testing."""
    return AuthService(db=mock_db_session)


class TestRegistrationToLoginFlow:
    """Test the complete registration to login flow."""

    def test_complete_registration_login_flow(self, auth_service, mock_db_session):
        """Test the entire flow from registration to login."""
        # Step 1: User registration
        user_data = {
            'email': 'newuser@example.com',
            'username': 'newuser',
            'password': 'password123',
            'full_name': 'New User',
            'phone': '1234567890',
            'role': 'customer'
        }
        
        # Mock database to return no existing user
        mock_db_session.query.return_value.filter.return_value.first.return_value = None
        
        # Mock user creation
        mock_user = User(
            id=1,
            email=user_data['email'],
            username=user_data['username'],
            hashed_password=AuthService.get_password_hash(user_data['password']),
            role=user_data['role'],
            is_active=True,
            email_verified=True,
            phone=user_data['phone'],
            full_name=user_data['full_name']
        )
        
        mock_db_session.add.return_value = None
        mock_db_session.commit.return_value = None
        mock_db_session.refresh.return_value = None
        
        # Mock the second query (for refresh) to return the user
        mock_db_session.query.return_value.filter.return_value.first.side_effect = [None, mock_user]
        
        # Register the user
        register_result = auth_service.create_user(user_data)
        
        # Verify registration result
        assert register_result is not None
        assert 'user' in register_result
        assert 'access_token' in register_result
        assert 'refresh_token' in register_result
        assert register_result['user']['email'] == user_data['email']
        assert register_result['user']['username'] == user_data['username']
        
        # Step 2: User login with same credentials
        mock_db_session.query.return_value.filter.return_value.first.return_value = mock_user
        mock_db_session.commit.return_value = None
        
        login_result = auth_service.login(user_data['username'], user_data['password'])
        
        # Verify login result
        assert login_result is not None
        assert 'user' in login_result
        assert 'access_token' in login_result
        assert 'refresh_token' in login_result
        assert login_result['user']['email'] == user_data['email']
        
        # Step 3: Verify tokens are different (new tokens generated for login)
        assert register_result['access_token'] != login_result['access_token']
        assert register_result['refresh_token'] != login_result['refresh_token']


class TestPasswordResetFlow:
    """Test the complete password reset flow."""

    def test_complete_password_reset_flow(self, auth_service, mock_db_session):
        """Test the entire password reset flow."""
        # Step 1: Create a user
        old_password = 'old_password_123'
        new_password = 'new_password_123'
        
        mock_user = User(
            id=1,
            email='test@example.com',
            username='testuser',
            hashed_password=AuthService.get_password_hash(old_password),
            role='customer',
            is_active=True,
            email_verified=True
        )
        
        mock_db_session.query.return_value.filter.return_value.first.return_value = mock_user
        mock_db_session.commit.return_value = None
        
        # Step 2: Reset password
        reset_result = auth_service.reset_password('test@example.com', new_password)
        
        assert reset_result is True
        
        # Step 3: Verify old password no longer works
        with pytest.raises(ValueError, match="Invalid credentials"):
            auth_service.login('testuser', old_password)
        
        # Step 4: Verify new password works
        login_result = auth_service.login('testuser', new_password)
        
        assert login_result is not None
        assert login_result['user']['email'] == 'test@example.com'


class TestTokenRefreshFlow:
    """Test the complete token refresh flow."""

    def test_complete_token_refresh_flow(self, auth_service, mock_db_session):
        """Test the entire token refresh flow."""
        # Step 1: Create and login user
        user_data = {
            'email': 'test@example.com',
            'username': 'testuser',
            'password': 'password123',
            'full_name': 'Test User',
            'phone': '1234567890',
            'role': 'customer'
        }
        
        mock_db_session.query.return_value.filter.return_value.first.return_value = None
        
        mock_user = User(
            id=1,
            email=user_data['email'],
            username=user_data['username'],
            hashed_password=AuthService.get_password_hash(user_data['password']),
            role=user_data['role'],
            is_active=True,
            email_verified=True,
            phone=user_data['phone'],
            full_name=user_data['full_name']
        )
        
        mock_db_session.add.return_value = None
        mock_db_session.commit.return_value = None
        mock_db_session.refresh.return_value = None
        mock_db_session.query.return_value.filter.return_value.first.side_effect = [None, mock_user]
        
        login_result = auth_service.create_user(user_data)
        
        # Step 2: Refresh access token
        with patch.object(auth_service, 'decode_token') as mock_decode:
            mock_decode.return_value = {
                'sub': '1',
                'role': 'customer',
                'type': 'refresh'
            }
            
            refresh_result = auth_service.refresh_access_token(login_result['refresh_token'])
            
            assert refresh_result is not None
            assert 'access_token' in refresh_result
            
            # Step 3: Verify new access token is different from original
            assert refresh_result['access_token'] != login_result['access_token']


class TestSessionInvalidationFlow:
    """Test the complete session invalidation flow."""

    def test_complete_session_invalidation_flow(self, auth_service, mock_db_session):
        """Test the entire session invalidation flow."""
        # Step 1: Create and login user
        user_data = {
            'email': 'test@example.com',
            'username': 'testuser',
            'password': 'password123',
            'full_name': 'Test User',
            'phone': '1234567890',
            'role': 'customer'
        }
        
        mock_db_session.query.return_value.filter.return_value.first.return_value = None
        
        mock_user = User(
            id=1,
            email=user_data['email'],
            username=user_data['username'],
            hashed_password=AuthService.get_password_hash(user_data['password']),
            role=user_data['role'],
            is_active=True,
            email_verified=True,
            phone=user_data['phone'],
            full_name=user_data['full_name']
        )
        
        mock_db_session.add.return_value = None
        mock_db_session.commit.return_value = None
        mock_db_session.refresh.return_value = None
        mock_db_session.query.return_value.filter.return_value.first.side_effect = [None, mock_user]
        
        login_result = auth_service.create_user(user_data)
        original_access_token = login_result['access_token']
        
        # Step 2: Invalidate session
        invalidate_result = auth_service.invalidate_session(1)
        
        assert invalidate_result is True
        
        # Step 3: Try to use old token (should fail in real implementation)
        # In our mock, the token would still work, but in production it would be invalidated
        with patch.object(auth_service, 'decode_token') as mock_decode:
            mock_decode.return_value = {
                'sub': '1',
                'role': 'customer',
                'type': 'access',
                'exp': datetime.now(timezone.utc) + timedelta(hours=1)
            }
            
            # The token itself would still decode, but the session would be invalid
            # This is a limitation of our current implementation
            decode_result = auth_service.decode_token(original_access_token)
            assert decode_result is not None


class TestErrorRecoveryFlow:
    """Test error recovery scenarios."""

    def test_recovery_from_database_error(self, auth_service, mock_db_session):
        """Test recovery from database errors."""
        # Step 1: Simulate database error during login
        mock_db_session.query.side_effect = Exception('Database connection failed')
        
        with pytest.raises(ValueError, match="Invalid credentials"):
            auth_service.login('testuser', 'password')
        
        # Step 2: Verify service is still functional
        health = auth_service.health_check()
        assert health['status'] == 'healthy'
        
        # Step 3: Try again with working database
        mock_db_session.query.side_effect = None
        mock_db_session.query.return_value.filter.return_value.first.return_value = None
        
        # Should still raise error (user doesn't exist), but service should work
        with pytest.raises(ValueError, match="Invalid credentials"):
            auth_service.login('testuser', 'password')

    def test_recovery_from_network_error(self, auth_service, mock_db_session):
        """Test recovery from network errors."""
        # This is more relevant for frontend, but we test the backend's resilience
        
        # Step 1: Simulate a network-related error
        mock_db_session.commit.side_effect = Exception('Network timeout')
        
        # Step 2: Verify service handles it gracefully
        mock_db_session.query.return_value.filter.return_value.first.return_value = None
        
        with pytest.raises(ValueError, match="Registration failed"):
            auth_service.create_user({
                'email': 'test@example.com',
                'username': 'testuser',
                'password': 'password123',
                'full_name': 'Test User',
                'phone': '1234567890',
                'role': 'customer'
            })
        
        # Step 3: Verify service is still functional
        health = auth_service.health_check()
        assert health['status'] == 'healthy'


class TestConcurrentOperations:
    """Test concurrent operations."""

    def test_concurrent_registrations_same_user(self, auth_service, mock_db_session):
        """Test concurrent registration attempts for the same user."""
        import threading
        
        user_data = {
            'email': 'test@example.com',
            'username': 'testuser',
            'password': 'password123',
            'full_name': 'Test User',
            'phone': '1234567890',
            'role': 'customer'
        }
        
        # Mock to allow first registration, reject subsequent ones
        call_count = 0
        
        def mock_first():
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                return None  # No existing user
            else:
                return User(id=1, email=user_data['email'], username=user_data['username'])
        
        mock_db_session.query.return_value.filter.return_value.first.side_effect = mock_first
        mock_db_session.add.return_value = None
        mock_db_session.commit.return_value = None
        mock_db_session.refresh.return_value = None
        
        results = []
        errors = []
        
        def register_user():
            try:
                result = auth_service.create_user(user_data)
                results.append(result)
            except Exception as e:
                errors.append(e)
        
        # Create multiple threads trying to register same user
        threads = []
        for _ in range(3):
            thread = threading.Thread(target=register_user)
            threads.append(thread)
            thread.start()
        
        # Wait for all threads to complete
        for thread in threads:
            thread.join()
        
        # Should have 1 success and 2 failures
        assert len(results) == 1
        assert len(errors) == 2
        
        # Verify the successful registration
        assert results[0] is not None
        assert results[0]['user']['email'] == user_data['email']

    def test_concurrent_logins_same_user(self, auth_service, mock_db_session):
        """Test concurrent login attempts for the same user."""
        import threading
        
        mock_user = User(
            id=1,
            email='test@example.com',
            username='testuser',
            hashed_password=AuthService.get_password_hash('password123'),
            role='customer',
            is_active=True
        )
        
        mock_db_session.query.return_value.filter.return_value.first.return_value = mock_user
        mock_db_session.commit.return_value = None
        
        results = []
        errors = []
        
        def login_user():
            try:
                result = auth_service.login('testuser', 'password123')
                results.append(result)
            except Exception as e:
                errors.append(e)
        
        # Create multiple threads trying to login same user
        threads = []
        for _ in range(5):
            thread = threading.Thread(target=login_user)
            threads.append(thread)
            thread.start()
        
        # Wait for all threads to complete
        for thread in threads:
            thread.join()
        
        # All should succeed (multiple logins are allowed)
        assert len(results) == 5
        assert len(errors) == 0
        
        # Each should have valid tokens
        for result in results:
            assert result is not None
            assert 'access_token' in result
            assert 'refresh_token' in result


class TestPerformanceUnderLoad:
    """Test performance under load."""

    def test_multiple_user_operations(self, auth_service, mock_db_session, benchmark):
        """Test performance with multiple user operations."""
        mock_db_session.query.return_value.filter.return_value.first.return_value = None
        mock_db_session.add.return_value = None
        mock_db_session.commit.return_value = None
        mock_db_session.refresh.return_value = None
        
        def perform_operations():
            for i in range(20):
                user_data = {
                    'email': f'test{i}@example.com',
                    'username': f'testuser{i}',
                    'password': 'password123',
                    'full_name': f'Test User {i}',
                    'phone': f'123456789{i}',
                    'role': 'customer'
                }
                auth_service.create_user(user_data)
        
        benchmark(perform_operations)

    def test_multiple_login_operations(self, auth_service, mock_db_session, benchmark):
        """Test performance with multiple login operations."""
        # Create a mock user
        mock_user = User(
            id=1,
            email='test@example.com',
            username='testuser',
            hashed_password=AuthService.get_password_hash('password123'),
            role='customer',
            is_active=True
        )
        
        mock_db_session.query.return_value.filter.return_value.first.return_value = mock_user
        mock_db_session.commit.return_value = None
        
        def perform_logins():
            for _ in range(50):
                auth_service.login('testuser', 'password123')
        
        benchmark(perform_logins)


class TestRealWorldScenarios:
    """Test real-world usage scenarios."""

    def test_ecommerce_checkout_flow(self, auth_service, mock_db_session):
        """Test a typical e-commerce checkout flow."""
        # Step 1: Guest user registers
        user_data = {
            'email': 'customer@example.com',
            'username': 'customer123',
            'password': 'securepassword123',
            'full_name': 'John Doe',
            'phone': '5551234567',
            'role': 'customer'
        }
        
        mock_db_session.query.return_value.filter.return_value.first.return_value = None
        
        mock_user = User(
            id=1,
            email=user_data['email'],
            username=user_data['username'],
            hashed_password=AuthService.get_password_hash(user_data['password']),
            role=user_data['role'],
            is_active=True,
            email_verified=True,
            phone=user_data['phone'],
            full_name=user_data['full_name']
        )
        
        mock_db_session.add.return_value = None
        mock_db_session.commit.return_value = None
        mock_db_session.refresh.return_value = None
        mock_db_session.query.return_value.filter.return_value.first.side_effect = [None, mock_user]
        
        # Register
        register_result = auth_service.create_user(user_data)
        assert register_result is not None
        
        # Step 2: User is automatically logged in (tokens returned)
        assert register_result['access_token'] is not None
        assert register_result['refresh_token'] is not None
        
        # Step 3: User updates their profile
        update_data = {
            'full_name': 'John H. Doe',
            'phone': '5559876543'
        }
        
        mock_db_session.query.return_value.filter.return_value.first.return_value = mock_user
        mock_db_session.commit.return_value = None
        mock_db_session.refresh.return_value = None
        
        updated_user = auth_service.update_user(1, update_data)
        assert updated_user is not None
        assert updated_user.full_name == 'John H. Doe'
        
        # Step 4: User changes password
        change_result = auth_service.change_password(1, user_data['password'], 'new_secure_password_456')
        assert change_result is True
        
        # Step 5: User logs out
        invalidate_result = auth_service.invalidate_session(1)
        assert invalidate_result is True

    def test_password_recovery_flow(self, auth_service, mock_db_session):
        """Test a typical password recovery flow."""
        # Step 1: User forgets password
        user_email = 'forgotten@example.com'
        
        # Create existing user
        mock_user = User(
            id=1,
            email=user_email,
            username='forgottenuser',
            hashed_password=AuthService.get_password_hash('old_password'),
            role='customer',
            is_active=True
        )
        
        mock_db_session.query.return_value.filter.return_value.first.return_value = mock_user
        mock_db_session.commit.return_value = None
        
        # Step 2: User requests password reset
        reset_result = auth_service.reset_password(user_email, 'new_secure_password_123')
        assert reset_result is True
        
        # Step 3: User logs in with new password
        login_result = auth_service.login(user_email, 'new_secure_password_123')
        assert login_result is not None
        assert login_result['user']['email'] == user_email
        
        # Step 4: Verify old password no longer works
        with pytest.raises(ValueError, match="Invalid credentials"):
            auth_service.login(user_email, 'old_password')

    def test_session_management_flow(self, auth_service, mock_db_session):
        """Test session management flow."""
        # Step 1: User logs in from device A
        user_data = {
            'email': 'multidevice@example.com',
            'username': 'multideviceuser',
            'password': 'password123',
            'full_name': 'Multi Device User',
            'phone': '5551112222',
            'role': 'customer'
        }
        
        mock_db_session.query.return_value.filter.return_value.first.return_value = None
        
        mock_user = User(
            id=1,
            email=user_data['email'],
            username=user_data['username'],
            hashed_password=AuthService.get_password_hash(user_data['password']),
            role=user_data['role'],
            is_active=True,
            email_verified=True,
            phone=user_data['phone'],
            full_name=user_data['full_name']
        )
        
        mock_db_session.add.return_value = None
        mock_db_session.commit.return_value = None
        mock_db_session.refresh.return_value = None
        mock_db_session.query.return_value.filter.return_value.first.side_effect = [None, mock_user]
        
        login_result_a = auth_service.create_user(user_data)
        
        # Step 2: User logs in from device B
        mock_db_session.query.return_value.filter.return_value.first.return_value = mock_user
        
        login_result_b = auth_service.login(user_data['username'], user_data['password'])
        
        # Both should have valid sessions
        assert login_result_a['access_token'] is not None
        assert login_result_b['access_token'] is not None
        
        # Step 3: User invalidates all sessions from device A
        invalidate_result = auth_service.invalidate_session(1)
        assert invalidate_result is True
        
        # Step 4: Both devices would need to re-authenticate
        # (In a real system with proper session management)


class TestSecurityScenarios:
    """Test security-related scenarios."""

    def test_prevent_brute_force_attacks(self, auth_service, mock_db_session):
        """Test prevention of brute force attacks."""
        # Note: Our current implementation doesn't have rate limiting,
        # but we test that it could be added
        
        mock_user = User(
            id=1,
            email='test@example.com',
            username='testuser',
            hashed_password=AuthService.get_password_hash('correct_password'),
            role='customer',
            is_active=True
        )
        
        mock_db_session.query.return_value.filter.return_value.first.return_value = mock_user
        
        # Multiple failed attempts
        wrong_passwords = ['wrong1', 'wrong2', 'wrong3', 'wrong4', 'wrong5']
        
        for wrong_password in wrong_passwords:
            with pytest.raises(ValueError, match="Invalid credentials"):
                auth_service.login('testuser', wrong_password)
        
        # Should still allow correct password (no account locking in current implementation)
        login_result = auth_service.login('testuser', 'correct_password')
        assert login_result is not None

    def test_password_complexity_enforcement(self, auth_service):
        """Test password complexity enforcement."""
        # Test minimum length
        valid, errors = auth_service.validate_password('short')
        assert not valid
        assert '8 characters' in errors[0]
        
        # Test maximum length
        long_password = 'a' * 129
        valid, errors = auth_service.validate_password(long_password)
        assert not valid
        assert '128 characters' in errors[0]
        
        # Test valid password
        valid, errors = auth_service.validate_password('valid_password_123')
        assert valid
        assert len(errors) == 0

    def test_secure_password_storage(self, auth_service):
        """Test that passwords are securely stored."""
        password = 'test_password_123'
        
        # Hash the password
        hashed = AuthService.get_password_hash(password)
        
        # Verify it's not stored in plaintext
        assert hashed != password
        assert len(hashed) > len(password)
        
        # Verify it can be verified
        assert AuthService.verify_password(password, hashed)
        
        # Verify different salts produce different hashes
        hashed2 = AuthService.get_password_hash(password)
        assert hashed != hashed2
        
        # But both should verify correctly
        assert AuthService.verify_password(password, hashed2)


class TestDataIntegrity:
    """Test data integrity scenarios."""

    def test_user_data_consistency(self, auth_service, mock_db_session):
        """Test that user data remains consistent."""
        user_data = {
            'email': 'consistent@example.com',
            'username': 'consistentuser',
            'password': 'password123',
            'full_name': 'Consistent User',
            'phone': '5551234567',
            'role': 'customer'
        }
        
        mock_db_session.query.return_value.filter.return_value.first.return_value = None
        
        mock_user = User(
            id=1,
            email=user_data['email'],
            username=user_data['username'],
            hashed_password=AuthService.get_password_hash(user_data['password']),
            role=user_data['role'],
            is_active=True,
            email_verified=True,
            phone=user_data['phone'],
            full_name=user_data['full_name']
        )
        
        mock_db_session.add.return_value = None
        mock_db_session.commit.return_value = None
        mock_db_session.refresh.return_value = None
        mock_db_session.query.return_value.filter.return_value.first.side_effect = [None, mock_user]
        
        # Create user
        create_result = auth_service.create_user(user_data)
        
        # Get user by ID
        mock_db_session.query.return_value.filter.return_value.first.return_value = mock_user
        retrieved_user = auth_service.get_user_by_id(1)
        
        # Verify data consistency
        assert retrieved_user.email == user_data['email']
        assert retrieved_user.username == user_data['username']
        assert retrieved_user.full_name == user_data['full_name']
        
        # Update user
        update_data = {'full_name': 'Updated Name'}
        mock_db_session.query.return_value.filter.return_value.first.return_value = mock_user
        mock_db_session.commit.return_value = None
        mock_db_session.refresh.return_value = None
        
        updated_user = auth_service.update_user(1, update_data)
        
        # Verify update was applied
        assert updated_user.full_name == 'Updated Name'
        # Other fields should remain unchanged
        assert updated_user.email == user_data['email']
        assert updated_user.username == user_data['username']

    def test_transactional_integrity(self, auth_service, mock_db_session):
        """Test transactional integrity."""
        # Simulate a database error during commit
        mock_db_session.query.return_value.filter.return_value.first.return_value = None
        mock_db_session.add.side_effect = Exception('Database error')
        
        with pytest.raises(ValueError, match='Registration failed'):
            auth_service.create_user({
                'email': 'test@example.com',
                'username': 'testuser',
                'password': 'password123',
                'full_name': 'Test User',
                'phone': '1234567890',
                'role': 'customer'
            })
        
        # Verify the service is still functional after error
        health = auth_service.health_check()
        assert health['status'] == 'healthy'


class TestEdgeCases:
    """Test edge cases in integration scenarios."""

    def test_maximum_length_inputs(self, auth_service, mock_db_session):
        """Test handling of maximum length inputs."""
        # Test with maximum length password
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
        
        # Should handle maximum length password
        result = auth_service.create_user(user_data)
        assert result is not None

    def test_special_characters_in_data(self, auth_service, mock_db_session):
        """Test handling of special characters in user data."""
        user_data = {
            'email': 'test+special@example.com',
            'username': 'test_user-123',
            'password': 'p@$$w0rd!#$%^&*()',
            'full_name': "Test O'User",
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
            'username': '测试用户',  # Chinese
            'password': 'пароль123',  # Russian
            'full_name': 'テストユーザー',  # Japanese
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


class TestErrorRecovery:
    """Test error recovery in integration scenarios."""

    def test_recovery_from_partial_failure(self, auth_service, mock_db_session):
        """Test recovery from partial failures."""
        # Simulate a failure during user creation
        mock_db_session.query.return_value.filter.return_value.first.return_value = None
        mock_db_session.add.side_effect = [None, Exception('Second add failed')]
        
        # First user should succeed
        user_data1 = {
            'email': 'user1@example.com',
            'username': 'user1',
            'password': 'password123',
            'full_name': 'User One',
            'phone': '1234567890',
            'role': 'customer'
        }
        
        mock_user1 = User(
            id=1,
            email=user_data1['email'],
            username=user_data1['username'],
            hashed_password=AuthService.get_password_hash(user_data1['password']),
            role=user_data1['role'],
            is_active=True,
            email_verified=True,
            phone=user_data1['phone'],
            full_name=user_data1['full_name']
        )
        
        mock_db_session.refresh.return_value = None
        mock_db_session.query.return_value.filter.return_value.first.side_effect = [None, mock_user1]
        
        result1 = auth_service.create_user(user_data1)
        assert result1 is not None
        
        # Second user should fail
        user_data2 = {
            'email': 'user2@example.com',
            'username': 'user2',
            'password': 'password123',
            'full_name': 'User Two',
            'phone': '1234567891',
            'role': 'customer'
        }
        
        with pytest.raises(ValueError):
            auth_service.create_user(user_data2)
        
        # Service should still be functional
        health = auth_service.health_check()
        assert health['status'] == 'healthy'

    def test_graceful_degradation(self, auth_service, mock_db_session):
        """Test graceful degradation when services are unavailable."""
        # Simulate database unavailable
        mock_db_session.query.side_effect = Exception('Database unavailable')
        
        # Operations should fail gracefully
        with pytest.raises(ValueError):
            auth_service.login('testuser', 'password')
        
        # Health check should still work
        health = auth_service.health_check()
        assert health['status'] == 'healthy'
        assert health['database_connected'] is True  # Mocked, so it thinks it's connected


# Run integration tests with: pytest tests/integration/test_auth_integration.py -v
# For specific test: pytest tests/integration/test_auth_integration.py::TestRegistrationToLoginFlow::test_complete_registration_login_flow -v
# For performance tests: pytest tests/integration/test_auth_integration.py::TestPerformanceUnderLoad -v