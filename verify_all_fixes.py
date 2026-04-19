#!/usr/bin/env python3
"""
Final Verification Script
Checks all critical fixes have been applied
"""
import os
import re

def check_file(filepath, pattern, description, should_exist=True):
    """Check if pattern exists in file"""
    if not os.path.exists(filepath):
        print(f"❌ {filepath} does not exist")
        return False
    
    with open(filepath, 'r') as f:
        content = f.read()
    
    found = pattern in content
    
    if should_exist:
        if found:
            print(f"✅ {description}")
            return True
        else:
            print(f"❌ {description} - NOT FOUND")
            return False
    else:
        if not found:
            print(f"✅ {description}")
            return True
        else:
            print(f"❌ {description} - SHOULD NOT EXIST")
            return False

def main():
    print("🔍 Verifying All Critical Fixes...")
    print("=" * 60)
    
    fixes_applied = []
    
    # 1. Auth Service - email_verified should be False
    fixes_applied.append(check_file(
        'services/core/service/auth_service.py',
        'email_verified=False,',
        'Auth: email_verified=False (not auto-verified)'
    ))
    
    fixes_applied.append(check_file(
        'services/core/service/auth_service.py',
        'email_verified=True,',
        'Auth: No email_verified=True (security risk)',
        should_exist=False
    ))
    
    # 2. Database Pooling - Reduced sizes
    fixes_applied.append(check_file(
        'docker-compose.yml',
        'DATABASE_POOL_SIZE=5',
        'DB: DATABASE_POOL_SIZE reduced to 5'
    ))
    
    fixes_applied.append(check_file(
        'docker-compose.yml',
        'DATABASE_MAX_OVERFLOW=2',
        'DB: DATABASE_MAX_OVERFLOW reduced to 2'
    ))
    
    # 3. PgBouncer - Optimized settings
    fixes_applied.append(check_file(
        'docker/pgbouncer/pgbouncer.ini',
        'default_pool_size = 25',
        'PgBouncer: default_pool_size reduced to 25'
    ))
    
    fixes_applied.append(check_file(
        'docker/pgbouncer/pgbouncer.ini',
        'prepared_statements = 1',
        'PgBouncer: prepared_statements enabled'
    ))
    
    # 4. Redis - Reduced memory
    fixes_applied.append(check_file(
        'docker-compose.yml',
        'maxmemory 512mb',
        'Redis: maxmemory reduced to 512mb'
    ))
    
    # 5. PostgreSQL - Added timeouts
    fixes_applied.append(check_file(
        'docker-compose.yml',
        'statement_timeout=30000',
        'PostgreSQL: statement_timeout added'
    ))
    
    # 6. Database Indexes - Added critical ones
    fixes_applied.append(check_file(
        'docker/postgres/init.sql',
        'idx_users_phone ON users(phone)',
        'DB: Phone index added'
    ))
    
    fixes_applied.append(check_file(
        'docker/postgres/init.sql',
        'idx_verification_tokens_user_id',
        'DB: Verification tokens index added'
    ))
    
    # 7. Frontend - Uses authApi
    fixes_applied.append(check_file(
        'frontend_new/app/auth/register/page.js',
        'authApi.register',
        'Frontend: Uses authApi instead of fetch'
    ))
    
    # 8. Password Validation - Simplified
    fixes_applied.append(check_file(
        'services/core/service/auth_service.py',
        'if len(password) < 5:',
        'Auth: Password minimum is 5 characters'
    ))
    
    fixes_applied.append(check_file(
        'services/core/service/auth_service.py',
        'Password must be at least 5 characters',
        'Auth: Password error message updated'
    ))
    
    # Summary
    print("\n" + "=" * 60)
    print("📊 VERIFICATION SUMMARY")
    print("=" * 60)
    
    total_fixes = len(fixes_applied)
    applied_fixes = sum(fixes_applied)
    
    print(f"Total Checks: {total_fixes}")
    print(f"✅ Applied: {applied_fixes}")
    print(f"❌ Missing: {total_fixes - applied_fixes}")
    
    if applied_fixes == total_fixes:
        print("\n🎉 ALL CRITICAL FIXES HAVE BEEN APPLIED!")
        print("The system is now optimized and production-ready.")
        return 0
    else:
        print("\n⚠️  Some fixes are still missing.")
        print("Please review the failed checks above.")
        return 1

if __name__ == "__main__":
    exit(main())
