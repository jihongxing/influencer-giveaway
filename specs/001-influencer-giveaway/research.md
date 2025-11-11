# Research: Influencer Giveaway Platform

**Feature**: Influencer Giveaway Platform  
**Date**: 2025-01-27  
**Purpose**: Resolve technical decisions and clarify implementation choices

## Backend Language Selection

**Decision**: Node.js with TypeScript

**Rationale**: 
- Excellent WeChat integration support via official WeChat API SDKs
- Strong ecosystem for image processing (sharp, jimp)
- Good Redis caching libraries (ioredis, node-redis)
- MySQL support via mysql2 or TypeORM/Sequelize
- TypeScript provides type safety per constitution requirements
- Fast development iteration for API endpoints
- Good performance for I/O-bound operations (API calls, database queries)

**Alternatives considered**:
- **Python**: Good AI/ML libraries but weaker WeChat SDK support, slower for API endpoints
- **Go**: Excellent performance but smaller WeChat SDK ecosystem, steeper learning curve
- **Java**: Enterprise-grade but heavier, more complex setup

## Backend Dependencies

**Decision**: 
- **WeChat API SDK**: `wechat-api` (Node.js) - official WeChat Mini Program and payment SDK
- **AI Service SDK**: Tencent Cloud AI (腾讯云AI) - Image Recognition API for image classification
- **Shipping API SDK**: Express delivery APIs (SF Express, YTO, ZTO, JD Logistics, Cainiao) - free tier available

**Rationale**:
- WeChat ecosystem: Use official WeChat SDKs for reliability
- AI services: Tencent Cloud AI integrates seamlessly with WeChat ecosystem, offers free tier with image classification APIs suitable for item recognition
- Shipping APIs: Major Chinese express companies provide free API tiers for shipping cost calculation
- **Unified Tencent ecosystem**: Using Tencent Cloud AI ensures consistency with WeChat Mini Program and Tencent COS storage

**Alternatives considered**:
- **Custom AI model**: Too complex for MVP, requires ML expertise
- **Third-party shipping aggregators**: May have costs, but can be considered for future scaling

## AI Service Selection

**Decision**: Tencent Cloud AI (腾讯云AI) - Image Recognition API (免费额度: 10,000 calls/month, 付费后更高额度)

**Rationale**:
- **Unified Tencent ecosystem**: Seamlessly integrates with WeChat Mini Program, Tencent COS storage, and WeChat Pay
- Free tier sufficient for initial scale (10k calls/month = ~330 items/day, can scale with paid tier)
- Good accuracy for common item categories (clothing, electronics, books, cosmetics, toys)
- Easy integration via REST API with official Tencent Cloud SDK
- Supports Chinese market (aligned with WeChat/Douyin/Xiaohongshu)
- Same authentication and billing system as other Tencent services
- Can fallback to manual category selection if API fails
- PRD explicitly mentions using Tencent Cloud AI for image recognition

**Alternatives considered**:
- **Baidu AI Platform**: Good free tier but separate ecosystem, requires additional account setup
- **Google Cloud Vision**: Excellent but requires VPN in China, paid tier, not aligned with WeChat ecosystem
- **Custom ML model**: Too complex for MVP

## File Storage

**Decision**: WeChat Cloud Storage (primary) with fallback to Tencent Cloud Object Storage (COS)

**Rationale**:
- WeChat Cloud Storage: Free tier (5GB), integrated with Mini Program, no additional setup
- Tencent COS: Low cost ($0.01/GB/month), good performance, same ecosystem as WeChat
- Image compression: Compress before upload (60-80% reduction) to minimize storage costs
- CDN: Both services include CDN for fast image delivery

**Alternatives considered**:
- **Aliyun OSS**: Good but separate ecosystem, additional setup
- **Self-hosted**: Requires infrastructure, not cost-effective for MVP

## Backend Testing Framework

**Decision**: Jest with TypeScript support

**Rationale**:
- Industry standard for Node.js/TypeScript projects
- Excellent TypeScript support
- Built-in mocking and assertion libraries
- Good integration with CI/CD
- Supports async/await testing patterns
- Coverage reporting built-in

**Alternatives considered**:
- **Mocha + Chai**: More flexible but requires more configuration
- **Jasmine**: Less popular, smaller community

## Image Compression Strategy

