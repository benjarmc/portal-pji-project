// Environment de PRODUCCIÓN - Este archivo se usa cuando se ejecuta ng build --configuration production
export const environment = {
    production: true,
    debug: true,
    api: {
        baseUrl: 'https://backend.pjionline.com.mx/api',
        timeout: 30000,
        apiKey: 'dev-frontend-api-key-12345',
    },
    openpay: {
        merchantId: 'maklddlcpad3qzj7n5o5',
        publicKey: 'pk_7fbdc5d5b1654266af05acc3a3e8dca5',
        sandboxMode: true
    }
};

// Verificar que este environment se esté usando
if (environment.debug) {
    console.log('🚀 Environment de PRODUCCIÓN cargado:', {
        production: environment.production,
        apiUrl: environment.api.baseUrl,
        debug: environment.debug,
        timestamp: new Date().toISOString()
    });
}
