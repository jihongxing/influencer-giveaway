# Quick Start Guide: Influencer Giveaway Platform

**Feature**: Influencer Giveaway Platform  
**Date**: 2025-01-27  
**Purpose**: Get the system running locally for development and testing

## Prerequisites

### Required Software
- **Node.js**: v18.x or higher
- **MySQL**: 8.0 or higher
- **Redis**: 6.x or higher
- **WeChat Developer Tools**: Latest version
- **Git**: For version control

### Required Accounts
- **WeChat Mini Program Account**: Register at https://mp.weixin.qq.com/
- **Tencent Cloud AI Account**: Register at https://cloud.tencent.com/product/tiia (free tier: 10k calls/month)
- **WeChat Pay Merchant Account**: For payment testing (sandbox available)

## Setup Steps

### 1. Clone and Install

```bash
# Clone repository
git clone <repository-url>
cd FamilyAuther

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies (if using npm for miniprogram)
cd ../miniprogram
npm install  # Optional, if using npm packages
```

### 2. Database Setup

```bash
# Create database
mysql -u root -p
CREATE DATABASE influencer_giveaway CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
EXIT;

# Run migrations
cd backend
npm run migrate
```

### 3. Redis Setup

```bash
# Start Redis (macOS with Homebrew)
brew services start redis

# Start Redis (Linux)
sudo systemctl start redis

# Start Redis (Windows)
# Download Redis from https://github.com/microsoftarchive/redis/releases
redis-server
```

### 4. Backend Configuration

Create `backend/.env` file:

```env
# Server
NODE_ENV=development
PORT=3000
API_BASE_URL=http://localhost:3000/api/v1

# Database
DB_HOST=localhost
DB_PORT=3306
DB_NAME=influencer_giveaway
DB_USER=root
DB_PASSWORD=your_password

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# WeChat Mini Program
WECHAT_APPID=your_appid
WECHAT_SECRET=your_secret
WECHAT_MCHID=your_merchant_id
WECHAT_API_KEY=your_api_key

# Tencent Cloud AI
TENCENT_CLOUD_SECRET_ID=your_secret_id
TENCENT_CLOUD_SECRET_KEY=your_secret_key
TENCENT_CLOUD_REGION=ap-guangzhou

# File Storage
STORAGE_TYPE=wechat_cloud  # or 'tencent_cos'
TENCENT_COS_SECRET_ID=your_secret_id
TENCENT_COS_SECRET_KEY=your_secret_key
TENCENT_COS_BUCKET=your_bucket_name
TENCENT_COS_REGION=ap-guangzhou

# Image Compression
IMAGE_MAX_WIDTH=1920
IMAGE_MAX_HEIGHT=1920
IMAGE_QUALITY=80
IMAGE_FORMAT=webp
```

### 5. Start Backend Server

```bash
cd backend
npm run dev  # Development mode with hot reload
```

Backend should be running at `http://localhost:3000`

### 6. Frontend Setup (WeChat Mini Program)

1. Open **WeChat Developer Tools**
2. Click **+** to create new project
3. Select **Import Project**
4. Choose `miniprogram/` directory
5. Enter your **AppID** (from WeChat Mini Program account)
6. Click **Import**

### 7. Configure Frontend API Endpoint

Edit `miniprogram/config/api.js`:

```javascript
const config = {
  apiBaseUrl: 'http://localhost:3000/api/v1',  // Development
  // apiBaseUrl: 'https://api.example.com/api/v1',  // Production
};

module.exports = config;
```

**Note**: For WeChat Mini Program, you need to:
- Add your backend domain to **WeChat Mini Program Settings → Server Domain → Request Domain**
- Use HTTPS in production (required by WeChat)

### 8. Run Tests

```bash
# Backend tests
cd backend
npm test              # Run all tests
npm run test:unit     # Unit tests only
npm run test:integration  # Integration tests only
npm run test:contract # Contract tests only

# Frontend tests (in WeChat Developer Tools)
# Use built-in testing framework
```

## Development Workflow

### 1. Database Migrations

