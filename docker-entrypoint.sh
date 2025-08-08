#!/bin/sh

# Iniciar nginx en segundo plano
echo "Iniciando nginx..."
nginx

# Iniciar el servidor de desarrollo de Angular
echo "Iniciando servidor de desarrollo Angular..."
npm start
