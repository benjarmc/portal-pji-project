# Integración de VDID en el Backend

## Descripción

Este documento describe los endpoints que el backend debe implementar para manejar las validaciones de identidad usando VDID. El frontend se encarga solo de la visualización y el backend maneja toda la lógica de VDID.

## Endpoints Requeridos

### 1. POST `/api/validation/start`

**Descripción:** Inicia una nueva validación de identidad. El backend debe:
- Crear la verificación en VDID usando la API de Azure
- Enviar el enlace de verificación por email
- Almacenar la información en la base de datos

**Request Body:**
```json
{
  "name": "Juan Pérez",
  "email": "juan@ejemplo.com",
  "type": "arrendador", // "arrendador" | "arrendatario" | "aval"
  "quotationId": "uuid-de-la-cotizacion"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid-interno",
    "uuid": "uuid-de-vdid",
    "type": "arrendador",
    "status": "PENDING",
    "quotationId": "uuid-de-la-cotizacion",
    "name": "Juan Pérez",
    "email": "juan@ejemplo.com",
    "createdAt": "2024-01-15T10:30:00Z",
    "updatedAt": "2024-01-15T10:30:00Z"
  },
  "message": "Validación iniciada exitosamente"
}
```

### 2. GET `/api/validation/status/{uuid}`

**Descripción:** Obtiene el estado actual de una validación por UUID.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid-interno",
    "uuid": "uuid-de-vdid",
    "type": "arrendador",
    "status": "COMPLETED", // "PENDING" | "IN_PROGRESS" | "COMPLETED" | "FAILED"
    "quotationId": "uuid-de-la-cotizacion",
    "name": "Juan Pérez",
    "email": "juan@ejemplo.com",
    "createdAt": "2024-01-15T10:30:00Z",
    "updatedAt": "2024-01-15T10:35:00Z"
  }
}
```

### 3. GET `/api/validation/quotation/{quotationId}`

**Descripción:** Obtiene todas las validaciones de una cotización específica.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid-interno-1",
      "uuid": "uuid-de-vdid-1",
      "type": "arrendador",
      "status": "COMPLETED",
      "quotationId": "uuid-de-la-cotizacion",
      "name": "Juan Pérez",
      "email": "juan@ejemplo.com",
      "createdAt": "2024-01-15T10:30:00Z",
      "updatedAt": "2024-01-15T10:35:00Z"
    },
    {
      "id": "uuid-interno-2",
      "uuid": "uuid-de-vdid-2",
      "type": "aval",
      "status": "PENDING",
      "quotationId": "uuid-de-la-cotizacion",
      "name": "María García",
      "email": "maria@ejemplo.com",
      "createdAt": "2024-01-15T10:30:00Z",
      "updatedAt": "2024-01-15T10:30:00Z"
    }
  ]
}
```

### 4. POST `/api/validation/resend/{uuid}`

**Descripción:** Reenvía el enlace de verificación por email.

**Response:**
```json
{
  "success": true,
  "message": "Verificación reenviada exitosamente"
}
```

### 5. POST `/api/validation/complete/{uuid}`

**Descripción:** Marca una validación como completada (cuando VDID notifica que se completó).

**Request Body:**
```json
{
  "status": "COMPLETED",
  "verificationData": {
    // Datos de la verificación de VDID
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid-interno",
    "uuid": "uuid-de-vdid",
    "type": "arrendador",
    "status": "COMPLETED",
    "quotationId": "uuid-de-la-cotizacion",
    "name": "Juan Pérez",
    "email": "juan@ejemplo.com",
    "createdAt": "2024-01-15T10:30:00Z",
    "updatedAt": "2024-01-15T10:40:00Z"
  }
}
```

## Integración con VDID

### 1. Crear Verificación

El backend debe usar la API de VDID para crear verificaciones:

