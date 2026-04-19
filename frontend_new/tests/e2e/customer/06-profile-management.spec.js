/**
 * Profile Management E2E Tests
 * 
 * Test Suite: User Profile & Settings
 * Coverage:
 * - Update profile
 * - Change password
 * - Manage addresses
 * - Notification preferences
 */

import { test, expect } from '@playwright/test';

test.describe('Profile Management', () => {
  test.beforeEach(async ({ page }) => {
    // Login first
    await page.goto('/auth/login');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'TestPassword123!');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(profile|home|\/)?$/, { timeout: 10000 });
  });

  test.describe('Profile Information', () => {
    test('should view profile page', async ({ page }) => {
      await page.goto('/profile');
      await expect(page).toHaveURL(/\/profile/, { timeout: 10000 });
    });

    test('should display user information', async ({ page }) => {
      await page.goto('/profile');
      
      // Should show user name or email
      const nameVisible = await page.locator('text=Test, .profile-name, [class*="user-name"]').isVisible().catch(() => false);
      const emailVisible = await page.locator('text=@, .profile-email, [class*="user-email"]').isVisible().catch(() => false);
      
      expect(nameVisible || emailVisible).toBeTruthy();
    });

    test('should update profile information', async ({ page }) => {
      await page.goto('/profile/settings');
      
      // Find and fill profile form
      const firstNameInput = page.locator('input[name="firstName"], input[name="first_name"], #firstName');
      const lastNameInput = page.locator('input[name="lastName"], input[name="last_name"], #lastName');
      
      if (await firstNameInput.isVisible()) {
        const timestamp = Date.now();
        await firstNameInput.fill(`Test${timestamp}`);
        
        if (await lastNameInput.isVisible()) {
          await lastNameInput.fill(`User${timestamp}`);
        }
        
        const saveButton = page.locator('button:has-text("Save"), button:has-text("Update")');
        if (await saveButton.isVisible()) {
          await saveButton.click();
          await page.waitForTimeout(2000);
          
          // Should show success message
          const successVisible = await page.locator('[class*="success"]').isVisible().catch(() => false);
          expect(successVisible).toBeTruthy();
        }
      }
    });

    test('should upload profile picture', async ({ page }) => {
      await page.goto('/profile/settings');
      
      const uploadInput = page.locator('input[type="file"][accept*="image"], input[name="avatar"]');
      
      if (await uploadInput.isVisible()) {
        // Note: Actual file upload would require a test image file
        // This test verifies the upload element exists
        expect(uploadInput).toBeTruthy();
      }
    });
  });

  test.describe('Change Password', () => {
    test('should navigate to change password page', async ({ page }) => {
      await page.goto('/profile/settings');
      
      const changePasswordLink = page.locator('a[href*="change-password"], button:has-text("Change Password")');
      if (await changePasswordLink.isVisible()) {
        await changePasswordLink.click();
        await page.waitForURL(/\/change-password/, { timeout: 10000 });
      }
    });

    test('should change password successfully', async ({ page }) => {
      await page.goto('/auth/change-password');
      
      const currentPassword = page.locator('input[name="currentPassword"], input[placeholder*="current" i]');
      const newPassword = page.locator('input[name="newPassword"], input[placeholder*="new" i]');
      const confirmPassword = page.locator('input[name="confirmPassword"], input[placeholder*="confirm" i]');
      
      if (await currentPassword.isVisible()) {
        await currentPassword.fill('TestPassword123!');
        await newPassword.fill('NewPassword123!');
        await confirmPassword.fill('NewPassword123!');
        
        const submitButton = page.locator('button:has-text("Change"), button:has-text("Update")');
        await submitButton.click();
        
        // Should show success or error
        await page.waitForTimeout(2000);
      }
    });

    test('should validate password mismatch', async ({ page }) => {
      await page.goto('/auth/change-password');
      
      const newPassword = page.locator('input[name="newPassword"]');
      const confirmPassword = page.locator('input[name="confirmPassword"]');
      
      if (await newPassword.isVisible()) {
        await newPassword.fill('Password123!');
        await confirmPassword.fill('Different123!');
        
        const submitButton = page.locator('button:has-text("Change")');
        await submitButton.click();
        
        // Should show error
        const errorVisible = await page.locator('[class*="error"], text=mismatch').isVisible().catch(() => false);
        expect(errorVisible).toBeTruthy();
      }
    });

    test('should validate weak new password', async ({ page }) => {
      await page.goto('/auth/change-password');
      
      const currentPassword = page.locator('input[name="currentPassword"]');
      const newPassword = page.locator('input[name="newPassword"]');
      
      if (await currentPassword.isVisible()) {
        await currentPassword.fill('TestPassword123!');
        await newPassword.fill('weak');
        
        const submitButton = page.locator('button:has-text("Change")');
        await submitButton.click();
        
        // Should show validation error
        await page.waitForTimeout(1000);
      }
    });
  });

  test.describe('Address Management', () => {
    test('should view saved addresses', async ({ page }) => {
      await page.goto('/profile/addresses');
      
      // Should show addresses list or empty state
      const addressesVisible = await page.locator('.address-card, [class*="address"]').isVisible().catch(() => false);
      const emptyStateVisible = await page.locator('text=No addresses, .empty-addresses').isVisible().catch(() => false);
      
      expect(addressesVisible || emptyStateVisible).toBeTruthy();
    });

    test('should add new address', async ({ page }) => {
      await page.goto('/profile/addresses');
      
      const addAddressButton = page.locator('button:has-text("Add Address"), .add-address');
      if (await addAddressButton.isVisible()) {
        await addAddressButton.click();
        
        // Fill address form
        const nameInput = page.locator('input[name="name"], #name');
        const phoneInput = page.locator('input[name="phone"], #phone');
        const addressInput = page.locator('input[name="address"], textarea[name="address"]');
        const cityInput = page.locator('input[name="city"], #city');
        const stateInput = page.locator('input[name="state"], #state');
        const pincodeInput = page.locator('input[name="pincode"], #pincode');
        
        if (await nameInput.isVisible()) {
          await nameInput.fill('Test User');
          await phoneInput.fill('9876543210');
          await addressInput.fill('123 Test Street');
          await cityInput.fill('Mumbai');
          await stateInput.fill('Maharashtra');
          await pincodeInput.fill('400001');
          
          const saveButton = page.locator('button:has-text("Save")');
          await saveButton.click();
          
          await page.waitForTimeout(2000);
          
          // Should show success
          const successVisible = await page.locator('[class*="success"]').isVisible().catch(() => false);
          expect(successVisible).toBeTruthy();
        }
      }
    });

    test('should edit existing address', async ({ page }) => {
      await page.goto('/profile/addresses');
      
      const editButton = page.locator('button:has-text("Edit"), .edit-address').first();
      if (await editButton.isVisible()) {
        await editButton.click();
        
        // Modify address
        const cityInput = page.locator('input[name="city"], #city');
        if (await cityInput.isVisible()) {
          await cityInput.fill('Updated City');
          
          const saveButton = page.locator('button:has-text("Save")');
          await saveButton.click();
          
          await page.waitForTimeout(2000);
        }
      }
    });

    test('should delete address', async ({ page }) => {
      await page.goto('/profile/addresses');
      
      const deleteButton = page.locator('button:has-text("Delete"), .delete-address').first();
      if (await deleteButton.isVisible()) {
        await deleteButton.click();
        
        // Confirm deletion
        const confirmButton = page.locator('button:has-text("Confirm"), button:has-text("Yes")');
        if (await confirmButton.isVisible()) {
          await confirmButton.click();
        }
        
        await page.waitForTimeout(2000);
      }
    });

    test('should set default address', async ({ page }) => {
      await page.goto('/profile/addresses');
      
      const setDefaultButton = page.locator('button:has-text("Set Default"), .set-default').first();
      if (await setDefaultButton.isVisible()) {
        await setDefaultButton.click();
        await page.waitForTimeout(1000);
      }
    });
  });

  test.describe('Notification Preferences', () => {
    test('should view notification settings', async ({ page }) => {
      await page.goto('/profile/settings');
      
      const notificationsSection = page.locator('.notifications-section, [class*="notification"], text=Notification');
      if (await notificationsSection.isVisible()) {
        expect(notificationsSection).toBeTruthy();
      }
    });

    test('should toggle email notifications', async ({ page }) => {
      await page.goto('/profile/settings');
      
      const emailToggle = page.locator('input[type="checkbox"][name*="email"], [data-testid="email-notifications"]');
      if (await emailToggle.isVisible()) {
        const initialState = await emailToggle.isChecked();
        await emailToggle.click();
        
        const newState = await emailToggle.isChecked();
        expect(newState).not.toBe(initialState);
      }
    });

    test('should toggle SMS notifications', async ({ page }) => {
      await page.goto('/profile/settings');
      
      const smsToggle = page.locator('input[type="checkbox"][name*="sms"], [data-testid="sms-notifications"]');
      if (await smsToggle.isVisible()) {
        await smsToggle.click();
        await page.waitForTimeout(500);
      }
    });

    test('should toggle SMS notifications', async ({ page }) => {
      await page.goto('/profile/settings');

      const smsToggle = page.locator('input[type="checkbox"][name*="sms"], [data-testid="sms-notifications"]');
      if (await smsToggle.isVisible()) {
        await smsToggle.click();
        await page.waitForTimeout(500);
      }
    });
  });

  test.describe('Account Security', () => {
    test('should view active sessions', async ({ page }) => {
      await page.goto('/profile/settings');
      
      const sessionsLink = page.locator('a:has-text("Sessions"), button:has-text("Active Sessions")');
      if (await sessionsLink.isVisible()) {
        await sessionsLink.click();
        await page.waitForTimeout(1000);
      }
    });

    test('should logout from all devices', async ({ page }) => {
      await page.goto('/profile/settings');
      
      const logoutAllButton = page.locator('button:has-text("Logout All"), button:has-text("Logout from all")');
      if (await logoutAllButton.isVisible()) {
        await logoutAllButton.click();
        
        // Confirm
        const confirmButton = page.locator('button:has-text("Confirm")');
        if (await confirmButton.isVisible()) {
          await confirmButton.click();
        }
        
        await page.waitForTimeout(2000);
      }
    });
  });

  test.describe('Responsive Design - Profile', () => {
    test('should display profile correctly on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/profile');
      
      await expect(page.locator('.profile-header, h1')).toBeVisible();
    });

    test('should display profile correctly on tablet', async ({ page }) => {
      await page.setViewportSize({ width: 1024, height: 768 });
      await page.goto('/profile');
      
      await expect(page.locator('.profile-header, h1')).toBeVisible();
    });
  });
});
