# Data Model: Influencer Giveaway Platform

**Feature**: Influencer Giveaway Platform  
**Date**: 2025-01-27  
**Based on**: [spec.md](./spec.md)

## Entity Relationship Overview

```
Influencer Account
    ├── 1:N → Giveaway Activity
    │           ├── 1:N → Item
    │           │           ├── 1:1 → Order (when claimed)
    │           │           │           └── 1:1 → Shipping Information
    │           │           │           └── 1:1 → Sharing Post (after delivery)
    │           │           └── 1:1 → Shipping Information (via Order)
    │           └── 1:N → Order (via Item)
    ├── 1:N → External Activity (WeChat/Xiaohongshu posts)
    └── 1:N → Order (as influencer)
```

## Entities

### Influencer Account

**Purpose**: Represents a registered influencer user who creates giveaways.

**Attributes**:
- `id` (BIGINT, PRIMARY KEY, AUTO_INCREMENT): Unique identifier
- `wechat_openid` (VARCHAR(64), UNIQUE, NOT NULL): WeChat OpenID for authentication
- `wechat_unionid` (VARCHAR(64), UNIQUE, NULLABLE): WeChat UnionID (if available)
- `phone_number` (VARCHAR(20), NOT NULL): Phone number (verified)
- `nickname` (VARCHAR(100), NULLABLE): Display name from WeChat
- `avatar_url` (VARCHAR(500), NULLABLE): Profile picture URL
- `shipping_address` (TEXT, NOT NULL): Default shipping address (JSON format)
- `shipping_contact_name` (VARCHAR(100), NOT NULL): Contact name for shipping
- `shipping_contact_phone` (VARCHAR(20), NOT NULL): Contact phone for shipping
- `account_status` (ENUM('active', 'suspended', 'banned'), DEFAULT 'active'): Account status
- `created_at` (DATETIME, NOT NULL, DEFAULT CURRENT_TIMESTAMP): Registration date
- `updated_at` (DATETIME, NOT NULL, DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP): Last update time

**Indexes**:
- PRIMARY KEY: `id`
- UNIQUE: `wechat_openid`
- INDEX: `phone_number` (for lookups)
- INDEX: `account_status` (for filtering)

**Validation Rules**:
- Phone number must be valid Chinese mobile format (11 digits, starts with 1)
- Shipping address must contain: province, city, district, street address
- Account status transitions: active → suspended → banned (one-way)

**State Transitions**:
- `active` → `suspended`: Admin action or policy violation
- `suspended` → `banned`: Repeated violations
- `suspended` → `active`: Admin reinstatement (if applicable)

### Giveaway Activity

**Purpose**: Represents a published giveaway created by an influencer.

**Attributes**:
- `id` (BIGINT, PRIMARY KEY, AUTO_INCREMENT): Unique identifier
- `influencer_id` (BIGINT, NOT NULL, FOREIGN KEY → Influencer.id): Creator of giveaway
- `shareable_link` (VARCHAR(200), UNIQUE, NOT NULL): Shareable page URL
- `qr_code_url` (VARCHAR(500), NULLABLE): QR code image URL
- `status` (ENUM('draft', 'active', 'completed', 'cancelled'), DEFAULT 'draft'): Activity status
- `created_at` (DATETIME, NOT NULL, DEFAULT CURRENT_TIMESTAMP): Creation date
- `published_at` (DATETIME, NULLABLE): Publication date (when status changed to 'active')
- `updated_at` (DATETIME, NOT NULL, DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP): Last update time

