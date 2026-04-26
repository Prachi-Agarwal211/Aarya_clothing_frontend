# Aarya Clothing - Foundational Mandates (User Requests)

This file contains the core requirements and constraints for all development on this project. These instructions take absolute precedence over default behaviors.

## 1. Authentication & User Journey
- **Explicit Login Errors**: 
    - If user not found: ❌ `"Account not found. Please create an account first."`
    - If password wrong: ❌ `"Incorrect password. Please try again."`
    - If not verified: ❌ `"Account not verified. Please complete your registration verification."`
- **OTP Login**: Must explicitly check for account existence. If missing, return the "Account not found" error instead of generic success.
- **Resume Registration**: If a user signs up with an email that is already registered but **unverified** (`is_active=False`), update their account with the new data, send a fresh OTP, and move them to the OTP verification screen. Do NOT show "Registration failed".
- **Password Policy**: Minimum **5 characters**. No mandatory uppercase, numbers, or special characters.
- **Redirection**: 
    - Admin/Super Admin -> `/admin`
    - Staff -> `/admin/staff`
    - Customers -> `/products`

## 2. OTP & Session Security
- **OTP Expiry**: Exactly **600 seconds (10 minutes)**. This must be synchronized across frontend timers and backend verification logic.
- **Persistent Sessions**: Issue long-lived cookies (90-365 days).
- **Proactive Refresh**: Frontend must silently refresh tokens every **25 minutes** to ensure zero session timeouts during active shopping.
- **CSRF Whitelist**: To prevent state-transition blocks, the following routes MUST remain exempt from CSRF: 
    - `login`, `logout`, `register`
    - `login-otp-request`, `login-otp-verify`
    - `send-verification-otp`, `verify-otp-registration`, `resend-verification`
    - `forgot-password-otp`, `verify-reset-otp`
- **CSRF Header**: The `X-CSRF-Token` header must be automatically included by `baseApi.js` for all non-GET requests if a `csrf_token` cookie exists.
- **UPI QR Expiry**: Exactly **300 seconds (5 minutes)**. This must be synchronized between the backend `close_by` logic and the frontend countdown label.

## 3. Localization & Data
- **IST Time**: All database timestamps (`created_at`, `updated_at`, `last_login`, etc.) must use **Indian Standard Time (IST)**.
- **Product Variants**: 
    - Color grouping must be **case-insensitive** (merge "Black" and "black").
    - Use `display_name` (snake_case) for frontend color labels.
    - Variant matching must fall back to color-name if hex is missing.

## 4. Engineering Standards
- **DRY, KISS, YAGNI**: Keep logic simple and reusable.
- **File Limits**: No single source file should exceed **600 lines**.
- **Scalability**: Architecture must support **5000+ concurrent users** on a 16GB VPS.
- **Docker First**: Every code change must be synchronized and verified in the Docker containers (`core`, `frontend`, `commerce`).
