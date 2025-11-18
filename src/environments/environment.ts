// Environment de DESARROLLO - Este archivo se usa por defecto
export const environment = {
    production: false,
    debug: true,
    api: {
        baseUrl: 'http://127.0.0.1:3000/api',
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
    console.log('🔧 Environment de DESARROLLO cargado:', {
        production: environment.production,
        apiUrl: environment.api.baseUrl,
        debug: environment.debug,
        timestamp: new Date().toISOString()
    });
}
