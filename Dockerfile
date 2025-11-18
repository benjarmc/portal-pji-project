# Etapa 1: Build de Angular
FROM node:22-alpine AS builder

WORKDIR /app

# Copiar solo los archivos necesarios
COPY package*.json ./

RUN npm install --legacy-peer-deps

# Copiar el resto del código y construir la app
COPY . .

RUN npm run build -- --configuration production

# Etapa 2: Servidor NGINX para servir archivos estáticos
FROM nginx:stable-alpine

COPY --from=builder /app/dist/portal-pji-project/browser /usr/share/nginx/html

COPY nginx.conf /etc/nginx/nginx.conf

# Exponer el puerto (no obligatorio en Dokploy, pero recomendable para claridad)
EXPOSE 80

# Comando por defecto
CMD ["nginx", "-g", "daemon off;"]
