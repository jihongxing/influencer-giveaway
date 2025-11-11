# 批量更新所有页面中的 API 服务引用
# 将 api.js 替换为 api-cloud.js

$files = Get-ChildItem -Path "miniprogram\pages" -Recurse -Filter "*.js" | Where-Object { $_.FullName -notlike "*node_modules*" }

foreach ($file in $files) {
    $content = Get-Content $file.FullName -Raw -Encoding UTF8
    $originalContent = $content
    
    # 替换 API 服务引用
    $content = $content -replace "require\('\.\.\/\.\.\/services\/api'\)\.default", "require('../../services/api-cloud').default"
    $content = $content -replace 'require\("\.\.\/\.\.\/services\/api"\)\.default', 'require("../../services/api-cloud").default'
    
    if ($content -ne $originalContent) {
        Set-Content -Path $file.FullName -Value $content -Encoding UTF8 -NoNewline
        Write-Host "Updated: $($file.FullName)" -ForegroundColor Green
    }
}

Write-Host "`n所有文件更新完成！" -ForegroundColor Cyan
Write-Host "`n注意：还需要手动更新 API 调用方法，因为云函数的调用方式与 HTTP 请求不同。" -ForegroundColor Yellow

