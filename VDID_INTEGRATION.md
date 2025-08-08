# Integración VDID SDK en Portal PJI Project

## 📋 Descripción

Esta integración implementa el SDK `vdid-sdk-web` de Suma México para verificación de identidad en el proyecto Angular Portal PJI.

## 🚀 Instalación

El paquete ya está instalado. Si necesitas reinstalarlo:

```bash
npm install vdid-sdk-web
```

## ⚙️ Configuración

### 1. Configurar Public Key

Edita el archivo `src/environments/environment.ts`:

```typescript
export const environment = {
  production: false,
  vdid: {
    publicKey: 'TU_PUBLIC_KEY_REAL_AQUI', // Tu public key de VDID
    privateKey: 'TU_PRIVATE_KEY_AQUI', // Tu private key (para uso interno)
    defaultVersion: 'v2'
  }
};
```

### 2. Configuración de Producción

Crea `src/environments/environment.prod.ts`:

```typescript
export const environment = {
  production: true,
  vdid: {
    apiKey: 'TU_API_KEY_PRODUCCION',
    defaultVersion: 'v2'
  }
};
```

## 🔧 Uso del Servicio

### Inicialización

```typescript
import { VdidService } from './services/vdid.service';

constructor(private vdidService: VdidService) {
  // Inicializar con la configuración del entorno
  this.vdidService.initialize({
    publicKey: environment.vdid.publicKey,
    version: environment.vdid.defaultVersion
  });
}
```

### Métodos Disponibles

#### 1. Verificación de Identidad
```typescript
// Redirección directa
this.vdidService.verifyIdentity(uuid).subscribe({
  next: () => console.log('Verificación iniciada'),
  error: (error) => console.error('Error:', error)
});

// En popup
this.vdidService.verifyIdentity(uuid, { method: 'popup' }).subscribe();
```

#### 2. Obtener URL de Verificación
```typescript
const url = this.vdidService.getVerificationUrl(uuid);
console.log('URL de verificación:', url);
```

#### 3. Enviar por Email
```typescript
this.vdidService.sendVerificationEmail(uuid, 'usuario@ejemplo.com').subscribe({
  next: () => console.log('Email enviado'),
  error: (error) => console.error('Error:', error)
});
```

#### 4. Captura de Imágenes
```typescript
// Para ID (frente y reverso)
const url = this.vdidService.getImageCaptureUrl({ typeId: 'id' });

// Para pasaporte (una foto)
const url = this.vdidService.getImageCaptureUrl({ typeId: 'passport' });
```

## 🎨 Uso del Componente

### Integración Básica

```html
<app-vdid-integration
  [publicKey]="'TU_PUBLIC_KEY'"
  (verificationStarted)="onVerificationStarted($event)"
  (verificationCompleted)="onVerificationCompleted($event)">
</app-vdid-integration>
```

### En el Wizard

El componente ya está integrado en el paso de validación (`validation-step`). Para mostrarlo:

```typescript
// En validation-step.component.ts
showVdidIntegration = true;
```

## 📱 Funcionalidades Disponibles

### ✅ Verificación Completa
- Redirección directa al flujo de verificación
- Apertura en popup modal
- Soporte para versiones v1 y v2 del diseño

### ✅ Envío por Email
- Envío automático de URL de verificación
- Configuración de email personalizado

### ✅ Captura de Imágenes
- Captura específica para ID (frente y reverso)
- Captura específica para pasaporte
- Configuración de altura personalizable (solo v1)

### ✅ Gestión de URLs
- Generación de URLs de verificación
- Copia al portapapeles
- Apertura en nueva pestaña

## 🔒 Seguridad

### Public Key
- **NUNCA** incluyas la private key en el código fuente
- La public key es segura para usar en el frontend
- Usa variables de entorno para ambas keys
- Configura diferentes keys para desarrollo y producción

### Validación
- El servicio valida que el SDK esté inicializado antes de usar
- Manejo de errores robusto
- Logs detallados para debugging

## 🐛 Troubleshooting

### Error: "VDID SDK no ha sido inicializado"
```typescript
// Asegúrate de llamar initialize() antes de usar otros métodos
this.vdidService.initialize({
  apiKey: 'tu-api-key',
  version: 'v2'
});
```

### Error: "Public Key inválida"
- Verifica que la public key sea correcta
- Contacta a Suma México para obtener keys válidas
- Asegúrate de que la key tenga permisos para el dominio

### Problemas con Popup
- Algunos navegadores bloquean popups
- Usa redirección directa como alternativa
- Verifica la configuración del navegador

## 📞 Soporte

- **Documentación oficial**: [npmjs.com/package/vdid-sdk-web](https://www.npmjs.com/package/vdid-sdk-web)
- **Demo oficial**: [github.com/Suma-Mexico/demo-vdid-sdk-web](https://github.com/Suma-Mexico/demo-vdid-sdk-web)
- **Soporte técnico**: Contactar a Suma México

## 🔄 Versiones

- **v2.0.1** (actual): Diseño v2 por defecto, optimizaciones de rendimiento
- **v2.0.0**: Nuevo parámetro de selección de diseño
- **v1.x**: Diseño legacy

## 📝 Notas Importantes

1. **Public Key requerida**: Debes obtener una public key de Suma México
2. **Private Key**: Mantén tu private key segura, solo se usa en el backend
3. **Dominio autorizado**: Las keys deben estar configuradas para tu dominio
4. **HTTPS requerido**: En producción, el sitio debe usar HTTPS
5. **Compatibilidad**: Funciona en navegadores modernos (Chrome, Firefox, Safari, Edge)

## 🚀 Próximos Pasos

1. Obtener public key y private key de Suma México
2. Configurar las keys en `environment.ts`
3. Probar la integración en desarrollo
4. Configurar para producción
5. Implementar manejo de callbacks de verificación 