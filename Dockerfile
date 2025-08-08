# Etapa 1: Build de Angular Universal
FROM node:18-alpine AS builder
WORKDIR /app

# Copiar los archivos de dependencias
COPY package*.json ./
RUN npm install --legacy-peer-deps

# Copiar el resto del código y construir la app SSR
COPY . .
RUN npm run build:ssr

# Etapa 2: Imagen final para producción SSR
FROM node:18-alpine
WORKDIR /app

# Copiar el build SSR y node_modules
COPY --from=builder /app/dist/portal-pji-project /app/dist/portal-pji-project
COPY --from=builder /app/node_modules /app/node_modules

# Exponer el puerto por defecto de Angular Universal
EXPOSE 4000

# Comando por defecto para iniciar el servidor SSR
CMD ["node", "dist/portal-pji-project/server/server.mjs"]
