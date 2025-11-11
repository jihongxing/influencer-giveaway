# 云开发迁移快速开始

## 第一步：开通云开发（5分钟）

1. 打开微信开发者工具
2. 点击顶部菜单"云开发"
3. 点击"开通"按钮
4. 选择套餐（建议先选择免费版测试）
5. 创建环境（建议创建两个：`dev` 和 `prod`）
6. 记录环境 ID

## 第二步：初始化项目（10分钟）

### 2.1 修改 project.config.json

```json
{
  "cloudfunctionRoot": "cloudfunctions/",
  "cloudbaseRoot": "cloudbase/"
}
```

### 2.2 初始化云开发

在 `miniprogram/app.js` 中添加：

```javascript
onLaunch() {
  // 初始化云开发
  if (!wx.cloud) {
    console.error('请使用 2.2.3 或以上的基础库以使用云能力');
  } else {
    wx.cloud.init({
      env: 'your-env-id', // 替换为你的环境 ID
      traceUser: true,
    });
  }
}
```

### 2.3 创建云函数目录

在微信开发者工具中：
1. 右键点击 `miniprogram` 目录
2. 选择"新建" → "云函数"
3. 输入函数名：`auth`
4. 重复创建其他云函数：`activities`, `items`, `orders`, `payments`

## 第三步：创建数据库集合（5分钟）

在云开发控制台：
1. 进入"数据库"
2. 点击"添加集合"
3. 创建以下集合：
   - `users` - 用户信息
   - `activities` - 活动信息
   - `items` - 物品信息
   - `orders` - 订单信息
   - `shipping` - 物流信息
   - `sharing_posts` - 分享帖子
   - `external_activities` - 外部活动

## 第四步：配置环境变量（5分钟）

在云开发控制台：
1. 进入"云函数" → "环境变量"
2. 添加以下变量：
   - `WECHAT_SECRET`: 你的微信 AppSecret
   - `WECHAT_MCHID`: 微信支付商户号（可选）
   - `WECHAT_API_KEY`: 微信支付 API Key（可选）

## 第五步：部署第一个云函数（10分钟）

### 5.1 复制云函数代码

将 `miniprogram/cloudfunctions/auth/` 目录下的文件复制到云函数目录。

### 5.2 安装依赖

在云函数目录下：
```bash
npm install
```

### 5.3 上传部署

在微信开发者工具中：
1. 右键点击 `cloudfunctions/auth`
2. 选择"上传并部署：云端安装依赖"

## 第六步：修改前端代码（15分钟）

### 6.1 修改 API 服务

更新 `miniprogram/services/api.js`，使用云函数调用：

```javascript
// 调用云函数示例
async register(data) {
  return new Promise((resolve, reject) => {
    wx.cloud.callFunction({
      name: 'auth',
      data: {
        action: 'register',
        ...data
      },
      success: (res) => {
        if (res.result.success) {
          resolve(res.result);
        } else {
          reject(new Error(res.result.error?.message || 'Register failed'));
        }
      },
      fail: reject
    });
  });
}
```

### 6.2 测试调用

在注册页面测试云函数调用是否正常。

## 第七步：逐步迁移其他功能

按照以下顺序迁移：

1. ✅ **认证功能**（auth）- 已完成
2. ⬜ **活动管理**（activities）
3. ⬜ **物品管理**（items）
4. ⬜ **订单管理**（orders）
5. ⬜ **支付处理**（payments）
6. ⬜ **分享功能**（sharing）

## 常见问题

### Q: 云函数调用失败？
- 检查环境 ID 是否正确
- 检查云函数是否已部署
- 查看云函数日志

### Q: 数据库查询失败？
- 检查数据库权限设置
- 检查集合名称是否正确
- 查看数据库操作日志

### Q: 如何调试云函数？
- 在云开发控制台查看日志
- 使用 `console.log` 输出调试信息
- 在本地测试云函数

## 下一步

- 查看完整迁移指南：`docs/wechat-cloud-migration.md`
- 参考云函数示例代码
- 逐步迁移其他功能模块

