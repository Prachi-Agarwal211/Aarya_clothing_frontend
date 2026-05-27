"""Unit tests for the payment service exception handler module.

Verifies that custom domain exceptions are properly defined with correct
error codes and inherit from the right base classes, and that the global
exception handler maps them to appropriate HTTP status codes.
"""
from fastapi import FastAPI, status
from fastapi.testclient import TestClient

from exception_handler import (
    DatabaseException,
    InvalidSignatureError,
    OrderCreationError,
    PaymentGatewayException,
    PaymentServiceException,
    TransactionException,
    TransactionNotFoundError,
    WebhookException,
    setup_exception_handlers,
)


class TestExceptionHierarchy:
    """Verify the custom exception class hierarchy."""

    def test_base_exception_has_message_and_error_code(self):
        exc = PaymentServiceException("Something went wrong", error_code="ERR_001")
        assert exc.message == "Something went wrong"
        assert exc.error_code == "ERR_001"

    def test_invalid_signature_error_defaults(self):
        exc = InvalidSignatureError()
        assert exc.message == "Invalid payment signature"
        assert exc.error_code == "INVALID_SIGNATURE"
        assert isinstance(exc, PaymentServiceException)

    def test_transaction_not_found_error(self):
        exc = TransactionNotFoundError("txn_001")
        assert "txn_001" in exc.message
        assert exc.error_code == "TRANSACTION_NOT_FOUND"
        assert isinstance(exc, TransactionException)

    def test_order_creation_error(self):
        exc = OrderCreationError("Commerce service unavailable")
        assert exc.message == "Commerce service unavailable"
        assert exc.error_code == "ORDER_CREATION_FAILED"
        assert isinstance(exc, PaymentGatewayException)

    def test_database_exception(self):
        exc = DatabaseException("DB connection lost")
        assert exc.message == "DB connection lost"
        assert isinstance(exc, PaymentServiceException)

    def test_webhook_exception(self):
        exc = WebhookException("Webhook signature mismatch")
        assert exc.message == "Webhook signature mismatch"
        assert isinstance(exc, PaymentServiceException)

    def test_payment_gateway_exception(self):
        exc = PaymentGatewayException("Gateway timeout")
        assert exc.message == "Gateway timeout"
        assert isinstance(exc, PaymentServiceException)


class TestExceptionHandlerHTTPMapping:
    """Verify exceptions map to correct HTTP status codes."""

    @staticmethod
    def _build_test_app() -> FastAPI:
        app = FastAPI()
        setup_exception_handlers(app)
        return app

    def test_invalid_signature_maps_to_402(self):
        app = self._build_test_app()

        @app.get("/test/signature")
        async def raise_sig():
            raise InvalidSignatureError()

        with TestClient(app) as client:
            resp = client.get("/test/signature")
            assert resp.status_code == status.HTTP_402_PAYMENT_REQUIRED
            body = resp.json()
            assert body["error"]["error_code"] == "INVALID_SIGNATURE"

    def test_transaction_not_found_maps_to_404(self):
        app = self._build_test_app()

        @app.get("/test/not-found")
        async def raise_not_found():
            raise TransactionNotFoundError("txn_ghost")

        with TestClient(app) as client:
            resp = client.get("/test/not-found")
            assert resp.status_code == status.HTTP_404_NOT_FOUND
            body = resp.json()
            assert body["error"]["error_code"] == "TRANSACTION_NOT_FOUND"

    def test_order_creation_error_maps_to_502(self):
        app = self._build_test_app()

        @app.get("/test/order-creation")
        async def raise_order():
            raise OrderCreationError("Commerce unavailable")

        with TestClient(app) as client:
            resp = client.get("/test/order-creation")
            assert resp.status_code == status.HTTP_502_BAD_GATEWAY
            body = resp.json()
            assert body["error"]["error_code"] == "ORDER_CREATION_FAILED"

    def test_generic_payment_service_maps_to_500(self):
        app = self._build_test_app()

        @app.get("/test/generic")
        async def raise_generic():
            raise PaymentServiceException("Generic failure")

        with TestClient(app) as client:
            resp = client.get("/test/generic")
            assert resp.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR

    def test_gateway_exception_maps_to_502(self):
        app = self._build_test_app()

        @app.get("/test/gateway")
        async def raise_gateway():
            raise PaymentGatewayException("Gateway down")

        with TestClient(app) as client:
            resp = client.get("/test/gateway")
            assert resp.status_code == status.HTTP_502_BAD_GATEWAY

    def test_transaction_exception_maps_to_400(self):
        app = self._build_test_app()

        @app.get("/test/txn")
        async def raise_txn():
            raise TransactionException("Bad request")

        with TestClient(app) as client:
            resp = client.get("/test/txn")
            assert resp.status_code == status.HTTP_400_BAD_REQUEST

    def test_webhook_exception_maps_to_502(self):
        app = self._build_test_app()

        @app.get("/test/webhook")
        async def raise_webhook():
            raise WebhookException("Webhook failed")

        with TestClient(app) as client:
            resp = client.get("/test/webhook")
            assert resp.status_code == status.HTTP_502_BAD_GATEWAY
