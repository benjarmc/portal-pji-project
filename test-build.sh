#!/bin/bash

echo "🧪 Probando build SSR del proyecto..."

# Limpiar builds anteriores
echo "📁 Limpiando builds anteriores..."
rm -rf dist/

# Instalar dependencias si es necesario
echo "📦 Verificando dependencias..."
npm install --legacy-peer-deps

# Ejecutar build SSR
echo "🔨 Ejecutando build SSR..."
npm run build:ssr

# Verificar que se crearon los archivos necesarios
echo "✅ Verificando archivos generados..."
if [ -f "dist/portal-pji-project/server/server.mjs" ]; then
    echo "✅ Servidor SSR generado correctamente"
else
    echo "❌ Error: No se generó el servidor SSR"
    exit 1
fi

if [ -f "dist/portal-pji-project/browser/index.html" ]; then
    echo "✅ Aplicación browser generada correctamente"
else
    echo "❌ Error: No se generó la aplicación browser"
    exit 1
fi

echo "🎉 Build SSR completado exitosamente!"
echo "📁 Archivos generados en: dist/portal-pji-project/"
echo "🚀 Para ejecutar: node dist/portal-pji-project/server/server.mjs"
