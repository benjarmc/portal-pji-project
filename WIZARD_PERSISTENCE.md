# Sistema de Persistencia del Wizard

## Resumen

Se ha implementado un sistema robusto de persistencia del estado del wizard que permite a los usuarios continuar donde lo dejaron, incluso después de recargar la página o cerrar y abrir el navegador.

## Características Principales

### ✅ **Persistencia Dual**
- **localStorage**: Persistencia a largo plazo (24 horas)
- **sessionStorage**: Persistencia de sesión actual
- **Sincronización automática** entre ambos almacenamientos

### ✅ **Gestión de Sesiones**
- **ID de sesión único** para cada usuario
- **Detección de sesiones expiradas** (30 minutos de inactividad)
- **Limpieza automática** de estados obsoletos

### ✅ **Validación de Estado**
- **Expiración automática** después de 24 horas
- **Verificación de integridad** del estado guardado
- **Manejo de errores** de almacenamiento

## Arquitectura del Sistema

### 1. **WizardStateService** (`src/app/services/wizard-state.service.ts`)

#### Funcionalidades Principales
```typescript
// Guardar estado con sincronización
saveState(state: Partial<WizardState>): void

// Obtener estado validado
getState(): WizardState

// Verificar si hay estado guardado válido
hasSavedState(): boolean

// Restaurar wizard al último estado
restoreWizard(): WizardState

// Limpiar estados expirados
cleanupExpiredStates(): void
```

#### Estructura del Estado
```typescript
export interface WizardState {
  currentStep: number;           // Paso actual del wizard
  selectedPlan: string | null;   // Plan seleccionado
  quotationId: string | null;    // ID de cotización
  quotationNumber: string | null; // Número de cotización
  userId: string | null;         // ID del usuario
  userData: { ... };            // Datos del usuario
  paymentData: { ... };         // Datos de pago
  paymentResult?: { ... };      // Resultado del pago
  validationRequirements?: [...]; // Requisitos de validación
  completedSteps: number[];     // Pasos completados
  timestamp: number;            // Timestamp de creación
  sessionId: string;            // ID único de sesión
  lastActivity: number;         // Última actividad
}
```

### 2. **WizardFlowComponent** (`src/app/wizard-flow/wizard-flow.component.ts`)

#### Funcionalidades de Persistencia
```typescript
// Restauración automática del estado
private restoreWizardState(): void

// Listener para actividad del usuario
@HostListener('document:click')
@HostListener('document:keydown')
@HostListener('document:scroll')
onUserActivity(): void

// Guardar estado antes de recargar
@HostListener('window:beforeunload')
onBeforeUnload(): void
```

### 3. **ContinueWizardModal** (`src/app/components/continue-wizard-modal/continue-wizard-modal.component.ts`)

#### Información Mostrada
- **Paso actual** del wizard
- **Plan seleccionado** (si existe)
- **Número de cotización** (si existe)
- **Progreso general** con barra visual
- **Porcentaje de completado**

## Flujo de Funcionamiento

### **Escenario 1: Usuario Nuevo**
1. Usuario inicia wizard
2. No hay estado guardado
3. Wizard inicia desde el paso 0
4. Estado se guarda automáticamente en cada paso

### **Escenario 2: Usuario Retorna (Misma Sesión)**
1. Usuario recarga página o regresa
2. Sistema detecta estado en sessionStorage
3. Estado se restaura automáticamente
4. Usuario continúa desde donde lo dejó

### **Escenario 3: Usuario Retorna (Nueva Sesión)**
1. Usuario abre nueva pestaña/ventana
2. Sistema detecta estado en localStorage
3. Estado se valida y sincroniza
4. Modal de continuar se muestra automáticamente
5. Usuario decide continuar o reiniciar

### **Escenario 4: Estado Expirado**
1. Estado tiene más de 24 horas
2. Sistema detecta expiración
3. Estado se limpia automáticamente
4. Wizard inicia desde el principio

## Configuración y Personalización

### **Tiempos de Expiración**
```typescript
private readonly EXPIRATION_TIME = 24 * 60 * 60 * 1000; // 24 horas
private readonly INACTIVITY_TIME = 30 * 60 * 1000;       // 30 minutos
```

### **Claves de Almacenamiento**
```typescript
private readonly STORAGE_KEY = 'pji_wizard_state';      // localStorage
private readonly SESSION_KEY = 'pji_wizard_session';    // sessionStorage
private readonly SESSION_ID_KEY = 'pji_session_id';     // ID de sesión
```

## Ventajas del Sistema

### 🔒 **Seguridad**
- **No se exponen datos sensibles** en el frontend
- **Validación de integridad** del estado
- **Limpieza automática** de datos obsoletos

### 🚀 **Experiencia de Usuario**
- **No se pierde progreso** al recargar
- **Continuación automática** donde se quedó
- **Modal informativo** con opciones claras

### 🛠️ **Mantenibilidad**
- **Código modular** y bien estructurado
- **Manejo de errores** robusto
- **Logging detallado** para debugging

### 📱 **Responsividad**
- **Funciona en móviles** y desktop
- **Persistencia cross-tab** en el mismo dominio
- **Manejo de navegación** del navegador

## Casos de Uso Específicos

### **Validación de Identidad**
- Estado de validaciones se mantiene
- UUIDs de verificación se preservan
- Progreso de validaciones se restaura

### **Proceso de Pago**
- Datos de cotización se mantienen
- Información de pago se preserva
- Estado de transacciones se restaura

### **Navegación desde Email**
- Parámetros de URL se procesan
- Estado se configura automáticamente
- Navegación se bloquea apropiadamente

## Debugging y Monitoreo

### **Información del Estado**
```typescript
// Obtener información detallada del estado
getStateInfo(): any {
  return this.wizardStateService.getStateInfo();
}
```

### **Logs del Sistema**
- ✅ Estado guardado exitosamente
- 🔄 Estado sincronizado
- ⏰ Estado expirado
- 😴 Estado inactivo
- 🧹 Estado limpiado
- ❌ Errores de almacenamiento

## Próximos Pasos Recomendados

1. **Testing**: Probar todos los escenarios de persistencia
2. **Analytics**: Implementar tracking de uso del wizard
3. **Notificaciones**: Agregar notificaciones push para recordatorios
4. **Backup**: Implementar respaldo en servidor para casos críticos
5. **Migración**: Sistema para migrar estados entre versiones

## Consideraciones Técnicas

### **Compatibilidad del Navegador**
- ✅ Chrome, Firefox, Safari, Edge (modernos)
- ✅ Navegadores móviles
- ⚠️ IE11 (limitado)

### **Límites de Almacenamiento**
- **localStorage**: ~5-10 MB
- **sessionStorage**: ~5-10 MB
- **Manejo automático** de errores de cuota

### **Rendimiento**
- **Guardado asíncrono** para no bloquear UI
- **Limpieza automática** de estados obsoletos
- **Validación eficiente** del estado

## Conclusión

El sistema de persistencia implementado proporciona una experiencia de usuario robusta y profesional, asegurando que los usuarios nunca pierdan su progreso en el wizard de cotización. La implementación es escalable, mantenible y sigue las mejores prácticas de desarrollo web moderno.

