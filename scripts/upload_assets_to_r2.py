#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script to upload all local assets to Cloudflare R2.
Run this once to migrate existing assets from local storage to R2.

Usage:
    python scripts/upload_assets_to_r2.py
"""

import os
import sys
import boto3
from botocore.config import Config
from pathlib import Path
from typing import Optional
import logging

# Fix Windows console encoding
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# R2 Configuration from environment (REQUIRED - no hardcoded credentials)
R2_ACCOUNT_ID = os.getenv('R2_ACCOUNT_ID')
R2_ACCESS_KEY_ID = os.getenv('R2_ACCESS_KEY_ID')
R2_SECRET_ACCESS_KEY = os.getenv('R2_SECRET_ACCESS_KEY')
R2_BUCKET_NAME = os.getenv('R2_BUCKET_NAME', 'aarya-clothing-images')
R2_PUBLIC_URL = os.getenv('R2_PUBLIC_URL')
R2_REGION = os.getenv('R2_REGION', 'auto')

# Validate required environment variables
def validate_config():
    """Validate that all required R2 configuration is present."""
    required_vars = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_PUBLIC_URL']
    missing = [v for v in required_vars if not os.getenv(v)]
    if missing:
        logger.error(f"Missing required environment variables: {', '.join(missing)}")
        logger.error("Please set these in your .env file or environment:")
        logger.error("  R2_ACCOUNT_ID=your_account_id")
        logger.error("  R2_ACCESS_KEY_ID=your_access_key")
        logger.error("  R2_SECRET_ACCESS_KEY=your_secret_key")
        logger.error("  R2_PUBLIC_URL=https://your-bucket.r2.dev")
        sys.exit(1)

# Local assets directory
PUBLIC_DIR = Path(__file__).parent.parent / 'frontend_new' / 'public'

# Content types mapping
CONTENT_TYPES = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
}


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


def get_content_type(file_path: Path) -> str:
    """Get content type based on file extension."""
    ext = file_path.suffix.lower()
    return CONTENT_TYPES.get(ext, 'application/octet-stream')


def upload_file(client, file_path: Path, key: str) -> Optional[str]:
    """Upload a single file to R2."""
    try:
        content_type = get_content_type(file_path)
        
        with open(file_path, 'rb') as f:
            client.put_object(
                Bucket=R2_BUCKET_NAME,
                Key=key,
                Body=f,
                ContentType=content_type,
            )
        
        public_url = f"{R2_PUBLIC_URL}/{key}"
        logger.info(f"✓ Uploaded: {key} -> {public_url}")
        return public_url
    except Exception as e:
        logger.error(f"✗ Failed to upload {key}: {e}")
        return None


def upload_all_assets():
    """Upload all assets from public directory to R2."""
    client = get_r2_client()
    
    # Test connection
    try:
        client.head_bucket(Bucket=R2_BUCKET_NAME)
        logger.info(f"✓ Connected to R2 bucket: {R2_BUCKET_NAME}")
    except Exception as e:
        logger.error(f"✗ Failed to connect to R2 bucket: {e}")
        sys.exit(1)
    
    uploaded_files = []
    failed_files = []
    
    # Walk through all files in public directory
    for root, dirs, files in os.walk(PUBLIC_DIR):
        for file in files:
            local_path = Path(root) / file
            
            # Create R2 key (relative path from public directory)
            relative_path = local_path.relative_to(PUBLIC_DIR)
            key = str(relative_path).replace('\\', '/')  # Ensure forward slashes
            
            # Upload file
            result = upload_file(client, local_path, key)
            if result:
                uploaded_files.append({
                    'local_path': str(local_path),
                    'r2_key': key,
                    'r2_url': result,
                })
            else:
                failed_files.append(str(local_path))
    
    # Summary
    print("\n" + "="*60)
    print("UPLOAD SUMMARY")
    print("="*60)
    print(f"Total files processed: {len(uploaded_files) + len(failed_files)}")
    print(f"Successfully uploaded: {len(uploaded_files)}")
    print(f"Failed: {len(failed_files)}")
    
    if failed_files:
        print("\nFailed files:")
        for f in failed_files:
            print(f"  - {f}")
    
    print("\n" + "="*60)
    print("R2 URL MAPPING")
    print("="*60)
    for file_info in uploaded_files:
        print(f"{file_info['local_path']} -> {file_info['r2_url']}")
    
    return uploaded_files


def generate_env_file(uploaded_files):
    """Generate environment variables for R2 URLs."""
    print("\n" + "="*60)
    print("ADD TO frontend_new/.env.local")
    print("="*60)
    
    # Group by type
    hero_images = [f for f in uploaded_files if f['r2_key'].startswith('hero/')]
    product_images = [f for f in uploaded_files if f['r2_key'].startswith('products/')]
    collection_images = [f for f in uploaded_files if f['r2_key'].startswith('collections/')]
    about_images = [f for f in uploaded_files if f['r2_key'].startswith('about/')]
    videos = [f for f in uploaded_files if 'video' in f['r2_key'] or f['r2_key'].endswith('.mp4')]
    
    print("\n# R2 Asset URLs")
    print(f"NEXT_PUBLIC_R2_BASE_URL={R2_PUBLIC_URL}")
    
    if videos:
        print("\n# Video URLs")
        for v in videos:
            print(f"NEXT_PUBLIC_VIDEO_INTRO={v['r2_url']}")
    
    print("\n# Logo")
    logo = [f for f in uploaded_files if 'logo' in f['r2_key']]
    if logo:
        print(f"NEXT_PUBLIC_LOGO_URL={logo[0]['r2_url']}")


if __name__ == '__main__':
    # Validate configuration first
    validate_config()
    
    print("="*60)
    print("Aarya Clothing - R2 Asset Upload Script")
    print("="*60)
    print(f"\nSource: {PUBLIC_DIR}")
    print(f"Destination: R2 Bucket '{R2_BUCKET_NAME}'")
    print(f"Public URL: {R2_PUBLIC_URL}")
    print()
    
    if not PUBLIC_DIR.exists():
        logger.error(f"Public directory not found: {PUBLIC_DIR}")
        sys.exit(1)
    
    uploaded = upload_all_assets()
    generate_env_file(uploaded)
