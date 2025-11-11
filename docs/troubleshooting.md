# 故障排除指南

## 网络连接错误

### 错误信息
```
ERR_CONNECTION_REFUSED
无法连接到服务器，请确认后端服务是否已启动（http://localhost:3000）
```

### 解决方案

#### 1. 启动后端服务器

在项目根目录下，进入 `backend` 目录并启动服务器：

```bash
cd backend
npm install  # 如果还没有安装依赖
npm run dev  # 启动开发服务器
```

服务器应该会在 `http://localhost:3000` 上运行。

#### 2. 检查后端服务器状态

打开浏览器访问：`http://localhost:3000/api/v1/health`（如果配置了健康检查接口）

或者检查后端控制台，确认服务器已成功启动。

#### 3. 微信开发者工具的 localhost 问题

**问题**：微信开发者工具可能无法访问 `localhost`，需要使用本机 IP 地址。

**解决方案**：

1. **获取本机 IP 地址**：
   - Windows: 打开命令提示符，运行 `ipconfig`，查找 "IPv4 地址"
   - Mac/Linux: 打开终端，运行 `ifconfig` 或 `ip addr`

2. **修改 `miniprogram/app.js`**：
   ```javascript
   globalData: {
     // 将 localhost 替换为你的本机 IP，例如：
     apiBaseUrl: 'http://192.168.1.100:3000/api/v1',
   }
   ```

3. **配置微信开发者工具**：
   - 打开微信开发者工具
   - 点击右上角"详情"
   - 在"本地设置"中勾选"不校验合法域名、web-view（业务域名）、TLS 版本以及 HTTPS 证书"
   - 这样可以在开发环境中使用 HTTP 和本地 IP

#### 4. 生产环境配置

在生产环境中，需要：

1. **配置 HTTPS**：微信小程序要求使用 HTTPS
2. **配置合法域名**：在微信公众平台配置服务器域名
3. **更新 `app.js`**：
   ```javascript
   globalData: {
     apiBaseUrl: 'https://your-api-domain.com/api/v1',
   }
   ```

### 常见问题

**Q: 后端服务器已启动，但仍然无法连接？**

A: 检查以下几点：
- 确认端口号是否正确（默认 3000）
- 检查防火墙是否阻止了连接
- 尝试在浏览器中直接访问 API 地址
- 检查后端 CORS 配置是否允许小程序域名

**Q: 如何查看后端日志？**

A: 后端服务器启动后，控制台会显示请求日志。检查是否有错误信息。

**Q: 开发环境可以使用 HTTP 吗？**

A: 可以。在微信开发者工具的"本地设置"中勾选"不校验合法域名"即可。

## 其他错误

### 模块未找到错误

如果遇到 `module 'services/api.js' is not defined` 错误：

1. 确认 `miniprogram/services/api.js` 文件存在
2. 检查文件路径是否正确
3. 重新编译小程序

### WXML 编译错误

如果遇到 WXML 语法错误：

1. 检查是否使用了可选链操作符 `?.`（WXML 不支持）
2. 检查是否使用了箭头函数（WXML 不支持）
3. 将复杂逻辑移到 JS 文件中处理

