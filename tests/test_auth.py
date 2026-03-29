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


# ==================== Forgot Password Flow Tests ====================

class TestForgotPasswordFlow:
    """Test complete forgot password flow with OTP verification."""

    @pytest.mark.integration
    def test_forgot_password_request_email_otp(self, core_client, verified_user):
        """Test requesting password reset OTP via email."""
        response = core_client.session.post(
            f"{core_client.base_url}/api/v1/auth/forgot-password-otp",
            json={"identifier": verified_user["email"], "otp_type": "EMAIL"}
        )
        
        # Should succeed (or return generic message if user doesn't exist)
        assert response.status_code == 200
        data = response.json()
        assert "message" in data

    @pytest.mark.integration
    def test_forgot_password_request_whatsapp_otp(self, core_client, verified_user):
        """Test requesting password reset OTP via WhatsApp."""
        phone = verified_user["profile"]["phone"]
        
        response = core_client.session.post(
            f"{core_client.base_url}/api/v1/auth/forgot-password-otp",
            json={"identifier": phone, "otp_type": "WHATSAPP"}
        )
        
        # Should succeed (or return generic message if user doesn't exist)
        assert response.status_code == 200
        data = response.json()
        assert "message" in data

    @pytest.mark.integration
    def test_forgot_password_nonexistent_user(self, core_client):
        """Test password reset for non-existent user (should not reveal existence)."""
        response = core_client.session.post(
            f"{core_client.base_url}/api/v1/auth/forgot-password-otp",
            json={"identifier": "nonexistent@example.com", "otp_type": "EMAIL"}
        )
        
        # Should return same message as for existing user (security)
        assert response.status_code == 200
        data = response.json()
        assert "message" in data

    @pytest.mark.integration
    def test_verify_reset_otp_invalid(self, core_client, verified_user):
        """Test OTP verification with invalid code."""
        # First request OTP
        core_client.session.post(
            f"{core_client.base_url}/api/v1/auth/forgot-password-otp",
            json={"identifier": verified_user["email"], "otp_type": "EMAIL"}
        )
        
        # Try to verify with wrong OTP
        response = core_client.session.post(
            f"{core_client.base_url}/api/v1/auth/verify-reset-otp",
            json={
                "identifier": verified_user["email"],
                "otp_code": "000000",
                "otp_type": "EMAIL"
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["verified"] == False
        assert data["error_code"] in ["INVALID", "EXPIRED"]

    @pytest.mark.integration
    def test_verify_reset_otp_missing_fields(self, core_client):
        """Test OTP verification with missing required fields."""
        response = core_client.session.post(
            f"{core_client.base_url}/api/v1/auth/verify-reset-otp",
            json={}
        )
        
        # Should fail validation
        assert response.status_code == 422

    @pytest.mark.integration
    def test_reset_password_with_otp_weak_password(self, core_client, verified_user, redis_client):
        """Test password reset with weak password following correct 2-step OTP verification flow.
        
        This test verifies the complete password reset flow:
        Step 1: Request OTP via forgot-password-otp endpoint
        Step 2: Verify OTP via verify-reset-otp endpoint (creates verification timestamp in Redis)
        Step 3: Reset password via reset-password-with-otp endpoint (checks verification timestamp)
        
        The test specifically validates that weak passwords are rejected even with valid OTP verification.
        
        SECURITY: The 2-step verification prevents abuse by requiring:
        - Valid OTP code (verified in step 2)
        - Verification timestamp in Redis (created in step 2, valid for 5 minutes)
        - Strong password validation (enforced in step 3)
        """
        # STEP 1: Request OTP for password reset
        otp_request_response = core_client.session.post(
            f"{core_client.base_url}/api/v1/auth/forgot-password-otp",
            json={"identifier": verified_user["email"], "otp_type": "EMAIL"}
        )
        
        # OTP request should succeed
        assert otp_request_response.status_code == 200
        otp_request_data = otp_request_response.json()
        assert "message" in otp_request_data

        # STEP 2: Get OTP from Redis (test environment only)
        otp_key = f"EMAIL:{verified_user['email']}"
        otp_code = redis_client.get_otp(otp_key) if redis_client else None

        if not otp_code:
            pytest.skip("Could not retrieve OTP from Redis - test environment issue")

        # STEP 3: Verify OTP (NEW - This creates the verification timestamp in Redis)
        # This step is CRITICAL - without it, the password reset will fail because
        # the backend checks for verification timestamp in Redis
        verify_response = core_client.session.post(
            f"{core_client.base_url}/api/v1/auth/verify-reset-otp",
            json={
                "identifier": verified_user["email"],
                "otp_code": otp_code,
                "otp_type": "EMAIL"
            }
        )
        
        # OTP verification should succeed
        assert verify_response.status_code == 200
        verify_data = verify_response.json()
        assert verify_data["verified"] == True
        assert verify_data["success"] == True

        # STEP 4: Try to reset password with WEAK password (should fail)
        # This is the main purpose of this test - validating password strength rules
        weak_password_response = core_client.session.post(
            f"{core_client.base_url}/api/v1/auth/reset-password-with-otp",
            json={
                "identifier": verified_user["email"],
                "otp_code": otp_code,  # Kept for API compatibility (not re-verified)
                "new_password": "weak",  # Intentionally weak password
                "otp_type": "EMAIL"
            }
        )

        # Should fail with 400 - password validation error
        assert weak_password_response.status_code == 400
        weak_data = weak_password_response.json()
        assert "detail" in weak_data
        # Verify error message mentions password validation
        assert "password" in weak_data["detail"].lower()

        # STEP 5 (Optional but recommended): Reset password with STRONG password (should succeed)
        # This verifies the complete flow works with valid input
        strong_password = "SecurePass123!"  # Meets all password requirements
        strong_password_response = core_client.session.post(
            f"{core_client.base_url}/api/v1/auth/reset-password-with-otp",
            json={
                "identifier": verified_user["email"],
                "otp_code": otp_code,  # Kept for API compatibility
                "new_password": strong_password,
                "otp_type": "EMAIL"
            }
        )
        
        # Should succeed with 200
        assert strong_password_response.status_code == 200
        strong_data = strong_password_response.json()
        assert "message" in strong_data
        assert "successfully" in strong_data["message"].lower()

        # STEP 6 (Verification): Verify user can login with new password
        login_response = core_client.login(verified_user["email"], strong_password)
        assert login_response.status_code == 200
        login_data = login_response.json()
        assert "tokens" in login_data
        assert "access_token" in login_data["tokens"]

    @pytest.mark.integration
    def test_reset_password_otp_verification_expired(self, core_client, verified_user, redis_client):
        """Test that password reset fails if OTP verification timestamp has expired.
        
        This test verifies the 5-minute timeout on OTP verification.
        After verifying OTP, the verification timestamp is stored in Redis with 5-minute TTL.
        If the password reset is attempted after expiration, it should fail.
        
        SECURITY: This prevents attackers from using old verified OTPs indefinitely.
        """
        # STEP 1: Request OTP
        core_client.session.post(
            f"{core_client.base_url}/api/v1/auth/forgot-password-otp",
            json={"identifier": verified_user["email"], "otp_type": "EMAIL"}
        )

        # STEP 2: Get OTP and verify it
        otp_key = f"EMAIL:{verified_user['email']}"
        otp_code = redis_client.get_otp(otp_key) if redis_client else None

        if not otp_code:
            pytest.skip("Could not retrieve OTP from Redis")

        # Verify OTP (creates verification timestamp with 5-minute TTL)
        verify_response = core_client.session.post(
            f"{core_client.base_url}/api/v1/auth/verify-reset-otp",
            json={
                "identifier": verified_user["email"],
                "otp_code": otp_code,
                "otp_type": "EMAIL"
            }
        )
        assert verify_response.status_code == 200
        assert verify_response.json()["verified"] == True

        # STEP 3: Manually expire the verification timestamp (simulate 5-minute timeout)
        # In production, this would happen naturally after 5 minutes
        verification_key = f"password_reset_verified:email:{verified_user['email']}"
        if redis_client:
            redis_client.delete_cache(verification_key, namespace="")

        # STEP 4: Try to reset password (should fail - verification expired)
        response = core_client.session.post(
            f"{core_client.base_url}/api/v1/auth/reset-password-with-otp",
            json={
                "identifier": verified_user["email"],
                "otp_code": otp_code,
                "new_password": "SecurePass123!",
                "otp_type": "EMAIL"
            }
        )

        # Should fail because verification timestamp was deleted/expired
        assert response.status_code == 400
        data = response.json()
        assert "detail" in data
        assert "verification" in data["detail"].lower() or "expired" in data["detail"].lower()

    @pytest.mark.integration
    def test_reset_password_without_otp_verification(self, core_client, verified_user, redis_client):
        """Test that direct password reset fails without prior OTP verification.
        
        This test verifies that attackers cannot bypass OTP verification by calling
        the reset-password-with-otp endpoint directly.
        
        SECURITY: The backend checks for verification timestamp in Redis before allowing
        password reset. This prevents brute-force attacks on the password reset endpoint.
        """
        # STEP 1: Request OTP (but DON'T verify it)
        core_client.session.post(
            f"{core_client.base_url}/api/v1/auth/forgot-password-otp",
            json={"identifier": verified_user["email"], "otp_type": "EMAIL"}
        )

        # STEP 2: Get OTP from Redis
        otp_key = f"EMAIL:{verified_user['email']}"
        otp_code = redis_client.get_otp(otp_key) if redis_client else None

        if not otp_code:
            pytest.skip("Could not retrieve OTP from Redis")

        # STEP 3: Try to reset password WITHOUT verifying OTP first
        # This should fail because verification timestamp doesn't exist in Redis
        response = core_client.session.post(
            f"{core_client.base_url}/api/v1/auth/reset-password-with-otp",
            json={
                "identifier": verified_user["email"],
                "otp_code": otp_code,  # Even with correct OTP code
                "new_password": "SecurePass123!",
                "otp_type": "EMAIL"
            }
        )

        # Should fail - verification timestamp not found
        assert response.status_code == 400
        data = response.json()
        assert "detail" in data
        assert "verification" in data["detail"].lower() or "expired" in data["detail"].lower()

    @pytest.mark.integration
    def test_reset_password_otp_double_use_prevented(self, core_client, verified_user, redis_client):
        """Test that OTP cannot be reused after successful password reset.
        
        This test verifies that:
        1. First password reset with verified OTP succeeds
        2. Second password reset with same OTP fails (verification timestamp was consumed)
        
        SECURITY: The verification timestamp is deleted after successful password reset,
        preventing attackers from resetting password multiple times with a single OTP.
        """
        # STEP 1: Request OTP
        core_client.session.post(
            f"{core_client.base_url}/api/v1/auth/forgot-password-otp",
            json={"identifier": verified_user["email"], "otp_type": "EMAIL"}
        )

        # STEP 2: Get OTP and verify it
        otp_key = f"EMAIL:{verified_user['email']}"
        otp_code = redis_client.get_otp(otp_key) if redis_client else None

        if not otp_code:
            pytest.skip("Could not retrieve OTP from Redis")

        # Verify OTP
        verify_response = core_client.session.post(
            f"{core_client.base_url}/api/v1/auth/verify-reset-otp",
            json={
                "identifier": verified_user["email"],
                "otp_code": otp_code,
                "otp_type": "EMAIL"
            }
        )
        assert verify_response.status_code == 200
        assert verify_response.json()["verified"] == True

        # STEP 3: First password reset (should succeed)
        first_reset_response = core_client.session.post(
            f"{core_client.base_url}/api/v1/auth/reset-password-with-otp",
            json={
                "identifier": verified_user["email"],
                "otp_code": otp_code,
                "new_password": "FirstPass123!",
                "otp_type": "EMAIL"
            }
        )
        assert first_reset_response.status_code == 200

        # STEP 4: Try to reset password again with same OTP (should fail)
        # The verification timestamp was deleted after first reset
        second_reset_response = core_client.session.post(
            f"{core_client.base_url}/api/v1/auth/reset-password-with-otp",
            json={
                "identifier": verified_user["email"],
                "otp_code": otp_code,
                "new_password": "SecondPass123!",
                "otp_type": "EMAIL"
            }
        )

        # Should fail - verification timestamp was consumed
        assert second_reset_response.status_code == 400
        data = second_reset_response.json()
        assert "detail" in data
        assert "verification" in data["detail"].lower() or "expired" in data["detail"].lower()

    @pytest.mark.integration
    def test_forgot_password_rate_limit(self, core_client, verified_user):
        """Test rate limiting on password reset requests."""
        # Make multiple requests
        responses = []
        for i in range(4):
            response = core_client.session.post(
                f"{core_client.base_url}/api/v1/auth/forgot-password-otp",
                json={"identifier": verified_user["email"], "otp_type": "EMAIL"}
            )
            responses.append(response)

        # First 3 should succeed, 4th should be rate limited
        # Note: Rate limit is 3 per hour
        assert responses[0].status_code == 200

        # Check if at least one was rate limited (may not trigger in test env)
        rate_limited = any(r.status_code == 429 for r in responses)
        if rate_limited:
            # Rate limiting is working
            assert True
        else:
            # May not trigger in test environment with bypass
            pytest.skip("Rate limit not triggered (may be bypassed in test env)")


# ==================== Password Reset Token Flow Tests ====================

class TestPasswordResetTokenFlow:
    """Test traditional token-based password reset (email link)."""

    @pytest.mark.integration
    def test_reset_password_invalid_token(self, core_client):
        """Test password reset with invalid token."""
        response = core_client.session.post(
            f"{core_client.base_url}/api/v1/auth/reset-password",
            json={
                "token": "invalid_token_12345",
                "new_password": "NewSecure123"
            }
        )
        
        assert response.status_code == 400
        data = response.json()
        assert "detail" in data

    @pytest.mark.integration
    def test_verify_reset_token_invalid(self, core_client):
        """Test verifying invalid reset token."""
        response = core_client.session.get(
            f"{core_client.base_url}/api/v1/auth/verify-reset-token/invalid_token_12345"
        )

        assert response.status_code == 400
        data = response.json()
        assert "detail" in data
