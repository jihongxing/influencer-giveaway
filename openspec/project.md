# Project Context

## Purpose

**FamilyAuther** (网红赠送平台) 是一个基于微信云开发的小程序平台，帮助抖音、小红书等平台的网红快速清理闲置物品并与粉丝互动。

### 核心价值
- **网红侧**：简化赠品发放流程，无需定价、处理物流或客服沟通
- **粉丝侧**：支付包装和运费即可获得网红赠品，建立更紧密的互动关系
- **平台侧**：通过物流差价获利，提供自动化的物流结算服务

### 关键功能
1. 网红微信授权登录后上传物品照片，AI自动识别物品类型和计算运费
2. 系统自动生成可分享的赠品页面
3. 粉丝浏览并领取心仪物品，通过微信支付完成包装和运费支付
4. 平台处理物流结算，从运费差价中获利

### 架构特点
- **Serverless架构**：完全基于微信云开发，无需独立后端服务器
- **云函数驱动**：所有业务逻辑通过云函数实现
- **云数据库存储**：使用微信云数据库替代传统MySQL
- **一体化部署**：小程序前端与云函数后端统一管理

## Tech Stack

### 核心平台
- **平台**: 微信小程序 + 微信云开发
- **架构模式**: Serverless (无服务器)
- **基础库要求**: >= 2.2.3 (云能力支持)

### 前端 (MiniProgram)
- **开发语言**: 原生 WXML/WXSS/JavaScript
- **组件化**: 自定义组件 (activity-timeline, error-message, loading, qr-scanner)
- **状态管理**: 本地存储 + 云数据库同步
- **离线能力**: offlineSync (本地缓存 + 云端同步)
- **表单验证**: validation.js
- **图片处理**: imageUtils.js

### 云函数 (Cloud Functions)
- **运行时**: Node.js (wx-server-sdk ~2.6.3)
- **编程语言**: JavaScript (ES6+)
- **函数列表**:
  - `auth`: 用户认证、注册、登录、资料管理
  - `activities`: 赠品活动创建、发布、管理
  - `items`: 物品上传、AI识别、状态管理
  - `orders`: 订单创建、支付确认、状态更新、扫码匹配
  - `payments`: 微信支付集成、支付回调处理
  - `sharing`: 粉丝分享帖管理
  - `db-init`: 数据库初始化
  - `test-data`: 测试数据生成

### 云数据库 (Cloud Database)
- **类型**: 微信云开发数据库 (基于MongoDB的文档型数据库)
- **环境**: cloud1-8gezjcq432191d0d
- **特性**:
  - JSON文档存储
  - 实时数据监听
  - 事务支持 (订单并发控制)
  - 服务端时间戳 (serverDate)
  - 索引优化

### 数据集合 (Collections)
- `users`: 用户账户信息
- `activities`: 赠品活动
- `items`: 物品详情
- `orders`: 订单记录
- `shipping_info`: 物流信息
- `sharing_posts`: 分享帖
- `external_activities`: 外部平台活动

### 云存储 (Cloud Storage)
- **用途**: 用户上传图片、物品照片存储
- **特性**: CDN加速、临时链接、权限控制

### 外部服务集成
- **AI服务**: 腾讯云 AI (图像识别) - 通过云函数调用
- **支付**: 微信支付 (云开发支付API)
- **物流**: 快递公司 API (云函数代理调用)
- **消息推送**: 微信订阅消息
- **社交平台**: 抖音/小红书 (通过云函数爬取或API对接)

### 开发工具
- **IDE**: 微信开发者工具
- **版本控制**: Git
- **环境配置**: dotenv (云函数环境变量)
- **调试工具**: 云开发控制台、云函数日志

## Project Conventions

### Code Style

#### JavaScript 规范 (云函数)
- **语言版本**: ES6+
- **模块系统**: CommonJS (require/exports)
- **异步处理**: async/await
- **错误处理**: try-catch + 统一错误返回格式
- **代码组织**: 单文件多函数，按功能分组

#### 命名规范
- **云函数目录**: 小写+连字符 (如 `auth`, `activities`, `db-init`)
- **文件命名**: 小写 (如 `index.js`, `config.json`)
- **函数名**: camelCase (如 `createOrder`, `getUserInfo`)
- **变量名**: camelCase 或 snake_case (数据库字段)
- **常量**: UPPER_SNAKE_CASE
- **集合名**: 小写+下划线 (如 `users`, `shipping_info`)

