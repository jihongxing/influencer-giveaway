# API Contracts: Influencer Giveaway Platform

**Version**: 1.0.0  
**Date**: 2025-01-27  
**Base URL**: `https://api.example.com/api/v1`  
**Authentication**: WeChat OpenID via session token

## Authentication

All API requests (except public endpoints) require authentication via WeChat session token.

**Header**: `Authorization: Bearer {session_token}`

Session token obtained via WeChat Mini Program login API (`wx.login()`).

## Common Response Format

### Success Response
```json
{
  "success": true,
  "data": { ... },
  "message": "Success message"
}
```

### Error Response
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": { ... }
  }
}
```

### HTTP Status Codes
- `200 OK`: Success
- `201 Created`: Resource created successfully
- `400 Bad Request`: Invalid request parameters
- `401 Unauthorized`: Authentication required or invalid
- `403 Forbidden`: Insufficient permissions
- `404 Not Found`: Resource not found
- `409 Conflict`: Resource conflict (e.g., item already claimed)
- `500 Internal Server Error`: Server error

## Endpoints

### 1. Influencer Registration

**POST** `/auth/register`

Register a new influencer account.

**Request Body**:
```json
{
  "wechat_code": "string",      // From wx.login()
  "phone_number": "string",     // 11-digit Chinese mobile
  "nickname": "string",          // Optional, from WeChat profile
  "avatar_url": "string",        // Optional, from WeChat profile
  "shipping_address": {
    "province": "string",
    "city": "string",
    "district": "string",
    "street": "string",
    "postal_code": "string"
  },
  "shipping_contact_name": "string",
  "shipping_contact_phone": "string"
}
```

**Response** (201 Created):
```json
{
  "success": true,
  "data": {
    "user_id": 123,
    "session_token": "string",
    "wechat_openid": "string"
  }
}
```

**Errors**:
- `400`: Invalid phone number format
- `400`: Invalid address format
- `409`: Account already exists

---

### 2. Influencer Login

**POST** `/auth/login`

Login existing influencer account.

**Request Body**:
```json
{
  "wechat_code": "string"        // From wx.login()
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "user_id": 123,
    "session_token": "string",
    "account_status": "active"
  }
}
```

**Errors**:
- `401`: Account not found or suspended

---

### 3. Upload Item Photos

**POST** `/items/upload-photos`

Upload photos for AI processing. Returns temporary item IDs.

**Headers**: `Authorization: Bearer {session_token}`

**Request**: `multipart/form-data`
- `photos`: File[] (multiple image files, max 10, max 5MB each)

**Response** (201 Created):
```json
{
  "success": true,
  "data": {
    "temp_item_ids": ["uuid1", "uuid2", ...],
    "uploaded_count": 5
  }
}
```

**Errors**:
- `400`: Invalid file format or size exceeded
- `401`: Authentication required

---

### 4. Process Item Photos (AI Recognition)

**POST** `/items/process`

Process uploaded photos with AI to identify categories and calculate shipping costs.

**Headers**: `Authorization: Bearer {session_token}`

**Request Body**:
```json
{
  "temp_item_ids": ["uuid1", "uuid2", ...],
  "activity_id": null              // null for new activity, or existing activity_id
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "temp_id": "uuid1",
        "ai_category": "clothing",
        "confidence": 0.92,
        "shipping_cost_estimate": 15.50,
        "photo_urls": ["https://..."],
        "suggested_label": "女士上衣"
      },
      ...
    ]
  }
}
```

**Note**: AI service uses Tencent Cloud AI Image Recognition API.

**Errors**:
- `400`: Invalid temp_item_ids
- `401`: Authentication required
- `500`: AI service unavailable

---

### 5. Create/Update Giveaway Activity

**POST** `/activities`  
**PUT** `/activities/{activity_id}`

Create new or update existing giveaway activity.

**Headers**: `Authorization: Bearer {session_token}`

**Request Body**:
```json
{
  "items": [
    {
      "temp_id": "uuid1",              // From process endpoint
      "photo_urls": ["https://..."],
      "category": "clothing",          // ai_category or manual override
      "label": "女士上衣",              // Optional custom label
      "description": "..." ,           // Optional description
      "marker_name": "衣服A",          // Item marker for order matching
      "quantity": 1,
      "shipping_cost_estimate": 15.50
    },
    ...
  ]
}
```

**Response** (201 Created / 200 OK):
```json
{
  "success": true,
  "data": {
    "activity_id": 456,
    "status": "draft",
    "items_count": 5
  }
}
```

**Errors**:
- `400`: Invalid item data
- `401`: Authentication required
- `404`: Activity not found (for PUT)

---

### 6. Publish Giveaway Activity

**POST** `/activities/{activity_id}/publish`

Publish a draft giveaway activity, generating shareable link and QR code.

**Headers**: `Authorization: Bearer {session_token}`

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "activity_id": 456,
    "shareable_link": "https://miniprogram.example.com/giveaway/abc123",
    "qr_code_url": "https://storage.example.com/qr/abc123.png",
    "status": "active"
  }
}
```

