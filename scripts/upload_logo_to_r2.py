#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Quick script to upload logo.png to Cloudflare R2.
Run this to fix the logo loading issue on production.

Usage:
    python scripts/upload_logo_to_r2.py
"""

import os
import sys
import boto3
from botocore.config import Config
from pathlib import Path
import logging

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# R2 Configuration from environment
R2_ACCOUNT_ID = os.getenv('R2_ACCOUNT_ID')
R2_ACCESS_KEY_ID = os.getenv('R2_ACCESS_KEY_ID')
R2_SECRET_ACCESS_KEY = os.getenv('R2_SECRET_ACCESS_KEY')
R2_BUCKET_NAME = os.getenv('R2_BUCKET_NAME', 'aarya-clothing-images')
R2_PUBLIC_URL = os.getenv('R2_PUBLIC_URL')
R2_REGION = os.getenv('R2_REGION', 'auto')


def validate_config():
    """Validate that all required R2 configuration is present."""
    required_vars = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_PUBLIC_URL']
    missing = [v for v in required_vars if not os.getenv(v)]
    if missing:
        logger.error(f"Missing required environment variables: {', '.join(missing)}")
        logger.error("Please set these in your .env file:")
        logger.error("  R2_ACCOUNT_ID=your_account_id")
        logger.error("  R2_ACCESS_KEY_ID=your_access_key")
        logger.error("  R2_SECRET_ACCESS_KEY=your_secret_key")
        logger.error("  R2_PUBLIC_URL=https://pub-xxx.r2.dev")
        sys.exit(1)


def get_r2_client():
    """Create R2 client using boto3."""
    endpoint_url = f'https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com'
    
    client = boto3.client(
        's3',
        endpoint_url=endpoint_url,
        aws_access_key_id=R2_ACCESS_KEY_ID,
        aws_secret_access_key=R2_SECRET_ACCESS_KEY,
        config=Config(
            region_name=R2_REGION,
            signature_version='s3v4',
        ),
    )
    return client


def upload_logo():
    """Upload logo.png to R2."""
    validate_config()
    
    # Logo file path
    logo_path = Path(__file__).parent.parent / 'frontend_new' / 'public' / 'logo.png'
    
    if not logo_path.exists():
        logger.error(f"Logo file not found: {logo_path}")
        sys.exit(1)
    
    logger.info(f"Found logo file: {logo_path}")
    logger.info(f"File size: {logo_path.stat().st_size} bytes")
    
    # Get R2 client
    client = get_r2_client()
    
    # Test connection
    try:
        client.head_bucket(Bucket=R2_BUCKET_NAME)
        logger.info(f"✓ Connected to R2 bucket: {R2_BUCKET_NAME}")
    except Exception as e:
        logger.error(f"✗ Failed to connect to R2 bucket: {e}")
        sys.exit(1)
    
    # Upload logo
    try:
        with open(logo_path, 'rb') as f:
            client.put_object(
                Bucket=R2_BUCKET_NAME,
                Key='logo.png',
                Body=f,
                ContentType='image/png',
                ACL='public-read',  # Make publicly accessible
            )
        
        r2_url = f"{R2_PUBLIC_URL.rstrip('/')}/logo.png"
        logger.info(f"✓ Successfully uploaded logo.png to R2!")
        logger.info(f"✓ R2 URL: {r2_url}")
        logger.info(f"✓ Verify by visiting: {r2_url}")
        
        return r2_url
    except Exception as e:
        logger.error(f"✗ Failed to upload logo: {e}")
        sys.exit(1)


if __name__ == '__main__':
    print("="*60)
    print("Aarya Clothing - Upload Logo to R2")
    print("="*60)
    
    r2_url = upload_logo()
    
    print("\n" + "="*60)
    print("NEXT STEPS:")
    print("="*60)
    print("1. Verify logo loads: Open in browser:")
    print(f"   {r2_url}")
    print("\n2. Run database migration to add logo_url:")
    print("   psql -d aarya_clothing -f scripts/migration_add_logo_url.sql")
    print("\n3. Restart backend services to pick up new config")
    print("\n4. Test on production: https://aaryaclothing.in")
    print("="*60)
