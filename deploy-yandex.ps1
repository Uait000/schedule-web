Write-Host "🚀 Building for Yandex Cloud..." -ForegroundColor Green

# Очистка и сборка
npm run build

Write-Host "📦 Uploading to Yandex Cloud..." -ForegroundColor Yellow

# Загрузка в Yandex Object Storage
try {
    & aws --endpoint-url=https://storage.yandexcloud.net s3 sync ./dist s3://schedulettgt-static/ --delete
    Write-Host "✅ Files uploaded successfully!" -ForegroundColor Green
}
catch {
    Write-Host "❌ Upload failed: $_" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Deployment completed!" -ForegroundColor Green
Write-Host "🌐 Site URL: https://storage.yandexcloud.net/schedulettgt-static/" -ForegroundColor Cyan
Write-Host "📱 Telegram Mini App ready!" -ForegroundColor Cyan

# Открываем сайт для проверки
Start-Process "https://storage.yandexcloud.net/schedulettgt-static/"