# 云函数依赖安装问题修复指南

## 错误分析

**错误信息**：
```
errCode: -504002 functions execute fail | errMsg: Error: Cannot find module 'wx-server-sdk'
```

**原因**：
云函数部署时没有正确安装依赖包 `wx-server-sdk`。

## 解决方案

### 方法1：重新部署并安装依赖（推荐）

#### 步骤1：检查 package.json

确保每个云函数的 `package.json` 文件存在且配置正确：

```json
{
  "name": "activities",
  "version": "1.0.0",
  "description": "活动管理云函数",
  "main": "index.js",
  "dependencies": {
    "wx-server-sdk": "~2.6.3"
  }
}
```

#### 步骤2：在微信开发者工具中重新部署

1. **右键点击云函数文件夹**
   - 例如：右键点击 `cloudfunctions/activities` 文件夹

2. **选择正确的部署选项**
   - **必须选择**："上传并部署：云端安装依赖"
   - **不要选择**："上传并部署：所有文件"（这个不会安装依赖）

3. **等待部署完成**
   - 查看控制台输出，确认依赖安装成功
   - 应该看到类似 "Installing dependencies..." 的提示

#### 步骤3：验证部署

1. **打开云开发控制台**
   - 点击微信开发者工具顶部的"云开发"按钮

2. **查看云函数日志**
   - 进入"云函数" → "函数列表"
   - 点击云函数名称进入详情
   - 查看"日志"标签，确认没有依赖错误

### 方法2：本地安装依赖后部署

如果方法1不行，可以尝试在本地安装依赖：

#### 步骤1：在云函数目录中安装依赖

```bash
# 进入云函数目录
cd miniprogram/cloudfunctions/activities

# 安装依赖
npm install

# 返回项目根目录
cd ../../..
```

#### 步骤2：部署云函数

1. 在微信开发者工具中右键点击云函数文件夹
2. 选择"上传并部署：所有文件"（这次可以选这个，因为依赖已经在本地安装了）

### 方法3：检查云函数目录结构

确保云函数目录结构正确：

```
cloudfunctions/
  activities/
    index.js          # 主函数文件
    package.json            # 依赖配置文件（必须）
    config.json        # 权限配置文件
    node_modules/      # 依赖包（可选，部署时会自动安装）
```

**注意**：
- `package.json` 是必需的
- `node_modules` 可以存在，但部署时会重新安装

## 批量修复所有云函数

### 步骤1：检查所有云函数的 package.json

确保以下云函数都有正确的 `package.json`：
- `auth` - 需要 `wx-server-sdk` 和 `axios`
- `activities` - 需要 `wx-server-sdk`
- `items` - 需要 `wx-server-sdk`
- `orders` - 需要 `wx-server-sdk`
- `payments` - 需要 `wx-server-sdk`
- `sharing` - 需要 `wx-server-sdk`

### 步骤2：逐个重新部署

按照以下顺序逐个重新部署（选择"上传并部署：云端安装依赖"）：

1. `auth`
2. `activities`
3. `items`
4. `orders`
5. `payments`
6. `sharing`

### 步骤3：验证所有云函数

在云开发控制台检查所有云函数：
- 确认所有云函数都已部署
- 查看日志，确认没有依赖错误

## 常见问题

### 问题1：部署后仍然报错

**可能原因**：
1. 选择了错误的部署选项
2. `package.json` 配置错误
3. 网络问题导致依赖安装失败

**解决方案**：
1. 确认选择了"上传并部署：云端安装依赖"
2. 检查 `package.json` 中的依赖版本
3. 重试部署

### 问题2：某些云函数需要额外依赖

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

### 问题3：依赖版本问题

**推荐版本**：
- `wx-server-sdk`: `~2.6.3` 或 `latest`
- `axios`: `^1.6.0`（仅 auth 云函数需要）

## 验证修复

部署完成后，在小程序中测试：

1. **清除缓存**
   - 在微信开发者工具中，点击"清缓存" → "清除数据缓存"

2. **重新编译**
   - 点击"编译"按钮

3. **查看控制台**
   - 确认没有 `Cannot find module 'wx-server-sdk'` 错误

4. **测试功能**
   - 尝试加载活动列表
   - 确认功能正常

## 快速修复脚本

可以创建一个脚本来检查所有云函数的 package.json：

```powershell
# check-cloudfunctions.ps1
$cloudfunctions = @('auth', 'activities', 'items', 'orders', 'payments', 'sharing')

foreach ($func in $cloudfunctions) {
    $packageJson = "miniprogram\cloudfunctions\$func\package.json"
    if (Test-Path $packageJson) {
        Write-Host "✓ $func - package.json exists" -ForegroundColor Green
        $content = Get-Content $packageJson | ConvertFrom-Json
        if ($content.dependencies.'wx-server-sdk') {
            Write-Host "  - wx-server-sdk: $($content.dependencies.'wx-server-sdk')" -ForegroundColor Cyan
        } else {
            Write-Host "  ✗ Missing wx-server-sdk dependency!" -ForegroundColor Red
        }
    } else {
        Write-Host "✗ $func - package.json missing!" -ForegroundColor Red
    }
}
```