```bash
cd backend
npm run migrate:create -- --name create_users_table
npm run migrate:up
npm run migrate:down  # Rollback
```

### 2. API Development

1. Define contract in `contracts/api-contracts.md`
2. Write contract tests first (TDD)
3. Implement endpoint in `backend/src/api/`
4. Run tests: `npm test`

### 3. Frontend Development

1. Create page in `miniprogram/pages/`
2. Add route in `miniprogram/app.json`
3. Test in WeChat Developer Tools
4. Use WeChat debugging tools for network requests

### 4. Image Upload Testing

```bash
# Test image compression
curl -X POST http://localhost:3000/api/v1/items/upload-photos \
  -H "Authorization: Bearer {token}" \
  -F "photos=@test-image.jpg"
```

## Common Tasks

### Reset Database

```bash
cd backend
npm run migrate:down:all
npm run migrate:up
npm run seed  # If seed data exists
```

### Clear Redis Cache

```bash
redis-cli FLUSHALL
```

### View Logs

```bash
# Backend logs (if using PM2)
pm2 logs

# Backend logs (if using npm run dev)
# Logs appear in console

# Frontend logs
# Use WeChat Developer Tools Console
```

### Test WeChat Pay (Sandbox)

1. Enable WeChat Pay Sandbox in merchant account
2. Use sandbox API key in `.env`
3. Test payment flow with sandbox test accounts

## Verification Checklist

After setup, verify:

- [x] Backend server starts without errors
- [x] Database connection successful
- [x] Redis connection successful
- [x] WeChat Mini Program loads in Developer Tools
- [x] API endpoints respond (test with `curl` or Postman)
- [x] Image upload works
- [x] AI service responds (test with sample image)
- [x] WeChat Pay sandbox configured (if testing payments)

## Troubleshooting

### Backend won't start
- Check MySQL is running: `mysql -u root -p`
- Check Redis is running: `redis-cli ping`
- Check port 3000 is available: `lsof -i :3000`
- Verify `.env` file exists and has correct values

### Database connection errors
- Verify MySQL 8.0 is installed: `mysql --version`
- Check database exists: `SHOW DATABASES;`
- Verify user permissions: `GRANT ALL ON influencer_giveaway.* TO 'user'@'localhost';`

### WeChat Mini Program errors
- Verify AppID is correct
- Check backend domain is added to WeChat settings
- Use HTTPS in production (required)
- Check network requests in Developer Tools → Network

### Image upload fails
- Verify file size < 5MB
- Check image format (JPEG, PNG, WebP)
- Verify storage credentials in `.env`
- Check WeChat Cloud Storage quota (5GB free tier)

### AI service errors
- Verify Tencent Cloud AI credentials (Secret ID and Secret Key)
- Check API quota (10k calls/month free tier)
- Test API directly: `curl` to Tencent Cloud AI endpoint
- Check network connectivity to Tencent Cloud servers
- Ensure region is set correctly (ap-guangzhou recommended)

## Next Steps

1. **Read Documentation**:
   - [spec.md](./spec.md) - Feature specification
   - [data-model.md](./data-model.md) - Database schema
   - [contracts/api-contracts.md](./contracts/api-contracts.md) - API contracts

2. **Start Development**:
   - Follow TDD approach (write tests first)
   - Implement User Story 1 (Influencer Creates Giveaway)
   - Test independently before moving to next story

3. **Deploy**:
   - Backend: Deploy to cloud server (Tencent Cloud, Aliyun, etc.)
   - Frontend: Upload to WeChat Mini Program platform
   - Configure production environment variables

## Resources

- **WeChat Mini Program Docs**: https://developers.weixin.qq.com/miniprogram/dev/framework/
- **WeChat Pay Docs**: https://pay.weixin.qq.com/wiki/doc/apiv3/index.shtml
- **Tencent Cloud AI Docs**: https://cloud.tencent.com/document/product/865
- **MySQL 8.0 Docs**: https://dev.mysql.com/doc/refman/8.0/en/
- **Redis Docs**: https://redis.io/documentation