#### 数据库字段规范
- **字段命名**: snake_case (如 `wechat_openid`, `created_at`)
- **时间字段**: 使用 `db.serverDate()` 确保服务端时间
- **ID字段**: 使用云数据库自动生成的 `_id`
- **状态字段**: 字符串枚举 (如 'pending', 'active', 'completed')
- **JSON存储**: 复杂对象使用 `JSON.stringify()` 序列化

#### 云函数返回格式
```javascript
// 成功响应
{
  success: true,
  data: { /* 返回数据 */ }
}

// 错误响应
{
  success: false,
  error: {
    code: 'ERROR_CODE',
    message: '错误描述'
  }
}
```

### Architecture Patterns

#### 项目结构
```
miniprogram/
├── pages/              # 小程序页面
│   ├── index/          # 首页
│   ├── explore/        # 发现页
│   ├── create-giveaway/# 创建赠品
│   ├── profile/        # 个人中心
│   ├── activity-detail/# 活动详情
│   ├── claim-item/     # 领取物品
│   ├── payment/        # 支付页面
│   ├── my-orders/      # 我的订单
│   └── ...
├── components/         # 自定义组件
│   ├── activity-timeline/
│   ├── error-message/
│   ├── loading/
│   └── qr-scanner/
├── services/           # 前端服务层
│   ├── api.js          # 云函数调用封装
│   ├── aiService.js    # AI服务
│   └── paymentService.ts
├── utils/              # 工具函数
│   ├── validation.js   # 表单验证
│   ├── imageUtils.js   # 图片处理
│   ├── offlineSync.js  # 离线同步
│   └── loadingHelper.js
├── cloudfunctions/     # 云函数目录
│   ├── auth/           # 认证模块
│   ├── activities/     # 活动管理
│   ├── items/          # 物品管理
│   ├── orders/         # 订单管理
│   ├── payments/       # 支付处理
│   ├── sharing/        # 分享管理
│   ├── db-init/        # 数据库初始化
│   └── test-data/      # 测试数据
├── app.js              # 小程序入口
└── app.json            # 小程序配置
```

#### Serverless 架构模式

**1. 云函数分层**
- **入口层**: exports.main 接收请求，路由到具体action
- **业务层**: 各个功能函数 (如 register, login, createOrder)
- **数据层**: 云数据库操作 (db.collection())
- **集成层**: 外部API调用 (微信API, 腾讯云AI)

**2. 前端服务层**
- 封装云函数调用 (`wx.cloud.callFunction`)
- 统一错误处理和响应格式转换
- 离线数据缓存和同步

**3. 数据访问模式**
- **读取**: 直接查询云数据库或通过云函数
- **写入**: 必须通过云函数确保权限控制
- **事务**: 使用云数据库事务确保并发安全

**4. 核心云函数模块**

**auth** (认证模块):
- `register`: 用户注册
- `login`: 用户登录
- `getPhoneNumber`: 获取手机号
- `getUserInfo`: 获取用户信息
- `updateProfile`: 更新用户资料

**activities** (活动管理):
- `create`: 创建活动
- `publish`: 发布活动
- `getList`: 获取活动列表
- `getDetail`: 获取活动详情

**items** (物品管理):
- `upload`: 上传物品照片
- `processAI`: AI识别处理
- `updateMarker`: 更新物品标记
- `getList`: 获取物品列表

**orders** (订单管理):
- `create`: 创建订单 (并发控制)
- `getList`: 获取订单列表
- `getDetail`: 获取订单详情
- `updateStatus`: 更新订单状态
- `confirmPayment`: 确认支付
- `scanMatch`: 扫码匹配订单

**payments** (支付处理):
- `createPayment`: 创建支付订单
- `handleCallback`: 处理支付回调
- `queryPayment`: 查询支付状态

**sharing** (分享管理):
- `createPost`: 创建分享帖
- `getList`: 获取分享列表
- `likePost`: 点赞分享

### Testing Strategy

#### 测试方法

