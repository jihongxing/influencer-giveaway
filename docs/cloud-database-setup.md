# 云数据库集合创建指南

## 需要创建的7个集合

### 1. users（用户信息）

**集合名称**: `users`

**字段结构**:
```javascript
{
  _id: String,                    // 自动生成
  wechat_openid: String,          // 微信openid（唯一索引）
  nickname: String,               // 昵称
  avatar_url: String,             // 头像URL
  phone_number: String,           // 手机号
  account_status: String,         // 账户状态: 'active', 'suspended', 'banned'
  created_at: Date,               // 创建时间
  updated_at: Date                 // 更新时间
}
```

**索引**:
- `wechat_openid`: 唯一索引

**权限设置**:
- 读取：仅创建者可读
- 创建：所有用户可创建
- 更新：仅创建者可更新
- 删除：仅创建者可删除

---

### 2. activities（活动信息）

**集合名称**: `activities`

**字段结构**:
```javascript
{
  _id: String,                    // 自动生成
  influencer_id: String,          // 创建者openid（索引）
  title: String,                  // 活动标题
  description: String,             // 活动描述
  category: String,               // 分类: 'clothing', 'books', 'beauty', 'other'
  status: String,                 // 状态: 'draft', 'active', 'cancelled', 'completed'
  public_link_id: String,          // 公开链接ID（唯一索引）
  start_date: Date,               // 开始时间
  end_date: Date,                 // 结束时间
  created_at: Date,               // 创建时间
  updated_at: Date                 // 更新时间
}
```

**索引**:
- `influencer_id`: 普通索引
- `public_link_id`: 唯一索引
- `status`: 普通索引
- `category`: 普通索引

**权限设置**:
- 读取：所有用户可读（公开活动）
- 创建：所有用户可创建
- 更新：仅创建者可更新
- 删除：仅创建者可删除

---

### 3. items（物品信息）

**集合名称**: `items`

**字段结构**:
```javascript
{
  _id: String,                    // 自动生成
  activity_id: String,            // 所属活动ID（索引）
  label: String,                   // 物品标签
  description: String,             // 物品描述
  category: String,                // AI识别类别
  photo_urls: Array,              // 照片URL数组
  quantity: Number,               // 数量
  shipping_cost_estimate: Number, // 运费估算
  marker_name: String,            // 物品标记名称（用于二维码）
  status: String,                 // 状态: 'available', 'claimed', 'shipped', 'delivered'
  created_at: Date,               // 创建时间
  updated_at: Date                // 更新时间
}
```

**索引**:
- `activity_id`: 普通索引
- `status`: 普通索引
- `marker_name`: 普通索引

**权限设置**:
- 读取：所有用户可读
- 创建：所有用户可创建
- 更新：仅活动创建者可更新
- 删除：仅活动创建者可删除

---

### 4. orders（订单信息）

**集合名称**: `orders`

**字段结构**:
```javascript
{
  _id: String,                    // 自动生成
  item_id: String,                // 物品ID（索引）
  activity_id: String,            // 活动ID（索引）
  fan_wechat_openid: String,      // 领取者openid（索引）
  fan_phone_number: String,       // 领取者手机号
  shipping_address: String,       // 收货地址（JSON字符串）
  shipping_contact_name: String,     // 收货人姓名
  shipping_contact_phone: String,  // 收货人电话
  packaging_fee: Number,          // 包装费
  shipping_cost: Number,          // 运费
  platform_fee: Number,           // 平台服务费
  total_amount: Number,           // 总金额
  payment_status: String,         // 支付状态: 'pending', 'paid', 'refunded'
  order_status: String,           // 订单状态: 'pending', 'confirmed', 'shipped', 'delivered', 'completed', 'cancelled'
  wechat_payment_transaction_id: String, // 微信支付交易号
  created_at: Date,               // 创建时间
  paid_at: Date,                  // 支付时间
  updated_at: Date                // 更新时间
}
```

**索引**:
- `item_id`: 唯一索引（一个物品只能有一个订单）
- `activity_id`: 普通索引
- `fan_wechat_openid`: 普通索引
- `payment_status`: 普通索引
- `order_status`: 普通索引

**权限设置**:
- 读取：订单创建者和活动创建者可读
- 创建：所有用户可创建
- 更新：仅活动创建者可更新
- 删除：不允许删除

---

### 5. shipping（物流信息）

**集合名称**: `shipping`

**字段结构**:
```javascript
{
  _id: String,                    // 自动生成
  order_id: String,               // 订单ID（唯一索引）
  shipping_provider: String,       // 物流商: 'sf', 'yunda', 'yuantong', 'other'
  tracking_number: String,        // 物流单号
  shipping_label_url: String,      // 物流标签URL
  estimated_delivery_date: Date,   // 预计送达时间
  actual_delivery_date: Date,      // 实际送达时间
  status: String,                 // 状态: 'pending', 'in_transit', 'delivered', 'exception'
  created_at: Date,               // 创建时间
  updated_at: Date                // 更新时间
}
```

**索引**:
- `order_id`: 唯一索引
- `tracking_number`: 普通索引
- `status`: 普通索引

**权限设置**:
- 读取：订单创建者和活动创建者可读
- 创建：仅活动创建者可创建
- 更新：仅活动创建者可更新
- 删除：不允许删除

