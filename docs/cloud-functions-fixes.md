# 云函数修复说明

## 已修复的问题

### 1. auth云函数 - API调用错误 ✅

**问题**: 使用了不存在的API `cloud.openapi.wxacode.getSessionKey`

**修复**:
- 使用 `axios` 直接调用微信API
- 通过code获取openid: `https://api.weixin.qq.com/sns/jscode2session`
- 获取手机号: `https://api.weixin.qq.com/wxa/business/getuserphonenumber`

**修改的文件**:
- `miniprogram/cloudfunctions/auth/index.js` - 修复API调用
- `miniprogram/cloudfunctions/auth/package.json` - 添加axios依赖
- `miniprogram/cloudfunctions/auth/config.json` - 移除错误的权限配置

## 需要修复的前端代码

以下页面仍在使用旧的HTTP API调用方式，需要改为云函数调用：

### 1. activity-detail.js
- `apiService.get('/activities/public/${linkId}')` → `apiService.getPublicActivityDetail(linkId)`
- `apiService.get('/activities/${activityId}')` → `apiService.getActivityDetail(activityId)`
- `apiService.get('/auth/me')` → `apiService.getUserInfo()`
- `apiService.get('/orders?activity_id=...')` → `apiService.getOrders({activity_id: ...})`
- `apiService.put('/activities/${activityId}')` → `apiService.updateActivity(activityId, data)`

### 2. profile.js
- `apiService.get('/auth/me')` → `apiService.getUserInfo()`
- `apiService.get('/activities?page=1&limit=3')` → `apiService.getActivities({page: 1, limit: 3})`
- `apiService.get('/orders?page=1&limit=3')` → `apiService.getOrders({page: 1, limit: 3})`

### 3. create-giveaway.js
- `apiService.post('/items/process')` → `apiService.uploadItemPhotos(files)`
- `apiService.put('/activities/${activityId}')` → `apiService.updateActivity(activityId, data)`
- `apiService.post('/activities')` → `apiService.createActivity(data)`

### 4. claim-item.js
- `apiService.get('/activities/public/${linkId}')` → `apiService.getPublicActivityDetail(linkId)`

### 5. explore.js
- `apiService.get('/activities/public?...')` → `apiService.getPublicActivities(params)`

### 6. giveaway.js
- `apiService.get('/activities/public/${linkId}')` → `apiService.getPublicActivityDetail(linkId)`

### 7. my-activities.js
- `apiService.get('/activities')` → `apiService.getActivities()`
- `apiService.post('/orders/scan-match')` → 需要创建对应的云函数方法

### 8. my-orders.js
- `apiService.get('/orders?...')` → `apiService.getOrders(params)`

### 9. order-detail.js
- `apiService.get('/orders/${orderId}')` → `apiService.getOrderDetail(orderId)`
- `apiService.get('/auth/me')` → `apiService.getUserInfo()`

### 10. order-status.js
- `apiService.get('/orders/${orderId}')` → `apiService.getOrderDetail(orderId)`

### 11. payment.js
- `apiService.get('/orders/${orderId}')` → `apiService.getOrderDetail(orderId)`

### 12. share-item.js
- `apiService.post('/sharing-posts')` → `apiService.createSharingPost(data)`

### 13. sharing-area.js
- `apiService.get('/sharing-posts?...')` → `apiService.getSharingPosts(params)`
- `apiService.post('/sharing-posts/${postId}/like')` → `apiService.likeSharingPost(postId)`

### 14. shipping-label.js
- `apiService.get('/orders/${orderId}')` → `apiService.getOrderDetail(orderId)`

## 修复步骤

### 方法1: 手动修复（推荐）
逐个页面修复，确保功能正确。

### 方法2: 批量替换（需谨慎）
使用脚本批量替换，但需要验证每个调用的正确性。

## 常见错误模式

### 错误1: 使用旧的HTTP API调用
```javascript
// ❌ 错误
const response = await apiService.get('/activities/public/xxx');

// ✅ 正确
const response = await apiService.getPublicActivityDetail('xxx');
```

### 错误2: 参数传递方式错误
```javascript
// ❌ 错误
const response = await apiService.get('/orders?activity_id=123');

// ✅ 正确
const response = await apiService.getOrders({activity_id: 123});
```

### 错误3: 需要登录的接口调用
```javascript
// ❌ 错误
const response = await apiService.get('/auth/me', true);

// ✅ 正确
const response = await apiService.getUserInfo();
```

## 测试建议

修复后需要测试：
1. 用户注册和登录
2. 活动创建和查询
3. 物品上传和处理
4. 订单创建和查询
5. 支付流程
6. 分享功能

