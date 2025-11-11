# 修复 wx-server-sdk 依赖错误

## 错误信息

```
errCode: -504002 functions execute fail | errMsg: Error: Cannot find module 'wx-server-sdk'
```

## 问题原因

云函数部署时没有正确安装依赖包。虽然 `package.json` 配置正确，但部署时可能：
1. 选择了错误的部署选项（"上传并部署：所有文件"）
2. 依赖安装失败
3. 需要重新部署并安装依赖

## 解决方案

### 方法1：重新部署并安装依赖（推荐）

#### 步骤1：在微信开发者工具中重新部署

**重要**：必须选择"上传并部署：云端安装依赖"

1. **找到云函数文件夹**
   - 在文件管理器中找到 `miniprogram/cloudfunctions/activities` 文件夹

2. **右键点击文件夹**
   - 右键点击 `activities` 文件夹

3. **选择正确的部署选项**
   - **必须选择**："上传并部署：云端安装依赖"
   - **不要选择**："上传并部署：所有文件"（这个不会安装依赖）

4. **等待部署完成**
   - 查看控制台输出
   - 应该看到类似 "Installing dependencies..." 的提示
   - 等待直到看到 "Deploy success" 或类似的成功提示

#### 步骤2：重复部署其他云函数

按照以下顺序逐个重新部署（**必须选择"上传并部署：云端安装依赖"**）：

1. **auth** - 需要 `wx-server-sdk` 和 `axios`
2. **activities** - 需要 `wx-server-sdk`
3. **items** - 需要 `wx-server-sdk`
4. **orders** - 需要 `wx-server-sdk`
5. **payments** - 需要 `wx-server-sdk`
6. **sharing** - 需要 `wx-server-sdk`

#### 步骤3：验证部署

1. **打开云开发控制台**
   - 点击微信开发者工具顶部的"云开发"按钮

2. **查看云函数列表**
   - 进入"云函数" → "函数列表"
   - 确认所有云函数都已部署

3. **查看云函数日志**
   - 点击云函数名称进入详情
   - 查看"日志"标签
   - 确认没有依赖错误

### 方法2：本地安装依赖后部署

如果方法1不行，可以尝试在本地安装依赖：

#### 步骤1：在云函数目录中安装依赖

在项目根目录执行：

```powershell
# 进入 activities 云函数目录
cd miniprogram\cloudfunctions\activities
npm install
cd ..\..

# 进入 auth 云函数目录
cd miniprogram\cloudfunctions\auth
npm install
cd ..\..

# 进入 items 云函数目录
cd miniprogram\cloudfunctions\items
npm install
cd ..\..

# 进入 orders 云函数目录
cd miniprogram\cloudfunctions\orders
npm install
cd ..\..

# 进入 payments 云函数目录
cd miniprogram\cloudfunctions\payments
npm install
cd ..\..

# 进入 sharing 云函数目录
cd miniprogram\cloudfunctions\sharing
npm install
cd ..\..
```

#### 步骤2：部署云函数

1. 在微信开发者工具中右键点击云函数文件夹
2. 这次可以选择"上传并部署：所有文件"（因为依赖已经在本地安装了）

### 方法3：使用批量部署脚本

创建一个 PowerShell 脚本来批量安装依赖：

```powershell
# install-cloudfunction-dependencies.ps1
$cloudfunctions = @('auth', 'activities', 'items', 'orders', 'payments', 'sharing')

foreach ($func in $cloudfunctions) {
    Write-Host "Installing dependencies for $func..." -ForegroundColor Cyan
    $funcPath = "miniprogram\cloudfunctions\$func"
    if (Test-Path $funcPath) {
        Push-Location $funcPath
        npm install
        Pop-Location
        Write-Host "✓ $func dependencies installed" -ForegroundColor Green
    } else {
        Write-Host "✗ $func path not found!" -ForegroundColor Red
    }
}
```

## 部署选项说明

### "上传并部署：云端安装依赖"（推荐）

- **作用**：上传代码文件，然后在云端自动安装 `package.json` 中的依赖
- **适用场景**：首次部署或更新代码后
- **优点**：确保依赖正确安装
- **缺点**：部署时间稍长（需要安装依赖）

### "上传并部署：所有文件"

- **作用**：上传所有文件，包括 `node_modules`（如果存在）
- **适用场景**：本地已安装依赖，直接上传
- **优点**：部署速度快
- **缺点**：如果本地没有 `node_modules`，依赖不会安装

## 验证修复

部署完成后：

1. **清除小程序缓存**
   - 在微信开发者工具中，点击"清缓存" → "清除数据缓存"

2. **重新编译**
   - 点击"编译"按钮

3. **查看控制台**
   - 确认没有 `Cannot find module 'wx-server-sdk'` 错误

4. **测试功能**
   - 尝试加载活动列表
   - 确认功能正常

## 常见问题

### Q1: 部署后仍然报错

**可能原因**：
1. 选择了错误的部署选项
2. 网络问题导致依赖安装失败
3. 云函数环境问题

**解决方案**：
1. 确认选择了"上传并部署：云端安装依赖"
2. 检查网络连接
3. 重试部署
4. 查看云函数日志中的详细错误信息

### Q2: 依赖安装失败

**可能原因**：
1. `package.json` 配置错误
2. 依赖版本不兼容
3. 网络问题

**解决方案**：
1. 检查 `package.json` 中的依赖版本
2. 尝试使用 `latest` 版本
3. 检查网络连接

### Q3: 某些云函数需要额外依赖

**auth 云函数**需要 `axios`：
```json
{
  "dependencies": {
    "wx-server-sdk": "~2.6.3",
    "axios": "^1.6.0"
  }
}
```

**其他云函数**只需要 `wx-server-sdk`：
```json
{
  "dependencies": {
    "wx-server-sdk": "~2.6.3"
  }
}
```

## 快速检查清单

- [ ] 所有云函数的 `package.json` 都存在
- [ ] `package.json` 中包含 `wx-server-sdk` 依赖
- [ ] 使用"上传并部署：云端安装依赖"选项部署
- [ ] 所有云函数都已重新部署
- [ ] 云开发控制台中确认部署成功
- [ ] 查看云函数日志，确认没有依赖错误
- [ ] 清除小程序缓存并重新编译
- [ ] 测试功能，确认错误已修复

## 下一步

修复依赖错误后：
1. 测试所有云函数功能
2. 创建数据库集合（如果还没创建）
3. 配置环境变量（如果需要）
4. 测试完整业务流程

