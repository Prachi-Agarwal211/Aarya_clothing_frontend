#!/usr/bin/env python3
"""Test AI endpoints without external API calls"""

import requests
import json

def test_ai_endpoints():
    base_url = "http://localhost:6005/api/v1/ai"
    
    print("Testing AI endpoints...")
    
    # Test customer chat (should return 401 without auth, or proper error without API key)
    try:
        response = requests.post(
            f"{base_url}/customer/chat",
            json={"message": "Hello"},
            headers={"Content-Type": "application/json"}
        )
        print(f"Customer chat status: {response.status_code}")
        if response.status_code != 200:
            print(f"Expected error: {response.text[:200]}")
    except Exception as e:
        print(f"Customer chat error: {e}")
    
    # Test admin chat (should return 401 without auth)
    try:
        response = requests.post(
            f"{base_url}/admin/chat",
            json={"message": "Hello"},
            headers={"Content-Type": "application/json"}
        )
        print(f"Admin chat status: {response.status_code}")
        if response.status_code != 200:
            print(f"Expected error: {response.text[:200]}")
    except Exception as e:
        print(f"Admin chat error: {e}")

if __name__ == "__main__":
    test_ai_endpoints()
