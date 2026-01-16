#!/bin/bash
echo "🚀 Building for Yandex Cloud..."

# Сборка проекта
npm run build

echo "📦 Uploading to Yandex Cloud..."

# Шаг 1: Загружаем все файлы, кроме index.html, с удалением старых
# Это обеспечит чистоту в хранилище
aws --endpoint-url=https://storage.yandexcloud.net s3 sync ./dist s3://schedulettgt-static/ --exclude "index.html" --delete

# Шаг 2: Загружаем index.html отдельно с заголовками анти-кэширования
# Это КРИТИЧЕСКИ важный момент для работы PWA и исключения 404 ошибок
aws --endpoint-url=https://storage.yandexcloud.net s3 cp ./dist/index.html s3://schedulettgt-static/index.html \
    --metadata-directive REPLACE \
    --cache-control "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0"

echo "✅ Deployment completed!"
echo "🌐 Site URL: https://schedulettgt-static.website.yandexcloud.net"