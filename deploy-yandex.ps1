Write-Host "🚀 Building for Yandex Cloud..." -ForegroundColor Green

# Очистка и сборка
npm run build

Write-Host "📦 Uploading to Yandex Cloud..." -ForegroundColor Yellow

# Загрузка в Yandex Object Storage
try {
    # Шаг 1: Синхронизируем все ассеты (картинки, стили, скрипты), удаляя старые
    & aws --endpoint-url=https://storage.yandexcloud.net s3 sync ./dist s3://schedulettgt-static/ --exclude "index.html" --delete
    
    # Шаг 2: Перезаписываем index.html с жесткими правилами кэширования
    # no-cache заставляет браузер всегда проверять наличие новой версии на сервере
    & aws --endpoint-url=https://storage.yandexcloud.net s3 cp ./dist/index.html s3://schedulettgt-static/index.html `
        --metadata-directive REPLACE `
        --cache-control "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0"

    Write-Host "✅ Files uploaded successfully!" -ForegroundColor Green
}
catch {
    Write-Host "❌ Upload failed: $_" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Deployment completed!" -ForegroundColor Green
Write-Host "🌐 Site URL: https://schedulettgt-static.website.yandexcloud.net" -ForegroundColor Cyan
Write-Host "📱 Telegram Mini App ready!" -ForegroundColor Cyan

# Открываем сайт для проверки
Start-Process "https://schedulettgt-static.website.yandexcloud.net"