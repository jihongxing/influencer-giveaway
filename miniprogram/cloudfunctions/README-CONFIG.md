# 云函数环境配置指南

## 📋 配置清单

本项目所有API密钥已配置到云函数环境变量中，以下是配置的密钥清单：

### ✅ 已配置的环境变量

#### 1. 微信小程序配置
- **WECHAT_APPID**: wx28fe6d19a46e6327
- **WECHAT_SECRET**: 789b87feaa1bc64f42489529d64b04d6
- **配置位置**: 
  - `auth/config.json`
  - `activities/config.json`
  - `payments/config.json`

#### 2. 百度AI配置
- **BAIDU_API_KEY**: Ynk0D3FhSZO5UVxcLrMMO60R
- **BAIDU_SECRET_KEY**: bTHzNmCKAVE8dKSFGH2HNHg3A4sHCEMA
- **配置位置**: `ai-recognition/config.json`
- **用途**: 物品图像识别、分类标签生成

#### 3. 快递100 API配置（推荐）
- **KUAIDI100_KEY**: EZWROLVn8912
- **KUAIDI100_SECRET**: b18729a888c54001b9d9f9a7aa6cbce7
- **配置位置**: `express-api/config.json`
- **用途**: 运费查询、快递下单、物流跟踪

#### 4. 快递鸟配置（备选）
- **KDN_EBUSINESS_ID**: 1901915
- **KDN_API_KEY**: 633e5647-b75c-4143-a874-1e0f76627ba0
- **配置位置**: `express-api/config.json`
- **用途**: 备用快递服务

---

## 📁 配置文件结构

```
miniprogram/cloudfunctions/
├── config/
│   └── env.js                      # 统一环境变量配置
├── .env.template                    # 环境变量模板
├── auth/
│   └── config.json                  # 微信配置
├── ai-recognition/
│   └── config.json                  # 百度AI配置
├── express-api/
│   └── config.json                  # 快递API配置
├── activities/
│   └── config.json                  # 微信配置（小程序码）
└── payments/
    └── config.json                  # 微信支付配置
```

---

## 🚀 使用方法

### 方法1：直接使用 config.json（已配置）
每个云函数的 `config.json` 已包含必要的环境变量，上传云函数时会自动配置。

### 方法2：使用统一配置模块
在云函数代码中引入统一配置：

```javascript
const config = require('../config/env');

// 使用微信配置
const { appId, secret } = config.wechat;

// 使用百度AI配置
const { apiKey, secretKey } = config.baiduAI;

// 使用快递100配置
const { key, secret } = config.kuaidi100;
```

---

## 🔐 安全建议

### 生产环境配置
在腾讯云开发控制台中配置环境变量，避免硬编码密钥：

1. 登录腾讯云开发控制台
2. 进入「云函数」→「环境」→「环境变量」
3. 添加以下环境变量：

```
WECHAT_APPID=wx28fe6d19a46e6327
WECHAT_SECRET=789b87feaa1bc64f42489529d64b04d6
BAIDU_API_KEY=Ynk0D3FhSZO5UVxcLrMMO60R
BAIDU_SECRET_KEY=bTHzNmCKAVE8dKSFGH2HNHg3A4sHCEMA
KUAIDI100_KEY=EZWROLVn8912
KUAIDI100_SECRET=b18729a888c54001b9d9f9a7aa6cbce7
KDN_EBUSINESS_ID=1901915
KDN_API_KEY=633e5647-b75c-4143-a874-1e0f76627ba0
NODE_ENV=production
```

### .gitignore 配置
确保以下文件不被提交到版本控制：
```
.env
.env.local
*.key
*.secret
```

---

## 📊 云函数权限配置

### auth 云函数
```json
{
  "openapi": [
    "security.msgSecCheck",      // 内容安全检测
    "wxacode.get",                // 小程序码生成
    "wxacode.getUnlimited"        // 无限制小程序码
  ]
}
```

### activities 云函数
```json
{
  "openapi": [
    "wxacode.getUnlimited"        // 生成活动小程序码
  ]
}
```

### payments 云函数
```json
{
  "openapi": [
    "wxpay.unifiedOrder",         // 统一下单
    "wxpay.getOrder"              // 查询订单
  ]
}
```

---

## 🔧 开发调试

### 本地调试
使用 `.env.template` 创建本地 `.env` 文件：
```bash
cp .env.template .env
```

### Mock模式
设置 `USE_MOCK_EXPRESS=true` 启用Mock快递数据（用于开发测试）

---

## 📝 注意事项

1. **密钥轮换**: 定期更新API密钥
2. **环境分离**: 开发/测试/生产环境使用不同密钥
3. **权限最小化**: 只授予必要的API权限
4. **监控告警**: 设置API调用量监控和告警
5. **成本控制**: 关注第三方API的调用量和费用

---

## 🆘 常见问题

### Q: 云函数报错"appid不匹配"？
A: 检查 `config.json` 中的 `WECHAT_APPID` 是否正确

### Q: 百度AI调用失败？
A: 
1. 检查API Key是否正确
2. 确认百度AI账户余额充足
3. 检查图片格式和大小是否符合要求

### Q: 快递API调用失败？
A: 
1. 检查快递100密钥是否正确
2. 确认账户余额充足
3. 检查API签名算法是否正确

---

**配置完成时间**: 2025-11-10
**配置版本**: v1.0
**维护者**: 开发团队
