#!/usr/bin/env python3
"""
Test Script for GST Invoice System and Size Guide Feature

Usage:
    python test_invoice_size_guide.py

Requirements:
    - Commerce service running on localhost:8001
    - Valid JWT token for authentication
"""

import requests
import json
import sys
from typing import Optional

# Configuration
BASE_URL = "http://localhost:8001"
AUTH_TOKEN = "YOUR_JWT_TOKEN_HERE"  # Replace with actual token

def print_section(title: str):
    """Print section header."""
    print("\n" + "=" * 60)
    print(f"  {title}")
    print("=" * 60)

def test_size_guide_categories():
    """Test getting all size guide categories."""
    print_section("TEST: Get Size Guide Categories")
    
    try:
        response = requests.get(f"{BASE_URL}/api/v1/size-guide/categories")
        response.raise_for_status()
        
        categories = response.json()
        print(f"✅ Success! Found {len(categories)} categories:")
        for cat in categories[:10]:  # Show first 10
            print(f"   - {cat}")
        if len(categories) > 10:
            print(f"   ... and {len(categories) - 10} more")
        
        return True
    except Exception as e:
        print(f"❌ Failed: {e}")
        return False

def test_size_guide_chart(category: str = "kurta"):
    """Test getting size chart for a category."""
    print_section(f"TEST: Get Size Chart for '{category}'")
    
    try:
        response = requests.get(f"{BASE_URL}/api/v1/size-guide?category={category}")
        response.raise_for_status()
        
        data = response.json()
        print(f"✅ Success! Size chart for {category}:")
        
        if 'size_chart' in data:
            print(f"   Available sizes: {len(data['size_chart'])}")
            for size in data['size_chart'][:3]:  # Show first 3
                print(f"   - Size {size['size']}: {json.dumps(size, indent=6)}")
        
        return True
    except Exception as e:
        print(f"❌ Failed: {e}")
        return False

def test_size_recommendation():
    """Test AI-powered size recommendation."""
    print_section("TEST: Size Recommendation")
    
    test_cases = [
        {
            "category": "kurta",
            "height_cm": 160,
            "weight_kg": 55,
            "age": 28,
            "fit_preference": "regular"
        },
        {
            "category": "dress",
            "height_cm": 170,
            "weight_kg": 70,
            "age": 35,
            "fit_preference": "slim"
        },
        {
            "category": "tops",
            "height_cm": 155,
            "weight_kg": 50,
            "age": 22,
            "fit_preference": "relaxed"
        }
    ]
    
    for i, test_data in enumerate(test_cases, 1):
        print(f"\nTest Case {i}: {test_data['category']} (H:{test_data['height_cm']}cm, W:{test_data['weight_kg']}kg, {test_data['fit_preference']})")
        
        try:
            response = requests.post(
                f"{BASE_URL}/api/v1/size-guide/recommend",
                json=test_data,
                headers={"Content-Type": "application/json"}
            )
            response.raise_for_status()
            
            result = response.json()
            print(f"   ✅ Recommended: {result['recommended_size']} (Confidence: {result['confidence_score']}%)")
            print(f"   Reasoning: {result['reasoning']}")
            
            if result.get('alternative_sizes'):
                print(f"   Alternatives: {', '.join([s['size'] for s in result['alternative_sizes']])}")
                
        except Exception as e:
            print(f"   ❌ Failed: {e}")
            return False
    
    return True

def test_measurement_guide():
    """Test getting measurement guide."""
    print_section("TEST: Measurement Guide")
    
    try:
        response = requests.get(f"{BASE_URL}/api/v1/size-guide/measurements")
        response.raise_for_status()
        
        data = response.json()
        print(f"✅ Success! Measurement guide has {len(data.get('measurements', {}))} measurement types:")
        
        for key, value in list(data.get('measurements', {}).items())[:3]:
            print(f"   - {value['name']}: {value['description'][:60]}...")
        
        return True
    except Exception as e:
        print(f"❌ Failed: {e}")
        return False

def test_fit_types():
    """Test getting fit type descriptions."""
    print_section("TEST: Fit Types")
    
    try:
        response = requests.get(f"{BASE_URL}/api/v1/size-guide/fit-types")
        response.raise_for_status()
        
        data = response.json()
        print(f"✅ Success! Fit types available:")
        
        for key, value in data.get('fit_types', {}).items():
            print(f"   - {value['name']}: {value['recommendation']}")
        
        return True
    except Exception as e:
        print(f"❌ Failed: {e}")
        return False

def test_hsn_codes():
    """Test getting HSN codes."""
    print_section("TEST: HSN Codes")
    
    categories = ["kurta", "saree", "lehenga", "mens_shirt"]
    
    for category in categories:
        try:
            response = requests.get(f"{BASE_URL}/api/v1/size-guide/hsn-codes?category={category}")
            response.raise_for_status()
            
            data = response.json()
            print(f"   ✅ {category}: HSN {data['hsn_code']} - {data.get('description', 'N/A')[:50]}")
            
        except Exception as e:
            print(f"   ❌ {category}: {e}")
            return False
    
    return True

def test_invoice_download(order_id: int):
    """Test invoice PDF download."""
    print_section(f"TEST: Invoice Download (Order #{order_id})")
    
    if AUTH_TOKEN == "YOUR_JWT_TOKEN_HERE":
        print("⚠️  Skipping - Please set AUTH_TOKEN in the script")
        return True
    
    try:
        headers = {"Authorization": f"Bearer {AUTH_TOKEN}"}
        response = requests.get(
            f"{BASE_URL}/api/v1/orders/{order_id}/invoice",
            headers=headers
        )
        
        if response.status_code == 404:
            print(f"⚠️  Order {order_id} not found - trying with order ID 1")
            return test_invoice_download(1)
        
        response.raise_for_status()
        
        # Save PDF
        filename = f"test_invoice_{order_id}.pdf"
        with open(filename, 'wb') as f:
            f.write(response.content)
        
        print(f"✅ Success! Invoice downloaded: {filename}")
        print(f"   Content-Type: {response.headers.get('Content-Type')}")
        print(f"   File Size: {len(response.content)} bytes")
        
        return True
    except Exception as e:
        print(f"❌ Failed: {e}")
        return False

def run_all_tests():
    """Run all tests."""
    print("\n" + "🎯" * 30)
    print("  GST Invoice & Size Guide - Test Suite")
    print("🎯" * 30)
    
    results = {
        "Size Guide Categories": test_size_guide_categories(),
        "Size Chart (Kurta)": test_size_guide_chart("kurta"),
        "Size Chart (Dress)": test_size_guide_chart("dress"),
        "Size Recommendation": test_size_recommendation(),
        "Measurement Guide": test_measurement_guide(),
        "Fit Types": test_fit_types(),
        "HSN Codes": test_hsn_codes(),
        "Invoice Download": test_invoice_download(1),
    }
    
    # Summary
    print_section("TEST SUMMARY")
    
    passed = sum(1 for v in results.values() if v)
    total = len(results)
    
    for test_name, result in results.items():
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status} - {test_name}")
    
    print(f"\nTotal: {passed}/{total} tests passed ({passed/total*100:.1f}%)")
    
    if passed == total:
        print("\n🎉 All tests passed! Features are working correctly.")
        return 0
    else:
        print(f"\n⚠️  {total - passed} test(s) failed. Please check the output above.")
        return 1

if __name__ == "__main__":
    sys.exit(run_all_tests())
