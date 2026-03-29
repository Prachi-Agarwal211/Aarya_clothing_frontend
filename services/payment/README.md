# Payment Service - Aarya Clothing

## Overview

This service handles all payment processing for Aarya Clothing women's wear brand, with primary integration for Razorpay payment gateway. It supports multiple payment methods, refund processing, and webhook handling.

## Features

- **Razorpay Integration** - Complete payment processing with Razorpay
- **Multiple Payment Methods** - Card, UPI, NetBanking, Wallets
- **Refund Processing** - Full and partial refunds
- **Webhook Handling** - Real-time payment status updates
- **Transaction Management** - Complete payment lifecycle
- **Fraud Detection** - Basic risk assessment
- **Payment History** - Transaction tracking and reporting

## Architecture

```
Payment Service (Port 8020)
├── Core Components
│   ├── razorpay_client.py      # Razorpay API client
│   ├── config.py              # Service configuration
│   └── payment_service.py    # Business logic
├── API Endpoints
│   ├── Razorpay endpoints     # Order creation, verification
│   ├── Payment endpoints      # Processing, status, refunds
│   ├── Webhook endpoints      # Razorpay webhooks
│   └── Admin endpoints        # History, methods
├── Database Models
│   ├── PaymentTransaction     # Payment records
│   ├── PaymentMethod          # Method configurations
│   └── WebhookEvent          # Webhook logs
└── Schemas
    ├── Payment schemas        # Request/response models
    └── Razorpay schemas       # Razorpay-specific models
```

## Environment Variables

```bash
# Required for Razorpay
RAZORPAY_KEY_ID=rzp_test_your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_key_secret
RAZORPAY_WEBHOOK_SECRET=whsec_your_razorpay_webhook_secret

# Payment URLs
PAYMENT_SUCCESS_URL=http://localhost:3000/payment/success
PAYMENT_FAILURE_URL=http://localhost:3000/payment/failure
```

## API Endpoints

### Razorpay Endpoints

#### Create Razorpay Order
```http
POST /api/v1/payments/razorpay/create-order
Content-Type: application/json

{
  "amount": 50000,  # Amount in paise (₹500.00)
  "currency": "INR",
  "receipt": "order_123",
  "notes": {
    "order_id": "123",
    "user_id": "456"
  }
}
```

#### Verify Razorpay Payment
```http
POST /api/v1/payments/razorpay/verify
Content-Type: application/json

{
  "razorpay_order_id": "order_123",
  "razorpay_payment_id": "pay_123",
  "razorpay_signature": "signature_hash"
}
```

### Payment Endpoints

#### Process Payment
```http
POST /api/v1/payments/process
Content-Type: application/json

{
  "order_id": 123,
  "user_id": 456,
  "amount": 500.00,
  "currency": "INR",
  "payment_method": "razorpay",
  "customer_email": "customer@example.com",
  "customer_phone": "+919876543210"
}
```

#### Get Payment Status
```http
GET /api/v1/payments/{transaction_id}/status
```

#### Process Refund
```http
POST /api/v1/payments/{transaction_id}/refund
Content-Type: application/json

{
  "reason": "Customer requested refund",
  "amount": 250.00  # Optional - full refund if not provided
}
```

#### Get Payment Methods
```http
GET /api/v1/payments/methods
```

#### Get Transaction History
```http
GET /api/v1/payments/history?user_id=456&status=completed&limit=20
```

### Webhook Endpoints

#### Razorpay Webhook
```http
POST /api/v1/webhooks/razorpay
X-Razorpay-Signature: webhook_signature
Content-Type: application/json

{
  "event": "payment.captured",
  "payload": {
    "payment": {
      "id": "pay_123",
      "entity": "payment",
      "amount": 50000,
      "currency": "INR",
      "status": "captured"
    }
  }
}
```

## Payment Flow

### 1. Order Creation
1. Frontend creates order in Commerce Service
2. Frontend calls Payment Service to create payment transaction
3. Payment Service creates Razorpay order
4. Frontend receives Razorpay order details