**Indexes**:
- PRIMARY KEY: `id`
- FOREIGN KEY: `influencer_id` → `influencer.id`
- UNIQUE: `shareable_link`
- INDEX: `status` (for filtering active giveaways)
- INDEX: `influencer_id, status` (composite, for user's activity list)

**Validation Rules**:
- Shareable link must be unique and URL-safe
- Status transitions: draft → active → completed/cancelled
- Cannot publish if no items exist

**State Transitions**:
- `draft` → `active`: Influencer publishes giveaway
- `active` → `completed`: All items claimed or influencer ends giveaway
- `active` → `cancelled`: Influencer cancels before items claimed
- `draft` → `cancelled`: Influencer cancels before publishing

### Item

**Purpose**: Represents a single item in a giveaway.

**Attributes**:
- `id` (BIGINT, PRIMARY KEY, AUTO_INCREMENT): Unique identifier
- `activity_id` (BIGINT, NOT NULL, FOREIGN KEY → Giveaway Activity.id): Parent giveaway
- `photo_urls` (JSON, NOT NULL): Array of compressed image URLs (stored in WeChat Cloud Storage or Tencent COS)
- `ai_category` (VARCHAR(50), NULLABLE): AI-identified category from Tencent Cloud AI (e.g., "clothing", "electronics", "books", "cosmetics", "toys")
- `manual_category` (VARCHAR(50), NULLABLE): Manual category override
- `label` (VARCHAR(200), NULLABLE): Custom label/name for item (AI-generated or manual)
- `description` (TEXT, NULLABLE): Optional description
- `marker_name` (VARCHAR(100), NULLABLE): Item marker name for order matching (e.g., "衣服A", "手机壳", "玩偶熊")
- `marker_qr_code` (VARCHAR(500), NULLABLE): QR code URL for scanning to match item to order
- `quantity` (INT, DEFAULT 1, NOT NULL): Number of items available
- `shipping_cost_estimate` (DECIMAL(10,2), NOT NULL): Estimated shipping cost (in CNY)
- `status` (ENUM('available', 'claimed', 'shipped', 'delivered'), DEFAULT 'available'): Item status
- `created_at` (DATETIME, NOT NULL, DEFAULT CURRENT_TIMESTAMP): Creation date
- `updated_at` (DATETIME, NOT NULL, DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP): Last update time

**Indexes**:
- PRIMARY KEY: `id`
- FOREIGN KEY: `activity_id` → `giveaway_activity.id`
- INDEX: `status` (for filtering available items)
- INDEX: `activity_id, status` (composite, for activity item list)
- INDEX: `ai_category` (for category filtering/search)

**Validation Rules**:
- At least one photo URL required
- Shipping cost estimate must be > 0
- Quantity must be >= 1
- If AI category unavailable, manual category required before publishing
- Status transitions: available → claimed → shipped → delivered

**State Transitions**:
- `available` → `claimed`: Fan successfully pays for item
- `claimed` → `shipped`: Shipping label generated and item shipped
- `shipped` → `delivered`: Shipping provider confirms delivery

### Order

**Purpose**: Represents a fan's claim of an item.

**Attributes**:
- `id` (BIGINT, PRIMARY KEY, AUTO_INCREMENT): Unique identifier
- `item_id` (BIGINT, NOT NULL, FOREIGN KEY → Item.id, UNIQUE): Claimed item (one order per item)
- `fan_wechat_openid` (VARCHAR(64), NOT NULL): Fan's WeChat OpenID
- `fan_phone_number` (VARCHAR(20), NOT NULL): Fan's contact phone
- `shipping_address` (TEXT, NOT NULL): Delivery address (JSON format)
- `shipping_contact_name` (VARCHAR(100), NOT NULL): Recipient name
- `shipping_contact_phone` (VARCHAR(20), NOT NULL): Recipient phone
- `matched_marker_name` (VARCHAR(100), NULLABLE): Matched item marker name (for order matching)
- `packaging_fee` (DECIMAL(10,2), NOT NULL): Packaging fee (in CNY)
- `shipping_cost` (DECIMAL(10,2), NOT NULL): Shipping cost (in CNY)
- `platform_fee` (DECIMAL(10,2), NOT NULL): Platform service fee (in CNY)
- `total_amount` (DECIMAL(10,2), NOT NULL): Total payment amount (packaging + shipping + platform fee)
- `payment_status` (ENUM('pending', 'paid', 'failed', 'refunded'), DEFAULT 'pending'): Payment status
- `order_status` (ENUM('pending', 'processing', 'shipped', 'delivered', 'completed', 'cancelled'), DEFAULT 'pending'): Order status
- `wechat_payment_transaction_id` (VARCHAR(64), NULLABLE): WeChat Pay transaction ID
- `created_at` (DATETIME, NOT NULL, DEFAULT CURRENT_TIMESTAMP): Order creation date
- `paid_at` (DATETIME, NULLABLE): Payment completion date
- `updated_at` (DATETIME, NOT NULL, DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP): Last update time

**Indexes**:
- PRIMARY KEY: `id`
- FOREIGN KEY: `item_id` → `item.id`
- UNIQUE: `item_id` (ensures one order per item)
- INDEX: `fan_wechat_openid` (for fan's order history)
- INDEX: `payment_status` (for payment processing)
- INDEX: `order_status` (for order management)
- INDEX: `wechat_payment_transaction_id` (for payment lookup)

**Validation Rules**:
- Total amount = packaging_fee + shipping_cost + platform_fee
- Shipping address must be valid (province, city, district, street)
- Phone numbers must be valid Chinese mobile format
- Payment status transitions: pending → paid/failed
- Order status transitions: pending → processing → shipped → delivered → completed

**State Transitions**:
- `pending` → `paid`: Payment successful via WeChat Pay
- `pending` → `failed`: Payment failed or timeout
- `paid` → `processing`: Order being prepared for shipping
- `processing` → `shipped`: Shipping label generated, item shipped
- `shipped` → `delivered`: Shipping provider confirms delivery
- `delivered` → `completed`: Fan confirms receipt
- Any status → `cancelled`: Order cancelled (with refund if paid)

### Shipping Information

**Purpose**: Represents logistics details for an order.

**Attributes**:
- `id` (BIGINT, PRIMARY KEY, AUTO_INCREMENT): Unique identifier
- `order_id` (BIGINT, NOT NULL, FOREIGN KEY → Order.id, UNIQUE): Associated order
- `shipping_provider` (VARCHAR(50), NOT NULL): Express company name (e.g., "SF Express", "YTO")
- `tracking_number` (VARCHAR(100), NULLABLE): Shipping tracking number
- `shipping_label_url` (VARCHAR(500), NULLABLE): Shipping label PDF/image URL
- `actual_shipping_cost` (DECIMAL(10,2), NULLABLE): Actual shipping cost (may differ from estimate)
- `estimated_delivery_date` (DATE, NULLABLE): Estimated delivery date
- `actual_delivery_date` (DATE, NULLABLE): Actual delivery date
- `tracking_status` (VARCHAR(50), NULLABLE): Current tracking status from provider
- `created_at` (DATETIME, NOT NULL, DEFAULT CURRENT_TIMESTAMP): Creation date
- `updated_at` (DATETIME, NOT NULL, DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP): Last update time

**Indexes**:
- PRIMARY KEY: `id`
- FOREIGN KEY: `order_id` → `order.id`
- UNIQUE: `order_id` (one shipping info per order)
- INDEX: `tracking_number` (for tracking lookup)
- INDEX: `shipping_provider` (for provider filtering)

**Validation Rules**:
- Shipping provider must be from supported list
- Tracking number format validated per provider
- Actual shipping cost recorded after label generation

### Sharing Post

**Purpose**: Represents a fan's sharing post after receiving an item.

**Attributes**:
- `id` (BIGINT, PRIMARY KEY, AUTO_INCREMENT): Unique identifier
- `order_id` (BIGINT, NOT NULL, FOREIGN KEY → Order.id, UNIQUE): Associated order (one post per order)
- `fan_wechat_openid` (VARCHAR(64), NOT NULL): Fan's WeChat OpenID
- `activity_id` (BIGINT, NOT NULL, FOREIGN KEY → Giveaway Activity.id): Parent giveaway activity
- `photos` (JSON, NOT NULL): Array of photo URLs uploaded by fan
- `text_content` (TEXT, NULLABLE): Text content of the sharing post
- `likes_count` (INT, DEFAULT 0, NOT NULL): Number of likes received
- `reward_points` (INT, DEFAULT 0, NOT NULL): Points earned for sharing
- `status` (ENUM('pending', 'published', 'hidden'), DEFAULT 'pending'): Post status
- `created_at` (DATETIME, NOT NULL, DEFAULT CURRENT_TIMESTAMP): Creation date
- `updated_at` (DATETIME, NOT NULL, DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP): Last update time

**Indexes**:
- PRIMARY KEY: `id`
- FOREIGN KEY: `order_id` → `order.id`
- FOREIGN KEY: `activity_id` → `giveaway_activity.id`
- UNIQUE: `order_id` (one post per order)
- INDEX: `activity_id` (for activity sharing area)
- INDEX: `fan_wechat_openid` (for fan's sharing history)

**Validation Rules**:
- At least one photo required
- Post can only be created after order status is 'delivered' or 'completed'
- Text content max length: 500 characters

### External Activity

**Purpose**: Represents influencer's external activity (WeChat/Xiaohongshu posts) for timeline display.

**Attributes**:
- `id` (BIGINT, PRIMARY KEY, AUTO_INCREMENT): Unique identifier
- `influencer_id` (BIGINT, NOT NULL, FOREIGN KEY → Influencer.id): Influencer who posted
- `platform_type` (ENUM('wechat', 'xiaohongshu', 'douyin'), NOT NULL): Platform where activity was posted
- `content_preview` (TEXT, NULLABLE): Preview text/content from external post
- `image_url` (VARCHAR(500), NULLABLE): Preview image URL
- `link_url` (VARCHAR(500), NULLABLE): Link to external post
- `posted_date` (DATETIME, NOT NULL): Date when external post was published
- `status` (ENUM('active', 'hidden'), DEFAULT 'active'): Display status
- `created_at` (DATETIME, NOT NULL, DEFAULT CURRENT_TIMESTAMP): Record creation date
- `updated_at` (DATETIME, NOT NULL, DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP): Last update time

**Indexes**:
- PRIMARY KEY: `id`
- FOREIGN KEY: `influencer_id` → `influencer.id`
- INDEX: `influencer_id, platform_type` (composite, for influencer timeline)
- INDEX: `posted_date` (for chronological sorting)

**Validation Rules**:
- Link URL must be valid HTTP/HTTPS URL
- Posted date cannot be in the future
- Content preview max length: 200 characters

## Relationships Summary

1. **Influencer → Giveaway Activity**: One-to-Many
   - One influencer can create multiple giveaways
   - Cascade delete: If influencer deleted, giveaways cancelled (not deleted)

2. **Giveaway Activity → Item**: One-to-Many
   - One giveaway contains multiple items
   - Cascade delete: If giveaway deleted, items deleted

3. **Item → Order**: One-to-One
   - One item can have at most one order (when claimed)
   - Foreign key constraint ensures uniqueness

4. **Order → Shipping Information**: One-to-One
   - One order has one shipping information record
   - Created when order status changes to 'processing'

5. **Order → Sharing Post**: One-to-One
   - One order can have one sharing post (after delivery)
   - Created by fan after receiving item

6. **Influencer → External Activity**: One-to-Many
   - One influencer can have multiple external activities
   - Used for displaying influencer's timeline on profile page

7. **Influencer → Order**: Indirect (via Item → Giveaway Activity)
   - Used for influencer's order management views

## Data Validation Rules

### Phone Number Format
- Must be 11 digits
- Must start with 1 (Chinese mobile)
- Pattern: `^1[3-9]\d{9}$`

### Address Format (JSON)
```json
{
  "province": "广东省",
  "city": "深圳市",
  "district": "南山区",
  "street": "科技园南路123号",
  "postal_code": "518000"
}
```

### Image URLs
- Must be valid HTTP/HTTPS URLs
- Must point to WeChat Cloud Storage or Tencent COS
- Compressed images: WebP format, max 1920x1920px

### Monetary Values
- All amounts in CNY (Chinese Yuan)
- Precision: 2 decimal places
- Range: >= 0

## Database Constraints

### Foreign Key Constraints
- `giveaway_activity.influencer_id` → `influencer.id` (ON DELETE RESTRICT)
- `item.activity_id` → `giveaway_activity.id` (ON DELETE CASCADE)
- `order.item_id` → `item.id` (ON DELETE RESTRICT)
- `shipping_information.order_id` → `order.id` (ON DELETE CASCADE)
- `sharing_post.order_id` → `order.id` (ON DELETE RESTRICT)
- `sharing_post.activity_id` → `giveaway_activity.id` (ON DELETE CASCADE)
- `external_activity.influencer_id` → `influencer.id` (ON DELETE CASCADE)

### Check Constraints
- `item.quantity >= 1`
- `item.shipping_cost_estimate > 0`
- `order.total_amount = packaging_fee + shipping_cost + platform_fee`
- `order.total_amount > 0`

## Caching Strategy

### Redis Cache Keys

1. **User Session**: `session:{wechat_openid}` (TTL: 7 days)
2. **Giveaway Page**: `giveaway:{activity_id}` (TTL: 1 hour)
3. **Shipping Cost**: `shipping_cost:{origin}:{destination}:{category}` (TTL: 24 hours)
4. **Hot Items**: `hot_items:{activity_id}` (TTL: 30 minutes)
5. **User Orders**: `user_orders:{wechat_openid}` (TTL: 5 minutes)

### Cache Invalidation
- Giveaway page cache: Invalidated when items claimed or status changes
- Shipping cost cache: Invalidated daily or when provider prices update
- User orders cache: Invalidated when new order created or status updated

