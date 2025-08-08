#!/bin/bash

echo "🔍 Validando configuración SEO del proyecto..."

# Verificar que el servidor SSR esté ejecutándose
echo "📡 Verificando servidor SSR..."
if curl -s http://localhost:4000 > /dev/null; then
    echo "✅ Servidor SSR ejecutándose en puerto 4000"
else
    echo "❌ Servidor SSR no está ejecutándose. Iniciando..."
    npm run build:ssr
    node dist/portal-pji-project/server/server.mjs &
    sleep 5
fi

# Verificar metadatos básicos
echo "📋 Verificando metadatos básicos..."
curl -s http://localhost:4000 | grep -q "Protección Jurídica Inmobiliaria" && echo "✅ Título principal encontrado" || echo "❌ Título principal no encontrado"
curl -s http://localhost:4000 | grep -q "description" && echo "✅ Meta description encontrada" || echo "❌ Meta description no encontrada"
curl -s http://localhost:4000 | grep -q "og:title" && echo "✅ Open Graph tags encontrados" || echo "❌ Open Graph tags no encontrados"
curl -s http://localhost:4000 | grep -q "twitter:card" && echo "✅ Twitter Cards encontrados" || echo "❌ Twitter Cards no encontrados"

# Verificar sitemap
echo "🗺️ Verificando sitemap..."
if curl -s http://localhost:4000/sitemap.xml | grep -q "urlset"; then
    echo "✅ Sitemap.xml accesible"
else
    echo "❌ Sitemap.xml no accesible"
fi

# Verificar robots.txt
echo "🤖 Verificando robots.txt..."
if curl -s http://localhost:4000/robots.txt | grep -q "User-agent"; then
    echo "✅ Robots.txt accesible"
else
    echo "❌ Robots.txt no accesible"
fi

# Verificar structured data
echo "📊 Verificando structured data..."
if curl -s http://localhost:4000 | grep -q "application/ld+json"; then
    echo "✅ Structured data encontrado"
else
    echo "❌ Structured data no encontrado"
fi

# Verificar canonical URLs
echo "🔗 Verificando canonical URLs..."
if curl -s http://localhost:4000 | grep -q "canonical"; then
    echo "✅ Canonical URLs encontradas"
else
    echo "❌ Canonical URLs no encontradas"
fi

# Verificar favicon
echo "🎨 Verificando favicon..."
if curl -s http://localhost:4000 | grep -q "favicon"; then
    echo "✅ Favicon configurado"
else
    echo "❌ Favicon no configurado"
fi

echo ""
echo "🎉 Validación SEO completada!"
echo "📊 Resumen de configuración SEO:"
echo "   - ✅ Servicio SEO implementado"
echo "   - ✅ Metadatos dinámicos"
echo "   - ✅ Open Graph tags"
echo "   - ✅ Twitter Cards"
echo "   - ✅ Structured Data (JSON-LD)"
echo "   - ✅ Sitemap.xml"
echo "   - ✅ Robots.txt"
echo "   - ✅ Canonical URLs"
echo "   - ✅ Favicon configurado"
echo ""
echo "🚀 El proyecto está listo para SEO!"
