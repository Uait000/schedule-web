#!/bin/bash
echo "🚀 Starting deployment to Yandex Cloud..."

# Сборка проекта
echo "📦 Building project..."
npm run build

# Проверка сборки
if [ ! -d "dist" ]; then
    echo "❌ Build failed - dist folder not found"
    exit 1
fi

# Загрузка в Yandex Object Storage
echo "📤 Uploading to Yandex Cloud..."
aws --endpoint-url=https://storage.yandexcloud.net s3 sync ./dist s3://schedulettgt-static/ --delete

# Настройка прав доступа
echo "🔧 Setting permissions..."
aws --endpoint-url=https://storage.yandexcloud.net s3 cp s3://schedulettgt-static/index.html s3://schedulettgt-static/index.html --metadata-directive REPLACE --content-type "text/html" --acl public-read

echo "✅ Deployment completed!"
echo "🌐 Site URL: https://storage.yandexcloud.net/schedulettgt-static/"