---

### 6. sharing_posts（分享帖子）

**集合名称**: `sharing_posts`

**字段结构**:
```javascript
{
  _id: String,                    // 自动生成
  order_id: String,               // 订单ID（索引）
  activity_id: String,            // 活动ID（索引）
  fan_wechat_openid: String,      // 分享者openid（索引）
  photos: Array,                  // 照片URL数组
  text_content: String,           // 文本内容（最多500字）
  likes_count: Number,            // 点赞数
  reward_points: Number,          // 奖励积分
  status: String,                 // 状态: 'pending', 'published', 'rejected'
  created_at: Date,               // 创建时间
  updated_at: Date                // 更新时间
}
```

**索引**:
- `order_id`: 唯一索引（一个订单只能有一个分享帖子）
- `activity_id`: 普通索引
- `fan_wechat_openid`: 普通索引
- `status`: 普通索引

**权限设置**:
- 读取：所有用户可读（已发布的帖子）
- 创建：所有用户可创建
- 更新：仅创建者可更新
- 删除：仅创建者可删除

---

### 7. external_activities（外部活动）

**集合名称**: `external_activities`

**字段结构**:
```javascript
{
  _id: String,                    // 自动生成
  influencer_id: String,         // 创建者openid（索引）
  title: String,                  // 活动标题
  description: String,            // 活动描述
  external_url: String,           // 外部链接
  platform: String,               // 平台: 'douyin', 'kuaishou', 'xiaohongshu', 'other'
  posted_date: Date,              // 发布时间
  status: String,                // 状态: 'active', 'expired'
  created_at: Date,               // 创建时间
  updated_at: Date                // 更新时间
}
```

**索引**:
- `influencer_id`: 普通索引
- `status`: 普通索引
- `platform`: 普通索引

**权限设置**:
- 读取：所有用户可读
- 创建：所有用户可创建
- 更新：仅创建者可更新
- 删除：仅创建者可删除

---

## 创建步骤

### 方法1：在微信开发者工具中创建（推荐）

1. **打开云开发控制台**
   - 在微信开发者工具中，点击顶部菜单"云开发"
   - 或点击工具栏中的"云开发"按钮

2. **进入数据库管理**
   - 在云开发控制台中，点击左侧菜单"数据库"
   - 点击"添加集合"按钮

3. **逐个创建集合**
   - 按照上述7个集合的定义，逐个创建
   - 集合名称必须完全匹配（区分大小写）

4. **设置索引**
   - 创建集合后，点击集合名称进入详情
   - 在"索引"标签页中添加索引
   - 注意：唯一索引需要勾选"唯一"选项

5. **配置权限**
   - 在"权限设置"标签页中配置权限规则
   - 或使用自定义权限规则（JSON格式）

### 方法2：使用云开发控制台Web界面

1. **登录云开发控制台**
   - 访问：https://console.cloud.tencent.com/tcb
   - 选择对应的环境（cloud1-8gezjcq432191d0d）

2. **创建集合**
   - 进入"数据库" → "集合管理"
   - 点击"新建集合"
   - 输入集合名称并创建

3. **设置索引和权限**
   - 在集合详情中设置索引
   - 配置权限规则

---

## 权限规则配置示例

### 示例1：users集合权限规则

```json
{
  "read": "doc._openid == auth.openid",
  "write": "doc._openid == auth.openid"
}
```

### 示例2：activities集合权限规则

```json
{
  "read": true,
  "create": true,
  "update": "doc.influencer_id == auth.openid",
  "delete": "doc.influencer_id == auth.openid"
}
```

### 示例3：orders集合权限规则

```json
{
  "read": "doc.fan_wechat_openid == auth.openid || get('activities', doc.activity_id).influencer_id == auth.openid",
  "create": true,
  "update": "get('activities', doc.activity_id).influencer_id == auth.openid",
  "delete": false
}
```

---

## 注意事项

1. **集合名称大小写敏感**
   - 必须与代码中的集合名称完全一致
   - 建议使用小写字母和下划线

2. **索引创建**
   - 唯一索引确保数据唯一性
   - 普通索引提高查询性能
   - 索引创建后不能删除，只能重建集合

3. **权限设置**
   - 建议先使用宽松权限进行开发测试
   - 生产环境需要严格配置权限规则

4. **数据迁移**
   - 如果已有MySQL数据，需要编写迁移脚本
   - 将MySQL数据转换为MongoDB格式

5. **字段类型**
   - MongoDB是文档数据库，字段类型灵活
   - 但建议保持字段类型一致性

---

## 快速创建脚本

如果集合较多，可以使用云开发CLI批量创建：

```bash
# 安装云开发CLI
npm install -g @cloudbase/cli

# 登录
tcb login

# 创建集合（需要编写脚本）
```

---

## 验证集合创建

创建完成后，可以在云开发控制台的数据库中看到所有集合，并验证：
1. 集合名称是否正确
2. 索引是否已创建
3. 权限规则是否配置正确

---

## 下一步

创建完所有集合后：
1. 部署云函数（在微信开发者工具中右键云函数文件夹 → 上传并部署）
2. 测试云函数调用
3. 验证数据读写权限

