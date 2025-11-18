# Etapa 1: Build de Angular (sin SSR)
FROM node:22-alpine AS builder
WORKDIR /app

# Copiar los archivos de dependencias
COPY package*.json ./
RUN npm install --legacy-peer-deps

# Copiar el resto del código y construir la app
COPY . .
RUN npm run build:prod

# Etapa 2: Imagen final con Nginx
FROM nginx:alpine

# Instalar wget para el healthcheck
RUN apk add --no-cache wget

# Copiar la configuración de nginx
COPY nginx.conf /etc/nginx/nginx.conf

# Copiar los archivos compilados del build
COPY --from=builder /app/dist/portal-pji-project/browser /usr/share/nginx/html

# Verificar que index.html existe
RUN ls -la /usr/share/nginx/html/ | head -20 || true

# Exponer el puerto 80
EXPOSE 80

# Healthcheck para verificar que nginx está funcionando
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost/ || exit 1

# Iniciar nginx en primer plano
CMD ["nginx", "-g", "daemon off;"]
