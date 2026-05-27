"""Pytest fixtures for payment service unit tests.

All tests use mocked Razorpay client and an in-memory SQLite database
to avoid external dependencies.
"""
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any, Dict, Generator
from unittest.mock import MagicMock, patch

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

# ── In-memory SQLite engine for isolated tests ──
from models.payment import Base, PaymentTransaction, WebhookEvent


@pytest.fixture(scope="function")
def db_session() -> Generator[Session, None, None]:
    """Create a fresh in-memory SQLite session for each test.

    Uses SQLite's ``:memory:`` so each test gets an isolated database
    that is automatically destroyed when the session closes.
    """
    engine = create_engine("sqlite:///:memory:", echo=False)
    Base.metadata.create_all(engine)
    TestSession = sessionmaker(bind=engine)
    session = TestSession()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(engine)


@pytest.fixture(scope="function")
def sample_transaction(db_session: Session) -> PaymentTransaction:
    """Create a minimal pending payment transaction for test scenarios."""
    txn = PaymentTransaction(
        order_id=1,
        user_id=42,
        amount=Decimal("999.00"),
        currency="INR",
        payment_method="razorpay",
        transaction_id="txn_test_001",
        status="pending",
        razorpay_order_id="order_mock_1",
        customer_email="test@example.com",
    )
    db_session.add(txn)
    db_session.commit()
    return txn


@pytest.fixture(scope="function")
def completed_transaction(db_session: Session) -> PaymentTransaction:
    """Create a completed transaction (simulates webhook-first scenario)."""
    txn = PaymentTransaction(
        order_id=2,
        user_id=42,
        amount=Decimal("1499.00"),
        currency="INR",
        payment_method="razorpay",
        transaction_id="txn_completed_001",
        status="completed",
        razorpay_order_id="order_completed_001",
        razorpay_payment_id="pay_completed_001",
        customer_email="test@example.com",
    )
    db_session.add(txn)
    db_session.commit()
    return txn


# ── Mock Razorpay Client ──


class MockRazorpayClient:
    """Simulates the razorpay.Client interface for testing.

    Returns deterministic responses so tests are reproducible regardless
    of Razorpay API availability.
    """

    def __init__(self):
        self.orders = {}
        self.payments = {}

    def create_order(self, *, amount: int, currency: str, receipt: str, notes: dict) -> dict:
        order_id = f"order_mock_{len(self.orders) + 1}"
        order = {
            "id": order_id,
            "amount": amount,
            "currency": currency,
            "receipt": receipt,
            "notes": notes,
            "status": "created",
        }
        self.orders[order_id] = order
        return order

    def fetch_payment(self, payment_id: str) -> dict:
        """Return a deterministic payment response."""
        return {
            "id": payment_id,
            "order_id": "order_mock_1",
            "status": "captured",
            "amount": 99900,
            "currency": "INR",
            "method": "card",
            "notes": {"user_id": "42"},
        }

    def verify_payment(
        self, razorpay_order_id: str, razorpay_payment_id: str, razorpay_signature: str
    ) -> bool:
        # For tests, valid signature = "valid_signature"
        return razorpay_signature == "valid_signature"

    def refund_payment(self, payment_id: str, amount: int) -> dict:
        return {
            "id": "rfnd_mock_001",
            "payment_id": payment_id,
            "amount": amount,
            "status": "processed",
            "currency": "INR",
        }

    def parse_webhook_event(self, webhook_data: dict) -> dict:
        """Parse webhook data into a standardised event_info dict."""
        event_type = webhook_data.get("event", "")
        payload = webhook_data.get("payload", {})
        payment = payload.get("payment", {}).get("entity", {})
        order = payload.get("order", {}).get("entity", {})

        payment_id = payment.get("id") or payload.get("payment", {}).get("id")
        order_id = order.get("id") or payment.get("order_id")

        return {
            "event_type": event_type,
            "payment_id": payment_id,
            "order_id": order_id,
            "amount": payment.get("amount"),
            "method": payment.get("method", "card"),
            "status": payment.get("status", "captured"),
            "notes": payment.get("notes", {}),
            "payload": webhook_data,
        }


@pytest.fixture(scope="function")
def mock_razorpay() -> MockRazorpayClient:
    """Provide a fresh MockRazorpayClient for each test."""
    return MockRazorpayClient()


@pytest.fixture(scope="function", autouse=True)
def patch_env_vars():
    """Set required environment variables for the payment service tests."""
    import os
    with patch.dict(os.environ, {
        "COMMERCE_SERVICE_URL": "http://commerce:5002",
        "INTERNAL_SERVICE_SECRET": "test-secret",
    }):
        yield


@pytest.fixture(scope="function")
def payment_service(db_session: Session, mock_razorpay: MockRazorpayClient):
    """Create a PaymentService instance wired to test dependencies.

    The Razorpay client is mocked to avoid external API calls.
    The database session uses in-memory SQLite.
    """
    from service.payment_service import PaymentService

    with patch("service.payment_service.get_razorpay_client", return_value=mock_razorpay):
        with patch("core.razorpay_client.get_razorpay_client", return_value=mock_razorpay):
            service = PaymentService(db_session)
            yield service


# ── Sample webhook payloads ──


@pytest.fixture(scope="function")
def webhook_payment_captured() -> dict:
    """Simulated payment.captured webhook payload from Razorpay."""
    return {
        "id": "evt_mock_captured",
        "event": "payment.captured",
        "payload": {
            "payment": {
                "entity": {
                    "id": "pay_mock_captured",
                    "order_id": "order_mock_1",
                    "amount": 99900,
                    "currency": "INR",
                    "status": "captured",
                    "method": "card",
                    "notes": {
                        "user_id": "42",
                        "pending_order_id": "pending_001",
                    },
                }
            }
        },
    }


@pytest.fixture(scope="function")
def webhook_payment_failed() -> dict:
    """Simulated payment.failed webhook payload."""
    return {
        "id": "evt_mock_failed",
        "event": "payment.failed",
        "payload": {
            "payment": {
                "entity": {
                    "id": "pay_mock_failed",
                    "order_id": "order_mock_1",
                    "amount": 99900,
                    "currency": "INR",
                    "status": "failed",
                    "method": "card",
                    "notes": {},
                    "error_description": "Insufficient funds",
                }
            }
        },
    }