**Errors**:
- `400`: Activity has no items
- `401`: Authentication required
- `403`: Not activity owner
- `404`: Activity not found

---

### 7. Get Giveaway Page (Public)

**GET** `/activities/public/{shareable_link_id}`

Get public giveaway page data (no authentication required).

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "activity_id": 456,
    "influencer": {
      "nickname": "Influencer Name",
      "avatar_url": "https://..."
    },
    "items": [
      {
        "item_id": 789,
        "photo_urls": ["https://..."],
        "category": "clothing",
        "label": "女士上衣",
        "description": "...",
        "shipping_cost_estimate": 15.50,
        "status": "available"
      },
      ...
    ],
    "created_at": "2025-01-27T10:00:00Z"
  }
}
```

**Errors**:
- `404`: Giveaway not found or not published

---

### 8. Claim Item

**POST** `/orders/claim`

Fan claims an available item.

**Headers**: `Authorization: Bearer {session_token}` (fan's session token)

**Request Body**:
```json
{
  "item_id": 789,
  "shipping_address": {
    "province": "广东省",
    "city": "深圳市",
    "district": "南山区",
    "street": "科技园南路123号",
    "postal_code": "518000"
  },
  "shipping_contact_name": "张三",
  "shipping_contact_phone": "13800138000"
}
```

**Response** (201 Created):
```json
{
  "success": true,
  "data": {
    "order_id": 101,
    "item_id": 789,
    "total_amount": 25.50,
    "breakdown": {
      "packaging_fee": 5.00,
      "shipping_cost": 15.50,
      "platform_fee": 5.00
    },
    "payment_params": {
      // WeChat Pay parameters for wx.requestPayment()
      "timeStamp": "1234567890",
      "nonceStr": "abc123",
      "package": "prepay_id=wx123...",
      "signType": "RSA",
      "paySign": "signature..."
    }
  }
}
```

**Errors**:
- `400`: Invalid address format
- `401`: Authentication required
- `404`: Item not found
- `409`: Item already claimed

---

### 9. Confirm Payment

**POST** `/orders/{order_id}/confirm-payment`

Confirm payment completion (called after WeChat Pay success callback).

**Headers**: `Authorization: Bearer {session_token}`

**Request Body**:
```json
{
  "wechat_transaction_id": "string"   // From WeChat Pay callback
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "order_id": 101,
    "payment_status": "paid",
    "order_status": "processing"
  }
}
```

**Errors**:
- `400`: Invalid transaction ID
- `401`: Authentication required
- `404`: Order not found
- `409`: Payment already confirmed

---

### 10. Get Order Status

**GET** `/orders/{order_id}`

Get order details and status.

**Headers**: `Authorization: Bearer {session_token}`

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "order_id": 101,
    "item": {
      "item_id": 789,
      "photo_urls": ["https://..."],
      "label": "女士上衣"
    },
    "payment_status": "paid",
    "order_status": "shipped",
    "shipping_info": {
      "tracking_number": "SF1234567890",
      "shipping_provider": "SF Express",
      "tracking_status": "In transit",
      "estimated_delivery_date": "2025-02-01"
    },
    "total_amount": 25.50,
    "created_at": "2025-01-27T10:00:00Z"
  }
}
```

**Errors**:
- `401`: Authentication required
- `403`: Not order owner
- `404`: Order not found

---

### 11. Get User Orders

**GET** `/orders`

Get current user's order list.

**Headers**: `Authorization: Bearer {session_token}`

**Query Parameters**:
- `status` (optional): Filter by order_status
- `page` (optional, default: 1): Page number
- `limit` (optional, default: 20): Items per page

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "orders": [
      {
        "order_id": 101,
        "item_label": "女士上衣",
        "order_status": "shipped",
        "total_amount": 25.50,
        "created_at": "2025-01-27T10:00:00Z"
      },
      ...
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 45,
      "total_pages": 3
    }
  }
}
```

---

### 12. Get Influencer Activities

**GET** `/activities`

Get influencer's own activities.

**Headers**: `Authorization: Bearer {session_token}`

**Query Parameters**:
- `status` (optional): Filter by activity status
- `page` (optional, default: 1)
- `limit` (optional, default: 20)

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "activities": [
      {
        "activity_id": 456,
        "status": "active",
        "items_count": 5,
        "claimed_count": 2,
        "shareable_link": "https://...",
        "created_at": "2025-01-27T10:00:00Z"
      },
      ...
    ],
    "pagination": { ... }
  }
}
```

---

### 13. Webhook: WeChat Pay Notification

**POST** `/webhooks/wechat-pay`

Receive WeChat Pay payment notifications.

**Request Body**: (WeChat Pay XML format, converted to JSON by middleware)
```json
{
  "transaction_id": "string",
  "out_trade_no": "string",      // order_id
  "total_fee": 2550,              // Amount in cents
  "result_code": "SUCCESS",
  "time_end": "20250127100000"
}
```

**Response** (200 OK):
```xml
<xml>
  <return_code><![CDATA[SUCCESS]]></return_code>
  <return_msg><![CDATA[OK]]></return_msg>
</xml>
```

