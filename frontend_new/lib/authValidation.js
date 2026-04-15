/**
 * Authentication validation utilities for frontend
 * Validates phone numbers, passwords, and other auth fields
 */

// Phone number validation
export const validatePhone = (phone) => {
  if (!phone || phone.trim() === '') {
    return 'Phone number is required';
  }
  
  // Remove common formatting
  const phoneDigits = phone.replace(/\D/g, '');
  
  // Validate Indian phone numbers (starting with 6-9, 10 digits)
  if (phoneDigits.length === 10 && ['6', '7', '8', '9'].includes(phoneDigits[0])) {
    return null; // Valid
  }
  
  // Validate international numbers (10-15 digits)
  if (phoneDigits.length >= 10 && phoneDigits.length <= 15) {
    return null; // Valid
  }
  
  return 'Invalid phone number format. Please enter a valid phone number.';
};

// Password validation
export const validatePassword = (password) => {
  const errors = [];
  
  if (!password || password.length < 5) {
    errors.push('Password must be at least 5 characters');
  }
  
  return errors.length === 0 ? null : errors.join('. ');
};

// Email validation
export const validateEmail = (email) => {
  if (!email || email.trim() === '') {
    return 'Email is required';
  }
  
  const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
  if (!emailRegex.test(email)) {
    return 'Please enter a valid email address';
  }
  
  return null;
};

// Username validation
export const validateUsername = (username) => {
  if (!username || username.trim() === '') {
    return 'Username is required';
  }
  
  if (username.length < 3) {
    return 'Username must be at least 3 characters';
  }
  
  if (username.length > 50) {
    return 'Username must be less than 50 characters';
  }
  
  // Allow only letters, numbers, underscores, and hyphens
  const usernameRegex = /^[a-zA-Z0-9_-]+$/;
  if (!usernameRegex.test(username)) {
    return 'Username can only contain letters, numbers, underscores, and hyphens';
  }
  
  return null;
};

// Full name validation
export const validateFullName = (fullName) => {
  if (!fullName || fullName.trim() === '') {
    return 'Full name is required';
  }
  
  if (fullName.length < 1) {
    return 'Full name cannot be empty';
  }
  
  if (fullName.length > 100) {
    return 'Full name must be less than 100 characters';
  }
  
  return null;
};

// Complete registration form validation
export const validateRegistrationForm = (formData) => {
  const errors = {};
  
  const emailError = validateEmail(formData.email);
  if (emailError) errors.email = emailError;
  
  const usernameError = validateUsername(formData.username);
  if (usernameError) errors.username = usernameError;
  
  const passwordError = validatePassword(formData.password);
  if (passwordError) errors.password = passwordError;
  
  const fullNameError = validateFullName(formData.fullName);
  if (fullNameError) errors.fullName = fullNameError;
  
  const phoneError = validatePhone(formData.phone);
  if (phoneError) errors.phone = phoneError;
  
  return errors;
};

// Login form validation
export const validateLoginForm = (formData) => {
  const errors = {};
  
  if (!formData.username || formData.username.trim() === '') {
    errors.username = 'Email or username is required';
  }
  
  if (!formData.password || formData.password.trim() === '') {
    errors.password = 'Password is required';
  }
  
  return errors;
};

export default {
  validatePhone,
  validatePassword,
  validateEmail,
  validateUsername,
  validateFullName,
  validateRegistrationForm,
  validateLoginForm
};
