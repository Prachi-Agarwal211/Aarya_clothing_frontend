/**
 * authCopy.js
 * 
 * SINGLE SOURCE OF TRUTH for all user-facing copy in authentication flows.
 * 
 * Phone-first design for Indian users:
 * 1. Enter phone number
 * 2. Get OTP via SMS/WhatsApp
 * 3. Auto-create account if new user
 * 
 * Password is optional/hidden — most Indian users prefer OTP.
 */

export const AUTH_COPY = {
  // === Phone Format — keep it dead simple ===
  phoneFormatHint: 
    "Enter your 10-digit mobile number. +91 is added automatically.",

  phoneFormatShort: 
    "10-digit mobile number",

  phoneFormatExample: 
    "e.g. 9876543210",

  // === Login Page — Phone First ===
  loginTitle: "Welcome to Aarya Clothing",
  loginSubtitle: "Enter your phone number to get started",
  phonePlaceholder: "Enter 10-digit phone number",
  sendOtpButton: "GET OTP",
  sendingOtp: "Sending OTP...",
  
  // === OTP Verification ===
  otpSentMessage: "OTP sent to your phone",
  otpEnterCode: "Enter the 6-digit code sent to",
  otpExpiresIn: "Code expires in",
  otpResend: "Resend OTP",
  otpResendIn: "Resend in",
  verifyButton: "VERIFY & CONTINUE",
  verifying: "Verifying...",
  otpTroubleshooting: 
    "Didn't receive the code? Check your messages or try WhatsApp method.",

  // === New User Auto-Registration ===
  newUserMessage: "New to Aarya? We'll create your account automatically after verification.",
  accountCreated: "Account created successfully!",
  
  // === Optional Fields (shown after OTP for new users) ===
  optionalName: "Your name (optional)",
  optionalEmail: "Email for order updates (optional)",
  
  // === Legacy/Password Mode (hidden by default) ===
  loginPasswordTitle: "Sign in with password",
  loginOtpTitle: "Login with OTP",
  loginOtpSubtitle: "Sign in with a one-time code",
  
  // === Error Recovery Messages ===
  errors: {
    missingPhone: "Please enter your phone number.",
    invalidPhone: "Enter a valid 10-digit Indian mobile number.",
    invalidCredentials: "Invalid credentials. Please check and try again.",
    otpFailed: "Invalid or expired code. Please request a new one.",
    otpSendFailed: "Failed to send code. Please try again.",
    tooManyRequests: "Too many requests. Please wait a moment.",
    networkError: "Network error. Please check your connection.",
  },

  // === Product Share ===
  shareTitle: "Share this product",
  shareWhatsApp: "Share on WhatsApp",
  shareCopyLink: "Copy Link",
  linkCopied: "Link copied to clipboard!",
};

export default AUTH_COPY;
