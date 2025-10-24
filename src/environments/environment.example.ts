export const environment = {
    production: false,
    debug: true, // Controlar logs: true para mostrar, false para ocultar
    vdid: {
        publicKey: 'TU_VDID_PUBLIC_KEY',
        privateKey: 'TU_VDID_PRIVATE_KEY',
        defaultVersion: 'v2'
    },
    openpay: {
        merchantId: 'TU_MERCHANT_ID',
        publicKey: 'TU_PUBLIC_API_KEY',
        sandboxMode: true
    }
};
