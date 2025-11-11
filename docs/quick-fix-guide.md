# 快速修复指南

## 当前错误

`errCode: -501000 | errMsg: FunctionName parameter could not be found.`

## 立即修复步骤

### 步骤1：部署云函数（最重要）

1. **在微信开发者工具中**
   - 找到 `miniprogram/cloudfunctions/activities` 文件夹
   - 右键点击该文件夹
   - 选择"上传并部署：云端安装依赖"
   - 等待部署完成

2. **重复部署其他云函数**
   - `auth`
   - `items`
   - `orders`
   - `payments`
   - `sharing`

### 步骤2：验证部署

1. **打开云开发控制台**
   - 点击微信开发者工具顶部的"云开发"按钮
   - 进入"云函数" → "函数列表"
   - 确认所有云函数都已部署

2. **检查函数名称**
   - 确保函数名称与代码中调用的一致
   - 例如：`activities`、`auth` 等

### 步骤3：创建数据库集合

参考 `docs/cloud-database-setup.md` 创建7个集合：
1. `users`
2. `activities`
3. `items`
4. `orders`
5. `shipping`
6. `sharing_posts`
7. `external_activities`

### 步骤4：重新编译

1. **保存所有文件**
2. **重新编译小程序**
   - 点击"编译"按钮
   - 或使用快捷键 `Ctrl+B`

### 步骤5：测试

1. **清除缓存**
   - 在微信开发者工具中，点击"清缓存" → "清除数据缓存"

2. **重新运行**
   - 点击"编译"按钮
   - 查看控制台是否还有错误

## 如果仍然报错

### 检查清单

- [ ] 云函数已部署到云端
- [ ] 云函数名称正确（区分大小写）
- [ ] 云开发环境ID正确（cloud1-8gezjcq432191d0d）
- [ ] `app.js` 中已初始化云开发
- [ ] 数据库集合已创建
- [ ] 网络连接正常

### 常见问题

1. **云函数部署失败**
   - 检查 `package.json` 中的依赖
   - 确保网络连接正常
   - 查看部署日志中的错误信息

2. **函数名称不匹配**
   - 检查 `api-cloud.js` 中的云函数名称
   - 确保与云函数文件夹名称一致

3. **环境ID错误**
   - 检查 `app.js` 中的环境ID
   - 确保与云开发控制台中的环境ID一致

## 详细文档

- 云函数部署：`docs/cloud-function-deployment.md`
- 数据库集合创建：`docs/cloud-database-setup.md`
- 错误修复总结：`docs/console-errors-fixes.md`

