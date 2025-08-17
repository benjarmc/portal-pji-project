// Environment de DESARROLLO - Este archivo se usa por defecto
export const environment = {
    production: false,
    api: {
        baseUrl: 'http://127.0.0.1:3000/api',
        timeout: 30000,
    },
    vdid: {
        publicKey: 'pk_test_Qm3iR9607BpWD/UAP2Til1+5NCHA/yxvcZWtauDNHLE=',
        privateKey: 'sk_test_SWFRrKNc1vsPzvVuTe1zX3968L+Kg+N1HYpfmrXn164=',
        defaultVersion: 'v2'
    },
    openpay: {
        merchantId: 'moe7p2y5ycpz1jt71dxu',
        publicKey: 'pk_546e11f542f648a1a116b7d0007c06bf',
        sandboxMode: true
    }
};

// Verificar que este environment se esté usando
console.log('🔧 Environment de DESARROLLO cargado:', {
    production: environment.production,
    apiUrl: environment.api.baseUrl,
    timestamp: new Date().toISOString()
});
