# 手机预览配置指南

## 问题说明

当使用微信开发者工具生成预览二维码，用手机扫描后，如果提示"无法连接到服务器"，这是因为：

1. **开发工具中**：小程序可以访问 `localhost:3000`（开发电脑的本地地址）
2. **手机预览时**：手机无法访问开发电脑的 `localhost`，因为手机和电脑不在同一个网络上下文

## 解决方案

### 方案一：使用局域网 IP（推荐用于开发测试）

1. **获取开发电脑的局域网 IP 地址**：
   - Windows: 打开命令提示符，输入 `ipconfig`，找到 "IPv4 地址"（通常是 `192.168.x.x`）
   - Mac: 打开终端，输入 `ifconfig | grep "inet "`，找到局域网 IP
   - Linux: 打开终端，输入 `ip addr show` 或 `ifconfig`

2. **修改小程序配置**：
   打开 `miniprogram/app.js`，将 `apiBaseUrl` 改为你的局域网 IP：
   ```javascript
   globalData: {
     apiBaseUrl: 'http://192.168.1.100:3000/api/v1', // 替换为你的局域网 IP
   }
   ```

3. **确保后端服务监听所有网络接口**：
   检查 `backend` 服务是否监听 `0.0.0.0:3000` 而不是 `localhost:3000`
   - 如果使用 Express，确保 `app.listen(3000, '0.0.0.0')` 或 `app.listen(3000)`

4. **确保手机和电脑在同一局域网**：
   - 手机和开发电脑必须连接到同一个 WiFi 网络

5. **检查防火墙**：
   - Windows: 确保防火墙允许 3000 端口的入站连接
   - Mac/Linux: 检查防火墙设置

### 方案二：部署到云服务器（推荐用于生产环境）

1. 将后端服务部署到云服务器（如阿里云、腾讯云、AWS 等）
2. 配置域名和 HTTPS 证书
3. 修改 `app.js` 中的 `apiBaseUrl` 为云服务器地址：
   ```javascript
   globalData: {
     apiBaseUrl: 'https://api.yourdomain.com/api/v1',
   }
   ```

### 方案三：使用内网穿透工具（临时测试）

可以使用内网穿透工具将本地服务暴露到公网：
- ngrok: `ngrok http 3000`
- 花生壳
- 其他内网穿透服务

## 快速配置脚本

项目提供了自动获取 IP 的脚本：

### Windows PowerShell
```powershell
# 在项目根目录运行
.\scripts\get-local-ip.ps1
```

### Mac/Linux
```bash
# 在项目根目录运行
chmod +x scripts/get-local-ip.sh
./scripts/get-local-ip.sh
```

脚本会自动查找你的局域网 IP 并显示配置方法。

## 验证配置

1. 在开发电脑浏览器访问 `http://你的IP:3000/api/v1/activities/public`，应该能正常访问
2. 在手机浏览器访问相同地址，也应该能正常访问
3. 如果手机无法访问，检查：
   - 手机和电脑是否在同一 WiFi
   - 防火墙是否阻止了 3000 端口
   - 后端服务是否正在运行

## 注意事项

- ⚠️ **开发环境**：使用局域网 IP 仅适用于开发和测试
- ⚠️ **生产环境**：必须使用 HTTPS 和正式域名
- ⚠️ **安全性**：确保后端服务有适当的身份验证和授权
- ⚠️ **微信小程序要求**：生产环境必须使用 HTTPS，且域名需要在微信公众平台配置

