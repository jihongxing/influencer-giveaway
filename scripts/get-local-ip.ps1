# 获取本机局域网 IP 地址（用于手机预览配置）
# Windows PowerShell 脚本

Write-Host "正在查找局域网 IP 地址..." -ForegroundColor Cyan
Write-Host ""

# 获取所有 IPv4 地址，排除回环地址
$ips = Get-NetIPAddress -AddressFamily IPv4 | 
    Where-Object {
        $_.IPAddress -notlike "127.*" -and 
        $_.IPAddress -notlike "169.254.*" -and
        ($_.IPAddress -like "192.168.*" -or $_.IPAddress -like "10.*" -or $_.IPAddress -like "172.16.*" -or $_.IPAddress -like "172.17.*" -or $_.IPAddress -like "172.18.*" -or $_.IPAddress -like "172.19.*" -or $_.IPAddress -like "172.20.*" -or $_.IPAddress -like "172.21.*" -or $_.IPAddress -like "172.22.*" -or $_.IPAddress -like "172.23.*" -or $_.IPAddress -like "172.24.*" -or $_.IPAddress -like "172.25.*" -or $_.IPAddress -like "172.26.*" -or $_.IPAddress -like "172.27.*" -or $_.IPAddress -like "172.28.*" -or $_.IPAddress -like "172.29.*" -or $_.IPAddress -like "172.30.*" -or $_.IPAddress -like "172.31.*")
    } | 
    Select-Object -First 1

if ($ips) {
    $ip = $ips.IPAddress
    Write-Host "✅ 找到局域网 IP: $ip" -ForegroundColor Green
    Write-Host ""
    Write-Host "请在 miniprogram/app.js 中设置:" -ForegroundColor Yellow
    Write-Host "  apiBaseUrl: 'http://$ip:3000/api/v1'" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "或者直接修改为:" -ForegroundColor Yellow
    Write-Host "  apiBaseUrl: 'http://$ip:3000/api/v1'," -ForegroundColor Cyan
    Write-Host ""
    Write-Host "⚠️  注意事项:" -ForegroundColor Yellow
    Write-Host "  1. 确保手机和电脑连接在同一 WiFi 网络" -ForegroundColor White
    Write-Host "  2. 确保后端服务正在运行 (npm run dev)" -ForegroundColor White
    Write-Host "  3. 确保防火墙允许 3000 端口的连接" -ForegroundColor White
} else {
    Write-Host "❌ 未找到局域网 IP 地址" -ForegroundColor Red
    Write-Host ""
    Write-Host "请检查:" -ForegroundColor Yellow
    Write-Host "  1. 电脑是否连接到 WiFi 或以太网" -ForegroundColor White
    Write-Host "  2. 网络适配器是否已启用" -ForegroundColor White
    Write-Host ""
    Write-Host "手动查找方法:" -ForegroundColor Yellow
    Write-Host "  打开命令提示符，输入: ipconfig" -ForegroundColor White
    Write-Host "  查找 'IPv4 地址'，通常是 192.168.x.x 或 10.x.x.x" -ForegroundColor White
}

