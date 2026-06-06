/**
 * authCopy.js
 * 
 * SINGLE SOURCE OF TRUTH for all user-facing copy in authentication flows.
 * 
 * Simplicity-first: Indian users expect phone-first auth with minimal fields.
 * Phone number is auto-normalized to +91 E.164 on the backend.
 * Users just type their 10-digit number — that's it.
 */

export const AUTH_COPY = {
  // === Core Model Explanation (used on Register) ===
  bothEmailAndPhoneRequired: 
    "Email for order updates & account recovery. Phone for OTP login via SMS or WhatsApp.",

  // === Phone Format — keep it dead simple ===
  phoneFormatHint: 
    "Enter your 10-digit mobile number. +91 is added automatically.",

  phoneFormatShort: 
    "10-digit mobile number — works with or without +91.",

  phoneFormatExample: 
    "e.g. 9876543210",

  // === Identifier / Login Input ===
  identifierPlaceholder: "Email, username, or phone number",
  identifierPlaceholderWithHint: "Email, username, or phone number",

  // === OTP Flow Guidance ===
  otpDeliveryExplanation: 
    "We'll send a one-time code to your email, SMS, or WhatsApp. You must have an account first.",

  otpTroubleshooting: 
    "Didn't receive the code? Check your messages, spam folder, or try a different method below.",

  otpMethodHelp: 
    "Choose how you want to receive the code:",

  // === Login Page Specific ===
  loginPasswordTitle: "Sign in to your account",
  loginOtpTitle: "Login with OTP",
  loginOtpSubtitle: "Sign in with a one-time code",

  needBothToRegister: 
    "Email & phone both required to register.",

  // === Error Recovery Messages ===
  errors: {
    missingIdentifier: "Please enter your email, username, or phone number.",
    invalidCredentials: "Invalid credentials. Please check and try again.",
    otpFailed: "Invalid or expired code. Please request a new one.",
    otpSendFailed: "Failed to send code. Please try again.",
    accountNotVerified: "Account exists but isn't verified. Try registering again — we'll send a fresh code.",
  },

  // === Register Specific ===
  registerPhoneHelp: 
    "Required for OTP login. We'll auto-add +91 for Indian numbers.",

  alreadyRegisteredButNotVerified: 
    "Already registered but haven't verified? Fill in your details again — we'll send a fresh OTP.",
};

export default AUTH_COPY;
