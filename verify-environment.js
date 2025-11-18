#!/usr/bin/env node

/**
 * Script para verificar que se esté usando el environment correcto
 * Ejecutar después del build para confirmar que se usó environment.prod.ts
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Verificando environment usado en el build...\n');

// Verificar si existe el build de producción
const buildPath = path.join(__dirname, 'dist/portal-pji-project/browser');

if (!fs.existsSync(buildPath)) {
    console.log('❌ No se encontró el directorio de build. Ejecuta primero: npm run build:prod');
    process.exit(1);
}

// Verificar archivos principales
const mainJsPath = path.join(buildPath, 'main.js');

console.log('📁 Verificando archivos de build...');

if (fs.existsSync(mainJsPath)) {
    const mainContent = fs.readFileSync(mainJsPath, 'utf8');
    if (mainContent.includes('webjpi-backend-nqtehg-1f4f4f-72-167-143-166.traefik.me')) {
        console.log('✅ main.js: Environment de PRODUCCIÓN detectado');
    } else if (mainContent.includes('127.0.0.1:3000')) {
        console.log('⚠️  main.js: Environment de DESARROLLO detectado');
    } else {
        console.log('❓ main.js: Environment no identificado');
    }
} else {
    console.log('❌ main.js no encontrado');
}

// Verificar logs de environment
console.log('\n🔍 Buscando logs de environment en los archivos...');

const searchInFile = (filePath, searchTerm) => {
    if (!fs.existsSync(filePath)) return false;
    const content = fs.readFileSync(filePath, 'utf8');
    return content.includes(searchTerm);
};

const prodUrl = 'webjpi-backend-nqtehg-1f4f4f-72-167-143-166.traefik.me';
const devUrl = '127.0.0.1:3000';

if (searchInFile(mainJsPath, prodUrl)) {
    console.log('✅ main.js contiene URL de PRODUCCIÓN');
} else if (searchInFile(mainJsPath, devUrl)) {
    console.log('⚠️  main.js contiene URL de DESARROLLO');
}

console.log('\n📋 Resumen de verificación:');
console.log('Para usar environment de PRODUCCIÓN, ejecuta: npm run build:prod');
console.log('Para usar environment de DESARROLLO, ejecuta: npm run build:dev');
console.log('Para verificar después del build, ejecuta: node verify-environment.js');