**1. 云函数测试**
- **本地测试**: 微信开发者工具内置云函数调试
- **云端测试**: 上传到云端后在控制台测试
- **测试数据**: 使用 `test-data` 云函数生成模拟数据

**2. 小程序测试**
- **真机预览**: 通过开发者工具扫码预览
- **模拟器测试**: 开发者工具内置模拟器
- **体验版**: 发布体验版进行完整流程测试

**3. 测试层级**

**功能测试**:
- 用户注册登录流程
- 活动创建发布流程
- 物品上传和AI识别
- 订单创建和支付流程
- 扫码匹配发货流程

**并发测试**:
- 多用户同时领取同一物品 (事务控制验证)
- 高并发订单创建
- 支付回调并发处理

**集成测试**:
- 微信支付集成
- 腾讯云AI调用
- 物流API对接

**4. 测试工具**
- **云函数**: 云开发控制台 > 云函数 > 测试
- **数据库**: 云开发控制台 > 数据库 > 数据查看
- **日志**: 云开发控制台 > 云函数 > 日志
- **性能**: 云开发控制台 > 监控告警

**5. 测试数据管理**
- 开发环境: 使用 `db-init` 初始化测试数据
- 测试账号: 通过 `test-data` 云函数生成
- 数据隔离: 开发环境与生产环境分离

**6. 核心测试场景**
- ✅ 新用户注册和首次登录
- ✅ 网红创建活动并上传5个物品
- ✅ AI识别准确率验证
- ✅ 粉丝浏览并领取物品
- ✅ 并发领取防重复验证
- ✅ 支付完成后订单状态更新
- ✅ 扫码匹配正确订单
- ✅ 物流信息更新和推送

### Git Workflow

#### 分支策略
- **主分支**: `main` (生产环境代码)
- **开发分支**: `dev` (开发环境代码)
- **功能分支**: 基于功能规范命名 (如 `feature/001-influencer-giveaway`)
- **规范文档**: 每个功能在 `specs/` 目录下有对应文档

#### 提交规范
- 遵循语义化提交信息
- 关联功能分支编号
- 清晰描述变更内容
- 云函数变更必须注明函数名

#### 云函数部署
- **开发环境**: 通过微信开发者工具右键上传
- **生产环境**: 通过云开发控制台部署
- **版本管理**: 云函数支持版本回滚
- **灰度发布**: 使用云开发流量分配功能

#### 环境管理
- **开发环境**: 独立云环境 (DEV_CLOUD_ENV)
- **生产环境**: 生产云环境 (PROD_CLOUD_ENV)
- **环境变量**: 通过云函数配置管理
- **配置隔离**: 不同环境使用不同的微信APPID和密钥

## Domain Context

### 业务领域知识

#### 核心实体关系 (云数据库集合)

**1. users (用户集合)**
```javascript
{
  _id: String,                    // 云数据库自动生成
  wechat_openid: String,          // 微信OpenID (唯一)
  phone_number: String,           // 手机号
  nickname: String,               // 昵称
  avatar_url: String,             // 头像URL
  shipping_address: String,       // JSON序列化的收货地址
  shipping_contact_name: String,  // 收货人姓名
  shipping_contact_phone: String, // 收货人电话
  account_status: String,         // 账户状态: active/suspended
  created_at: Date,               // 创建时间 (serverDate)
  updated_at: Date                // 更新时间 (serverDate)
}
```

**2. activities (活动集合)**
```javascript
{
  _id: String,
  influencer_id: String,          // 用户OpenID
  title: String,                  // 活动标题
  description: String,            // 活动描述
  status: String,                 // draft/active/completed/cancelled
  share_link: String,             // 分享链接
  qr_code_url: String,            // 二维码图片URL
  created_at: Date,
  updated_at: Date,
  published_at: Date              // 发布时间
}
```

**3. items (物品集合)**
```javascript
{
  _id: String,
  activity_id: String,            // 关联活动ID
  photo_urls: Array<String>,      // 物品照片URL数组
  ai_category: String,            // AI识别的类别
  ai_tags: Array<String>,         // AI识别的标签
  label: String,                  // 手动标签/描述
  marker_name: String,            // 物品标记名 (用于扫码)
  marker_quantity: Number,        // 标记数量
  marker_notes: String,           // 标记备注
  shipping_cost_estimate: Number, // 预估运费
  status: String,                 // available/claimed/shipped/delivered
  qr_code_data: String,           // 二维码数据
  created_at: Date,
  updated_at: Date
}
```

