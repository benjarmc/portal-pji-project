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
        merchantId: 'moe7p2y5ycpz1jt71dxu',
        publicKey: 'pk_546e11f542f648a1a116b7d0007c06bf',
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
