# 云函数部署指南

## 错误分析

当前错误：`errCode: -501000 | errMsg: FunctionName parameter could not be found.`

**原因**：
1. 云函数未部署到云端
2. 云函数名称不匹配
3. 云函数部署失败

## 部署步骤

### 1. 在微信开发者工具中部署

#### 步骤1：检查云函数目录结构

确保云函数目录结构正确：
```
miniprogram/
  cloudfunctions/
    auth/
      index.js
      package.json
      config.json
    activities/
      index.js
      package.json
      config.json
    items/
      index.js
      package.json
      config.json
    orders/
      index.js
      package.json
      config.json
    payments/
      index.js
      package.json
      config.json
    sharing/
      index.js
      package.json
      config.json
```

#### 步骤2：部署单个云函数

1. **右键点击云函数文件夹**
   - 例如：右键点击 `cloudfunctions/auth` 文件夹

2. **选择部署选项**
   - 选择"上传并部署：云端安装依赖"
   - 或选择"上传并部署：所有文件"

3. **等待部署完成**
   - 查看控制台输出，确认部署成功
   - 如果失败，查看错误信息

#### 步骤3：批量部署所有云函数

1. **逐个部署**
   - 按照依赖顺序部署：
     1. `auth` - 基础认证功能
     2. `activities` - 活动管理
     3. `items` - 物品管理
     4. `orders` - 订单管理
     5. `payments` - 支付处理
     6. `sharing` - 分享功能

2. **验证部署**
   - 在云开发控制台查看云函数列表
   - 确认所有云函数都已部署

### 2. 检查云函数配置

#### 检查 package.json

确保每个云函数的 `package.json` 包含必要的依赖：

```json
{
  "name": "auth",
  "version": "1.0.0",
  "description": "认证相关云函数",
  "main": "index.js",
  "dependencies": {
    "wx-server-sdk": "~2.6.3",
    "axios": "^1.6.0"
  }
}
```

#### 检查 config.json

确保每个云函数的 `config.json` 配置正确：

```json
{
  "permissions": {
    "openapi": []
  }
}
```

### 3. 验证云函数部署

#### 方法1：在云开发控制台查看

1. 打开云开发控制台
2. 进入"云函数" → "函数列表"
3. 查看所有已部署的云函数
4. 确认函数名称与代码中调用的一致

#### 方法2：在代码中测试

在 `app.js` 中添加测试代码：

```javascript
// 测试云函数调用
wx.cloud.callFunction({
  name: 'activities',
  data: {
    action: 'getPublicList',
    page: 1,
    limit: 10
  },
  success: (res) => {
    console.log('云函数调用成功:', res);
  },
  fail: (err) => {
    console.error('云函数调用失败:', err);
  }
});
```

### 4. 常见部署问题

#### 问题1：依赖安装失败

**解决方案**：
1. 检查 `package.json` 中的依赖版本
2. 确保网络连接正常
3. 尝试手动安装依赖：
   ```bash
   cd cloudfunctions/auth
   npm install
   ```

#### 问题2：云函数名称不匹配

**解决方案**：
1. 确保云函数文件夹名称与调用时的名称一致
2. 检查 `api-cloud.js` 中的云函数名称
3. 云函数名称区分大小写

#### 问题3：权限不足

**解决方案**：
1. 检查云函数 `config.json` 中的权限配置
2. 确保云开发环境已正确初始化
3. 检查 `app.js` 中的环境ID是否正确

### 5. 部署检查清单

- [ ] 所有云函数文件夹都存在
- [ ] 每个云函数都有 `index.js`、`package.json`、`config.json`
- [ ] `package.json` 中的依赖已正确配置
- [ ] 云函数已部署到云端
- [ ] 云函数名称与代码中调用的一致
- [ ] 云开发环境ID正确（cloud1-8gezjcq432191d0d）
- [ ] 云开发已初始化（app.js中）

### 6. 快速部署脚本

可以创建一个脚本来批量部署所有云函数：

```bash
# deploy-cloudfunctions.ps1 (PowerShell)
$cloudfunctions = @('auth', 'activities', 'items', 'orders', 'payments', 'sharing')

foreach ($func in $cloudfunctions) {
    Write-Host "Deploying $func..."
    # 这里需要手动在微信开发者工具中部署
    # 或者使用云开发CLI
}
```

## 下一步操作

1. **部署所有云函数**
   - 按照上述步骤逐个部署

2. **创建数据库集合**
   - 参考 `docs/cloud-database-setup.md`

3. **测试云函数调用**
   - 在小程序中测试各个功能

4. **配置环境变量**
   - 在云开发控制台配置 `WECHAT_SECRET` 等环境变量

