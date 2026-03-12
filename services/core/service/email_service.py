"""Email service for sending emails via SMTP."""
import logging
import smtplib
import ssl
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional, List
import asyncio
from concurrent.futures import ThreadPoolExecutor
import os

from core.config import settings

logger = logging.getLogger(__name__)


class EmailService:
    """Email service for sending emails via SMTP."""
    
    def __init__(self):
        """Initialize email service."""
        # Get settings or use defaults
        if settings is not None:
            self.host = settings.SMTP_HOST
            self.port = settings.SMTP_PORT
            self.user = settings.SMTP_USER
            self.password = settings.SMTP_PASSWORD
            self.use_tls = settings.SMTP_TLS
            self.from_email = settings.EMAIL_FROM
            self.from_name = settings.EMAIL_FROM_NAME
        else:
            self.host = os.getenv("SMTP_HOST", "smtp.gmail.com")
            self.port = int(os.getenv("SMTP_PORT", "587"))
            self.user = os.getenv("SMTP_USER", "")
            self.password = os.getenv("SMTP_PASSWORD", "")
            self.use_tls = os.getenv("SMTP_TLS", "true").lower() == "true"
            self.from_email = os.getenv("EMAIL_FROM", "noreply@aaryaclothings.com")
            self.from_name = os.getenv("EMAIL_FROM_NAME", "Aarya Clothings")
        self._executor = ThreadPoolExecutor(max_workers=2)
    
    def _create_message(
        self,
        to_email: str,
        subject: str,
        html_content: str,
        text_content: Optional[str] = None
    ) -> MIMEMultipart:
        """Create email message."""
        message = MIMEMultipart("alternative")
        message["Subject"] = subject
        message["From"] = f"{self.from_name} <{self.from_email}>"
        message["To"] = to_email
        
        # Add text version
        if text_content:
            part1 = MIMEText(text_content, "plain")
            message.attach(part1)
        
        # Add HTML version
        part2 = MIMEText(html_content, "html")
        message.attach(part2)
        
        return message
    
    def _send_sync(
        self,
        to_email: str,
        subject: str,
        html_content: str,
        text_content: Optional[str] = None
    ) -> bool:
        """Send email synchronously."""
        if not self.user or not self.password:
            logger.info(f"[EMAIL] SMTP not configured. Would send to: {to_email}")
            logger.info(f"[EMAIL] Subject: {subject}")
            return True  # Pretend success for development
        
        try:
            message = self._create_message(to_email, subject, html_content, text_content)
            
            context = ssl.create_default_context()
            
            if self.use_tls:
                with smtplib.SMTP(self.host, self.port) as server:
                    server.starttls(context=context)
                    server.login(self.user, self.password)
                    server.sendmail(self.from_email, to_email, message.as_string())
            else:
                with smtplib.SMTP_SSL(self.host, self.port, context=context) as server:
                    server.login(self.user, self.password)
                    server.sendmail(self.from_email, to_email, message.as_string())
            
            logger.info(f"[EMAIL] Sent to: {to_email}")
            return True
            
        except Exception as e:
            logger.error(f"[EMAIL] Failed to send to {to_email}: {str(e)}")
            return False
    
    async def send_async(
        self,
        to_email: str,
        subject: str,
        html_content: str,
        text_content: Optional[str] = None
    ) -> bool:
        """Send email asynchronously."""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            self._executor,
            self._send_sync,
            to_email,
            subject,
            html_content,
            text_content
        )
    
    def send(
        self,
        to_email: str,
        subject: str,
        html_content: str,
        text_content: Optional[str] = None
    ) -> bool:
        """Send email (synchronous wrapper)."""
        return self._send_sync(to_email, subject, html_content, text_content)
    
    # ==================== Email Templates ====================
    
    def send_password_reset_email(self, to_email: str, reset_token: str, reset_url: str) -> bool:
        """Send password reset email."""
        subject = "Reset Your Password - Aarya Clothings"
        
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #0B0608; margin: 0; padding: 20px;">
            <div style="max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #180F14 0%, #0B0608 100%); border-radius: 20px; padding: 40px; border: 1px solid rgba(183, 110, 121, 0.3); box-shadow: 0 8px 32px rgba(183, 110, 121, 0.15);">
                <!-- Header -->
                <div style="text-align: center; margin-bottom: 30px;">
                    <h1 style="color: #F2C29A; font-size: 32px; margin: 0; font-family: 'Cinzel', serif; letter-spacing: 2px; text-shadow: 0 2px 8px rgba(242, 194, 154, 0.3);">AARYA</h1>
                    <p style="color: #B76E79; font-size: 14px; margin: 8px 0 0 0; letter-spacing: 4px;">CLOTHINGS</p>
                </div>
                
                <!-- Content -->
                <div style="color: #EAE0D5; font-size: 16px; line-height: 1.7;">
                    <h2 style="color: #F2C29A; font-size: 24px; margin-bottom: 20px; font-weight: 600;">Reset Your Password</h2>
                    
                    <p style="margin-bottom: 24px;">We received a request to reset your password. Click the button below to create a new password:</p>
                    
                    <!-- Button -->
                    <div style="text-align: center; margin: 35px 0;">
                        <a href="{reset_url}" style="display: inline-block; background: linear-gradient(135deg, #B76E79 0%, #7A2F57 100%); color: #FFFFFF; text-decoration: none; padding: 16px 40px; border-radius: 12px; font-weight: 600; font-size: 16px; letter-spacing: 1px; box-shadow: 0 4px 16px rgba(183, 110, 121, 0.4); border: 1px solid rgba(242, 194, 154, 0.2);">Reset Password</a>
                    </div>
                    
                    <p style="color: #EAE0D5; opacity: 0.7; font-size: 14px; margin-bottom: 12px;">⏱️ This link will expire in 24 hours.</p>
                    
                    <p style="color: #EAE0D5; opacity: 0.6; font-size: 14px;">If you didn't request a password reset, you can safely ignore this email.</p>
                    
                    <hr style="border: none; border-top: 1px solid rgba(183, 110, 121, 0.2); margin: 30px 0;">
                    
                    <p style="color: #EAE0D5; opacity: 0.5; font-size: 12px; text-align: center; line-height: 1.6;">
                        If the button doesn't work, copy and paste this link:<br>
                        <a href="{reset_url}" style="color: #B76E79; word-break: break-all; text-decoration: none;">{reset_url}</a>
                    </p>
                </div>
                
                <!-- Footer -->
                <div style="text-align: center; margin-top: 35px; padding-top: 25px; border-top: 1px solid rgba(183, 110, 121, 0.2);">
                    <p style="color: #EAE0D5; opacity: 0.4; font-size: 11px; margin: 0; letter-spacing: 0.5px;">
                        © 2026 Aarya Clothings. All rights reserved.
                    </p>
                </div>
            </div>
        </body>
        </html>
        """
        
        text_content = f"""
        Reset Your Password - Aarya Clothings
        
        We received a request to reset your password. 
        
        Click the link below to create a new password:
        {reset_url}
        
        This link will expire in 24 hours.
        
        If you didn't request a password reset, you can safely ignore this email.
        
        © 2026 Aarya Clothings
        """
        
        return self.send(to_email, subject, html_content, text_content)
    
    def send_otp_email(self, to_email: str, otp_code: str, purpose: str = "verification") -> bool:
        """Send OTP verification email."""
        subject = f"Your Verification Code - Aarya Clothings"
        
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #0B0608; margin: 0; padding: 20px;">
            <div style="max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #180F14 0%, #0B0608 100%); border-radius: 20px; padding: 40px; border: 1px solid rgba(183, 110, 121, 0.3); box-shadow: 0 8px 32px rgba(183, 110, 121, 0.15);">
                <!-- Header -->
                <div style="text-align: center; margin-bottom: 30px;">
                    <h1 style="color: #F2C29A; font-size: 32px; margin: 0; font-family: 'Cinzel', serif; letter-spacing: 2px; text-shadow: 0 2px 8px rgba(242, 194, 154, 0.3);">AARYA</h1>
                    <p style="color: #B76E79; font-size: 14px; margin: 8px 0 0 0; letter-spacing: 4px;">CLOTHINGS</p>
                </div>
                
                <!-- Content -->
                <div style="color: #EAE0D5; font-size: 16px; line-height: 1.7;">
                    <h2 style="color: #F2C29A; font-size: 24px; margin-bottom: 20px; font-weight: 600;">Your Verification Code</h2>
                    
                    <p style="margin-bottom: 28px;">Use the following code to complete your {purpose}:</p>
                    
                    <!-- OTP Code -->
                    <div style="text-align: center; margin: 35px 0;">
                        <div style="display: inline-block; background: linear-gradient(135deg, #7A2F57 0%, #2A1208 100%); border: 2px solid #B76E79; border-radius: 16px; padding: 24px 48px; box-shadow: 0 4px 20px rgba(183, 110, 121, 0.3);">
                            <span style="font-size: 36px; font-weight: bold; letter-spacing: 12px; color: #F2C29A; text-shadow: 0 2px 8px rgba(242, 194, 154, 0.4);">{otp_code}</span>
                        </div>
                    </div>
                    
                    <p style="color: #EAE0D5; opacity: 0.7; font-size: 14px; margin-bottom: 12px;">⏱️ This code will expire in 10 minutes.</p>
                    
                    <p style="color: #EAE0D5; opacity: 0.6; font-size: 14px;">If you didn't request this code, please ignore this email.</p>
                </div>
                
                <!-- Footer -->
                <div style="text-align: center; margin-top: 35px; padding-top: 25px; border-top: 1px solid rgba(183, 110, 121, 0.2);">
                    <p style="color: #EAE0D5; opacity: 0.4; font-size: 11px; margin: 0; letter-spacing: 0.5px;">
                        © 2026 Aarya Clothings. All rights reserved.
                    </p>
                </div>
            </div>
        </body>
        </html>
        """
        
        text_content = f"""
        Your Verification Code - Aarya Clothings
        
        Use the following code to complete your {purpose}:
        
        {otp_code}
        
        This code will expire in 10 minutes.
        
        If you didn't request this code, please ignore this email.
        
        © 2026 Aarya Clothings
        """
        
        return self.send(to_email, subject, html_content, text_content)
    
    def send_email_verification_link(self, to_email: str, verification_url: str) -> bool:
        """Send email verification link."""
        subject = "Verify Your Email - Aarya Clothings"
        
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #0B0608; margin: 0; padding: 20px;">
            <div style="max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #180F14 0%, #0B0608 100%); border-radius: 20px; padding: 40px; border: 1px solid rgba(183, 110, 121, 0.3); box-shadow: 0 8px 32px rgba(183, 110, 121, 0.15);">
                <!-- Header -->
                <div style="text-align: center; margin-bottom: 30px;">
                    <h1 style="color: #F2C29A; font-size: 32px; margin: 0; font-family: 'Cinzel', serif; letter-spacing: 2px; text-shadow: 0 2px 8px rgba(242, 194, 154, 0.3);">AARYA</h1>
                    <p style="color: #B76E79; font-size: 14px; margin: 8px 0 0 0; letter-spacing: 4px;">CLOTHINGS</p>
                </div>
                
                <!-- Content -->
                <div style="color: #EAE0D5; font-size: 16px; line-height: 1.7;">
                    <h2 style="color: #F2C29A; font-size: 24px; margin-bottom: 20px; font-weight: 600;">Verify Your Email Address</h2>
                    
                    <p style="margin-bottom: 24px;">Thank you for creating an account! Please click the button below to verify your email address:</p>
                    
                    <!-- Button -->
                    <div style="text-align: center; margin: 35px 0;">
                        <a href="{verification_url}" style="display: inline-block; background: linear-gradient(135deg, #B76E79 0%, #7A2F57 100%); color: #FFFFFF; text-decoration: none; padding: 16px 40px; border-radius: 12px; font-weight: 600; font-size: 16px; letter-spacing: 1px; box-shadow: 0 4px 16px rgba(183, 110, 121, 0.4); border: 1px solid rgba(242, 194, 154, 0.2);">Verify Email</a>
                    </div>
                    
                    <p style="color: #EAE0D5; opacity: 0.7; font-size: 14px; margin-bottom: 12px;">⏱️ This link will expire in 24 hours.</p>
                    
                    <p style="color: #EAE0D5; opacity: 0.6; font-size: 14px;">If you didn't create an account, you can safely ignore this email.</p>
                    
                    <hr style="border: none; border-top: 1px solid rgba(183, 110, 121, 0.2); margin: 30px 0;">
                    
                    <p style="color: #EAE0D5; opacity: 0.5; font-size: 12px; text-align: center; line-height: 1.6;">
                        If the button doesn't work, copy and paste this link:<br>
                        <a href="{verification_url}" style="color: #B76E79; word-break: break-all; text-decoration: none;">{verification_url}</a>
                    </p>
                </div>
                
                <!-- Footer -->
                <div style="text-align: center; margin-top: 35px; padding-top: 25px; border-top: 1px solid rgba(183, 110, 121, 0.2);">
                    <p style="color: #EAE0D5; opacity: 0.4; font-size: 11px; margin: 0; letter-spacing: 0.5px;">
                        © 2026 Aarya Clothings. All rights reserved.
                    </p>
                </div>
            </div>
        </body>
        </html>
        """
        
        text_content = f"""
        Verify Your Email - Aarya Clothings
        
        Thank you for creating an account!
        
        Click the link below to verify your email address:
        {verification_url}
        
        This link will expire in 24 hours.
        
        If you didn't create an account, you can safely ignore this email.
        
        © 2026 Aarya Clothings
        """
        
        return self.send(to_email, subject, html_content, text_content)


# Global email service instance
email_service = EmailService()