---

### 14. Scan QR Code to Match Order

**POST** `/orders/scan-match`

Scan item QR code to automatically match it to the corresponding order (for influencer shipping).

**Headers**: `Authorization: Bearer {session_token}` (influencer's session token)

**Request Body**:
```json
{
  "qr_code": "string"        // QR code content from scanned item marker
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "order_id": 101,
    "item_id": 789,
    "item_marker_name": "衣服A",
    "fan_info": {
      "shipping_address": { ... },
      "shipping_contact_name": "张三",
      "shipping_contact_phone": "13800138000"
    },
    "shipping_label_url": "https://storage.example.com/labels/order101.pdf",
    "order_status": "processing"
  }
}
```

**Errors**:
- `400`: Invalid QR code format
- `401`: Authentication required
- `404`: Item or order not found
- `409`: Item already shipped

---

### 15. Create Sharing Post

**POST** `/sharing-posts`

Create a sharing post after receiving an item (fan).

**Headers**: `Authorization: Bearer {session_token}` (fan's session token)

**Request Body**:
```json
{
  "order_id": 101,
  "photos": ["https://..."],     // Array of photo URLs
  "text_content": "收到啦，很喜欢！"  // Optional text content
}
```

**Response** (201 Created):
```json
{
  "success": true,
  "data": {
    "post_id": 201,
    "order_id": 101,
    "reward_points": 10,
    "status": "published"
  }
}
```

**Errors**:
- `400`: Order not delivered yet
- `400`: At least one photo required
- `401`: Authentication required
- `404`: Order not found
- `409`: Sharing post already exists for this order

---

### 16. Get Sharing Posts

**GET** `/sharing-posts`

Get sharing posts for an activity or influencer.

**Query Parameters**:
- `activity_id` (optional): Filter by activity
- `influencer_id` (optional): Filter by influencer
- `page` (optional, default: 1)
- `limit` (optional, default: 20)

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "posts": [
      {
        "post_id": 201,
        "fan_nickname": "Fan Name",
        "fan_avatar": "https://...",
        "photos": ["https://..."],
        "text_content": "收到啦，很喜欢！",
        "likes_count": 5,
        "created_at": "2025-01-27T10:00:00Z"
      },
      ...
    ],
    "pagination": { ... }
  }
}
```

---

### 17. Like Sharing Post

**POST** `/sharing-posts/{post_id}/like`

Like a sharing post.

**Headers**: `Authorization: Bearer {session_token}`

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "post_id": 201,
    "likes_count": 6,
    "liked": true
  }
}
```

---

### 18. Create External Activity

**POST** `/external-activities`

Add an external activity (WeChat/Xiaohongshu post) to influencer's timeline.

**Headers**: `Authorization: Bearer {session_token}` (influencer's session token)

**Request Body**:
```json
{
  "platform_type": "wechat",      // "wechat", "xiaohongshu", or "douyin"
  "content_preview": "今天分享一些闲置物品...",
  "image_url": "https://...",     // Optional preview image
  "link_url": "https://...",      // Link to external post
  "posted_date": "2025-01-27T10:00:00Z"
}
```

**Response** (201 Created):
```json
{
  "success": true,
  "data": {
    "activity_id": 301,
    "platform_type": "wechat",
    "status": "active"
  }
}
```

**Errors**:
- `400`: Invalid link URL
- `400`: Posted date cannot be in future
- `401`: Authentication required

---

### 19. Get External Activities

**GET** `/external-activities`

Get influencer's external activities timeline.

**Query Parameters**:
- `influencer_id` (required): Influencer ID
- `platform_type` (optional): Filter by platform
- `page` (optional, default: 1)
- `limit` (optional, default: 20)

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "activities": [
      {
        "activity_id": 301,
        "platform_type": "wechat",
        "content_preview": "今天分享一些闲置物品...",
        "image_url": "https://...",
        "link_url": "https://...",
        "posted_date": "2025-01-27T10:00:00Z"
      },
      ...
    ],
    "pagination": { ... }
  }
}
```

---

- **Public endpoints**: 100 requests/minute per IP
- **Authenticated endpoints**: 1000 requests/minute per user
- **Upload endpoints**: 10 requests/minute per user

## Image Upload Constraints

- **Max file size**: 5MB per image
- **Max images per request**: 10
- **Supported formats**: JPEG, PNG, WebP
- **Auto compression**: Images compressed to WebP format, max 1920x1920px

## Error Codes

| Code | Description |
|------|-------------|
| `INVALID_REQUEST` | Invalid request parameters |
| `UNAUTHORIZED` | Authentication required |
| `FORBIDDEN` | Insufficient permissions |
| `NOT_FOUND` | Resource not found |
| `CONFLICT` | Resource conflict (e.g., item already claimed) |
| `AI_SERVICE_ERROR` | AI service unavailable or error |
| `PAYMENT_ERROR` | Payment processing error |
| `SHIPPING_ERROR` | Shipping calculation error |
| `INTERNAL_ERROR` | Internal server error |