**4. orders (订单集合)**
```javascript
{
  _id: String,
  item_id: String,                      // 关联物品ID
  activity_id: String,                  // 关联活动ID
  fan_wechat_openid: String,            // 粉丝OpenID
  fan_phone_number: String,             // 粉丝手机号
  shipping_address: String,             // JSON序列化的收货地址
  shipping_contact_name: String,
  shipping_contact_phone: String,
  packaging_fee: Number,                // 包装费
  shipping_cost: Number,                // 运费
  platform_fee: Number,                 // 平台服务费
  total_amount: Number,                 // 总金额
  payment_status: String,               // pending/paid/refunded
  order_status: String,                 // pending/confirmed/shipped/delivered
  wechat_payment_transaction_id: String,// 微信支付交易ID
  created_at: Date,
  paid_at: Date,
  updated_at: Date
}
```

**5. shipping_info (物流信息集合)**
```javascript
{
  _id: String,
  order_id: String,                // 关联订单ID
  provider: String,                // 物流公司
  tracking_number: String,         // 运单号
  shipping_label_url: String,      // 运单标签URL
  estimated_delivery_date: Date,
  actual_delivery_date: Date,
  actual_shipping_cost: Number,    // 实际运费成本
  status: String,                  // pending/in_transit/delivered
  created_at: Date,
  updated_at: Date
}
```

**6. sharing_posts (分享帖集合)**
```javascript
{
  _id: String,
  order_id: String,
  fan_openid: String,
  photo_urls: Array<String>,
  content: String,
  likes_count: Number,
  created_at: Date
}
```

**7. external_activities (外部活动集合)**
```javascript
{
  _id: String,
  influencer_id: String,
  platform_type: String,    // wechat/douyin/xiaohongshu
  content_preview: String,
  link_url: String,
  posted_at: Date
}
```

#### 关键业务流程

**网红发布流程** (涉及云函数: auth, activities, items):
1. 调用 `auth.register/login` 获取用户身份
2. 调用 `activities.create` 创建活动
3. 小程序端上传照片到云存储
4. 调用 `items.upload` 保存物品信息
5. 调用 `items.processAI` 进行AI识别
6. 调用 `items.updateMarker` 添加物品标记
7. 调用 `activities.publish` 发布活动

**粉丝领取流程** (涉及云函数: orders, payments):
1. 打开分享链接浏览活动详情
2. 选择物品并填写收货信息
3. 调用 `orders.create` 创建订单 (事务控制防并发)
4. 调用 `payments.createPayment` 创建微信支付订单
5. 小程序端调起微信支付
6. 支付成功后回调 `payments.handleCallback`
7. 调用 `orders.confirmPayment` 确认订单支付

**物流处理流程** (涉及云函数: orders, shipping):
1. 订单支付成功后自动生成运单标签
2. 网红使用小程序扫描物品二维码
3. 调用 `orders.scanMatch` 匹配订单
4. 打印运单并发货
5. 更新物流状态 (通过物流API回调)
6. 粉丝确认收货

#### 收益模式
- **收入来源**: 粉丝支付 = 包装费 + 运费 + 平台服务费
- **成本**: 实际物流成本
- **利润**: `平台利润 = 平台服务费 + (运费 - 实际物流成本)`
- **目标利润率**: ≥10% per transaction

#### 并发控制机制
- **场景**: 多个粉丝同时领取同一物品
- **解决方案**: 云数据库事务 (transaction)
- **实现**: 
  1. 开启事务 `db.startTransaction()`
  2. 查询物品状态并锁定
  3. 检查状态为 'available'
  4. 创建订单并更新物品状态为 'claimed'
  5. 提交事务或回滚
- **结果**: 仅第一个请求成功，其他请求返回 'ITEM_ALREADY_CLAIMED'

#### 物品标记系统
- **目的**: 网红发货时快速匹配订单
- **实现**: 每个物品生成唯一二维码 `marker_${activityId}_${markerName}`
- **流程**: 扫码 → 解析二维码 → 查找物品 → 匹配订单 → 显示收货信息
- **优势**: 避免发错货，提高发货效率

