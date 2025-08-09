# Configuración de OpenPay

## 📋 Requisitos Previos

1. Tener una cuenta en [OpenPay](https://www.openpay.mx/)
2. Obtener las credenciales de tu cuenta:
   - Merchant ID
   - Public API Key

## 🔧 Configuración

### 1. Crear archivos de environment

Copia el archivo de ejemplo y renómbralo:

```bash
cp src/environments/environment.example.ts src/environments/environment.ts
cp src/environments/environment.example.ts src/environments/environment.prod.ts
```

### 2. Configurar credenciales

Edita `src/environments/environment.ts` para desarrollo:

```typescript
export const environment = {
    production: false,
    vdid: {
        publicKey: 'TU_VDID_PUBLIC_KEY',
        privateKey: 'TU_VDID_PRIVATE_KEY',
        defaultVersion: 'v2'
    },
    openpay: {
        merchantId: 'TU_MERCHANT_ID_DEV',
        publicKey: 'TU_PUBLIC_API_KEY_DEV',
        sandboxMode: true  // true para pruebas
    }
};
```

Edita `src/environments/environment.prod.ts` para producción:

```typescript
export const environment = {
    production: true,
    vdid: {
        publicKey: 'TU_VDID_PUBLIC_KEY',
        privateKey: 'TU_VDID_PRIVATE_KEY',
        defaultVersion: 'v2'
    },
    openpay: {
        merchantId: 'TU_MERCHANT_ID_PROD',
        publicKey: 'TU_PUBLIC_API_KEY_PROD',
        sandboxMode: false  // false para producción
    }
};
```

### 3. Obtener credenciales de OpenPay

1. Inicia sesión en tu [panel de OpenPay](https://www.openpay.mx/)
2. Ve a **Configuración > Credenciales**
3. Copia tu **Merchant ID** y **Public API Key**

### 4. Tarjetas de prueba (Sandbox)

Para probar en modo sandbox, usa estas tarjetas:

- **Visa**: 4111111111111111
- **Mastercard**: 5555555555554444
- **CVV**: Cualquier número de 3 dígitos
- **Fecha de expiración**: Cualquier fecha futura

## 🚀 Uso

La integración está lista para usar. El servicio `OpenPayService` maneja:

- ✅ Validación de tarjetas en tiempo real
- ✅ Creación de tokens seguros
- ✅ Detección de fraude con device data
- ✅ Manejo de errores
- ✅ Compatibilidad con SSR

## 🔒 Seguridad

- ✅ Las credenciales están en environment files
- ✅ Los archivos de environment están en .gitignore
- ✅ Solo se usan las claves públicas en el frontend
- ✅ Los tokens se crean sin pasar por tu servidor

## 📞 Soporte

Para problemas con OpenPay, contacta a su soporte técnico.
