# Aarya Clothing E-commerce Platform

A modern, production-ready e-commerce platform built with Next.js 15, React 19, and Python microservices.

## 🚀 Features

### Frontend
- **Next.js 15** with React 19 and App Router
- **Responsive Design** - Mobile-first approach
- **AI-Powered Chat** - Customer support chatbot
- **Video Uploads** - Cloudflare R2 storage integration
- **Dual Payment** - Razorpay + Cashfree integration
- **OTP Authentication** - Email and WhatsApp verification
- **Admin Dashboard** - Complete inventory and order management
- **E2E Tests** - Playwright test suite

### Backend Microservices
- **Core Service** - Authentication, users, profiles
- **Commerce Service** - Products, orders, cart, inventory
- **Admin Service** - Dashboard, analytics, AI monitoring
- **Payment Service** - Dual gateway integration

### Infrastructure
- **Docker** - Complete containerization
- **PostgreSQL** - Primary database with pgvector
- **Redis** - Caching and session management
- **Meilisearch** - Product search
- **Nginx** - Reverse proxy with SSL

## 📁 Project Structure

```
Aarya_clothing_frontend/
├── frontend_new/          # Next.js frontend application
├── services/              # Python microservices
│   ├── core/             # Authentication & users
│   ├── commerce/         # Products & orders
│   ├── admin/            # Admin dashboard
│   └── payment/          # Payment processing
├── shared/               # Shared libraries
├── database/             # SQL migrations
├── docker/               # Docker configurations
├── docs/                 # Documentation
└── tests/                # Test suites
```

## 🛠️ Development Setup

### Prerequisites
- Docker & Docker Compose
- Node.js 18+
- Python 3.11+

### Quick Start

1. **Clone the repository**
```bash
git clone <your-repo-url>
cd Aarya_clothing_frontend
```

2. **Setup environment variables**
```bash
cp .env.example .env
# Edit .env with your credentials
```

3. **Start all services**
```bash
docker-compose -f docker-compose.dev.yml up -d
```

4. **Install frontend dependencies**
```bash
cd frontend_new
npm install
npm run dev
```

5. **Access the application**
- Frontend: http://localhost:6004
- Admin: http://localhost:6004/admin
- API: http://localhost:6005

## 🧪 Testing

```bash
# Run E2E tests
npm run test

# Run specific test suites
npm run test:customer
npm run test:admin

# Run with UI
npm run test:ui
```

## 📚 Documentation

See the `docs/` folder for detailed guides:
- [Complete Deployment Guide](docs/COMPLETE_DEPLOYMENT_GUIDE.md)
- [Payment Integration](docs/DUAL_PAYMENT_IMPLEMENTATION_COMPLETE.md)
- [Video Upload System](docs/VIDEO_UPLOAD_COMPLETE_IMPLEMENTATION.md)
- [AI Dashboard Setup](docs/IMPLEMENTATION_SUMMARY.md)

## 🔐 Security

- JWT authentication with refresh tokens
- OTP verification for registration and forgot password
- Internal service authentication
- CORS protection
- Rate limiting
- SQL injection prevention

## 💳 Payment Gateways

### Razorpay (Primary)
- UPI support
- Credit/Debit cards
- Net banking
- Wallets

### Cashfree (Alternative)
- UPI
- Cards
- Net banking

## 🎯 Key Features

- ✅ Guest checkout support
- ✅ Cart reservation system (15 minutes)
- ✅ Inventory management
- ✅ Order tracking
- ✅ Return/refund processing
- ✅ AI-powered customer support
- ✅ Admin analytics dashboard
- ✅ Staff management
- ✅ Product video uploads
- ✅ Image optimization with R2

## 📝 License

Private - All rights reserved

## 👥 Team

Built by the Aarya Clothing development team.

---

**Version:** 2.0.0  
**Last Updated:** March 29, 2026
