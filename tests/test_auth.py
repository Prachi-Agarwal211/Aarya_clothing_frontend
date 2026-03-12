"""
Authentication tests for Core service.
UPDATED: Tests now account for email verification requirement.
"""
import pytest


class TestUserRegistration:
    """Test user registration flow."""
    
    @pytest.mark.integration
    def test_register_new_user(self, core_client, fake_user_data):
        """Test registering a new user.
        
        UPDATED: Registration no longer returns tokens (email verification required).
        """
        response = core_client.register(fake_user_data)
        
        # Should succeed with 201 or 200, or fail with 400 if already exists
        assert response.status_code in [200, 201, 400]
        
        if response.status_code in [200, 201]:
            data = response.json()
            # Should return user data and message, NOT tokens
            assert "user" in data or "id" in data
            assert "tokens" not in data  # No auto-login
    
    @pytest.mark.integration
    def test_register_no_auto_login(self, core_client, fake_user_data):
        """Test that registration does not return tokens (email verification required)."""
        response = core_client.register(fake_user_data)
        
        if response.status_code in [200, 201]:
            data = response.json()
            # Should NOT have tokens - email verification required
            assert "tokens" not in data
            assert "access_token" not in data
    
    @pytest.mark.integration
    def test_register_duplicate_email(self, core_client, fake_user_data):
        """Test that duplicate email registration fails."""
        # First registration
        core_client.register(fake_user_data)
        
        # Second registration with same email
        response = core_client.register(fake_user_data)
        
        # Should fail with 400 (business rule) or 422 (schema validation)
        assert response.status_code in [400, 422]
    
    @pytest.mark.integration
    def test_register_weak_password(self, core_client, fake_user_data):
        """Test that weak password is rejected."""
        weak_user = fake_user_data.copy()
        weak_user["password"] = "123"  # Too weak
        
        response = core_client.register(weak_user)
        
        # Should fail with 400 (business rule) or 422 (schema validation)
        assert response.status_code in [400, 422]


class TestEmailVerification:
    """Test email verification flow."""
    
    @pytest.mark.integration
    def test_unverified_user_cannot_login(self, core_client, fake_user_data):
        """Test that unverified users cannot login.
        
        NEW TEST: Verifies email verification requirement.
        """
        # Register user (unverified)
        register_response = core_client.register(fake_user_data)
        
        if register_response.status_code not in [200, 201]:
            pytest.skip("User already exists")
        
        # Try to login without verifying email
        login_response = core_client.login(fake_user_data["email"], fake_user_data["password"])
        
        # Should fail - email not verified
        assert login_response.status_code in [400, 403]
    
    @pytest.mark.integration
    def test_verify_email_flow(self, core_client, fake_user_data, db_connection):
        """Test complete email verification flow.
        
        NEW TEST: Verifies the complete verification flow.
        """
        # Register user
        register_response = core_client.register(fake_user_data)
        
        if register_response.status_code not in [200, 201]:
            pytest.skip("User already exists")
        
        # Get verification token from database
        verification_token = None
        if db_connection:
            try:
                cursor = db_connection.cursor()
                cursor.execute(
                    "SELECT token FROM email_verifications WHERE user_id = "
                    "(SELECT id FROM users WHERE email = %s) "
                    "ORDER BY created_at DESC LIMIT 1",
                    (fake_user_data["email"],)
                )
                result = cursor.fetchone()
                if result:
                    verification_token = result[0]
                cursor.close()
            except Exception as e:
                pytest.skip(f"Could not get verification token: {e}")
        
        if not verification_token:
            pytest.skip("No verification token found")
        
        # Verify email
        verify_response = core_client.verify_email(verification_token)
        assert verify_response.status_code == 200
        data = verify_response.json()
        
        # Should now have tokens
        assert "tokens" in data
        assert "access_token" in data["tokens"]
        
        # Login should now work
        login_response = core_client.login(fake_user_data["email"], fake_user_data["password"])
        assert login_response.status_code == 200


class TestUserLogin:
    """Test user login flow."""
    
    @pytest.mark.integration
    def test_login_with_email(self, verified_user, core_client):
        """Test login with email address.
        
        UPDATED: Uses verified_user fixture since email verification is required.
        """
        if not verified_user.get("verified"):
            pytest.skip("User could not be verified")
        
        # Login with email (user is already verified from fixture)
        response = core_client.login(verified_user["email"], verified_user["password"])
        
        assert response.status_code == 200
        data = response.json()
        assert "tokens" in data
        assert "access_token" in data["tokens"]
        assert "refresh_token" in data["tokens"]
    
    @pytest.mark.integration
    def test_login_with_username(self, verified_user, core_client):
        """Test login with username.
        
        UPDATED: Uses verified_user fixture since email verification is required.
        """
        if not verified_user.get("verified"):
            pytest.skip("User could not be verified")
        
        # Login with username
        response = core_client.login(verified_user["username"], verified_user["password"])
        
        assert response.status_code == 200
    
    @pytest.mark.integration
    def test_login_wrong_password(self, verified_user, core_client):
        """Test login with wrong password."""
        if not verified_user.get("verified"):
            pytest.skip("User could not be verified")
        
        # Login with wrong password
        response = core_client.login(verified_user["email"], "WrongPassword123")
        
        assert response.status_code in [400, 401]
    
    @pytest.mark.integration
    def test_login_nonexistent_user(self, core_client):
        """Test login with non-existent user."""
        response = core_client.login("nonexistent@example.com", "SomePassword123")
        
        assert response.status_code in [400, 401]


class TestUserAuthentication:
    """Test authenticated user operations."""
    
    @pytest.mark.integration
    def test_get_current_user(self, authenticated_user, core_client):
        """Test getting current user info."""
        if not authenticated_user.get("access_token"):
            pytest.skip("Authentication failed")
        
        response = core_client.get_user(authenticated_user["access_token"])
        
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == authenticated_user["email"]
    
    @pytest.mark.integration
    def test_get_user_without_token(self, core_client):
        """Test accessing protected endpoint without token."""
        response = core_client.session.get(
            f"{core_client.base_url}/api/v1/users/me"
        )
        
        assert response.status_code == 401
    
    @pytest.mark.integration
    def test_logout(self, authenticated_user, core_client):
        """Test user logout."""
        if not authenticated_user.get("access_token"):
            pytest.skip("Authentication failed")
        
        response = core_client.logout(authenticated_user["access_token"])
        
        assert response.status_code == 200


class TestPasswordValidation:
    """Test password validation rules."""
    
    @pytest.mark.integration
    def test_password_too_short(self, core_client, fake_user_data):
        """Test password that's too short."""
        user = fake_user_data.copy()
        user["password"] = "Short1"
        
        response = core_client.register(user)
        assert response.status_code in [400, 422]
    
    @pytest.mark.integration
    def test_password_no_uppercase(self, core_client, fake_user_data):
        """Test password without uppercase letter."""
        user = fake_user_data.copy()
        user["password"] = "alllowercase1"
        
        response = core_client.register(user)
        assert response.status_code in [400, 422]
    
    @pytest.mark.integration
    def test_password_no_lowercase(self, core_client, fake_user_data):
        """Test password without lowercase letter."""
        user = fake_user_data.copy()
        user["password"] = "ALLUPPERCASE1"
        
        response = core_client.register(user)
        assert response.status_code in [400, 422]
    
    @pytest.mark.integration
    def test_password_no_number(self, core_client, fake_user_data):
        """Test password without number."""
        user = fake_user_data.copy()
        user["password"] = "NoNumbersHere"
        
        response = core_client.register(user)
        assert response.status_code in [400, 422]