```typescript
// Ejemplo en NestJS
async createVerification(validationData: ValidationRequest) {
  const vdidResponse = await this.vdidService.createVerification({
    email: validationData.email,
    name: validationData.name,
    metadata: {
      type: validationData.type,
      quotationId: validationData.quotationId
    }
  });

  // Guardar en base de datos
  const validation = await this.validationRepository.save({
    uuid: vdidResponse.uuid,
    type: validationData.type,
    quotationId: validationData.quotationId,
    name: validationData.name,
    email: validationData.email,
    status: 'PENDING'
  });

  // Enviar email con enlace de verificación
  await this.emailService.sendVerificationEmail(
    validationData.email,
    vdidResponse.uuid
  );

  return validation;
}
```

### 2. Webhook de VDID

El backend debe implementar un webhook para recibir notificaciones cuando se complete una verificación:

```typescript
@Post('webhook/vdid')
async handleVdidWebhook(@Body() webhookData: any) {
  const { uuid, status } = webhookData;
  
  // Actualizar estado en base de datos
  await this.validationRepository.update(
    { uuid },
    { status, updatedAt: new Date() }
  );

  // Notificar al frontend si es necesario (WebSocket, etc.)
  
  return { success: true };
}
```

### 3. Verificación de Estado

El backend debe verificar periódicamente el estado de las validaciones pendientes:

```typescript
@Cron('*/30 * * * * *') // Cada 30 segundos
async checkPendingValidations() {
  const pendingValidations = await this.validationRepository.find({
    where: { status: 'PENDING' }
  });

  for (const validation of pendingValidations) {
    const status = await this.vdidService.getVerificationStatus(validation.uuid);
    
    if (status !== validation.status) {
      await this.validationRepository.update(
        { id: validation.id },
        { status, updatedAt: new Date() }
      );
    }
  }
}
```

## Base de Datos

### Tabla: validations

```sql
CREATE TABLE validations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uuid VARCHAR(255) NOT NULL UNIQUE, -- UUID de VDID
  type VARCHAR(50) NOT NULL, -- 'arrendador', 'arrendatario', 'aval'
  quotation_id UUID NOT NULL REFERENCES quotations(id),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
  metadata JSONB, -- Metadatos adicionales de la validación
  vdid_result JSONB, -- Resultado de la verificación de VDID
  completed_at TIMESTAMP, -- Fecha de completado
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_validations_quotation_id ON validations(quotation_id);
CREATE INDEX idx_validations_uuid ON validations(uuid);
CREATE INDEX idx_validations_status ON validations(status);
CREATE INDEX idx_validations_type ON validations(type);
CREATE INDEX idx_validations_created_at ON validations(created_at);
```

## Variables de Entorno

```env
# VDID Configuration
CLIENT_ID_VDID=tu_client_id_de_vdid
CLIENT_SECRET_VDID=tu_client_secret_de_vdid
VDID_DEFAULT_VERSION=v2
VDID_BASE_URL=https://veridocid.azure-api.net/api
VDID_TIMEOUT=30000
VDID_RETRY_ATTEMPTS=3

# Frontend URL (para redirects de VDID)
FRONTEND_URL=http://localhost:4200

# Email Configuration
EMAIL_SERVICE=resend
RESEND_API_KEY=tu_api_key_de_resend
```

## Flujo Completo

1. **Frontend** envía datos de validación al backend
2. **Backend** crea verificación en VDID
3. **Backend** envía email con enlace de verificación
4. **Usuario** completa verificación en VDID
5. **VDID** notifica al backend via webhook
6. **Backend** actualiza estado en base de datos
7. **Frontend** consulta estado y actualiza UI

## Notas Importantes

- El frontend NO debe tener acceso directo a la API de VDID
- Todas las comunicaciones con VDID deben pasar por el backend
- Implementar rate limiting para evitar spam
- Logging detallado de todas las operaciones
- Manejo de errores robusto
- Validación de datos de entrada
- Autenticación y autorización en todos los endpoints