## Important Constraints

### 技术约束

#### 微信云开发限制
1. **云函数**:
   - 单次运行内存: 256MB ~ 3072MB (可配置)
   - 单次运行超时: 20秒 (HTTP触发60秒)
   - 并发量: 1000 (可提升)
   - 代码包大小: 50MB (压缩后)

2. **云数据库**:
   - 单次读取: 1000条记录上限
   - 单次写入: 100条记录上限
   - 索引数量: 每个集合最多64个
   - 事务时长: 最长10秒

3. **云存储**:
   - 单文件大小: 100MB
   - 临时链接有效期: 最长2小时
   - CDN加速: 默认启用

4. **小程序基础库**:
   - 最低版本: 2.2.3 (云能力支持)
   - 推荐版本: 最新稳定版

#### 微信API限制
1. **微信支付**: 需要商户号和API密钥配置
2. **订阅消息**: 需要模板审核通过
3. **获取手机号**: 需要用户主动授权
4. **云函数调用**: 有频率限制和配额

#### 外部服务依赖
1. **腾讯云AI**: 需要API密钥，有调用量限制
2. **物流API**: 需要对接各快递公司接口
3. **网络环境**: 云函数需要访问外网

### 业务约束

#### 用户体系
1. **认证方式**: 仅支持微信授权登录 (OpenID)
2. **手机号获取**: 依赖微信官方API
3. **推广返佣**: 三级返佣机制 (6%, 3%, 2%)
4. **成长体系**: 推广行为与用户成长体系关联

#### 核心业务规则
1. **AI识别准确率**: 目标85%正确分类率
2. **运费估算精度**: 90%订单的估算误差≤15%
3. **并发领取**: 事务控制防止同一物品被多人领取
4. **订单状态**: 严格的状态流转控制
5. **支付超时**: 订单创建后30分钟未支付自动取消

#### 数据约束
1. **手机号格式**: 1[3-9]\d{9}
2. **收货地址**: 必须包含省市区街道
3. **物品照片**: 每个物品最多9张照片
4. **活动物品**: 每个活动最多100个物品

### 性能要求

#### 响应时间
- 云函数调用: < 3秒 (冷启动可能5-10秒)
- 数据库查询: < 1秒
- 支付创建: < 2秒
- 页面加载: < 2秒

#### 业务流程时长
- 网红创建赠品活动: < 3分钟 (5个物品)
- 粉丝领取支付流程: < 2分钟
- AI识别处理: < 10秒/张
- 运单生成: < 5秒

#### 并发能力
- 活动浏览: 支持100+并发
- 订单创建: 事务控制确保数据一致性
- 支付处理: 依赖微信支付能力

#### 可用性
- 云函数可用性: 99.95% (微信云开发SLA)
- 数据持久性: 99.9999%
- 支付成功率: > 95%

### 合规约束

#### 微信平台规范
1. **小程序类目**: 必须符合营业执照经营范围
2. **内容审核**: 用户上传图片需要内容安全检测
3. **用户隐私**: 必须明确隐私政策和用户协议
4. **支付资质**: 需要支付功能审核通过

#### 数据安全
1. **敏感信息加密**: 手机号、地址等需加密存储
2. **权限控制**: 云函数严格校验用户身份
3. **日志脱敏**: 日志中不记录敏感信息
4. **数据备份**: 云数据库定期备份

#### 支付合规
1. **资金结算**: 遵循微信支付规范
2. **退款处理**: 7天无理由退款
3. **发票开具**: 根据法规要求提供发票

### 开发约束

#### 环境隔离
- **开发环境**: DEV_CLOUD_ENV (独立云环境)
- **生产环境**: PROD_CLOUD_ENV (独立云环境)
- **配置分离**: 不同环境使用不同的APPID和密钥

#### 版本管理
- 云函数代码通过Git管理
- 云端部署支持版本回滚
- 数据库结构变更需要迁移脚本

#### 调试限制
- 云函数本地调试功能有限
- 需要上传云端进行完整测试
- 日志查看依赖云开发控制台

## External Dependencies

### 核心平台

