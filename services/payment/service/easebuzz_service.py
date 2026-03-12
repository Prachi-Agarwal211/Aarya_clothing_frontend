"""
Easebuzz Payment Service
Handles all Easebuzz payment operations and business logic
"""

import logging
from typing import Dict, Any, Optional, List
from decimal import Decimal
from sqlalchemy.orm import Session
from datetime import datetime, timezone

from core.easebuzz_client import easebuzz_client
from core.config import settings
from models.easebuzz import EasebuzzTransaction, EasebuzzRefund, EasebuzzWebhookLog
from schemas.easebuzz import (
    EasebuzzPaymentRequest, EasebuzzPaymentResponse, 
    EasebuzzVerificationRequest, EasebuzzVerificationResponse,
    EasebuzzRefundRequest, EasebuzzRefundResponse
)

logger = logging.getLogger(__name__)


class EasebuzzService:
    """Easebuzz payment service"""
    
    def __init__(self, db: Session):
        self.db = db
    
    def create_payment_transaction(self, request: EasebuzzPaymentRequest) -> EasebuzzPaymentResponse:
        """
        Create and initiate Easebuzz payment transaction
        
        Args:
            request: Payment request details
        
        Returns:
            EasebuzzPaymentResponse: Payment initiation result
        """
        try:
            # Create transaction record
            transaction = EasebuzzTransaction(
                transaction_id=request.txnid,
                txnid=request.txnid,
                amount=Decimal(request.amount),
                firstname=request.firstname,
                email=request.email,
                phone=request.phone,
                productinfo=request.productinfo,
                surl=request.surl,
                furl=request.furl,
                udf1=request.udf1,
                udf2=request.udf2,
                udf3=request.udf3,
                udf4=request.udf4,
                udf5=request.udf5,
                address1=request.address1,
                address2=request.address2,
                city=request.city,
                state=request.state,
                country=request.country,
                zipcode=request.zipcode,
                status="initiated"
            )
            
            self.db.add(transaction)
            self.db.commit()
            self.db.refresh(transaction)
            
            # Initiate payment with Easebuzz
            payment_data = request.dict()
            easebuzz_response = easebuzz_client.initiate_payment(payment_data)
            
            if easebuzz_response["success"]:
                # Update transaction with Easebuzz details
                transaction.easebuzz_order_id = easebuzz_response["easebuzz_order_id"]
                transaction.payment_url = easebuzz_response["payment_url"]
                transaction.status = "payment_initiated"
                self.db.commit()
                
                logger.info(f"Easebuzz payment initiated: {transaction.transaction_id}")
                
                return EasebuzzPaymentResponse(
                    success=True,
                    payment_url=easebuzz_response["payment_url"],
                    txnid=transaction.txnid,
                    easebuzz_order_id=transaction.easebuzz_order_id,
                    status="payment_initiated"
                )
            else:
                # Update transaction with error
                transaction.status = "failed"
                transaction.error_message = easebuzz_response.get("error", "Payment initiation failed")
                self.db.commit()
                
                logger.error(f"Easebuzz payment initiation failed: {transaction.transaction_id} - {transaction.error_message}")
                
                return EasebuzzPaymentResponse(
                    success=False,
                    error=transaction.error_message,
                    status="failed"
                )
                
        except Exception as e:
            logger.error(f"Easebuzz payment creation error: {str(e)}")
            raise Exception(f"Payment transaction creation failed: {str(e)}")
    
    def verify_payment(self, request: EasebuzzVerificationRequest) -> EasebuzzVerificationResponse:
        """
        Verify Easebuzz payment status
        
        Args:
            request: Verification request details
        
        Returns:
            EasebuzzVerificationResponse: Payment verification result
        """
        try:
            # Find transaction
            transaction = self.db.query(EasebuzzTransaction).filter(
                EasebuzzTransaction.txnid == request.txnid,
                EasebuzzTransaction.easebuzz_order_id == request.easebuzz_order_id
            ).first()
            
            if not transaction:
                return EasebuzzVerificationResponse(
                    success=False,
                    error="Transaction not found",
                    status="not_found"
                )
            
            # Verify with Easebuzz
            verification_result = easebuzz_client.verify_payment(
                request.txnid, 
                request.easebuzz_order_id
            )
            
            if verification_result["success"]:
                # Update transaction with verification result
                transaction.easebuzz_status = verification_result["status"]
                transaction.payment_mode = verification_result.get("payment_mode")
                transaction.bank_ref_num = verification_result.get("bank_ref_num")
                transaction.card_category = verification_result.get("card_category")
                transaction.completed_at = datetime.now(timezone.utc)
                
                # Map Easebuzz status to our status
                if verification_result["status"] == "success":
                    transaction.status = "completed"
                elif verification_result["status"] == "failure":
                    transaction.status = "failed"
                elif verification_result["status"] == "pending":
                    transaction.status = "processing"
                else:
                    transaction.status = "unknown"
                
                self.db.commit()
                
                logger.info(f"Easebuzz payment verified: {transaction.transaction_id} - {transaction.status}")
                
                return EasebuzzVerificationResponse(
                    success=True,
                    status=transaction.status,
                    amount=str(transaction.amount),
                    txnid=transaction.txnid,
                    easebuzz_order_id=transaction.easebuzz_order_id,
                    payment_mode=transaction.payment_mode,
                    bank_ref_num=transaction.bank_ref_num,
                    card_category=transaction.card_category
                )
            else:
                # Update transaction with verification error
                transaction.status = "verification_failed"
                transaction.error_message = verification_result.get("error", "Payment verification failed")
                self.db.commit()
                
                logger.error(f"Easebuzz payment verification failed: {transaction.transaction_id} - {transaction.error_message}")
                
                return EasebuzzVerificationResponse(
                    success=False,
                    error=transaction.error_message,
                    status="verification_failed"
                )
                
        except Exception as e:
            logger.error(f"Easebuzz payment verification error: {str(e)}")
            raise Exception(f"Payment verification failed: {str(e)}")
    
    def process_refund(self, request: EasebuzzRefundRequest) -> EasebuzzRefundResponse:
        """
        Process Easebuzz refund
        
        Args:
            request: Refund request details
        
        Returns:
            EasebuzzRefundResponse: Refund processing result
        """
        try:
            # Find original transaction
            original_transaction = self.db.query(EasebuzzTransaction).filter(
                EasebuzzTransaction.txnid == request.txnid
            ).first()
            
            if not original_transaction:
                return EasebuzzRefundResponse(
                    success=False,
                    error="Original transaction not found",
                    status="not_found"
                )
            
            # Create refund record
            refund = EasebuzzRefund(
                refund_id=f"RF_{request.txnid}_{int(datetime.now().timestamp())}",
                original_transaction_id=request.txnid,
                amount=Decimal(request.amount),
                refund_reason=request.refund_reason,
                status="initiated"
            )
            
            self.db.add(refund)
            self.db.commit()
            self.db.refresh(refund)
            
            # Process refund with Easebuzz
            refund_result = easebuzz_client.refund_payment(
                request.txnid,
                request.amount,
                request.refund_reason
            )
            
            if refund_result["success"]:
                # Update refund with Easebuzz details
                refund.easebuzz_refund_id = refund_result.get("refund_id")
                refund.status = refund_result.get("status", "processed")
                refund.completed_at = datetime.now(timezone.utc)
                self.db.commit()
                
                logger.info(f"Easebuzz refund processed: {refund.refund_id}")
                
                return EasebuzzRefundResponse(
                    success=True,
                    refund_id=refund.refund_id,
                    status=refund.status,
                    amount=str(refund.amount),
                    txnid=refund.original_transaction_id
                )
            else:
                # Update refund with error
                refund.status = "failed"
                refund.error_message = refund_result.get("error", "Refund failed")
                self.db.commit()
                
                logger.error(f"Easebuzz refund failed: {refund.refund_id} - {refund.error_message}")
                
                return EasebuzzRefundResponse(
                    success=False,
                    error=refund.error_message,
                    status="failed"
                )
                
        except Exception as e:
            logger.error(f"Easebuzz refund processing error: {str(e)}")
            raise Exception(f"Refund processing failed: {str(e)}")
    
    def get_payment_methods(self) -> Dict[str, Any]:
        """
        Get available Easebuzz payment methods
        
        Returns:
            Dict containing available payment methods
        """
        try:
            methods_response = easebuzz_client.get_payment_methods()
            
            if methods_response["success"]:
                # Format payment methods for frontend
                formatted_methods = [
                    {
                        "id": "easebuzz_upi",
                        "name": "UPI (Easebuzz)",
                        "description": "UPI, PhonePe, Google Pay, Paytm",
                        "fee_type": "percentage",
                        "fee_amount": 1.8,
                        "processing_time": "Instant",
                        "icon": "📱",
                        "available": True
                    },
                    {
                        "id": "easebuzz_card",
                        "name": "Credit/Debit Card",
                        "description": "Visa, Mastercard, Rupay",
                        "fee_type": "percentage",
                        "fee_amount": 2.0,
                        "processing_time": "Instant",
                        "icon": "💳",
                        "available": True
                    },
                    {
                        "id": "easebuzz_netbanking",
                        "name": "Net Banking",
                        "description": "All major banks supported",
                        "fee_type": "percentage",
                        "fee_amount": 2.0,
                        "processing_time": "Instant",
                        "icon": "🏦",
                        "available": True
                    },
                    {
                        "id": "easebuzz_wallet",
                        "name": "Mobile Wallets",
                        "description": "Paytm, PhonePe, Amazon Pay etc",
                        "fee_type": "percentage",
                        "fee_amount": 2.0,
                        "processing_time": "Instant",
                        "icon": "💼",
                        "available": True
                    }
                ]
                
                return {
                    "methods": formatted_methods,
                    "default_method": "easebuzz_upi"
                }
            else:
                logger.error(f"Easebuzz get payment methods failed: {methods_response.get('error')}")
                return {
                    "methods": [],
                    "default_method": "easebuzz_upi"
                }
                
        except Exception as e:
            logger.error(f"Easebuzz get payment methods error: {str(e)}")
            return {
                "methods": [],
                "default_method": "easebuzz_upi"
            }
    
    def get_transaction_status(self, transaction_id: str) -> Optional[Dict[str, Any]]:
        """
        Get transaction status
        
        Args:
            transaction_id: Transaction ID
        
        Returns:
            Dict containing transaction status or None if not found
        """
        try:
            transaction = self.db.query(EasebuzzTransaction).filter(
                EasebuzzTransaction.transaction_id == transaction_id
            ).first()
            
            if not transaction:
                return None
            
            return {
                "transaction_id": transaction.transaction_id,
                "txnid": transaction.txnid,
                "easebuzz_order_id": transaction.easebuzz_order_id,
                "amount": float(transaction.amount),
                "currency": transaction.currency,
                "status": transaction.status,
                "easebuzz_status": transaction.easebuzz_status,
                "payment_mode": transaction.payment_mode,
                "bank_ref_num": transaction.bank_ref_num,
                "card_category": transaction.card_category,
                "created_at": transaction.created_at.isoformat(),
                "completed_at": transaction.completed_at.isoformat() if transaction.completed_at else None,
                "error_message": transaction.error_message
            }
            
        except Exception as e:
            logger.error(f"Easebuzz get transaction status error: {str(e)}")
            return None
    
    def process_webhook_event(self, webhook_data: Dict[str, Any]) -> bool:
        """
        Process Easebuzz webhook event
        
        Args:
            webhook_data: Webhook event data
        
        Returns:
            bool: True if processed successfully, False otherwise
        """
        try:
            # Create webhook log
            webhook_log = EasebuzzWebhookLog(
                webhook_id=webhook_data.get("txnid", f"webhook_{int(datetime.now().timestamp())}"),
                event_type=webhook_data.get("event", "unknown"),
                payload=webhook_data,
                signature=webhook_data.get("signature")
            )
            
            self.db.add(webhook_log)
            self.db.commit()
            self.db.refresh(webhook_log)
            
            # Find related transaction
            transaction_id = webhook_data.get("txnid")
            if transaction_id:
                transaction = self.db.query(EasebuzzTransaction).filter(
                    EasebuzzTransaction.txnid == transaction_id
                ).first()
                
                if transaction:
                    # Update transaction based on webhook data
                    if webhook_data.get("status") == "success":
                        transaction.status = "completed"
                        transaction.easebuzz_status = "success"
                        transaction.completed_at = datetime.now(timezone.utc)
                    elif webhook_data.get("status") == "failure":
                        transaction.status = "failed"
                        transaction.easebuzz_status = "failure"
                    
                    # Update payment details
                    if webhook_data.get("payment_mode"):
                        transaction.payment_mode = webhook_data.get("payment_mode")
                    if webhook_data.get("bank_ref_num"):
                        transaction.bank_ref_num = webhook_data.get("bank_ref_num")
                    
                    # Link webhook to transaction
                    transaction.webhook_logs.append(webhook_log)
                    self.db.commit()
                    
                    logger.info(f"Easebuzz webhook processed: {webhook_log.webhook_id}")
                    
                    # Mark webhook as processed
                    webhook_log.processed = True
                    webhook_log.processed_at = datetime.now(timezone.utc)
                    self.db.commit()
                    
                    return True
                else:
                    logger.warning(f"Easebuzz webhook transaction not found: {transaction_id}")
                    webhook_log.error_message = "Transaction not found"
                    self.db.commit()
                    return False
            else:
                logger.error("Easebuzz webhook missing transaction ID")
                webhook_log.error_message = "Missing transaction ID"
                self.db.commit()
                return False
                
        except Exception as e:
            logger.error(f"Easebuzz webhook processing error: {str(e)}")
            return False
