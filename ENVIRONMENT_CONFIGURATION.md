# Configuración de Environments en Angular

## Problema Identificado

El sistema no estaba usando correctamente el environment de producción cuando se ejecutaba `ssr:production`, tomando siempre el environment de desarrollo.

## Solución Implementada

### 1. **Configuración de fileReplacements en angular.json**

Se agregó la configuración de `fileReplacements` para que Angular reemplace automáticamente el environment:

```json
"configurations": {
  "production": {
    "fileReplacements": [
      {
        "replace": "src/environments/environment.ts",
        "with": "src/environments/environment.prod.ts"
      }
    ]
  }
}
```

### 2. **Configuración del Servidor SSR**

También se configuró el servidor SSR para usar el environment correcto:

```json
"server": {
  "configurations": {
    "production": {
      "fileReplacements": [
        {
          "replace": "src/environments/environment.ts",
          "with": "src/environments/environment.prod.ts"
        }
      ]
    }
  }
}
```

### 3. **Scripts Corregidos en package.json**

```json
{
  "scripts": {
    "build:dev": "ng build --configuration development",
    "build:prod": "ng build --configuration production",
    "build:ssr:dev": "ng build --configuration development && ng run portal-pji-project:server:development",
    "build:ssr:prod": "ng build --configuration production && ng run portal-pji-project:server:production",
    "build:ssr:production": "ng build --configuration production && ng run portal-pji-project:server:production"
  }
}
```

## Cómo Usar los Environments

### **🔄 Desarrollo (Environment por defecto)**
```bash
# Build normal (usa environment.ts)
npm run build

# Build con configuración explícita de desarrollo
npm run build:dev

# Build SSR con desarrollo
npm run build:ssr:dev
```

### **🚀 Producción (Environment de producción)**
```bash
# Build con configuración de producción
npm run build:prod

# Build SSR con producción (RECOMENDADO)
npm run build:ssr:prod

# Build SSR con producción (alias)
npm run build:ssr:production
```

## Verificación del Environment

### **1. Logs en Consola**

Cada environment tiene logs distintivos:

- **🔧 Desarrollo**: `"Environment de DESARROLLO cargado"`
- **🚀 Producción**: `"Environment de PRODUCCIÓN cargado"`

### **2. URLs Diferentes**

- **Desarrollo**: `http://127.0.0.1:3000/api`
- **Producción**: `http://webjpi-backend-nqtehg-1f4f4f-72-167-143-166.traefik.me/api`

### **3. Script de Verificación**

Después del build, ejecuta:
```bash
node verify-environment.js
```

Este script verifica qué environment se usó en el build final.

## Estructura de Archivos

```
src/environments/
├── environment.ts          # 🔧 DESARROLLO (por defecto)
├── environment.prod.ts     # 🚀 PRODUCCIÓN
└── environment.example.ts  # 📋 Ejemplo
```

## Flujo de Build

### **Build de Desarrollo**
```
ng build --configuration development
├─ Usa environment.ts
├─ API: 127.0.0.1:3000
└─ Log: "Environment de DESARROLLO cargado"
```

### **Build de Producción**
```
ng build --configuration production
├─ Reemplaza environment.ts → environment.prod.ts
├─ API: webjpi-backend-nqtehg-1f4f4f-72-167-143-166.traefik.me
└─ Log: "Environment de PRODUCCIÓN cargado"
```

### **Build SSR de Producción**
```
ng build --configuration production && ng run portal-pji-project:server:production
├─ Build del cliente con environment.prod.ts
├─ Build del servidor con environment.prod.ts
└─ Ambos usan configuración de producción
```

## Troubleshooting

### **❌ Problema: Sigue usando environment de desarrollo**

**Causas posibles:**
1. No se especificó `--configuration production`
2. Cache de Angular no se limpió
3. Configuración de fileReplacements incorrecta

**Soluciones:**
```bash
# Limpiar cache y dist
rm -rf dist/
rm -rf .angular/

# Rebuild con configuración explícita
npm run build:ssr:prod

# Verificar que se usó el environment correcto
node verify-environment.js
```

### **❌ Problema: Build falla con environment de producción**

**Causas posibles:**
1. Variables de environment no definidas
2. Errores de sintaxis en environment.prod.ts
3. Dependencias faltantes

**Soluciones:**
```bash
# Verificar sintaxis
npx tsc --noEmit src/environments/environment.prod.ts

# Build paso a paso
npm run build:prod
npm run build:ssr:prod
```

## Configuración Avanzada

### **Variables de Entorno**

Para usar variables de entorno del sistema:

```typescript
// environment.prod.ts
export const environment = {
  production: true,
  api: {
    baseUrl: process.env.API_URL || 'http://webjpi-backend-nqtehg-1f4f4f-72-167-143-166.traefik.me/api',
    timeout: parseInt(process.env.API_TIMEOUT) || 30000,
  }
};
```

### **Múltiples Configuraciones**

Puedes crear más configuraciones:

```json
"configurations": {
  "staging": {
    "fileReplacements": [
      {
        "replace": "src/environments/environment.ts",
        "with": "src/environments/environment.staging.ts"
      }
    ]
  }
}
```

## Comandos Útiles

### **Build y Verificación**
```bash
# Build de producción
npm run build:ssr:prod

# Verificar environment usado
node verify-environment.js

# Servir SSR
npm run serve:ssr
```

### **Desarrollo**
```bash
# Build de desarrollo
npm run build:ssr:dev

# Servir con hot reload
npm start
```

### **Limpieza**
```bash
# Limpiar build
rm -rf dist/

# Limpiar cache de Angular
rm -rf .angular/
```

## Conclusión

Con la configuración implementada:

- ✅ **Los environments se usan correctamente** según la configuración
- ✅ **El build de producción** usa `environment.prod.ts`
- ✅ **El build de desarrollo** usa `environment.ts`
- ✅ **La verificación es fácil** con logs y scripts
- ✅ **La configuración es robusta** y mantenible

**Para usar producción, siempre ejecuta:**
```bash
npm run build:ssr:prod
```

**Para verificar, ejecuta:**
```bash
node verify-environment.js
```
