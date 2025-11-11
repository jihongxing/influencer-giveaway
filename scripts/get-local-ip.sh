#!/bin/bash
# 获取本机局域网 IP 地址（用于手机预览配置）
# Mac/Linux 脚本

echo "正在查找局域网 IP 地址..."
echo ""

# 获取局域网 IP（排除回环地址和虚拟网络）
IP=$(ifconfig | grep "inet " | grep -v 127.0.0.1 | grep -v "169.254" | awk '{print $2}' | head -1)

if [ -n "$IP" ]; then
    echo "✅ 找到局域网 IP: $IP"
    echo ""
    echo "请在 miniprogram/app.js 中设置:"
    echo "  apiBaseUrl: 'http://$IP:3000/api/v1'"
    echo ""
    echo "或者直接修改为:"
    echo "  apiBaseUrl: 'http://$IP:3000/api/v1',"
    echo ""
    echo "⚠️  注意事项:"
    echo "  1. 确保手机和电脑连接在同一 WiFi 网络"
    echo "  2. 确保后端服务正在运行 (npm run dev)"
    echo "  3. 确保防火墙允许 3000 端口的连接"
else
    echo "❌ 未找到局域网 IP 地址"
    echo ""
    echo "请检查:"
    echo "  1. 电脑是否连接到 WiFi 或以太网"
    echo "  2. 网络适配器是否已启用"
    echo ""
    echo "手动查找方法:"
    echo "  打开终端，输入: ifconfig"
    echo "  查找 'inet' 地址，通常是 192.168.x.x 或 10.x.x.x"
fi