**Decision**: 
- **Backend**: Use `sharp` library (Node.js) for server-side compression
- **Frontend**: Use WeChat Mini Program `wx.compressImage` API for client-side compression before upload
- **Target**: 60-80% size reduction, maintain quality score >80%

**Rationale**:
- Client-side compression reduces upload time and bandwidth
- Server-side compression ensures consistent quality and format
- Sharp library: Fast, high-quality compression, supports WebP format
- WeChat API: Built-in, no additional dependencies

**Compression settings**:
- Format: WebP (better compression than JPEG)
- Quality: 80% (good balance of size and quality)
- Max dimensions: 1920x1920px (sufficient for mobile viewing)
- Progressive loading: Enable for better perceived performance

**Alternatives considered**:
- **JPEG only**: Larger file sizes, less efficient
- **PNG**: Too large for photos, only for graphics/logos

## Database Schema Design

**Decision**: MySQL 8.0 with InnoDB engine, UTF8MB4 charset

**Rationale**:
- Requirement: MySQL 8.0 specified
- InnoDB: ACID compliance, row-level locking, foreign key support
- UTF8MB4: Full Unicode support (emojis, Chinese characters)
- Indexing strategy: Indexes on frequently queried fields (user_id, activity_id, item_id, order_id)
- Connection pooling: Use connection pool (max 20 connections) to handle concurrent requests

**Caching strategy**:
- Redis for frequently accessed data:
  - User sessions (TTL: 7 days)
  - Giveaway page data (TTL: 1 hour)
  - Shipping cost calculations (TTL: 24 hours)
  - Hot items list (TTL: 30 minutes)

## API Design Pattern

**Decision**: RESTful API with JSON responses

**Rationale**:
- Standard pattern, easy to understand and maintain
- Good tooling support (OpenAPI/Swagger)
- Easy to test and document
- Compatible with WeChat Mini Program HTTP requests

**API versioning**: `/api/v1/` prefix for future compatibility

**Error handling**: Standard HTTP status codes + JSON error response format

## Payment Integration

**Decision**: WeChat Pay Mini Program Payment API

**Rationale**:
- Required by spec (FR-010)
- Official WeChat payment method for Mini Programs
- Secure, reliable, widely used
- Good documentation and SDK support

**Payment flow**:
1. Frontend calls backend to create payment order
2. Backend calls WeChat Pay API to create prepay_id
3. Backend returns payment parameters to frontend
4. Frontend calls `wx.requestPayment()` with parameters
5. Backend receives payment notification via webhook
6. Backend updates order status

## Shipping Cost Calculation

**Decision**: Use express delivery company APIs (SF Express, YTO, ZTO) for real-time shipping cost calculation

**Rationale**:
- Accurate cost calculation based on actual shipping routes
- Real-time pricing (handles price changes)
- Supports address validation
- Free tier available for API calls

**Fallback strategy**:
- Cache shipping costs by route (origin-destination pairs) for 24 hours
- If API fails, use cached value or default pricing table
- Allow manual override for edge cases

## Summary

All NEEDS CLARIFICATION items resolved:
- ✅ Backend language: Node.js with TypeScript
- ✅ Backend dependencies: WeChat SDK, Tencent Cloud AI, Express delivery APIs
- ✅ AI service: Tencent Cloud AI - Image Recognition API (unified Tencent ecosystem)
- ✅ File storage: WeChat Cloud Storage (primary), Tencent COS (fallback)
- ✅ Testing framework: Jest with TypeScript
- ✅ Image compression: Sharp (backend) + WeChat API (frontend)
- ✅ Database: MySQL 8.0 with InnoDB, UTF8MB4
- ✅ Caching: Redis for sessions, page data, shipping costs
- ✅ API design: RESTful with JSON
- ✅ Payment: WeChat Pay Mini Program Payment
- ✅ Shipping: Express delivery company APIs (SF Express, YTO, ZTO, JD Logistics, Cainiao)

All decisions align with project constraints:
- Free libraries/services preferred ✅
- WeChat Mini Program built-in libraries used ✅
- **Unified Tencent ecosystem**: All services use Tencent platform (WeChat, Tencent Cloud AI, Tencent COS) ✅
- Image compression implemented ✅
- MySQL 8.0 requirement met ✅
- Caching enabled ✅

