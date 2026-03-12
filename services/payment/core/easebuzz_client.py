"""
Easebuzz Payment Client
Handles all Easebuzz payment gateway operations
"""

import hashlib
import hmac
import json
import logging
import requests
from typing import Dict, Any, Optional
from urllib.parse import urlencode
from decimal import Decimal

from core.config import settings

logger = logging.getLogger(__name__)


class EasebuzzClient:
    """Easebuzz Payment Gateway Client"""
    
    def __init__(self):
        self.merchant_key = settings.EASEBUZZ_MERCHANT_KEY
        self.salt = settings.EASEBUZZ_SALT
        self.env = settings.EASEBUZZ_ENV  # test / production
        
        # API endpoints
        if self.env == "production":
            self.base_url = "https://pay.easebuzz.in/"
        else:
            self.base_url = "https://testpay.easebuzz.in/"
    
    def _generate_signature(self, data: Dict[str, Any]) -> str:
        """Generate Easebuzz signature"""
        # Sort the data by key
        sorted_data = sorted(data.items())
        # Create hash string
        hash_string = urlencode(sorted_data) + "|" + self.salt
        # Generate SHA512 hash
        return hashlib.sha512(hash_string.encode()).hexdigest()
    
    def _make_request(self, endpoint: str, data: Dict[str, Any]) -> Dict[str, Any]:
        """Make HTTP request to Easebuzz API"""
        url = f"{self.base_url}{endpoint}"
        
        try:
            response = requests.post(url, data=data, timeout=30)
            response.raise_for_status()
            return response.json()
            
        except requests.exceptions.RequestException as e:
            logger.error(f"Easebuzz API request failed: {str(e)}")
            raise Exception(f"Payment gateway error: {str(e)}")
    
    def initiate_payment(self, payment_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Initiate payment with Easebuzz
        
        Args:
            payment_data: {
                "txnid": str,           # Transaction ID
                "amount": str,          # Amount (string format)
                "firstname": str,       # Customer first name
                "email": str,           # Customer email
                "phone": str,           # Customer phone
                "productinfo": str,     # Product description
                "surl": str,            # Success URL
                "furl": str,            # Failure URL
                "udf1": str,            # User defined field 1 (optional)
                "udf2": str,            # User defined field 2 (optional)
                "udf3": str,            # User defined field 3 (optional)
                "udf4": str,            # User defined field 4 (optional)
                "udf5": str,            # User defined field 5 (optional)
                "address1": str,        # Address (optional)
                "address2": str,        # Address (optional)
                "city": str,            # City (optional)
                "state": str,           # State (optional)
                "country": str,         # Country (optional)
                "zipcode": str,         # ZIP code (optional)
            }
        
        Returns:
            Dict containing payment link and details
        """
        # Add merchant credentials
        payment_data["key"] = self.merchant_key
        
        # Generate signature
        signature = self._generate_signature(payment_data)
        payment_data["hash"] = signature
        
        # Make API request
        try:
            response = self._make_request("payment/initiateLink", payment_data)
            
            if response.get("status") == 1:
                logger.info(f"Easebuzz payment initiated: {response.get('txnid')}")
                return {
                    "success": True,
                    "payment_url": response.get("data", {}).get("payment_url"),
                    "txnid": response.get("data", {}).get("txnid"),
                    "easebuzz_order_id": response.get("data", {}).get("easebuzz_order_id"),
                    "status": "initiated"
                }
            else:
                error_msg = response.get("message", "Payment initiation failed")
                logger.error(f"Easebuzz payment failed: {error_msg}")
                return {
                    "success": False,
                    "error": error_msg,
                    "status": "failed"
                }
                
        except Exception as e:
            logger.error(f"Easebuzz payment initiation error: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "status": "error"
            }
    
    def verify_payment(self, txnid: str, easebuzz_order_id: str) -> Dict[str, Any]:
        """
        Verify payment status
        
        Args:
            txnid: Transaction ID
            easebuzz_order_id: Easebuzz order ID
        
        Returns:
            Dict containing payment verification result
        """
        data = {
            "key": self.merchant_key,
            "txnid": txnid,
            "easebuzz_order_id": easebuzz_order_id
        }
        
        # Generate signature
        signature = self._generate_signature(data)
        data["hash"] = signature
        
        try:
            response = self._make_request("transaction/status", data)
            
            if response.get("status") == 1:
                payment_data = response.get("data", {})
                return {
                    "success": True,
                    "status": payment_data.get("status"),
                    "amount": payment_data.get("amount"),
                    "txnid": payment_data.get("txnid"),
                    "easebuzz_order_id": payment_data.get("easebuzz_order_id"),
                    "payment_mode": payment_data.get("payment_mode"),
                    "bank_ref_num": payment_data.get("bank_ref_num"),
                    "card_category": payment_data.get("card_category"),
                    "error": payment_data.get("error")
                }
            else:
                error_msg = response.get("message", "Payment verification failed")
                return {
                    "success": False,
                    "error": error_msg,
                    "status": "verification_failed"
                }
                
        except Exception as e:
            logger.error(f"Easebuzz payment verification error: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "status": "verification_error"
            }
    
    def refund_payment(self, txnid: str, amount: str, refund_reason: str = "Customer request") -> Dict[str, Any]:
        """
        Process refund
        
        Args:
            txnid: Original transaction ID
            amount: Refund amount
            refund_reason: Reason for refund
        
        Returns:
            Dict containing refund result
        """
        data = {
            "key": self.merchant_key,
            "txnid": txnid,
            "amount": amount,
            "refund_reason": refund_reason
        }
        
        # Generate signature
        signature = self._generate_signature(data)
        data["hash"] = signature
        
        try:
            response = self._make_request("payment/refund", data)
            
            if response.get("status") == 1:
                refund_data = response.get("data", {})
                return {
                    "success": True,
                    "refund_id": refund_data.get("refund_id"),
                    "status": refund_data.get("status"),
                    "amount": refund_data.get("amount"),
                    "txnid": refund_data.get("txnid")
                }
            else:
                error_msg = response.get("message", "Refund failed")
                return {
                    "success": False,
                    "error": error_msg,
                    "status": "refund_failed"
                }
                
        except Exception as e:
            logger.error(f"Easebuzz refund error: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "status": "refund_error"
            }
    
    def get_payment_methods(self) -> Dict[str, Any]:
        """
        Get available payment methods
        
        Returns:
            Dict containing available payment methods
        """
        try:
            response = self._make_request("payment/modes", {"key": self.merchant_key})
            
            if response.get("status") == 1:
                return {
                    "success": True,
                    "methods": response.get("data", {}).get("payment_modes", [])
                }
            else:
                return {
                    "success": False,
                    "error": response.get("message", "Failed to get payment methods")
                }
                
        except Exception as e:
            logger.error(f"Easebuzz get payment methods error: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }


# Global instance
easebuzz_client = EasebuzzClient()
