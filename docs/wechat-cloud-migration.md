# 迁移到微信云开发指南

## 概述

将后端服务和数据库从自建服务器迁移到微信云开发环境，可以：
- ✅ 解决手机预览时的网络连接问题
- ✅ 无需自己部署和维护服务器
- ✅ 与微信小程序深度集成
- ✅ 自动处理 HTTPS、域名配置等问题
- ✅ 使用云数据库（MongoDB）替代 MySQL
- ✅ 使用云存储替代文件服务器

## 微信云开发架构

```
小程序前端
    ↓
云函数 (Cloud Functions) - 替代 Express 后端
    ↓
云数据库 (Cloud Database) - 替代 MySQL
    ↓
云存储 (Cloud Storage) - 替代文件服务器
```

## 迁移方案

### 方案一：完全迁移（推荐）

将所有后端逻辑迁移到云函数，使用云数据库和云存储。

**优点：**
- 完全托管，无需维护
- 自动扩展
- 与小程序深度集成

**缺点：**
- 需要重写部分代码（MySQL → MongoDB）
- 云函数有执行时间限制
- 某些第三方服务可能需要调整

### 方案二：混合方案

核心功能使用云开发，复杂功能保留自建服务器。

**优点：**
- 渐进式迁移
- 保留现有复杂逻辑

**缺点：**
- 需要维护两套系统
- 增加复杂度

## 详细迁移步骤

### 第一步：开通云开发

1. 在微信开发者工具中，点击"云开发"按钮
2. 开通云开发环境
3. 创建环境（建议创建两个：开发环境、生产环境）
4. 记录环境 ID

### 第二步：初始化云开发

在项目根目录执行：

```bash
# 安装云开发 CLI
npm install -g @cloudbase/cli

# 登录
tcb login
```

### 第三步：创建云函数目录结构

```
miniprogram/
├── cloudfunctions/          # 云函数目录
│   ├── auth/                # 认证相关
│   │   ├── index.js
│   │   ├── package.json
│   │   └── config.json
│   ├── activities/          # 活动相关
│   ├── items/               # 物品相关
│   ├── orders/              # 订单相关
│   ├── payments/            # 支付相关
│   └── sharing/             # 分享相关
├── database/                # 数据库初始化脚本
│   └── init.js
└── ...
```

### 第四步：数据库迁移（MySQL → 云数据库）

#### 4.1 数据模型映射

| MySQL 表 | 云数据库集合 | 说明 |
|---------|------------|------|
| influencer_account | users | 用户信息 |
| giveaway_activity | activities | 活动信息 |
| item | items | 物品信息 |
| order | orders | 订单信息 |
| shipping_information | shipping | 物流信息 |
| sharing_post | sharing_posts | 分享帖子 |
| external_activity | external_activities | 外部活动 |

#### 4.2 创建数据库集合

在云开发控制台或通过代码创建：

```javascript
// database/init.js
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

// 创建集合
const collections = [
  'users',
  'activities',
  'items',
  'orders',
  'shipping',
  'sharing_posts',
  'external_activities'
];

async function initDatabase() {
  for (const collection of collections) {
    try {
      await db.createCollection(collection);
      console.log(`✅ Created collection: ${collection}`);
    } catch (error) {
      if (error.errCode === -1) {
        console.log(`⚠️  Collection ${collection} already exists`);
      } else {
        console.error(`❌ Failed to create ${collection}:`, error);
      }
    }
  }
}

initDatabase();
```

#### 4.3 数据迁移脚本

创建数据迁移脚本，将 MySQL 数据导入云数据库：

```javascript
// scripts/migrate-to-cloud-db.js
// 从 MySQL 读取数据，写入云数据库
```

### 第五步：创建云函数

#### 5.1 认证云函数示例

