#!/usr/bin/env python3
"""
Test script to verify INTERNAL_SERVICE_SECRET is loaded correctly.
Run this in the service container to debug settings loading.
"""

import sys
import os

# Add parent directory to path for shared imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

print("=" * 60)
print("Testing INTERNAL_SERVICE_SECRET Loading")
print("=" * 60)

# Test 1: Check if .env file exists
env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env')
print(f"\n1. Checking .env file at: {env_path}")
if os.path.exists(env_path):
    print("   ✓ .env file exists")
    
    # Check if INTERNAL_SERVICE_SECRET is in .env
    with open(env_path, 'r') as f:
        env_content = f.read()
        if 'INTERNAL_SERVICE_SECRET' in env_content:
            print("   ✓ INTERNAL_SERVICE_SECRET found in .env")
            # Extract the value (first 10 chars only for security)
            for line in env_content.split('\n'):
                if line.startswith('INTERNAL_SERVICE_SECRET='):
                    value = line.split('=', 1)[1]
                    print(f"   ✓ Value: {value[:10]}... (length: {len(value)})")
        else:
            print("   ✗ INTERNAL_SERVICE_SECRET NOT in .env")
else:
    print("   ✗ .env file does NOT exist")

# Test 2: Try to import and check settings
print("\n2. Testing settings loading in commerce service")
try:
    os.chdir(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'services', 'commerce'))
    sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'services', 'commerce'))
    
    from core.config import settings
    print("   ✓ Settings loaded successfully")
    
    # Check if INTERNAL_SERVICE_SECRET is accessible
    internal_secret = getattr(settings, 'INTERNAL_SERVICE_SECRET', None)
    if internal_secret:
        print(f"   ✓ INTERNAL_SERVICE_SECRET is accessible via getattr")
        print(f"   ✓ Value: {internal_secret[:10]}... (length: {len(internal_secret)})")
    else:
        print(f"   ✗ INTERNAL_SERVICE_SECRET is None or empty")
        print(f"   ✓ Settings attributes: {[attr for attr in dir(settings) if 'INTERNAL' in attr.upper()]}")
    
    # Try direct access
    try:
        direct_value = settings.INTERNAL_SERVICE_SECRET
        print(f"   ✓ Direct access works: {direct_value[:10]}...")
    except AttributeError as e:
        print(f"   ✗ Direct access failed: {e}")
        
except Exception as e:
    print(f"   ✗ Error loading settings: {e}")
    import traceback
    traceback.print_exc()

# Test 3: Check shared.base_config
print("\n3. Checking shared.base_config")
try:
    sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'shared'))
    from shared.base_config import BaseSettings
    
    # Check if INTERNAL_SERVICE_SECRET is defined in BaseSettings
    if hasattr(BaseSettings, 'INTERNAL_SERVICE_SECRET'):
        print("   ✓ INTERNAL_SERVICE_SECRET is defined in BaseSettings")
    else:
        print("   ✗ INTERNAL_SERVICE_SECRET is NOT defined in BaseSettings")
        
    # Check annotations
    if '__annotations__' in BaseSettings.__dict__:
        annotations = BaseSettings.__annotations__
        if 'INTERNAL_SERVICE_SECRET' in annotations:
            print(f"   ✓ INTERNAL_SERVICE_SECRET is in annotations: {annotations['INTERNAL_SERVICE_SECRET']}")
        else:
            print("   ✗ INTERNAL_SERVICE_SECRET is NOT in annotations")
            
except Exception as e:
    print(f"   ✗ Error checking shared.base_config: {e}")
    import traceback
    traceback.print_exc()

print("\n" + "=" * 60)
print("Test Complete")
print("=" * 60)
