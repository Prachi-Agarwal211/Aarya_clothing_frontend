"""
High Traffic Performance Test
Tests system capacity for 100+ concurrent users
"""
import pytest
import asyncio
import httpx
from datetime import datetime
import random
import string

# Test configuration
BASE_URL = "http://localhost:5001"
CONCURRENT_USERS = 150  # Test with 150 concurrent users
TEST_DURATION = 60  # 60 seconds

# Generate random test data
def random_email():
    return f"test_{''.join(random.choices(string.ascii_lowercase, k=8))}@example.com"

def random_username():
    return f"user_{''.join(random.choices(string.ascii_lowercase + string.digits, k=6))}"

def random_password():
    return ''.join(random.choices(string.ascii_letters + string.digits, k=10))

@pytest.mark.asyncio
async def test_high_traffic_registration():
    """Test 100+ concurrent registrations"""
    async with httpx.AsyncClient(timeout=30) as client:
        tasks = []
        
        for i in range(CONCURRENT_USERS):
            email = random_email()
            username = random_username()
            password = random_password()
            
            task = asyncio.create_task(
                client.post(
                    f"{BASE_URL}/api/v1/auth/register",
                    json={
                        "full_name": f"Test User {i}",
                        "username": username,
                        "email": email,
                        "phone": f"1234567{i:03d}",
                        "password": password,
                        "verification_method": "otp_email"
                    }
                )
            )
            tasks.append(task)
        
        # Run all tasks concurrently
        start_time = datetime.now()
        responses = await asyncio.gather(*tasks, return_exceptions=True)
        end_time = datetime.now()
        
        # Analyze results
        success_count = sum(1 for r in responses if isinstance(r, httpx.Response) and r.status_code == 201)
        error_count = sum(1 for r in responses if isinstance(r, Exception) or (isinstance(r, httpx.Response) and r.status_code != 201))
        duration = (end_time - start_time).total_seconds()
        
        print(f"\n📊 Registration Test Results:")
        print(f"   Successful: {success_count}/{CONCURRENT_USERS}")
        print(f"   Errors: {error_count}/{CONCURRENT_USERS}")
        print(f"   Duration: {duration:.2f} seconds")
        print(f"   Rate: {CONCURRENT_USERS/duration:.2f} req/sec")
        
        # Should handle at least 100 concurrent registrations
        assert success_count >= 100, f"Only {success_count} successful registrations"
        assert duration < 10, f"Took {duration:.2f}s (should be < 10s)"

@pytest.mark.asyncio
async def test_high_traffic_login():
    """Test 100+ concurrent logins"""
    # First create test users
    test_users = []
    async with httpx.AsyncClient(timeout=30) as client:
        for i in range(50):  # Create 50 test users
            email = random_email()
            username = random_username()
            password = random_password()
            
            reg_response = await client.post(
                f"{BASE_URL}/api/v1/auth/register",
                json={
                    "full_name": f"Test User {i}",
                    "username": username,
                    "email": email,
                    "phone": f"1234567{i:03d}",
                    "password": password,
                    "verification_method": "otp_email"
                }
            )
            
            if reg_response.status_code == 201:
                test_users.append((email, password))
    
    # Test concurrent logins
    async with httpx.AsyncClient(timeout=30) as client:
        tasks = []
        
        for email, password in test_users:
            for _ in range(3):  # 3 logins per user
                task = asyncio.create_task(
                    client.post(
                        f"{BASE_URL}/api/v1/auth/login",
                        json={"identifier": email, "password": password}
                    )
                )
                tasks.append(task)
        
        start_time = datetime.now()
        responses = await asyncio.gather(*tasks, return_exceptions=True)
        end_time = datetime.now()
        
        success_count = sum(1 for r in responses if isinstance(r, httpx.Response) and r.status_code == 200)
        error_count = sum(1 for r in responses if isinstance(r, Exception) or (isinstance(r, httpx.Response) and r.status_code != 200))
        duration = (end_time - start_time).total_seconds()
        
        print(f"\n📊 Login Test Results:")
        print(f"   Successful: {success_count}/{len(tasks)}")
        print(f"   Errors: {error_count}/{len(tasks)}")
        print(f"   Duration: {duration:.2f} seconds")
        print(f"   Rate: {len(tasks)/duration:.2f} req/sec")
        
        # Should handle at least 100 concurrent logins
        assert success_count >= 100, f"Only {success_count} successful logins"
        assert duration < 5, f"Took {duration:.2f}s (should be < 5s)"

@pytest.mark.asyncio
async def test_rate_limiting():
    """Test that rate limiting works under load"""
    async with httpx.AsyncClient(timeout=30) as client:
        # Try to exceed rate limit
        errors = []
        for i in range(30):  # Should hit rate limit after 10-20 requests
            try:
                response = await client.post(
                    f"{BASE_URL}/api/v1/auth/register",
                    json={
                        "full_name": f"Test User {i}",
                        "username": random_username(),
                        "email": random_email(),
                        "phone": f"1234567{i:03d}",
                        "password": random_password(),
                        "verification_method": "otp_email"
                    }
                )
                if response.status_code == 429:
                    errors.append("Rate limited")
                    break
            except Exception as e:
                errors.append(str(e))
        
        # Should get rate limited
        assert len(errors) > 0, "Rate limiting not working"
        print(f"\n✅ Rate limiting working: {len(errors)} requests blocked")

if __name__ == "__main__":
    import asyncio
    
    print("Running high traffic tests...")
    asyncio.run(test_high_traffic_registration())
    asyncio.run(test_high_traffic_login())
    asyncio.run(test_rate_limiting())
    print("\n✅ All performance tests completed!")
