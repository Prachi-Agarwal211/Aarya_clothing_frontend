#!/usr/bin/env python3
"""
Test script to verify Hostinger email configuration.
Run this to test if email sending works.
"""

import smtplib
import os
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

# Load configuration
SMTP_HOST = "smtp.hostinger.com"
SMTP_PORT = 465
SMTP_USER = "noreply@aaryaclothing.in"
SMTP_PASSWORD = "Aarya@2026"
FROM_EMAIL = "noreply@aaryaclothing.in"
FROM_NAME = "Aarya Clothing"

def test_email_connection():
    """Test SMTP connection to Hostinger."""
    print("📧 Testing Hostinger Email Connection...")
    print(f"SMTP Host: {SMTP_HOST}")
    print(f"SMTP Port: {SMTP_PORT}")
    print(f"SMTP User: {SMTP_USER}")
    print()
    
    try:
        # Connect to SMTP server
        print("Connecting to SMTP server...")
        server = smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT)
        print("✅ Connected successfully")
        
        # Login
        print("Logging in...")
        server.login(SMTP_USER, SMTP_PASSWORD)
        print("✅ Login successful")
        
        server.quit()
        print()
        print("✅ Email configuration is CORRECT!")
        return True
        
    except smtplib.SMTPAuthenticationError as e:
        print(f"❌ Authentication failed: {e}")
        print("\nPossible issues:")
        print("1. Incorrect password")
        print("2. Email account doesn't exist in Hostinger")
        print("3. SMTP access not enabled")
        return False
        
    except smtplib.SMTPConnectError as e:
        print(f"❌ Connection failed: {e}")
        print("\nPossible issues:")
        print("1. SMTP host is incorrect")
        print("2. Firewall blocking connection")
        print("3. Hostinger email service issue")
        return False
        
    except Exception as e:
        print(f"❌ Error: {e}")
        return False


def send_test_email(to_email):
    """Send a test email."""
    print(f"\n📤 Sending test email to: {to_email}")
    
    try:
        # Create message
        msg = MIMEMultipart()
        msg['Subject'] = 'Test Email - Aarya Clothing'
        msg['From'] = f"{FROM_NAME} <{FROM_EMAIL}>"
        msg['To'] = to_email
        
        # Email content
        html_content = """
        <html>
        <body style="font-family: Arial, sans-serif; background-color: #0B0608; color: #EAE0D5; padding: 20px;">
            <div style="max-width: 600px; margin: 0 auto; background: #180F14; padding: 30px; border-radius: 12px; border: 1px solid #B76E79;">
                <h1 style="color: #F2C29A; font-family: 'Cinzel', serif;">AARYA CLOTHING</h1>
                <h2 style="color: #B76E79;">Test Email</h2>
                <p>This is a test email from your Aarya Clothing email system.</p>
                <p style="color: #8A6A5C;">If you received this, your email configuration is working correctly!</p>
                <hr style="border: 1px solid #B76E79; margin: 20px 0;">
                <p style="font-size: 12px; color: #8A6A5C;">© 2026 Aarya Clothing. All rights reserved.</p>
            </div>
        </body>
        </html>
        """
        
        msg.attach(MIMEText(html_content, 'html'))
        
        # Send email
        server = smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT)
        server.login(SMTP_USER, SMTP_PASSWORD)
        server.sendmail(FROM_EMAIL, to_email, msg.as_string())
        server.quit()
        
        print("✅ Test email sent successfully!")
        print(f"Check your inbox at: {to_email}")
        return True
        
    except Exception as e:
        print(f"❌ Failed to send email: {e}")
        return False


if __name__ == "__main__":
    print("=" * 60)
    print("Aarya Clothing - Email Configuration Test")
    print("=" * 60)
    print()
    
    # Test connection
    if test_email_connection():
        # Ask for test email
        print("\n" + "=" * 60)
        test_email = input("Enter email address to send test email (or press Enter to skip): ")
        
        if test_email:
            send_test_email(test_email)
        
        print("\n" + "=" * 60)
        print("✅ Email setup is complete and working!")
        print("=" * 60)
    else:
        print("\n" + "=" * 60)
        print("❌ Email configuration needs to be fixed")
        print("\nNext steps:")
        print("1. Verify email account exists in Hostinger")
        print("2. Check password is correct")
        print("3. Ensure SMTP access is enabled")
        print("=" * 60)