```javascript
// cloudfunctions/auth/index.js
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

// 用户注册
exports.main = async (event, context) => {
  const { action, data } = event;
  
  switch (action) {
    case 'register':
      return await register(data);
    case 'login':
      return await login(data);
    case 'getPhoneNumber':
      return await getPhoneNumber(data);
    default:
      return { success: false, error: 'Unknown action' };
  }
};

async function register(data) {
  const { wechat_code, phone_number, nickname, avatar_url, shipping_address } = data;
  
  // 1. 通过 code 获取 openid
  const openid = await getOpenId(wechat_code);
  
  // 2. 检查用户是否已存在
  const existing = await db.collection('users')
    .where({ wechat_openid: openid })
    .get();
  
  if (existing.data.length > 0) {
    return {
      success: false,
      error: { code: 'ACCOUNT_ALREADY_EXISTS', message: 'Account already exists' }
    };
  }
  
  // 3. 创建用户
  const result = await db.collection('users').add({
    data: {
      wechat_openid: openid,
      phone_number,
      nickname,
      avatar_url,
      shipping_address,
      account_status: 'active',
      created_at: db.serverDate(),
      updated_at: db.serverDate()
    }
  });
  
  // 4. 生成 session token（使用云函数内置能力）
  const sessionToken = await generateSessionToken(result._id, openid);
  
  return {
    success: true,
    data: {
      user_id: result._id,
      session_token: sessionToken,
      wechat_openid: openid
    }
  };
}

async function getOpenId(code) {
  // 调用微信 API 获取 openid
  // 注意：需要在云函数中配置 AppSecret
  const appid = 'wx28fe6d19a46e6327';
  const secret = process.env.WECHAT_SECRET; // 从环境变量读取
  
  const response = await cloud.openapi.wxacode.getSessionKey({
    appid,
    secret,
    js_code: code
  });
  
  return response.openid;
}

async function generateSessionToken(userId, openid) {
  // 使用云开发内置能力生成 token
  // 或使用 JWT
  return `token_${userId}_${Date.now()}`;
}
```

#### 5.2 活动管理云函数

```javascript
// cloudfunctions/activities/index.js
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

exports.main = async (event, context) => {
  const { action, data } = event;
  const { OPENID } = cloud.getWXContext(); // 获取用户 openid
  
  switch (action) {
    case 'create':
      return await createActivity(OPENID, data);
    case 'getList':
      return await getActivityList(data);
    case 'getPublicList':
      return await getPublicActivityList(data);
    case 'getDetail':
      return await getActivityDetail(data);
    default:
      return { success: false, error: 'Unknown action' };
  }
};

async function createActivity(openid, data) {
  const { items, shareable_link } = data;
  
  // 创建活动
  const activityResult = await db.collection('activities').add({
    data: {
      influencer_id: openid,
      shareable_link,
      status: 'active',
      created_at: db.serverDate(),
      updated_at: db.serverDate()
    }
  });
  
  // 创建物品
  const itemsData = items.map(item => ({
    activity_id: activityResult._id,
    ...item,
    status: 'available',
    created_at: db.serverDate()
  }));
  
  await db.collection('items').add({
    data: itemsData
  });
  
  return {
    success: true,
    data: {
      activity_id: activityResult._id,
      shareable_link
    }
  };
}

async function getPublicActivityList(data) {
  const { page = 1, limit = 20, status = 'active' } = data;
  
  const result = await db.collection('activities')
    .where({
      status: status
    })
    .orderBy('created_at', 'desc')
    .skip((page - 1) * limit)
    .limit(limit)
    .get();
  
  // 获取总数
  const countResult = await db.collection('activities')
    .where({ status: status })
    .count();
  
  // 获取每个活动的物品和用户信息
  const activities = await Promise.all(
    result.data.map(async (activity) => {
      const items = await db.collection('items')
        .where({ activity_id: activity._id })
        .get();
      
      const user = await db.collection('users')
        .doc(activity.influencer_id)
        .get();
      
      return {
        activity_id: activity._id,
        shareable_link: activity.shareable_link,
        influencer: {
          nickname: user.data.nickname || '用户',
          avatar_url: user.data.avatar_url || null
        },
        items: items.data.map(item => ({
          item_id: item._id,
          photo_urls: item.photo_urls,
          category: item.category,
          label: item.label,
          shipping_cost_estimate: item.shipping_cost_estimate,
          status: item.status
        })),
        created_at: activity.created_at
      };
    })
  );
  
  return {
    success: true,
    data: {
      activities,
      pagination: {
        page,
        limit,
        total: countResult.total,
        total_pages: Math.ceil(countResult.total / limit)
      }
    }
  };
}
```

### 第六步：修改前端代码

#### 6.1 初始化云开发

```javascript
// miniprogram/app.js
App({
  onLaunch() {
    // 初始化云开发
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力');
    } else {
      wx.cloud.init({
        env: 'your-env-id', // 云开发环境 ID
        traceUser: true,
      });
    }
    
    // ... 其他初始化代码
  },
  
  globalData: {
    // 不再需要 apiBaseUrl
    // 使用云函数调用替代
  }
});
```

#### 6.2 修改 API 服务