### 2. Payment Processing
1. Frontend initiates payment using Razorpay SDK
2. User completes payment on Razorpay page
3. Razorpay redirects to success/failure URL
4. Frontend sends payment details to verification endpoint

### 3. Payment Verification
1. Payment Service verifies Razorpay signature
2. Updates transaction status to "completed"
3. Processes webhook events for real-time updates
4. Notifies Commerce Service of successful payment

### 4. Refund Processing
1. Admin/Backend initiates refund request
2. Payment Service processes refund via Razorpay
3. Updates transaction with refund details
4. Handles refund completion via webhooks

## Webhook Events

The service handles these Razorpay webhook events:

- `payment.captured` - Payment successful
- `payment.failed` - Payment failed
- `refund.processed` - Refund completed

## Database Schema

### Payment Transactions
```sql
CREATE TABLE payment_transactions (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'INR',
    payment_method VARCHAR(50) NOT NULL,
    
    -- Razorpay fields
    razorpay_order_id VARCHAR(100) UNIQUE,
    razorpay_payment_id VARCHAR(100) UNIQUE,
    razorpay_signature VARCHAR(500),
    
    -- Transaction details
    transaction_id VARCHAR(100) UNIQUE NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    gateway_response JSONB,
    
    -- Metadata
    description TEXT,
    customer_email VARCHAR(255),
    customer_phone VARCHAR(20),
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP,
    
    -- Refund details
    refund_amount DECIMAL(10,2),
    refund_id VARCHAR(100),
    refund_status VARCHAR(50),
    refund_reason TEXT
);
```

## Error Handling

The service returns appropriate HTTP status codes:

- `200` - Success
- `400` - Bad request (invalid data)
- `401` - Unauthorized (invalid webhook signature)
- `404` - Not found (transaction not found)
- `500` - Internal server error

## Security Features

- **Signature Verification** - All webhooks verified with HMAC
- **Transaction IDs** - Unique transaction identifiers
- **Amount Validation** - Prevent amount manipulation
- **Status Tracking** - Complete payment lifecycle tracking

## Testing

### Test Razorpay Integration

1. Get Razorpay test credentials from [Razorpay Dashboard](https://dashboard.razorpay.com/)
2. Set environment variables
3. Use test card numbers for payments

### Test Webhooks

Use ngrok to test webhooks locally:

```bash
ngrok http 8020
```

Set the ngrok URL in Razorpay webhook settings.

## Deployment

### Docker Deployment

```bash
# Build and start payment service
docker-compose up payment --build

# Check health
curl http://localhost:8020/health
```

### Environment Setup

1. Configure Razorpay credentials
2. Set webhook URLs in Razorpay dashboard
3. Configure database connection
4. Set up monitoring and logging

## Monitoring

Monitor these metrics:

- Payment success rate
- Transaction volume
- Error rates
- Webhook processing latency
- Refund processing time

## Troubleshooting

### Common Issues

1. **Razorpay Connection Failed**
   - Check API keys
   - Verify network connectivity
   - Check service logs

2. **Webhook Verification Failed**
   - Verify webhook secret
   - Check signature calculation
   - Ensure raw body is used

3. **Payment Not Captured**
   - Check order status
   - Verify payment method
   - Check Razorpay dashboard

### Logs

```bash
# View payment service logs
docker-compose logs -f payment

# Check specific transaction
grep "txn_123" /var/log/payment.log
```

## Future Enhancements

- **Multi-currency Support** - International payments
- **Split Payments** - Marketplace functionality
- **Subscription Management** - Recurring payments
- **Advanced Fraud Detection** - ML-based risk scoring
- **Payment Analytics** - Detailed reporting dashboard

## Support

For issues related to:
- **Razorpay API**: [Razorpay Support](https://razorpay.com/support/)
- **Service Issues**: Check logs and health endpoints
- **Integration Help**: Refer to Razorpay documentation
