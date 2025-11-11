# 手机预览快速配置

## 问题
手机扫描预览二维码后提示"无法连接到服务器"。

## 原因
手机无法访问开发电脑的 `localhost`，需要使用局域网 IP。

## 快速解决（3 步）

### 1. 获取你的局域网 IP

**Windows:**
```powershell
.\scripts\get-local-ip.ps1
```

**Mac/Linux:**
```bash
./scripts/get-local-ip.sh
```

或者手动查找：
- Windows: `ipconfig` → 查找 "IPv4 地址"（通常是 `192.168.x.x`）
- Mac/Linux: `ifconfig | grep "inet "` → 查找局域网 IP

### 2. 修改小程序配置

打开 `miniprogram/app.js`，找到 `apiBaseUrl`，修改为：

```javascript
globalData: {
  apiBaseUrl: 'http://192.168.2.16:3000/api/v1', // 替换为你的实际 IP
}
```

### 3. 确保条件满足

- ✅ 后端服务正在运行：`cd backend && npm run dev`
- ✅ 手机和电脑在同一 WiFi 网络
- ✅ 防火墙允许 3000 端口（Windows 可能会弹出提示，选择"允许"）

### 4. 重新预览

在微信开发者工具中重新生成预览二维码，用手机扫描测试。

## 详细说明

查看完整配置指南：`docs/mobile-preview-setup.md`

## 常见问题

**Q: 修改后还是无法连接？**
- 检查后端服务是否在运行
- 检查手机和电脑是否在同一 WiFi
- 在手机浏览器访问 `http://你的IP:3000/api/v1/activities/public` 测试

**Q: 防火墙提示？**
- Windows: 选择"允许访问"
- Mac: 系统偏好设置 → 安全性与隐私 → 防火墙 → 允许 Node.js

**Q: 生产环境怎么办？**
- 需要部署到云服务器
- 使用 HTTPS 和正式域名
- 在微信公众平台配置服务器域名

