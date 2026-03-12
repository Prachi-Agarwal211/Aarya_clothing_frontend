"""
Direct Payment Service - Zero/Low Fee Payment Methods
Supports UPI, Bank Transfer, COD, and Wallet payments without percentage fees
"""

import logging
from typing import Optional, Dict, Any
from datetime import datetime, timezone
from decimal import Decimal
import uuid
import qrcode
import io
import base64

logger = logging.getLogger(__name__)

class DirectPaymentService:
    """Handle direct payment methods with minimal or zero fees."""
    
    def __init__(self, db_session):
        self.db = db_session
        
    def generate_upi_qr(self, amount: Decimal, order_id: int, merchant_upi: str) -> Dict[str, Any]:
        """Generate UPI QR code for payment."""
        try:
            # UPI payment string format
            upi_string = f"upi://pay?pa={merchant_upi}&pn=Aarya%20Clothing&am={amount}&cu=INR&tn=Order_{order_id}"
            
            # Generate QR code
            qr = qrcode.QRCode(version=1, box_size=10, border=5)
            qr.add_data(upi_string)
            qr.make(fit=True)
            
            img = qr.make_image(fill_color="black", back_color="white")
            
            # Convert to base64
            buffer = io.BytesIO()
            img.save(buffer, format='PNG')
            img_base64 = base64.b64encode(buffer.getvalue()).decode()
            
            return {
                "upi_string": upi_string,
                "qr_code": f"data:image/png;base64,{img_base64}",
                "amount": float(amount),
                "merchant_upi": merchant_upi,
                "expires_at": (datetime.now(timezone.utc).timestamp() + 900)  # 15 min expiry
            }
            
        except Exception as e:
            logger.error(f"Failed to generate UPI QR: {e}")
            raise ValueError("Failed to generate UPI QR code")
    
    def create_bank_transfer_instructions(self, amount: Decimal, order_id: int) -> Dict[str, Any]:
        """Create bank transfer instructions."""
        return {
            "payment_method": "bank_transfer",
            "amount": float(amount),
            "account_details": {
                "bank_name": "Your Bank Name",
                "account_number": "XXXXXX1234",  # Mask for security
                "account_holder": "Aarya Clothing",
                "ifsc_code": "ABCDEF01234",
                "branch": "Main Branch"
            },
            "transfer_methods": {
                "neft": {"estimated_time": "2-3 hours", "fee": "₹0-25"},
                "rtgs": {"estimated_time": "30 minutes", "fee": "₹0-25", "min_amount": "₹2,00,000"},
                "imps": {"estimated_time": "5-10 minutes", "fee": "₹0-25", "max_amount": "₹5,00,000"}
            },
            "reference": f"ACLOTH{order_id}{datetime.now().strftime('%Y%m%d')}",
            "instructions": [
                "Add the order reference in payment description",
                "Upload payment receipt after transfer",
                "Payment will be verified within 2 hours"
            ]
        }
    
    def create_cod_order(self, amount: Decimal, order_id: int, customer_address: Dict) -> Dict[str, Any]:
        """Create Cash on Delivery order."""
        return {
            "payment_method": "cod",
            "amount": float(amount),
            "order_id": order_id,
            "delivery_instructions": [
                "Exact cash to be paid at delivery",
                "Keep exact amount ready",
                "Receipt will be provided by delivery partner"
            ],
            "cod_fee": 0.00,
            "total_payable": float(amount),
            "address_verification": True,
            "estimated_delivery": "3-5 business days"
        }
    
    def calculate_payment_fee(self, payment_method: str, amount: Decimal) -> Decimal:
        """Calculate payment processing fees."""
        fee_structure = {
            "upi": Decimal("0.00"),      # Free UPI (personal)
            "bank_transfer": Decimal("25.00"),  # Fixed bank fee
            "cod": Decimal("0.00"),       # No processing fee
            "wallet": Decimal("0.00"),   # Free wallet transfers
            "razorpay": amount * Decimal("0.023")  # 2.3% Razorpay
        }
        
        return fee_structure.get(payment_method, Decimal("0.00"))
    
    def get_payment_methods(self) -> Dict[str, Any]:
        """Get available payment methods with fee information."""
        return {
            "methods": [
                {
                    "id": "upi",
                    "name": "UPI Payment",
                    "description": "Pay via PhonePe, GPay, Paytm",
                    "fee_type": "fixed",
                    "fee_amount": 0.00,
                    "max_amount": 100000,
                    "processing_time": "Instant",
                    "icon": "📱"
                },
                {
                    "id": "bank_transfer",
                    "name": "Bank Transfer",
                    "description": "NEFT/RTGS/IMPS transfer",
                    "fee_type": "fixed",
                    "fee_amount": 25.00,
                    "min_amount": 100.00,
                    "processing_time": "5-30 minutes",
                    "icon": "🏦"
                },
                {
                    "id": "cod",
                    "name": "Cash on Delivery",
                    "description": "Pay when you receive",
                    "fee_type": "none",
                    "fee_amount": 0.00,
                    "max_amount": 50000,
                    "processing_time": "3-5 days",
                    "icon": "💵"
                },
                {
                    "id": "wallet",
                    "name": "Wallet Transfer",
                    "description": "Paytm, Amazon Pay, etc.",
                    "fee_type": "none",
                    "fee_amount": 0.00,
                    "processing_time": "Instant",
                    "icon": "💼"
                }
            ],
            "recommended": "upi"  # Best for most users
        }
