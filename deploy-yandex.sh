#!/bin/bash
echo "🚀 Building for Yandex Cloud..."

# Сборка проекта
npm run build

echo "📦 Uploading to Yandex Cloud..."

# Загрузка в Yandex Object Storage
aws --endpoint-url=https://storage.yandexcloud.net s3 sync ./dist s3://schedulettgt-static/ --delete

echo "✅ Deployment completed!"
echo "🌐 Site URL: https://storage.yandexcloud.net/schedulettgt-static/"