**1. 微信云开发平台**
- **服务**: 云函数、云数据库、云存储
- **SDK**: wx-server-sdk ~2.6.3
- **环境ID**: cloud1-8gezjcq432191d0d
- **用途**: 整个应用的基础设施
- **配置**: 通过微信开发者工具管理
- **文档**: https://developers.weixin.qq.com/miniprogram/dev/wxcloud/basis/getting-started.html

**2. 微信小程序平台**
- **基础库**: >= 2.2.3
- **功能**: 前端界面、用户交互、组件系统
- **能力**: 微信登录、微信支付、订阅消息、扫码
- **限制**: 代码包大小、API调用频率、审核规范

### 微信官方API

**1. 微信登录API**
- **接口**: jscode2session
- **用途**: 通过临时code换取openid
- **调用位置**: auth云函数
- **配置**: APPID + AppSecret

**2. 微信支付API**
- **功能**: 创建支付、查询订单、退款
- **调用位置**: payments云函数
- **配置**: 商户号 + API密钥 + 证书
- **文档**: https://pay.weixin.qq.com/wiki/doc/apiv3/index.shtml

**3. 获取手机号API**
- **接口**: business/getuserphonenumber
- **用途**: 获取用户手机号 (需用户授权)
- **调用位置**: auth云函数
- **依赖**: access_token

**4. 订阅消息API**
- **功能**: 订单状态通知、物流更新通知
- **限制**: 需要用户主动订阅
- **模板**: 需在小程序后台配置并审核

### 第三方云服务

**1. 腾讯云 AI**
- **功能**: 图像识别、物品分类
- **API**: 图像分析、物体识别
- **调用方式**: 在云函数中通过HTTP调用
- **配置**: SecretId + SecretKey
- **用途**: 自动识别上传物品的类型和属性
- **成本**: 按调用量计费
- **文档**: https://cloud.tencent.com/product/ai

**2. 快递物流API**
- **对接公司**: 顺丰、圆通、中通、韵达等
- **功能**: 
  - 运费计算
  - 电子面单生成
  - 物流轨迹查询
- **调用方式**: 云函数代理调用
- **返回数据**: 存储到云数据库 shipping_info 集合
- **配置**: 各快递公司分配的客户号和密钥

### 社交平台集成

**1. 抖音开放平台**
- **功能**: 获取网红发布的视频动态
- **方式**: 通过云函数爬取或API对接
- **存储**: external_activities 集合
- **展示**: 网红个人主页时间线

**2. 小红书**
- **功能**: 获取网红发布的笔记动态
- **方式**: 通过云函数爬取或API对接
- **存储**: external_activities 集合
- **展示**: 网红个人主页时间线

### 开发工具依赖

**1. 微信开发者工具**
- **版本**: 最新稳定版
- **用途**: 
  - 小程序代码编辑和调试
  - 云函数上传和调试
  - 真机预览和体验版发布
- **下载**: https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html

**2. 云开发控制台**
- **访问**: https://console.cloud.tencent.com/tcb
- **功能**:
  - 云函数管理和日志查看
  - 云数据库数据管理
  - 云存储文件管理
  - 监控告警配置
  - 流量统计分析

**3. npm依赖 (云函数)**
- **wx-server-sdk**: 云开发服务端SDK
- **axios**: HTTP请求库 (调用第三方API)
- **dotenv**: 环境变量管理

### 环境配置依赖

**开发环境**:
- `DEV_CLOUD_ENV`: 开发云环境ID
- `DEV_WECHAT_APPID`: 开发小程序APPID
- `DEV_WECHAT_SECRET`: 开发小程序密钥

**生产环境**:
- `PROD_CLOUD_ENV`: 生产云环境ID
- `PROD_WECHAT_APPID`: 生产小程序APPID
- `PROD_WECHAT_SECRET`: 生产小程序密钥

### 调试工具

**本地调试**:
- 微信开发者工具内置模拟器
- 云函数本地调试 (功能有限)
- 真机调试 (通过扫码)

**云端调试**:
- 云函数日志实时查看
- 云数据库控制台操作
- 性能监控和告警

### 网络依赖

**云函数出网**:
- 需要访问微信API: api.weixin.qq.com
- 需要访问腾讯云AI: *.tencentcloudapi.com
- 需要访问快递API: 各快递公司域名

**小程序端**:
- 需要配置服务器域名白名单
- 云开发域名自动信任
- 业务域名需要在小程序后台配置