```javascript
// miniprogram/services/api.js
class ApiService {
  /**
   * 调用云函数
   */
  async callCloudFunction(name, action, data = {}) {
    return new Promise((resolve, reject) => {
      wx.cloud.callFunction({
        name,
        data: {
          action,
          ...data
        },
        success: (res) => {
          if (res.result.success) {
            resolve(res.result);
          } else {
            reject(new Error(res.result.error?.message || 'Request failed'));
          }
        },
        fail: (err) => {
          reject(new Error(err.errMsg || 'Network error'));
        }
      });
    });
  }
  
  /**
   * 用户注册
   */
  async register(data) {
    return this.callCloudFunction('auth', 'register', data);
  }
  
  /**
   * 获取活动列表
   */
  async getPublicActivities(options) {
    return this.callCloudFunction('activities', 'getPublicList', options);
  }
  
  // ... 其他方法
}

module.exports = {
  default: new ApiService()
};
```

### 第七步：文件存储迁移

#### 7.1 上传文件到云存储

```javascript
// miniprogram/utils/cloudStorage.js
/**
 * 上传文件到云存储
 */
async function uploadFile(filePath, cloudPath) {
  return new Promise((resolve, reject) => {
    wx.cloud.uploadFile({
      cloudPath,
      filePath,
      success: (res) => {
        resolve(res.fileID);
      },
      fail: (err => {
        reject(err);
      }
    });
  });
}

/**
 * 获取文件临时链接
 */
async function getTempFileURL(fileID) {
  return new Promise((resolve, reject) => {
    wx.cloud.getTempFileURL({
      fileList: [fileID],
      success: (res) => {
        resolve(res.fileList[0].tempFileURL);
      },
      fail: reject
    });
  });
}
```

### 第八步：配置云函数环境变量

在云开发控制台配置环境变量：

- `WECHAT_SECRET`: 微信 AppSecret
- `WECHAT_MCHID`: 微信支付商户号
- `WECHAT_API_KEY`: 微信支付 API Key
- `TENCENT_CLOUD_SECRET_ID`: 腾讯云 SecretId（用于 AI 服务）
- `TENCENT_CLOUD_SECRET_KEY`: 腾讯云 SecretKey

## 迁移检查清单

### 数据库迁移
- [ ] 创建所有集合
- [ ] 迁移现有数据（如果有）
- [ ] 创建数据库索引
- [ ] 设置数据库权限规则

### 云函数迁移
- [ ] auth - 认证相关
- [ ] activities - 活动管理
- [ ] items - 物品管理
- [ ] orders - 订单管理
- [ ] payments - 支付处理
- [ ] sharing - 分享功能
- [ ] webhooks - 微信支付回调

### 前端修改
- [ ] 初始化云开发
- [ ] 修改 API 服务调用方式
- [ ] 修改文件上传逻辑
- [ ] 更新所有页面中的 API 调用

### 配置
- [ ] 配置云开发环境 ID
- [ ] 配置环境变量
- [ ] 配置数据库权限
- [ ] 配置云存储权限

## 注意事项

### 1. 数据库差异

**MySQL vs 云数据库（MongoDB）:**

| MySQL | 云数据库 |
|-------|---------|
| 表 (Table) | 集合 (Collection) |
| 行 (Row) | 文档 (Document) |
| 列 (Column) | 字段 (Field) |
| JOIN | 需要手动关联查询 |
| 事务 | 支持（有限） |
| 外键 | 不支持，需要应用层维护 |

### 2. 云函数限制

- 执行时间限制：60 秒（可申请延长）
- 内存限制：256MB（可申请增加）
- 并发限制：根据套餐不同
- 冷启动：首次调用可能较慢

### 3. 成本考虑

- 云函数：按调用次数和时长计费
- 云数据库：按存储和读取次数计费
- 云存储：按存储和流量计费
- 建议：先使用免费额度测试

### 4. 安全性

- 使用云数据库权限控制
- 敏感信息存储在环境变量
- 使用云函数进行权限验证

## 迁移工具

创建迁移工具脚本，帮助自动化迁移过程：

```javascript
// scripts/migrate-to-cloud.js
// 自动迁移脚本
```

## 测试验证

1. **单元测试**：测试每个云函数
2. **集成测试**：测试完整业务流程
3. **性能测试**：测试云函数响应时间
4. **压力测试**：测试并发处理能力

## 回滚方案

如果迁移出现问题，可以：
1. 保留原后端服务
2. 通过配置切换 API 地址
3. 逐步迁移，先迁移部分功能

## 参考资源

- [微信云开发文档](https://developers.weixin.qq.com/miniprogram/dev/wxcloud/basis/getting-started.html)
- [云函数开发指南](https://developers.weixin.qq.com/miniprogram/dev/wxcloud/guide/functions.html)
- [云数据库开发指南](https://developers.weixin.qq.com/miniprogram/dev/wxcloud/guide/database.html)
- [云存储开发指南](https://developers.weixin.qq.com/miniprogram/dev/wxcloud/guide/storage.html)

