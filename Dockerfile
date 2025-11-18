# Etapa 1: Build de Angular Universal
FROM node:18-alpine AS builder
WORKDIR /app

# Copiar los archivos de dependencias
COPY package*.json ./
RUN npm install --legacy-peer-deps

# Copiar el resto del código y construir la app SSR
COPY . .
RUN npm run build:ssr:production

# Etapa 2: Imagen final para producción SSR
FROM node:18-alpine
WORKDIR /app

# Crear usuario no-root para seguridad
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copiar solo los archivos necesarios para producción
COPY --from=builder --chown=nodejs:nodejs /app/dist/portal-pji-project /app/dist/portal-pji-project
COPY --from=builder --chown=nodejs:nodejs /app/package*.json ./

# Instalar solo dependencias de producción (sin devDependencies)
RUN npm install --only=production --legacy-peer-deps && \
    npm cache clean --force

# Cambiar al usuario no-root
USER nodejs

# Exponer el puerto (configurable via variable de entorno)
EXPOSE 4000

# Variable de entorno para el puerto
ENV PORT=4000
ENV NODE_ENV=production

# Healthcheck para verificar que el servidor está funcionando
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:4000/', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Comando por defecto para iniciar el servidor SSR
CMD ["node", "dist/portal-pji-project/server/main.js"]
