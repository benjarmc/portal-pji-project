import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject, Observable, of, catchError, Subject } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { ApiService, ApiResponse } from './api.service';
import { WizardSessionService, WizardSessionData } from './wizard-session.service';
import { LoggerService } from './logger.service';
export interface WizardState {
  // Campos principales del backend (estructura completa)
  id?: string;                    // UUID generado por el backend
  sessionId: string;              // ID único de sesión
  userId?: string;                // ID del usuario
  currentStep: number;            // Paso actual (0-9)
  stepData: WizardStepData;       // Datos de cada paso
  completedSteps: number[];       // Array de pasos completados
  status: string;                  // ACTIVE, COMPLETED, ABANDONED, EXPIRED
  expiresAt?: Date;               // Fecha de expiración
  quotationId?: string;           // ID de cotización
  policyId?: string;              // ID de póliza
  metadata?: object;              // Metadatos adicionales
  publicIp?: string;              // IP pública
  userAgent?: string;             // User agent
  lastActivityAt?: Date;          // Última actividad
  completedAt?: Date;             // Fecha de completado
  createdAt?: Date;               // Fecha de creación
  updatedAt?: Date;               // Fecha de actualización
  
  // Campos de control del frontend (para compatibilidad temporal)
  timestamp: number;               // Timestamp local para control de estado
  lastActivity: number;            // Timestamp local para control de actividad
  
  // Campos derivados (calculados desde stepData para compatibilidad)
  selectedPlan?: string;          // Campo principal de la API
  selectedPlanName?: string;      // Nombre del plan para mostrar al usuario
  quotationNumber?: string;       // = stepData.step3?.quotationNumber
  userData?: any;                 // = stepData.step1 (datos del usuario)
  
  // ✅ SEGURIDAD: Solo indicadores de pago, NO datos completos
  // Los datos completos se mantienen solo en el backend
  hasPaymentData?: boolean;       // Indica si existe paymentData en el backend
  hasPaymentResult?: boolean;     // Indica si existe paymentResult en el backend
  paymentStatus?: string;         // Estado del pago: 'COMPLETED', 'PENDING', 'FAILED', etc.
  paymentAmount?: number;         // Monto del pago (sin datos sensibles)
  
  // ✅ SEGURIDAD: Solo indicadores de contrato y validación
  hasContractData?: boolean;      // Indica si existe contractData en el backend
  hasValidationResult?: boolean;  // Indica si existe validationResult en el backend
  validationStatus?: string;      // Estado de validación: 'COMPLETED', 'PENDING', 'FAILED', etc.
  
  // ⚠️ COMPATIBILIDAD LOCAL: Estos campos solo se usan localmente en el frontend
  // NO se envían al backend, solo se usan para la UI
  // El backend solo recibe indicadores (hasPaymentData, hasPaymentResult, etc.)
  paymentData?: any;              // Solo para uso local en UI (NO se envía al backend)
  paymentResult?: any;            // Solo para uso local en UI (NO se envía al backend)
  contractData?: any;             // Solo para uso local en UI (NO se envía al backend)
  
  // Campos adicionales para compatibilidad (deprecated - usar stepData)
  policyNumber?: string;          // = stepData.step5?.policyNumber
  validationResult?: any;        // = stepData.step5?.validationData (solo para UI, no datos sensibles)
  validationRequirements?: ValidationRequirement[]; // = stepData.step5?.validationRequirements
  captureData?: {                // Datos de captura del paso 5 (solo para UI local)
    propietario?: any;
    inquilino?: any;
    fiador?: any;
    inmueble?: any;
  };
}

export interface ValidationRequirement {
  type: 'arrendador' | 'arrendatario' | 'aval';
  name: string;
  required: boolean;
  completed: boolean;
  uuid?: string;
}

export interface WizardStepData {
  step0?: { 
    tipoUsuario: string; 
    timestamp?: Date;
  };
  step1?: { 
    // Inputs del formulario de datos principales
    nombre?: string;
    telefono?: string;
    correo?: string;
    rentaMensual?: number;
    complementos?: string[];
    selectedPlan?: string;
    selectedPlanName?: string;
    timestamp?: Date;
  };
  step2?: { 
    // Inputs del paso de pago
    paymentMethod?: string;
    cardData?: any;
    timestamp?: Date;
  };
  step3?: { 
    // Inputs del paso de validación
    validationCode?: string;
    quotationId?: string;
    quotationNumber?: string;
    timestamp?: Date;
  };
  step4?: { 
    // Inputs del paso de Buro de Crédito
    buroCreditoId?: string;
    consultaData?: any;
    respuestaData?: any;
    status?: string;
    timestamp?: Date;
  };
  step5?: { 
    // Inputs del paso de captura de datos
    propietario?: any;
    inquilino?: any;
    fiador?: any;
    inmueble?: any;
    timestamp?: Date;
  };
  step6?: { 
    // Inputs del paso de validación
    validationRequirements?: ValidationRequirement[];
    policyNumber?: string;
    validationResult?: any;
    timestamp?: Date;
  };
  step7?: { 
    // Inputs del paso de contrato
    contractTerms?: any;
    signatures?: any;
    timestamp?: Date;
  };
  step8?: { 
    // Inputs del paso final
    deliveryPreferences?: any;
    timestamp?: Date;
  };
}

@Injectable({
  providedIn: 'root'
})
export class WizardStateService {
  private readonly SESSION_KEY = 'pji_wizard_state';
  private readonly TRANSACTION_PREFIX = 'pji_txn_';
  private readonly API_ENDPOINT = '/wizard-session';
  
  // Subject para notificar cambios en el estado
  private stateSubject = new BehaviorSubject<WizardState | null>(null);
  public stateChanges$: Observable<WizardState | null> = this.stateSubject.asObservable();
  
  // Configuración de expiración
  private readonly SESSION_TIMEOUT = 24 * 60 * 60 * 1000; // 24 horas de inactividad
  private syncInProgress = false;
  
  // Debounce para actividad del usuario
  private activitySubject = new Subject<void>();
  private activityDebounceTime = 2000; // 2 segundos
  
  // ✅ Sistema de cola para sincronización con backend (evita errores 429)
  private syncSubject = new Subject<{ state: WizardState; isCritical: boolean }>();
  private syncDebounceTime = 5000; // 5 segundos de debounce para sincronización (aumentado para evitar 429)
  private pendingSyncState: WizardState | null = null;
  private pendingSyncIsCritical: boolean = false;
  private syncPromise: Promise<WizardState> | null = null;
  private lastSyncTime: number = 0;
  private minTimeBetweenSyncs = 10000; // Mínimo 10 segundos entre sincronizaciones (aumentado para evitar 429)
  private syncQueue: Array<{ state: WizardState; isCritical: boolean; resolve: (value: WizardState) => void; reject: (error: any) => void }> = [];
  private isProcessingQueue = false;
  private consecutive429Errors = 0;
  private backoffMultiplier = 1; // Multiplicador para backoff exponencial
  private maxBackoffMultiplier = 8; // Máximo 8x el tiempo normal

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private apiService: ApiService,
    private wizardSessionService: WizardSessionService,
    private logger: LoggerService
  ) {
    this.initializeState();
    this.setupActivityDebounce();
    this.setupSyncDebounce();
  }

  /**
   * Inicializa el estado del wizard
   */
  private initializeState(): void {
    const initialState = this.getState();
    this.stateSubject.next(initialState);
    
    // Actualizar actividad al inicializar
    if (initialState) {
      this.updateActivity();
    }
  }

  /**
   * Configura el debounce para la actividad del usuario
   */
  private setupActivityDebounce(): void {
    this.activitySubject.pipe(
      debounceTime(this.activityDebounceTime)
    ).subscribe(() => {
      this.updateActivityDebounced();
    });
  }

  /**
   * Configura el debounce para sincronización con backend
   * Evita múltiples llamadas rápidas que causan errores 429
   * ✅ MEJORADO: Sistema de cola con priorización y backoff exponencial
   */
  private setupSyncDebounce(): void {
    this.syncSubject.pipe(
      debounceTime(this.syncDebounceTime)
    ).subscribe(async (data) => {
      if (this.pendingSyncState && this.syncPromise) {
        try {
          // Agregar a la cola si hay una sincronización en progreso
          if (this.syncInProgress) {
            this.addToQueue(this.pendingSyncState, this.pendingSyncIsCritical, this.syncPromise);
            this.pendingSyncState = null;
            this.pendingSyncIsCritical = false;
            this.syncPromise = null;
            return;
          }

          const syncedState = await this.executeSync(this.pendingSyncState);
          // Resolver la promesa pendiente con el estado sincronizado
          const promise = this.syncPromise as any;
          if (promise.resolve) {
            promise.resolve(syncedState);
          }
          this.pendingSyncState = null;
          this.pendingSyncIsCritical = false;
          this.syncPromise = null;

          // Procesar cola después de sincronizar
          this.processQueue();
        } catch (error) {
          this.logger.error('❌ Error en sincronización con debounce:', error);
          const promise = this.syncPromise as any;
          if (promise.reject) {
            promise.reject(error);
          }
          this.pendingSyncState = null;
          this.pendingSyncIsCritical = false;
          this.syncPromise = null;

          // Procesar cola incluso si hay error
          this.processQueue();
        }
      }
    });
  }

  /**
   * Agrega una sincronización a la cola
   */
  private addToQueue(state: WizardState, isCritical: boolean, promise: Promise<WizardState>): void {
    const promiseWithCallbacks = promise as any;
    this.syncQueue.push({
      state,
      isCritical,
      resolve: promiseWithCallbacks.resolve || (() => {}),
      reject: promiseWithCallbacks.reject || (() => {})
    });

    // Ordenar cola: cambios críticos primero
    this.syncQueue.sort((a, b) => {
      if (a.isCritical && !b.isCritical) return -1;
      if (!a.isCritical && b.isCritical) return 1;
      return 0;
    });

    this.logger.log(`📋 Sincronización agregada a cola. Tamaño: ${this.syncQueue.length}, Crítica: ${isCritical}`);
  }

  /**
   * Procesa la cola de sincronizaciones
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue || this.syncQueue.length === 0 || this.syncInProgress) {
      return;
    }

    this.isProcessingQueue = true;

    while (this.syncQueue.length > 0 && !this.syncInProgress) {
      const item = this.syncQueue.shift();
      if (!item) break;

      try {
        this.logger.log(`🔄 Procesando sincronización de cola (${this.syncQueue.length} pendientes, Crítica: ${item.isCritical})`);
        const syncedState = await this.executeSync(item.state);
        item.resolve(syncedState);
      } catch (error) {
        this.logger.error('❌ Error procesando sincronización de cola:', error);
        item.reject(error);
      }

      // Esperar tiempo mínimo entre sincronizaciones
      if (this.syncQueue.length > 0) {
        const waitTime = this.minTimeBetweenSyncs * this.backoffMultiplier;
        this.logger.log(`⏳ Esperando ${waitTime}ms antes de procesar siguiente sincronización...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }

    this.isProcessingQueue = false;
  }

  /**
   * Genera un ID único de transacción
   */
  private generateTransactionId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 15);
    return `${this.TRANSACTION_PREFIX}${timestamp}_${random}`;
  }

  /**
   * Genera un ID único de sesión
   */
  private generateSessionId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 15);
    return `pji_session_${timestamp}_${random}`;
  }

  /**
   * Obtiene el ID de transacción actual o genera uno nuevo
   */
  /**
   * Verifica si la sesión ha expirado
   */
  isSessionExpired(): boolean {
    const state = this.getState();
    if (!state.expiresAt) return false;
    return new Date() > new Date(state.expiresAt);
  }

  /**
   * Obtiene el estado de la sesión
   */
  getSessionStatus(): string {
    const state = this.getState();
    return state.status || 'ACTIVE';
  }

  /**
   * Actualiza el estado de la sesión
   */
  updateSessionStatus(status: string): void {
    this.saveState({ status });
  }

  /**
   * Elimina la sesión completamente de la base de datos
   */
  async deleteSession(sessionId?: string): Promise<boolean> {
    try {
      const currentSessionId = sessionId || this.getState().sessionId;
      if (!currentSessionId) {
        this.logger.warning('⚠️ No hay sessionId para eliminar');
        return false;
      }

      this.logger.log('🗑️ Eliminando sesión de la BD:', currentSessionId);
      const response = await this.wizardSessionService.deleteSession(currentSessionId).toPromise();
      
      // Manejar tanto respuesta envuelta como directa
      const actualResponse = (response as any).data || response;
      
      if (actualResponse && actualResponse.deleted) {
        this.logger.log('✅ Sesión eliminada exitosamente de la BD');
        return true;
      } else {
        this.logger.warning('⚠️ No se pudo eliminar la sesión de la BD:', actualResponse);
        return false;
      }
    } catch (error) {
      this.logger.error('❌ Error eliminando sesión de la BD:', error);
      return false;
    }
  }

  /**
   * Obtiene la fecha de expiración
   */
  getExpirationDate(): Date | null {
    const state = this.getState();
    return state.expiresAt ? new Date(state.expiresAt) : null;
  }

  /**
   * Extiende la expiración de la sesión
   */
  extendSession(hours: number = 24): void {
    const newExpiration = new Date(Date.now() + hours * 60 * 60 * 1000);
    this.saveState({ expiresAt: newExpiration });
  }

  /**
   * Obtiene metadatos de la sesión
   */
  getMetadata(): object {
    const state = this.getState();
    return state.metadata || {};
  }

  /**
   * Actualiza metadatos de la sesión
   */
  updateMetadata(metadata: object): void {
    const currentMetadata = this.getMetadata();
    const newMetadata = { ...currentMetadata, ...metadata };
    this.saveState({ metadata: newMetadata });
  }

  /**
   * Obtiene información de la IP y User Agent
   */
  getSessionInfo(): { publicIp?: string; userAgent?: string } {
    const state = this.getState();
    return {
      publicIp: state.publicIp,
      userAgent: state.userAgent
    };
  }

  /**
   * Obtiene el estado del wizard
   */
  getState(): WizardState {
    try {
      const sessionState = sessionStorage.getItem(this.SESSION_KEY);
      if (sessionState) {
        const state = JSON.parse(sessionState);
        if (this.isStateValid(state)) {
          // Actualizar lastActivity al cargar el estado
          const updatedState = {
            ...state,
            lastActivity: Date.now()
          };
          // ✅ SEGURIDAD: Sanitizar estado antes de guardar
          const sanitizedState = this.sanitizeStateForStorage(updatedState);
          // Guardar el estado actualizado sin hacer sync con backend
          sessionStorage.setItem(this.SESSION_KEY, JSON.stringify(sanitizedState));
          return updatedState;
        } else {
          this.logger.log('⏰ Estado de sesión expirado o inválido');
          this.clearState();
        }
      }
    } catch (error) {
      this.logger.error('❌ Error al cargar el estado del wizard:', error);
    }

    return this.getDefaultState();
  }

  /**
   * Verifica si el estado es válido
   */
  private isStateValid(state: WizardState): boolean {
    if (!state || !state.timestamp) return false;
    
    // Si no tiene lastActivity, considerar válido si tiene timestamp reciente
    if (!state.lastActivity) {
      const timeSinceCreation = Date.now() - state.timestamp;
      return timeSinceCreation < this.SESSION_TIMEOUT;
    }
    
    const now = Date.now();
    const timeSinceLastActivity = now - state.lastActivity;
    
    return timeSinceLastActivity < this.SESSION_TIMEOUT;
  }

  /**
   * Obtiene el estado por defecto
   */
  private getDefaultState(): WizardState {
    return {
      sessionId: this.generateSessionId(),
      currentStep: 0,
      stepData: {},
      completedSteps: [],
      status: 'ACTIVE',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 horas
      metadata: {},
      timestamp: Date.now(),
      lastActivity: Date.now(),
      // Campos derivados inicializados
      selectedPlan: '',
      selectedPlanName: '',
      quotationNumber: '',
      userData: null,
      paymentData: null,
      contractData: null,
      paymentResult: null,
      policyNumber: '',
      paymentAmount: 0,
      validationResult: null
    };
  }

  /**
   * Sanitiza el estado eliminando datos sensibles antes de guardar en sessionStorage
   * ✅ SEGURIDAD: Elimina paymentData, paymentResult, contractData, publicIp, userAgent, metadata
   * ✅ IMPORTANTE: Mantiene validationRequirements y stepData.step5.validationRequirements (no son datos sensibles)
   */
  private sanitizeStateForStorage(state: WizardState): WizardState {
    const sanitized = { ...state };
    
    // ✅ SEGURIDAD: Eliminar datos sensibles de pago
    delete sanitized.paymentData;
    delete sanitized.paymentResult;
    
    // ✅ SEGURIDAD: Eliminar datos sensibles de contrato
    delete sanitized.contractData;
    
    // ✅ SEGURIDAD: Eliminar información de IP y navegador
    delete sanitized.publicIp;
    delete sanitized.userAgent;
    
    // ✅ SEGURIDAD: Limpiar metadata (puede contener información del navegador)
    sanitized.metadata = {};
    
    // ✅ IMPORTANTE: Mantener validationRequirements (no es dato sensible, solo indicadores de estado)
    // validationRequirements contiene: type, name, required, completed, uuid, failed, errorMessage
    // Estos son metadatos de validación, no datos personales sensibles
    
    // ✅ IMPORTANTE: Mantener stepData.step5.validationRequirements también
    // Se mantiene automáticamente porque no estamos eliminando stepData
    
    // ✅ SEGURIDAD: Asegurar que solo se guarden indicadores, no datos completos
    // Los indicadores (hasPaymentData, hasPaymentResult, paymentStatus, paymentAmount) se mantienen
    
    return sanitized;
  }

  /**
   * Guarda el estado del wizard localmente (sessionStorage) Y sincroniza automáticamente con backend
   * La estructura guardada en sessionStorage es idéntica a la de la BD
   * 
   * ✅ MEJORADO: Sincronización inteligente con debounce agresivo y sistema de cola
   * - NO sincroniza automáticamente para evitar errores 429
   * - Solo sincroniza cambios críticos (usar saveAndSync para cambios importantes)
   * - Usa sistema de cola con priorización para cambios críticos
   * ✅ SEGURIDAD: Sanitiza datos sensibles antes de guardar en sessionStorage
   */
  async saveState(state: Partial<WizardState>, options?: { sync?: boolean; isCritical?: boolean }): Promise<void> {
    const currentState = this.getState();
    const now = Date.now();
    
    const newState: WizardState = {
      ...currentState,
      ...state,
      timestamp: now,
      lastActivity: now
    };

    // Asegurar que siempre tenga un sessionId
    if (!newState.sessionId) {
      newState.sessionId = this.generateSessionId();
    }

    // Asegurar que siempre tenga metadata
    if (!newState.metadata) {
      newState.metadata = {};
    }

    try {
      // ✅ SEGURIDAD: Sanitizar estado antes de guardar en sessionStorage
      const sanitizedState = this.sanitizeStateForStorage(newState);
      
      // Guardar localmente primero (solo datos no sensibles)
      sessionStorage.setItem(this.SESSION_KEY, JSON.stringify(sanitizedState));
      
      // Emitir cambios en el estado
      this.stateSubject.next(newState);
      
      // Solo loggear cambios importantes de paso
      if (newState.currentStep !== currentState.currentStep) {
        this.logger.log(`🔄 Paso del wizard: ${currentState.currentStep} → ${newState.currentStep}`);
      }

      // ✅ MEJORADO: Solo sincronizar si se solicita explícitamente o es un cambio crítico
      // Por defecto NO sincroniza automáticamente para evitar errores 429
      const shouldSync = options?.sync === true || options?.isCritical === true;
      const isCritical = options?.isCritical === true;

      if (shouldSync && newState.sessionId) {
        // Sincronizar en background (no esperar, para no bloquear la UI)
        this.syncWithBackendCorrected(newState, isCritical).catch(error => {
          this.logger.error('❌ Error sincronizando con backend (no crítico):', error);
        });
      }

    } catch (error) {
      this.logger.error('❌ Error guardando estado del wizard:', error);
    }
  }

  /**
   * Guarda el estado localmente Y sincroniza con backend
   * Usar para cambios críticos que deben persistirse inmediatamente
   * 
   * Ejemplos de uso:
   * - Completar un paso del wizard
   * - Seleccionar un plan
   * - Procesar un pago
   * - Generar un contrato
   * 
   * ✅ MEJORADO: Marca la sincronización como crítica para priorización
   */
  async saveAndSync(state: Partial<WizardState>, isCritical: boolean = true): Promise<WizardState> {
    // 1. Guardar localmente primero (sin sincronizar automáticamente)
    await this.saveState(state, { sync: false });
    
    // 2. Obtener el estado actualizado
    const currentState = this.getState();
    
    // 3. Sincronizar con backend (marcado como crítico para priorización)
    return await this.syncWithBackendCorrected(currentState, isCritical);
  }

  /**
   * Actualiza los datos de un paso específico en stepData
   */
  updateStepData(stepNumber: number, stepData: any): void {
    const currentState = this.getState();
    const updatedStepData = {
      ...currentState.stepData,
      [`step${stepNumber}`]: {
        ...currentState.stepData[`step${stepNumber}` as keyof WizardStepData],
        ...stepData,
        timestamp: new Date()
      }
    };

    this.saveState({ stepData: updatedStepData }, { sync: true, isCritical: true });
  }


  /**
   * Obtiene la IP pública del usuario
   */
  private async getPublicIp(): Promise<string> {
    try {
      // Intentar obtener IP desde servicio externo
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      return data.ip || 'unknown';
    } catch (error) {
      this.logger.warning('No se pudo obtener IP pública:', error);
      return 'unknown';
    }
  }

  /**
   * Sincroniza el estado con el backend - OPTIMIZADO CON DEBOUNCE Y COLA
   * Flujo optimizado: Usa respuesta del PATCH directamente, sin GET adicional
   * 1. Actualizar backend con datos del paso actual
   * 2. Usar respuesta del PATCH directamente (elimina GET innecesario)
   * 3. Sincronizar sessionStorage con la respuesta del backend
   * 
   * ✅ CON DEBOUNCE AGRESIVO: 5 segundos para evitar errores 429
   * ✅ CON RATE LIMITING: Mínimo 10 segundos entre sincronizaciones
   * ✅ CON COLA: Sistema de cola con priorización para cambios críticos
   * ✅ CON BACKOFF EXPONENCIAL: Aumenta tiempo de espera después de errores 429
   * 
   * @param state Estado a sincronizar
   * @param isCritical Si es true, se prioriza en la cola
   * @returns Promise<WizardState> - Estado sincronizado desde el backend
   */
  async syncWithBackendCorrected(state: WizardState, isCritical: boolean = false): Promise<WizardState> {
    const now = Date.now();
    const timeSinceLastSync = now - this.lastSyncTime;
    const adjustedMinTime = this.minTimeBetweenSyncs * this.backoffMultiplier;
    
    // Si ya hay una sincronización en progreso, agregar a la cola o actualizar pendiente
    if (this.syncInProgress) {
      if (isCritical && this.pendingSyncState && !this.pendingSyncIsCritical) {
        // Si es crítico y hay uno no crítico pendiente, reemplazarlo
        this.logger.log('🔄 Reemplazando sincronización pendiente con cambio crítico');
        this.pendingSyncState = state;
        this.pendingSyncIsCritical = true;
        return this.syncPromise || Promise.resolve(state);
      } else if (this.pendingSyncState) {
        // Actualizar el estado pendiente con el más reciente
        this.pendingSyncState = state;
        this.pendingSyncIsCritical = isCritical || this.pendingSyncIsCritical;
        return this.syncPromise || Promise.resolve(state);
      } else {
        // Agregar a la cola
        let resolvePromise: (value: WizardState) => void;
        let rejectPromise: (reason?: any) => void;
        
        const promise = new Promise<WizardState>((resolve, reject) => {
          resolvePromise = resolve;
          rejectPromise = reject;
        });
        
        (promise as any).resolve = resolvePromise!;
        (promise as any).reject = rejectPromise!;
        
        this.addToQueue(state, isCritical, promise);
        return promise;
      }
    }
    
    // Si no ha pasado suficiente tiempo desde la última sincronización
    if (timeSinceLastSync < adjustedMinTime && this.pendingSyncState) {
      const waitTime = adjustedMinTime - timeSinceLastSync;
      this.logger.log(`⏳ Esperando ${waitTime}ms antes de sincronizar (rate limiting + backoff)...`);
      
      // Si es crítico y el pendiente no lo es, reemplazarlo
      if (isCritical && !this.pendingSyncIsCritical) {
        this.pendingSyncState = state;
        this.pendingSyncIsCritical = true;
      } else if (!isCritical) {
        // Si no es crítico, actualizar solo si no hay uno crítico pendiente
        if (!this.pendingSyncIsCritical) {
          this.pendingSyncState = state;
        }
      }
      
      return this.syncPromise || Promise.resolve(state);
    }
    
    // Si hay una sincronización pendiente con debounce, actualizar el estado pendiente
    if (this.pendingSyncState && this.syncPromise) {
      this.logger.log('🔄 Actualizando estado pendiente de sincronización');
      // Si es crítico, reemplazar; si no, solo actualizar si no hay uno crítico
      if (isCritical || !this.pendingSyncIsCritical) {
        this.pendingSyncState = state;
        this.pendingSyncIsCritical = isCritical || this.pendingSyncIsCritical;
      }
      return this.syncPromise;
    }
    
    // Guardar estado pendiente y crear promesa
    this.pendingSyncState = state;
    this.pendingSyncIsCritical = isCritical;
    let resolvePromise: (value: WizardState) => void;
    let rejectPromise: (reason?: any) => void;
    
    this.syncPromise = new Promise<WizardState>((resolve, reject) => {
      resolvePromise = resolve;
      rejectPromise = reject;
    });
    
    // Guardar funciones de resolución para usarlas en el debounce
    (this.syncPromise as any).resolve = resolvePromise!;
    (this.syncPromise as any).reject = rejectPromise!;
    
    // Emitir al subject para activar el debounce
    this.syncSubject.next({ state, isCritical });
    
    return this.syncPromise;
  }

  /**
   * Ejecuta la sincronización real con el backend (sin debounce)
   * Este método es llamado por el debounce
   */
  private async executeSync(state: WizardState): Promise<WizardState> {
    if (this.syncInProgress) {
      // Si ya hay una sincronización en progreso, retornar estado actual
      return this.getState();
    }
    
    // Verificar si ha pasado suficiente tiempo desde la última sincronización
    const now = Date.now();
    const timeSinceLastSync = now - this.lastSyncTime;
    
    if (timeSinceLastSync < this.minTimeBetweenSyncs && this.lastSyncTime > 0) {
      const waitTime = this.minTimeBetweenSyncs - timeSinceLastSync;
      this.logger.log(`⏳ Esperando ${waitTime}ms antes de sincronizar (rate limiting)...`);
      // Esperar el tiempo restante antes de continuar
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    this.syncInProgress = true;
    
    try {
      // ✅ Usar UUID (id) si está disponible, sino usar sessionId
      // El backend puede buscar por ambos, pero el UUID es más confiable
      const sessionId = state.id || state.sessionId;
      
      if (!sessionId) {
        this.logger.warning('⚠️ No hay sessionId o id para sincronizar');
        return this.getState();
      }
      
      this.logger.log('📡 Sincronizando con backend usando ID:', { 
        id: state.id, 
        sessionId: state.sessionId, 
        using: sessionId 
      });

      // 1. Preparar stepData completo (todos los pasos, no solo el actual)
      const stepData = this.mapStateToStepData(state);
      
      this.logger.log('📡 Enviando estructura completa del estado al backend:', {
        sessionId,
        step: state.currentStep,
        stepDataKeys: Object.keys(stepData),
        userData: state.userData,
        selectedPlan: state.selectedPlan,
        selectedPlanName: state.selectedPlanName,
        quotationNumber: state.quotationNumber,
        quotationId: state.quotationId,
        userId: state.userId,
        policyId: state.policyId,
        policyNumber: state.policyNumber,
        completedSteps: state.completedSteps,
        paymentData: !!state.paymentData,
        contractData: !!state.contractData,
        paymentResult: !!state.paymentResult
      });

      // 2. Actualizar el backend con la estructura COMPLETA del estado (idéntica a sessionStorage)
      // Esto asegura que la BD tenga exactamente la misma estructura que el frontend
      const updateData = {
        step: state.currentStep,
        stepData: stepData, // ✅ Enviar stepData completo, no solo el paso actual
        completedSteps: state.completedSteps || [],
        lastActivityAt: new Date().toISOString(),
        
        // ✅ Campos principales (estructura idéntica a sessionStorage)
        ...(state.userId ? { userId: state.userId } : {}),
        ...(state.status ? { status: state.status } : {}),
        ...(state.expiresAt ? { 
          expiresAt: state.expiresAt instanceof Date 
            ? state.expiresAt.toISOString() 
            : typeof state.expiresAt === 'string' 
              ? state.expiresAt 
              : new Date(state.expiresAt).toISOString()
        } : {}),
        ...(state.metadata ? { metadata: state.metadata } : {}),
        
        // ✅ Campos derivados (estructura idéntica a sessionStorage)
        ...(state.selectedPlan ? { selectedPlan: state.selectedPlan } : {}),
        ...(state.selectedPlanName ? { selectedPlanName: state.selectedPlanName } : {}),
        ...(state.userData && Object.keys(state.userData).length > 0 ? { userData: state.userData } : {}),
        // ✅ SEGURIDAD: NO enviar paymentData, paymentResult, contractData al backend
        // Estos campos solo se usan localmente en el frontend
        // El backend solo recibe indicadores (hasPaymentData, hasPaymentResult, etc.)
        ...(state.policyNumber ? { policyNumber: state.policyNumber } : {}),
        // ✅ paymentAmount: Solo enviar si es un número válido mayor a 0
        ...(state.paymentAmount !== undefined && state.paymentAmount !== null && !isNaN(Number(state.paymentAmount)) && Number(state.paymentAmount) > 0 
          ? { paymentAmount: Number(state.paymentAmount) } 
          : {}),
        ...(state.validationResult ? { validationResult: state.validationResult } : {}),
        
        // ✅ Campos de relación (solo si estamos en el paso correcto)
        ...(state.currentStep >= 2 && state.quotationId ? { quotationId: state.quotationId } : {}),
        ...(state.currentStep >= 2 && state.quotationNumber ? { quotationNumber: state.quotationNumber } : {}),
        ...(state.policyId ? { policyId: state.policyId } : {})
      };

      // ✅ OPTIMIZACIÓN: Usar respuesta del PATCH directamente (elimina GET innecesario)
      // ✅ RETRY: Si falla con 404, esperar un poco y reintentar (para sesiones recién creadas)
      let patchResponse: any = null;
      let retries = 0;
      const maxRetries = 2;
      const retryDelay = 500; // 500ms entre reintentos
      
      while (retries <= maxRetries) {
        try {
          patchResponse = await this.apiService.patch<WizardSessionData>(
        `${this.API_ENDPOINT}/${sessionId}/step`,
        updateData
      ).toPromise();

          if (patchResponse) {
            break; // Éxito, salir del loop
          }
        } catch (error: any) {
          const errorStatus = error?.status;
          
          // Si es 404 y aún hay reintentos disponibles, esperar y reintentar
          if (errorStatus === 404 && retries < maxRetries) {
            retries++;
            this.logger.log(`⚠️ Sesión no encontrada (404), reintentando en ${retryDelay}ms (intento ${retries}/${maxRetries})...`);
            await new Promise(resolve => setTimeout(resolve, retryDelay));
            continue;
          }
          
          // Si es otro error o se agotaron los reintentos, lanzar el error
          throw error;
        }
      }

      if (!patchResponse) {
        this.logger.warning('⚠️ No se recibió respuesta del PATCH después de reintentos');
        return this.getState();
      }

      // Extraer datos de la respuesta del PATCH
      const backendData = (patchResponse as any).data || patchResponse;
      
      // ✅ IMPORTANTE: Guardar tokens si vienen en la respuesta del backend
      if (backendData.accessToken && backendData.refreshToken) {
        this.logger.log('🔑 Tokens recibidos del backend, guardándolos...');
        if (typeof window !== 'undefined' && window.localStorage) {
          localStorage.setItem('wizard_access_token', backendData.accessToken);
          localStorage.setItem('wizard_refresh_token', backendData.refreshToken);
          this.logger.log('✅ Tokens guardados en localStorage');
        }
      }
      
      this.logger.log('✅ Backend actualizado con datos del paso', state.currentStep);
      this.logger.log('📋 Datos actualizados obtenidos del PATCH (sin GET adicional):', {
        selectedPlan: backendData.selectedPlan,
        selectedPlanName: backendData.selectedPlanName,
        currentStep: backendData.currentStep,
        stepDataKeys: Object.keys(backendData.stepData || {}),
        hasAccessToken: !!backendData.accessToken
      });

      // 3. Sincronizar sessionStorage con la respuesta del backend (estructura idéntica)
      // ✅ IMPORTANTE: La estructura debe ser EXACTAMENTE la misma que en la BD
      // Incluir TODOS los campos, incluso si son null
      const syncedState: WizardState = {
        // ✅ Campos principales del backend (estructura idéntica)
        id: backendData.id,
        sessionId: backendData.sessionId,
        userId: backendData.userId || undefined,
        currentStep: backendData.currentStep || 0,
        stepData: backendData.stepData || {},
        completedSteps: backendData.completedSteps || [],
        status: backendData.status || 'ACTIVE',
        expiresAt: backendData.expiresAt ? new Date(backendData.expiresAt) : new Date(Date.now() + 24 * 60 * 60 * 1000),
        quotationId: backendData.quotationId || undefined,
        policyId: backendData.policyId || undefined,
        metadata: backendData.metadata || {},
        publicIp: backendData.publicIp,
        userAgent: backendData.userAgent,
        lastActivityAt: backendData.lastActivityAt ? new Date(backendData.lastActivityAt) : new Date(),
        completedAt: backendData.completedAt ? new Date(backendData.completedAt) : undefined,
        createdAt: backendData.createdAt ? new Date(backendData.createdAt) : undefined,
        updatedAt: backendData.updatedAt ? new Date(backendData.updatedAt) : undefined,
        
        // ✅ Campos derivados del backend (estructura idéntica - usar valores exactos de la BD)
        selectedPlan: backendData.selectedPlan || '',
        selectedPlanName: backendData.selectedPlanName || '',
        quotationNumber: backendData.quotationNumber || '',
        // ✅ Usar valores exactos de la BD (pueden ser null)
        userData: backendData.userData || null,
        // ✅ SEGURIDAD: Solo usar indicadores del backend, NO datos completos
        hasPaymentData: backendData.hasPaymentData || false,
        hasPaymentResult: backendData.hasPaymentResult || false,
        paymentStatus: backendData.paymentStatus || null,
        hasContractData: backendData.hasContractData || false,
        hasValidationResult: backendData.hasValidationResult || false,
        validationStatus: backendData.validationStatus || null,
        // ⚠️ COMPATIBILIDAD LOCAL: Mantener datos locales si existen (NO vienen del backend)
        // Estos campos solo se usan localmente en el frontend para la UI
        paymentData: state.paymentData || null,  // Mantener datos locales si existen
        contractData: state.contractData || null,  // Mantener datos locales si existen
        paymentResult: state.paymentResult || null,  // Mantener datos locales si existen
        policyNumber: backendData.policyNumber || '',
        paymentAmount: backendData.paymentAmount ? parseFloat(String(backendData.paymentAmount)) : 0,
        validationResult: backendData.validationResult || null,
        // ✅ validationRequirements está en stepData.step5, extraerlo
        validationRequirements: backendData.stepData?.step5?.validationRequirements || [],
        
        // ✅ Campos de compatibilidad del frontend (solo para control local)
        timestamp: Date.now(),
        lastActivity: Date.now()
      };

      // 4. ✅ SEGURIDAD: Sanitizar estado antes de guardar en sessionStorage
      const sanitizedState = this.sanitizeStateForStorage(syncedState);
      
      // Guardar en sessionStorage (solo datos no sensibles)
      if (isPlatformBrowser(this.platformId)) {
        sessionStorage.setItem(this.SESSION_KEY, JSON.stringify(sanitizedState));
        // Emitir estado completo para uso interno (no se guarda en sessionStorage)
        this.stateSubject.next(syncedState);
      }

      this.logger.log('✅ SessionStorage sincronizado con backend:', {
        selectedPlan: syncedState.selectedPlan,
        selectedPlanName: syncedState.selectedPlanName,
        currentStep: syncedState.currentStep
      });

      // Actualizar tiempo de última sincronización
      this.lastSyncTime = Date.now();
      
      return syncedState;

    } catch (error: any) {
      this.logger.error('❌ Error sincronizando con backend:', error);
      
      // ✅ MEJORADO: Backoff exponencial para errores 429
      if (error?.status === 429 || error?.message?.includes('429') || error?.message?.includes('Too Many Requests')) {
        this.consecutive429Errors++;
        this.backoffMultiplier = Math.min(this.backoffMultiplier * 2, this.maxBackoffMultiplier);
        
        this.logger.warning(`⚠️ Error 429 detectado (${this.consecutive429Errors} consecutivos), aplicando backoff exponencial...`);
        this.logger.log(`⏱️ Backoff multiplicador: ${this.backoffMultiplier}x`);
        this.logger.log(`⏱️ Tiempo mínimo entre sincronizaciones: ${this.minTimeBetweenSyncs * this.backoffMultiplier}ms`);
        
        // Aumentar también el debounce time
        this.syncDebounceTime = Math.min(this.syncDebounceTime * 1.5, 10000); // Máximo 10 segundos
        
        // Limpiar cola de sincronizaciones no críticas para reducir carga
        if (this.syncQueue.length > 0) {
          const criticalItems = this.syncQueue.filter(item => item.isCritical);
          const nonCriticalItems = this.syncQueue.filter(item => !item.isCritical);
          
          // Mantener solo los últimos 3 no críticos
          const keepNonCritical = nonCriticalItems.slice(-3);
          
          this.syncQueue = [...criticalItems, ...keepNonCritical];
          this.logger.log(`🧹 Cola limpiada después de error 429. Manteniendo ${this.syncQueue.length} items (${criticalItems.length} críticos)`);
        }
      } else {
        // Si no es error 429, resetear contador y multiplicador gradualmente
        if (this.consecutive429Errors > 0) {
          this.consecutive429Errors = Math.max(0, this.consecutive429Errors - 1);
          if (this.consecutive429Errors === 0) {
            this.backoffMultiplier = 1;
            this.logger.log('✅ Backoff reseteado después de sincronización exitosa');
          }
        }
      }
      
      throw error;
    } finally {
      this.syncInProgress = false;
    }
  }
  async syncWithBackend(state: WizardState): Promise<void> {
    if (this.syncInProgress) return;
    
    this.syncInProgress = true;
    
    try {
      const sessionId = state.sessionId;
      
      // Obtener datos actuales del backend para preservar campos importantes
      let backendData: any = null;
      if (sessionId) {
        try {
          const backendResponse = await this.wizardSessionService.getSession(sessionId).toPromise();
          if (backendResponse) {
            backendData = (backendResponse as any).data || backendResponse;
            this.logger.log('📋 Datos del backend obtenidos para preservar campos:', {
              selectedPlan: backendData.selectedPlan,
              selectedPlanName: backendData.selectedPlanName,
              quotationNumber: backendData.quotationNumber
            });
          }
        } catch (error) {
          this.logger.warning('⚠️ No se pudieron obtener datos del backend para preservar campos:', error);
        }
      }
      
      // Crear sesión si no existe
      if (!sessionId || state.currentStep === 0) {
        const publicIp = await this.getPublicIp();
        const userAgent = typeof navigator !== 'undefined' 
          ? navigator.userAgent 
          : 'Unknown-User-Agent';
        const platform = typeof navigator !== 'undefined'
          ? navigator.platform
          : 'Unknown-Platform';
        const createSessionResponse = await this.apiService.post(this.API_ENDPOINT, {
          sessionId: sessionId || state.sessionId,
          userId: state.userId || undefined, // No enviar string vacío
          publicIp,
          userAgent,
          createOnly: false, // Permitir reutilización por IP
          metadata: {
            timestamp: new Date().toISOString(),
            browser: userAgent,
            platform
          }
        }).toPromise();
        
        // Actualizar el sessionId y id si se creó una nueva sesión
        if (createSessionResponse && createSessionResponse.data) {
          const responseData = createSessionResponse.data as any;
          const newSessionId = responseData.sessionId;
          const newId = responseData.id;
          
          if (newSessionId !== sessionId) {
            this.logger.log('🔄 Actualizando sessionId local:', sessionId, '→', newSessionId);
            state.sessionId = newSessionId;
          }
          
          if (newId) {
            this.logger.log('🔄 Actualizando id (UUID) local:', state.id, '→', newId);
            state.id = newId;
          }
          
          // ✅ SEGURIDAD: Sanitizar estado antes de guardar
          const sanitizedState = this.sanitizeStateForStorage(state);
          // Actualizar el estado local con los nuevos valores
          if (isPlatformBrowser(this.platformId)) {
            sessionStorage.setItem(this.SESSION_KEY, JSON.stringify(sanitizedState));
          }
          this.stateSubject.next(state);
        }
      }

      // Actualizar paso actual si es mayor a 0
      let currentSessionId = state.sessionId;
      if (state.currentStep >= 0 && currentSessionId) { // ✅ Cambiar >= 0 para incluir paso 0
        const stepData = this.mapStateToStepData(state);
        let currentStepData = stepData[`step${state.currentStep}` as keyof WizardStepData];

        // Si no hay datos específicos para este paso, crear datos básicos
        if (!currentStepData) {
          currentStepData = {
            timestamp: new Date(),
            // Agregar datos básicos según el paso
            ...(state.currentStep === 0 && state.userData?.tipoUsuario ? { tipoUsuario: state.userData.tipoUsuario } : {}),
            ...(state.currentStep === 1 && state.selectedPlan ? { selectedPlan: state.selectedPlan } : {}),
            ...(state.currentStep === 2 && state.userData ? { userData: state.userData } : {}),
            ...(state.currentStep === 3 && state.quotationId ? { quotationId: state.quotationId } : {}),
            ...(state.currentStep === 4 && state.paymentData ? { paymentData: state.paymentData } : {}),
            ...(state.currentStep === 5 && state.paymentResult ? { validationData: state.paymentResult } : {}),
            ...(state.currentStep === 7 && state.contractData ? { propertyData: state.contractData } : {}),
            ...(state.currentStep === 8 && state.contractData ? { contractData: state.contractData } : {})
          };
        }
        
        // ✅ Asegurar que los campos derivados estén sincronizados
        // Si stepData tiene datos pero los campos derivados están vacíos, actualizarlos
        if (stepData.step0?.tipoUsuario && !state.userData?.tipoUsuario) {
          this.logger.log('🔄 Sincronizando tipoUsuario desde stepData.step0:', stepData.step0.tipoUsuario);
          state.userData = { ...state.userData, tipoUsuario: stepData.step0.tipoUsuario };
          if (isPlatformBrowser(this.platformId)) {
            const sanitizedState = this.sanitizeStateForStorage(state);
            sessionStorage.setItem(this.SESSION_KEY, JSON.stringify(sanitizedState));
          }
        }
        
        // Sincronizar datos del formulario principal desde stepData.step1
        if (stepData.step1 && (stepData.step1.nombre || stepData.step1.telefono || stepData.step1.correo || stepData.step1.rentaMensual)) {
          this.logger.log('🔄 Sincronizando datos del formulario desde stepData.step1:', stepData.step1);
          state.userData = {
            ...state.userData,
            name: stepData.step1.nombre,
            phone: stepData.step1.telefono,
            email: stepData.step1.correo,
            rentaMensual: stepData.step1.rentaMensual,
            complementos: stepData.step1.complementos
          };
          if (isPlatformBrowser(this.platformId)) {
            const sanitizedState = this.sanitizeStateForStorage(state);
            sessionStorage.setItem(this.SESSION_KEY, JSON.stringify(sanitizedState));
          }
        }
        
        // Sincronizar datos de pago desde stepData.step2
        if (stepData.step2 && stepData.step2.paymentMethod && !state.paymentData) {
          this.logger.log('🔄 Sincronizando datos de pago desde stepData.step2:', stepData.step2);
          state.paymentData = {
            method: stepData.step2.paymentMethod,
            cardData: stepData.step2.cardData
          };
          if (isPlatformBrowser(this.platformId)) {
            const sanitizedState = this.sanitizeStateForStorage(state);
            sessionStorage.setItem(this.SESSION_KEY, JSON.stringify(sanitizedState));
          }
        }
        
        // Sincronizar datos de validación desde stepData.step3
        if (stepData.step3 && stepData.step3.validationCode && !state.paymentResult) {
          this.logger.log('🔄 Sincronizando datos de validación desde stepData.step3:', stepData.step3);
          state.paymentResult = {
            validationCode: stepData.step3.validationCode
          };
          if (isPlatformBrowser(this.platformId)) {
            const sanitizedState = this.sanitizeStateForStorage(state);
            sessionStorage.setItem(this.SESSION_KEY, JSON.stringify(sanitizedState));
          }
        }
        
        // Sincronizar datos de captura desde stepData.step5
        if (stepData.step5 && (stepData.step5.propietario || stepData.step5.inquilino || stepData.step5.inmueble) && !state.contractData) {
          this.logger.log('🔄 Sincronizando datos de captura desde stepData.step5:', stepData.step5);
          state.contractData = {
            propietario: stepData.step5.propietario,
            inquilino: stepData.step5.inquilino,
            fiador: stepData.step5.fiador,
            inmueble: stepData.step5.inmueble
          };
          if (isPlatformBrowser(this.platformId)) {
            const sanitizedState = this.sanitizeStateForStorage(state);
            sessionStorage.setItem(this.SESSION_KEY, JSON.stringify(sanitizedState));
          }
        }
        
        // Sincronizar datos de contrato desde stepData.step7
        if (stepData.step7 && stepData.step7.contractTerms && !state.contractData?.contractTerms) {
          this.logger.log('🔄 Sincronizando datos de contrato desde stepData.step7:', stepData.step7);
          state.contractData = {
            ...state.contractData,
            contractTerms: stepData.step7.contractTerms,
            signatures: stepData.step7.signatures
          };
          if (isPlatformBrowser(this.platformId)) {
            const sanitizedState = this.sanitizeStateForStorage(state);
            sessionStorage.setItem(this.SESSION_KEY, JSON.stringify(sanitizedState));
          }
        }

        const doPatch = async (sessionIdToUse: string) => {
          // Enviar el estado completo para mantener sincronización total
          const fullStateData = {
              step: state.currentStep,
            stepData: stepData,
            completedSteps: state.completedSteps,
              quotationId: state.quotationId,
            policyId: state.policyId,
            userId: state.userId,
            status: state.status,
            expiresAt: state.expiresAt,
            metadata: state.metadata,
            publicIp: state.publicIp,
            userAgent: state.userAgent,
            lastActivityAt: new Date().toISOString(),
            // Campos derivados para sincronización completa - usar datos del backend si están disponibles
            selectedPlan: backendData?.selectedPlan || state.selectedPlan,
            selectedPlanName: backendData?.selectedPlanName || state.selectedPlanName,
            quotationNumber: backendData?.quotationNumber || state.quotationNumber,
            userData: state.userData,
            paymentData: state.paymentData,
            contractData: state.contractData,
            paymentResult: state.paymentResult,
            policyNumber: state.policyNumber,
            paymentAmount: state.paymentAmount,
            validationResult: state.validationResult
          };
          
          this.logger.log('📡 Sincronizando estado completo con backend:', {
            sessionId: sessionIdToUse,
            step: state.currentStep,
            stepDataKeys: Object.keys(stepData),
            completedSteps: state.completedSteps.length,
            quotationId: state.quotationId,
            policyId: state.policyId,
            // Mostrar qué valores se están usando para campos importantes
            selectedPlan: {
              fromBackend: backendData?.selectedPlan,
              fromState: state.selectedPlan,
              final: fullStateData.selectedPlan
            },
            selectedPlanName: {
              fromBackend: backendData?.selectedPlanName,
              fromState: state.selectedPlanName,
              final: fullStateData.selectedPlanName
            },
            quotationNumber: {
              fromBackend: backendData?.quotationNumber,
              fromState: state.quotationNumber,
              final: fullStateData.quotationNumber
            },
            userData: state.userData,
            paymentData: state.paymentData,
            contractData: state.contractData,
            paymentResult: state.paymentResult
          });
          
          await this.apiService.patch(
            `${this.API_ENDPOINT}/${sessionIdToUse}/step`,
            fullStateData
          ).toPromise();
        };

        try {
          await doPatch(currentSessionId);
        } catch (error: any) {
          // Si la sesión no existe (404), intentar recuperar la sesión activa por IP y reintentar una vez
          const status = error?.status || error?.statusCode || error?.response?.status;
          if (status === 404) {
            try {
              const publicIp = await this.getPublicIp();
              const activeSessionResponse = await this.apiService.get(`${this.API_ENDPOINT}/ip/${publicIp}`).toPromise();
              if (activeSessionResponse && activeSessionResponse.success && activeSessionResponse.data) {
                const recoveredSessionId = (activeSessionResponse.data as any).sessionId;
                if (recoveredSessionId && recoveredSessionId !== currentSessionId) {
                  this.logger.log('♻️ Recuperado sessionId por IP:', currentSessionId, '→', recoveredSessionId);
                  currentSessionId = recoveredSessionId;
                  state.sessionId = recoveredSessionId;
                  if (isPlatformBrowser(this.platformId)) {
                    const sanitizedState = this.sanitizeStateForStorage(state);
                    sessionStorage.setItem(this.SESSION_KEY, JSON.stringify(sanitizedState));
                  }
                  this.stateSubject.next(state);
                  await doPatch(recoveredSessionId);
                } else {
                  throw error;
                }
              } else {
                throw error;
              }
            } catch (innerErr) {
              throw innerErr;
            }
          } else {
            throw error;
          }
        }
      }

      // Marcar pasos completados
      for (const step of state.completedSteps) {
        if (currentSessionId) {
          try {
            await this.apiService.patch(
              `${this.API_ENDPOINT}/${currentSessionId}/complete-step`,
              { step }
            ).toPromise();
          } catch (error: any) {
            const status = error?.status || error?.statusCode || error?.response?.status;
            if (status === 404) {
              // Reintentar una vez con recuperación por IP
              const publicIp = await this.getPublicIp();
              const activeSessionResponse = await this.apiService.get(`${this.API_ENDPOINT}/ip/${publicIp}`).toPromise();
              if (activeSessionResponse && activeSessionResponse.success && activeSessionResponse.data) {
                const recoveredSessionId = (activeSessionResponse.data as any).sessionId;
                if (recoveredSessionId && recoveredSessionId !== currentSessionId) {
                  this.logger.log('♻️ Recuperado sessionId por IP (complete-step):', currentSessionId, '→', recoveredSessionId);
                  currentSessionId = recoveredSessionId;
                  state.sessionId = recoveredSessionId;
                  if (isPlatformBrowser(this.platformId)) {
                    const sanitizedState = this.sanitizeStateForStorage(state);
                    sessionStorage.setItem(this.SESSION_KEY, JSON.stringify(sanitizedState));
                  }
                  this.stateSubject.next(state);
                  await this.apiService.patch(
                    `${this.API_ENDPOINT}/${recoveredSessionId}/complete-step`,
                    { step }
                  ).toPromise();
                } else {
                  throw error;
                }
              } else {
                throw error;
              }
            } else {
              throw error;
            }
          }
        }
      }

      this.logger.log(`✅ Estado sincronizado con backend para sesión ${currentSessionId}`);

    } catch (error) {
      this.logger.error('❌ Error sincronizando con backend:', error);
      throw error;
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * Mapea el estado del frontend a datos de pasos para el backend
   * ✅ MEJORADO: Incluye todos los campos para mantener estructura completa e idéntica
   */
  private mapStateToStepData(state: WizardState): WizardStepData {
    // Si ya tenemos stepData estructurado, mejorarlo con campos adicionales
    const stepData: WizardStepData = state.stepData && Object.keys(state.stepData).length > 0 
      ? { ...state.stepData } 
      : {};
    
    // Siempre incluir datos básicos para el paso actual
    const baseStepData = {
        timestamp: new Date() 
    };
    
    // Paso 0: Tipo de usuario
    if (state.userData?.tipoUsuario) {
      stepData.step0 = {
        ...stepData.step0,
        tipoUsuario: state.userData.tipoUsuario,
        timestamp: stepData.step0?.timestamp || baseStepData.timestamp
      };
    }
    
    // Paso 1: Datos principales (inputs del formulario) + selectedPlan
    if (state.userData && (state.userData.name || state.userData.email || state.userData.phone || state.userData.rentaMensual)) {
      const nombre = state.userData.name || state.userData.nombre || stepData.step1?.nombre;
      const telefono = state.userData.phone || state.userData.telefono || stepData.step1?.telefono;
      const correo = state.userData.email || state.userData.correo || stepData.step1?.correo;
      const rentaMensual = state.userData.rentaMensual ?? stepData.step1?.rentaMensual ?? 0;
      
      stepData.step1 = {
        ...stepData.step1,
        ...(nombre ? { nombre } : {}),
        ...(telefono ? { telefono } : {}),
        ...(correo ? { correo } : {}),
        rentaMensual,
        complementos: state.userData.complementos || stepData.step1?.complementos || [],
        // ✅ Incluir selectedPlan y selectedPlanName en step1
        ...(state.selectedPlan ? { selectedPlan: state.selectedPlan } : {}),
        ...(state.selectedPlanName ? { selectedPlanName: state.selectedPlanName } : {}),
        timestamp: stepData.step1?.timestamp || baseStepData.timestamp
      };
    } else if (state.selectedPlan || state.selectedPlanName) {
      // Si solo hay selectedPlan pero no userData, crear step1 mínimo
      stepData.step1 = {
        ...stepData.step1,
        ...(state.selectedPlan ? { selectedPlan: state.selectedPlan } : {}),
        ...(state.selectedPlanName ? { selectedPlanName: state.selectedPlanName } : {}),
        timestamp: stepData.step1?.timestamp || baseStepData.timestamp
      };
    }
    
    // Paso 2: Datos de pago (inputs del formulario de pago)
    if (state.paymentData) {
      stepData.step2 = { 
        ...stepData.step2,
        paymentMethod: state.paymentData.method || stepData.step2?.paymentMethod || '',
        cardData: state.paymentData.cardData || stepData.step2?.cardData || null,
        timestamp: stepData.step2?.timestamp || baseStepData.timestamp
      };
    }
    
    // Paso 3: Datos de validación + quotationId y quotationNumber
    if (state.paymentResult || state.quotationId || state.quotationNumber) {
      stepData.step3 = { 
        ...stepData.step3,
        ...(state.paymentResult?.validationCode ? { validationCode: state.paymentResult.validationCode } : {}),
        ...(state.quotationId ? { quotationId: state.quotationId } : {}),
        ...(state.quotationNumber ? { quotationNumber: state.quotationNumber } : {}),
        timestamp: stepData.step3?.timestamp || baseStepData.timestamp
      };
    }
    
    // Paso 5: Datos de captura (inputs de los formularios de captura)
    if (state.contractData && (state.contractData.propietario || state.contractData.inquilino || state.contractData.inmueble)) {
      stepData.step5 = { 
        ...stepData.step5,
        propietario: state.contractData.propietario || stepData.step5?.propietario || null,
        inquilino: state.contractData.inquilino || stepData.step5?.inquilino || null,
        fiador: state.contractData.fiador || stepData.step5?.fiador || null,
        inmueble: state.contractData.inmueble || stepData.step5?.inmueble || null,
        timestamp: stepData.step5?.timestamp || baseStepData.timestamp
      };
    }
    
    // Paso 6: Datos de validación (validationRequirements) + policyNumber + validationResult
    if (state.validationRequirements && state.validationRequirements.length > 0) {
      stepData.step6 = { 
        ...stepData.step6,
        validationRequirements: state.validationRequirements,
        ...(state.policyNumber ? { policyNumber: state.policyNumber } : {}),
        ...(state.validationResult ? { validationResult: state.validationResult } : {}),
        timestamp: stepData.step6?.timestamp || baseStepData.timestamp
      };
    } else if (state.policyNumber || state.validationResult) {
      // Si solo hay policyNumber o validationResult, crear step6 mínimo
      stepData.step6 = {
        ...stepData.step6,
        ...(state.policyNumber ? { policyNumber: state.policyNumber } : {}),
        ...(state.validationResult ? { validationResult: state.validationResult } : {}),
        timestamp: stepData.step6?.timestamp || baseStepData.timestamp
      };
    }
    
    // Paso 7: Datos de contrato (inputs del formulario de contrato)
    if (state.contractData && state.contractData.contractTerms) {
      stepData.step7 = { 
        ...stepData.step7,
        contractTerms: state.contractData.contractTerms,
        signatures: state.contractData.signatures || stepData.step7?.signatures || null,
        timestamp: stepData.step7?.timestamp || baseStepData.timestamp
      };
    }
    
    // Paso 8: Datos finales (inputs del formulario final)
    if (state.userData && state.userData.deliveryPreferences) {
      stepData.step8 = {
        ...stepData.step8,
        deliveryPreferences: state.userData.deliveryPreferences,
        timestamp: stepData.step8?.timestamp || baseStepData.timestamp
      };
    }
    
    return stepData;
  }

  /**
   * Valida y sincroniza los datos requeridos según el paso actual
   * Sincroniza desde stepData a campos derivados y viceversa
   */
  private validateAndSyncStepData(session: any, currentStep: number): any {
    const stepData = session.stepData || {};
    let needsSync = false;

    this.logger.log(`🔍 Validando datos requeridos para paso ${currentStep}`, {
      sessionId: session.sessionId,
      currentStep,
      stepDataKeys: Object.keys(stepData)
    });

    // Sincronizar userData desde stepData.step1 si existe
    if (currentStep >= 1 && stepData.step1) {
      if (!session.userData) session.userData = {};
      const userData = session.userData as any;
      const step1 = stepData.step1;

      if (step1.nombre && !userData.name && !userData.nombre) {
        userData.name = step1.nombre;
        userData.nombre = step1.nombre;
        needsSync = true;
        this.logger.log(`✅ Sincronizado nombre desde stepData.step1`);
      }
      if (step1.correo && !userData.email && !userData.correo) {
        userData.email = step1.correo;
        userData.correo = step1.correo;
        needsSync = true;
        this.logger.log(`✅ Sincronizado correo desde stepData.step1`);
      }
      if (step1.telefono && !userData.phone && !userData.telefono) {
        userData.phone = step1.telefono;
        userData.telefono = step1.telefono;
        needsSync = true;
        this.logger.log(`✅ Sincronizado telefono desde stepData.step1`);
      }
      if (step1.rentaMensual && !userData.rentaMensual) {
        userData.rentaMensual = step1.rentaMensual;
        needsSync = true;
        this.logger.log(`✅ Sincronizado rentaMensual desde stepData.step1`);
      }
      if (step1.complementos && !userData.complementos) {
        userData.complementos = step1.complementos;
        needsSync = true;
        this.logger.log(`✅ Sincronizado complementos desde stepData.step1`);
      }

      if (needsSync) {
        session.userData = userData;
      }
    }

    // Sincronizar tipoUsuario desde stepData.step0
    if (currentStep >= 0 && stepData.step0?.tipoUsuario) {
      if (!session.userData) session.userData = {};
      const userData = session.userData as any;
      if (!userData.tipoUsuario) {
        userData.tipoUsuario = stepData.step0.tipoUsuario;
        session.userData = userData;
        needsSync = true;
        this.logger.log(`✅ Sincronizado tipoUsuario desde stepData.step0`);
      }
    }

    // Sincronizar quotationId y quotationNumber desde stepData.step3 o campos principales
    if (currentStep >= 2) {
      if (!session.quotationId && stepData.step3?.quotationId) {
        session.quotationId = stepData.step3.quotationId;
        needsSync = true;
        this.logger.log(`✅ Sincronizado quotationId desde stepData.step3`);
      }
      if (!session.quotationNumber && (stepData.step3?.quotationNumber || session.quotationNumber)) {
        session.quotationNumber = stepData.step3?.quotationNumber || session.quotationNumber;
        needsSync = true;
        this.logger.log(`✅ Sincronizado quotationNumber`);
      }
    }

    // Sincronizar policyId y policyNumber
    if (currentStep >= 3) {
      if (!session.policyId && session.paymentResult?.['policyId']) {
        session.policyId = session.paymentResult['policyId'];
        needsSync = true;
        this.logger.log(`✅ Sincronizado policyId desde paymentResult`);
      }
      if (!session.policyNumber) {
        if (session.paymentResult?.['policyNumber']) {
          session.policyNumber = session.paymentResult['policyNumber'];
          needsSync = true;
          this.logger.log(`✅ Sincronizado policyNumber desde paymentResult`);
        } else if (stepData.step5?.policyNumber) {
          session.policyNumber = stepData.step5.policyNumber;
          needsSync = true;
          this.logger.log(`✅ Sincronizado policyNumber desde stepData.step5`);
        }
      }
    }

    // Sincronizar contractData desde stepData.step4
    if (currentStep >= 4 && stepData.step4 && !session.contractData) {
      session.contractData = {
        propietario: stepData.step4.propietario,
        inquilino: stepData.step4.inquilino,
        fiador: stepData.step4.fiador,
        inmueble: stepData.step4.inmueble
      };
      needsSync = true;
      this.logger.log(`✅ Sincronizado contractData desde stepData.step4`);
    }

    // ✅ NUEVO: Paso 4/5 - Sincronizar validationRequirements y validationResult desde stepData.step5
    if (currentStep >= 4) {
      // Sincronizar validationRequirements desde stepData.step5
      if (stepData.step5?.validationRequirements && stepData.step5.validationRequirements.length > 0) {
        if (!session.validationRequirements || session.validationRequirements.length === 0) {
          session.validationRequirements = stepData.step5.validationRequirements;
          needsSync = true;
          this.logger.log(`✅ Sincronizado validationRequirements desde stepData.step5`);
        }
      }
      
      // Sincronizar validationResult desde stepData.step5 o desde campo principal
      if (stepData.step5?.validationResult && !session.validationResult) {
        session.validationResult = stepData.step5.validationResult;
        needsSync = true;
        this.logger.log(`✅ Sincronizado validationResult desde stepData.step5`);
      }
    }

    // Sincronizar paymentData y paymentResult si existen en campos principales
    if (currentStep >= 3) {
      // Sincronizar paymentData si existe en campos principales pero no en stepData
      if (session.paymentData && !stepData.step2?.paymentData) {
        if (!stepData.step2) stepData.step2 = {};
        stepData.step2.paymentData = session.paymentData;
        needsSync = true;
        this.logger.log(`✅ Sincronizado paymentData a stepData.step2`);
      }
      
      // Sincronizar paymentResult si existe en campos principales pero no en stepData
      if (session.paymentResult && !stepData.step3?.paymentResult && !stepData.step5?.validationData) {
        if (!stepData.step3) stepData.step3 = {};
        stepData.step3.paymentResult = session.paymentResult;
        needsSync = true;
        this.logger.log(`✅ Sincronizado paymentResult a stepData.step3`);
      }
    }

    // Sincronizar selectedPlan y selectedPlanName
    if (!session.selectedPlan && stepData.step1?.selectedPlan) {
      session.selectedPlan = stepData.step1.selectedPlan;
      needsSync = true;
      this.logger.log(`✅ Sincronizado selectedPlan desde stepData.step1`);
    }
    if (!session.selectedPlanName && stepData.step1?.selectedPlanName) {
      session.selectedPlanName = stepData.step1.selectedPlanName;
      needsSync = true;
      this.logger.log(`✅ Sincronizado selectedPlanName desde stepData.step1`);
    }

    if (needsSync) {
      this.logger.log(`✅ Datos sincronizados correctamente`);
    } else {
      this.logger.log(`✅ Todos los datos requeridos están presentes`);
    }

    return session;
  }

  /**
   * Restaura el estado desde el backend
   * Ahora incluye validación y sincronización automática de datos
   */
  async restoreFromBackend(sessionId: string): Promise<WizardState | null> {
    try {
      const response = await this.apiService.get(`${this.API_ENDPOINT}/${sessionId}`).toPromise();
      
      if (response && response.success && response.data) {
        let session = response.data as any;
        
        this.logger.log('📡 Datos recibidos del backend para restaurar sesión:', {
          sessionId: session.sessionId,
          policyId: session.policyId,
          policyNumber: session.policyNumber,
          paymentResult: session.paymentResult,
          currentStep: session.currentStep,
          stepData: session.stepData,
          completedSteps: session.completedSteps,
          status: session.status
        });
        
        // ✅ NUEVO: Validar y sincronizar datos según el paso actual
        session = this.validateAndSyncStepData(session, session.currentStep);
        
        this.logger.log('🔍 Análisis de datos de póliza:', {
          hasPolicyId: !!session.policyId,
          hasPolicyNumber: !!session.policyNumber,
          hasPaymentResult: !!session.paymentResult,
          policyIdValue: session.policyId,
          policyNumberValue: session.policyNumber,
          paymentResultValue: session.paymentResult
        });
        
        // Detectar si hay datos de póliza y ajustar currentStep si es necesario
        const hasPolicyData = !!(session.policyId && session.policyNumber);
        // ✅ SEGURIDAD: Usar indicadores en lugar de datos completos
        const hasPaymentResult = session.hasPaymentResult || false;
        const shouldBeInValidationStep = hasPolicyData || hasPaymentResult;
        
        this.logger.log('🎯 Análisis de paso correcto:', {
          currentStepFromBackend: session.currentStep,
          hasPolicyData: hasPolicyData,
          hasPaymentResult: hasPaymentResult,
          shouldBeInValidationStep: shouldBeInValidationStep,
          recommendedStep: shouldBeInValidationStep ? 3 : session.currentStep
        });
        
        // Ajustar currentStep si hay datos de póliza pero el paso no es correcto
        const adjustedCurrentStep = shouldBeInValidationStep && session.currentStep < 3 ? 3 : session.currentStep;
        
        if (adjustedCurrentStep !== session.currentStep) {
          this.logger.log('🔄 Ajustando currentStep:', {
            original: session.currentStep,
            adjusted: adjustedCurrentStep,
            reason: 'Hay datos de póliza, debe estar en paso de validación'
          });
        }
        
        // Convertir datos del backend al formato del frontend (estructura idéntica a la BD)
        // ✅ IMPORTANTE: Mapear TODOS los campos de la BD, incluyendo los que están como null
        const frontendState: WizardState = {
          id: session.id,
          sessionId: session.sessionId,
          userId: session.userId || undefined,
          currentStep: adjustedCurrentStep || 0,
          stepData: session.stepData || {},
          completedSteps: session.completedSteps || [],
          status: session.status || 'ACTIVE',
          expiresAt: session.expiresAt ? new Date(session.expiresAt) : undefined,
          quotationId: session.quotationId || undefined,
          policyId: session.policyId || undefined,
          metadata: session.metadata || {},
          publicIp: session.publicIp,
          userAgent: session.userAgent,
          lastActivityAt: session.lastActivityAt ? new Date(session.lastActivityAt) : undefined,
          completedAt: session.completedAt ? new Date(session.completedAt) : undefined,
          createdAt: session.createdAt ? new Date(session.createdAt) : undefined,
          updatedAt: session.updatedAt ? new Date(session.updatedAt) : undefined,
          timestamp: Date.now(),
          lastActivity: Date.now(),
          
          // ✅ Campos derivados - usar EXACTAMENTE como están en la BD (incluyendo null)
          selectedPlan: session.selectedPlan || '',
          selectedPlanName: session.selectedPlanName || '',
          quotationNumber: session.quotationNumber || '',
          // ✅ Usar userData de la BD directamente (puede ser null o tener datos)
          userData: session.userData || this.extractUserDataFromStepData(session.stepData),
          // ✅ SEGURIDAD: Solo indicadores de pago, NO datos completos
          hasPaymentData: session.hasPaymentData || false,
          hasPaymentResult: session.hasPaymentResult || false,
          paymentStatus: session.paymentStatus || null,
          
          // ✅ SEGURIDAD: Solo indicadores de contrato y validación
          hasContractData: session.hasContractData || false,
          hasValidationResult: session.hasValidationResult || false,
          validationStatus: session.validationStatus || null,
          
          // ✅ Campos adicionales para compatibilidad (estructura idéntica a la BD)
          policyNumber: session.policyNumber || '',
          paymentAmount: session.paymentAmount ? parseFloat(String(session.paymentAmount)) : 0,
          validationResult: session.validationResult || null,
          // ✅ validationRequirements está en stepData.step5, extraerlo
          validationRequirements: session.stepData?.step5?.validationRequirements || [],
        };

        // ✅ SEGURIDAD: Sanitizar estado antes de guardar en sessionStorage
        const sanitizedState = this.sanitizeStateForStorage(frontendState);
        
        // Guardar en sessionStorage (solo datos no sensibles)
        sessionStorage.setItem(this.SESSION_KEY, JSON.stringify(sanitizedState));
        // Emitir estado completo para uso interno (no se guarda en sessionStorage)
        this.stateSubject.next(frontendState);
        
        this.logger.log('💾 Estado restaurado guardado en sessionStorage:', {
          policyId: frontendState.policyId,
          policyNumber: frontendState.policyNumber,
          hasPaymentData: frontendState.hasPaymentData,
          hasPaymentResult: frontendState.hasPaymentResult,
          paymentStatus: frontendState.paymentStatus,
          paymentAmount: frontendState.paymentAmount,
          currentStep: frontendState.currentStep,
          userData: frontendState.userData
        });
        
        this.logger.log(`✅ Estado restaurado desde backend para sesión ${sessionId}`);
        return frontendState;
      }
    } catch (error) {
      this.logger.error('❌ Error restaurando desde backend:', error);
    }
    
    return null;
  }

  /**
   * Extrae userData desde stepData si no existe en campos principales
   */
  private extractUserDataFromStepData(stepData: any): any {
    if (!stepData) return null;
    
    const userData: any = {};
    
    if (stepData.step0?.tipoUsuario) {
      userData.tipoUsuario = stepData.step0.tipoUsuario;
    }
    
    if (stepData.step1) {
      if (stepData.step1.nombre) {
        userData.name = stepData.step1.nombre;
        userData.nombre = stepData.step1.nombre;
      }
      if (stepData.step1.correo) {
        userData.email = stepData.step1.correo;
        userData.correo = stepData.step1.correo;
      }
      if (stepData.step1.telefono) {
        userData.phone = stepData.step1.telefono;
        userData.telefono = stepData.step1.telefono;
      }
      if (stepData.step1.rentaMensual) {
        userData.rentaMensual = stepData.step1.rentaMensual;
      }
      if (stepData.step1.complementos) {
        userData.complementos = stepData.step1.complementos;
      }
    }
    
    return Object.keys(userData).length > 0 ? userData : null;
  }

  /**
   * Extrae contractData desde stepData si no existe en campos principales
   */
  private extractContractDataFromStepData(stepData: any): any {
    if (!stepData) return null;
    
    if (stepData.step4) {
      return {
        propietario: stepData.step4.propietario,
        inquilino: stepData.step4.inquilino,
        fiador: stepData.step4.fiador,
        inmueble: stepData.step4.inmueble
      };
    }
    
    if (stepData.step6) {
      return {
        contractTerms: stepData.step6.contractTerms,
        signatures: stepData.step6.signatures
      };
    }
    
    return null;
  }

  /**
   * Vincula la sesión a un usuario
   */
  async linkToUser(userId: string): Promise<void> {
    const state = this.getState();
    
    try {
      await this.apiService.patch(
        `${this.API_ENDPOINT}/${state.sessionId}/link-user`,
        { userId }
      ).toPromise();
      
      await this.saveState({ userId });
      this.logger.log(`✅ Sesión ${state.sessionId} vinculada al usuario ${userId}`);
    } catch (error) {
      this.logger.error('❌ Error vinculando usuario:', error);
      throw error;
    }
  }

  /**
   * Completa la sesión del wizard
   */
  async completeSession(): Promise<void> {
    const state = this.getState();
    
    try {
      await this.apiService.patch(
        `${this.API_ENDPOINT}/${state.sessionId}/complete`,
        {}
      ).toPromise();
      
      this.logger.log(`✅ Sesión ${state.sessionId} completada`);
    } catch (error) {
      this.logger.error('❌ Error completando sesión:', error);
      throw error;
    }
  }

  /**
   * Marca un paso como completado
   */
  async completeStep(step: number): Promise<void> {
    const currentState = this.getState();
    if (!currentState.completedSteps.includes(step)) {
      currentState.completedSteps.push(step);
      await this.saveState({ completedSteps: currentState.completedSteps });
      
      // Sincronizar con el backend para guardar los pasos completados
      await this.syncWithBackendCorrected(this.getState()).catch(error => {
        this.logger.error('❌ Error sincronizando pasos completados con backend:', error);
      });
      
      this.logger.log(`✅ Paso ${step} marcado como completado y sincronizado con backend`);
    }
  }

  /**
   * Verifica si un paso está completado
   */
  isStepCompleted(step: number): boolean {
    const currentState = this.getState();
    return currentState.completedSteps.includes(step);
  }

  /**
   * Obtiene el último paso completado
   */
  getLastCompletedStep(): number {
    const currentState = this.getState();
    return currentState.completedSteps.length > 0 
      ? Math.max(...currentState.completedSteps) 
      : -1;
  }

  /**
   * Limpia el estado del wizard
   */
  clearState(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    
    try {
      sessionStorage.removeItem(this.SESSION_KEY);
      this.stateSubject.next(null);
      this.logger.log('🧹 Estado del wizard limpiado de sessionStorage');
    } catch (error) {
      this.logger.error('❌ Error limpiando estado del wizard:', error);
    }
  }

  /**
   * Verifica si hay un estado guardado válido
   */
  hasSavedState(): boolean {
    if (!isPlatformBrowser(this.platformId)) return false;
    
    try {
      const sessionState = sessionStorage.getItem(this.SESSION_KEY);
      if (sessionState) {
        const state = JSON.parse(sessionState);
        return this.isStateValid(state);
      }
    } catch (error) {
      this.logger.error('❌ Error verificando estado guardado:', error);
    }
    
    return false;
  }

  /**
   * Actualiza la actividad del usuario (con debounce)
   */
  updateActivity(): void {
    this.activitySubject.next();
  }

  /**
   * Actualiza la actividad del usuario (sin debounce)
   */
  private updateActivityDebounced(): void {
    const currentState = this.getState();
    if (currentState) {
      // Solo actualizar en sessionStorage, no hacer sync con backend
      const updatedState = {
        ...currentState,
        lastActivity: Date.now()
      };
      if (isPlatformBrowser(this.platformId)) {
        const sanitizedState = this.sanitizeStateForStorage(updatedState);
        sessionStorage.setItem(this.SESSION_KEY, JSON.stringify(sanitizedState));
      }
    }
  }

  /**
   * Obtiene información del estado para debugging
   */
  getStateInfo(): any {
    const state = this.getState();
    return {
      sessionId: state.sessionId,
      currentStep: state.currentStep,
      completedSteps: state.completedSteps,
      userId: state.userId,
      quotationId: state.quotationId,
      policyId: state.policyId,
      lastActivity: new Date(state.lastActivity).toISOString(),
      hasValidState: this.isStateValid(state)
    };
  }

  /**
   * Restaura desde URL de cotización
   */
  async restoreFromQuotationUrl(quotationNumber: string): Promise<WizardState | null> {
    try {
      // Buscar sesión por número de cotización
      const quotationResponse = await this.apiService.get(`/quotations/by-number/${quotationNumber}`).toPromise();
      
      if (quotationResponse && quotationResponse.success && quotationResponse.data) {
        const quotation = quotationResponse.data as any;
        
        // Si la cotización tiene un sessionId asociado, restaurar desde ahí
        if (quotation.wizardSessionId) {
          return await this.restoreFromBackend(quotation.wizardSessionId);
        }
        
        // Si no, crear nueva sesión con los datos de la cotización
        const newSessionId = this.generateSessionId();
        const restoredState: WizardState = {
          sessionId: newSessionId,
          currentStep: 3, // Ir directamente al paso de validación
          stepData: {},
          completedSteps: [0, 1, 2], // Marcar pasos anteriores como completados
          status: 'ACTIVE',
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 horas
          quotationId: quotation.id || '',
          userId: quotation.userId || '',
          metadata: {},
          timestamp: Date.now(),
          lastActivity: Date.now(),
          // Campos derivados
          selectedPlan: quotation.planId || '',
          selectedPlanName: quotation.planName || '',
          quotationNumber: quotation.quotationNumber || '',
          userData: quotation.userData,
          
          // Campos adicionales para compatibilidad
          policyNumber: '',
          paymentAmount: 0,
          validationResult: null
        };

        // ✅ SEGURIDAD: Sanitizar estado antes de guardar
        const sanitizedState = this.sanitizeStateForStorage(restoredState);
        // Guardar localmente
        sessionStorage.setItem(this.SESSION_KEY, JSON.stringify(sanitizedState));
        this.stateSubject.next(restoredState);
        
        // Crear sesión en backend
        const publicIp = await this.getPublicIp();
        const userAgent = typeof navigator !== 'undefined' 
          ? navigator.userAgent 
          : 'Unknown-User-Agent';
        await this.apiService.post(this.API_ENDPOINT, {
          sessionId: newSessionId,
          userId: quotation.userId || undefined, // No enviar string vacío
          quotationId: quotation.id || '',
          publicIp,
          userAgent,
          createOnly: true // Crear nueva sesión sin reutilizar por IP
        }).toPromise();
        
        this.logger.log(`✅ Estado restaurado desde cotización ${quotationNumber}`);
        return restoredState;
      }
    } catch (error) {
      this.logger.error('❌ Error restaurando desde URL de cotización:', error);
    }
    
    return null;
  }

  /**
   * Obtener o crear sesión del wizard
   * ✅ MODIFICADO: NO crea automáticamente una nueva sesión
   * Primero busca por IP, luego por sessionId local, y solo crea si no encuentra ninguna
   */
  async getOrCreateSession(): Promise<string | null> {
    const currentState = this.getState();
    
    // PRIMERO: Buscar si hay una sesión activa para esta IP
    try {
      const publicIp = await this.getPublicIp();
      const activeSessionResponse = await this.apiService.get(`${this.API_ENDPOINT}/ip/${publicIp}`).toPromise();
      
      if (activeSessionResponse) {
        // Manejar tanto respuesta envuelta como directa
        const actualData = (activeSessionResponse as any).data || activeSessionResponse;
        
        if (actualData && actualData.sessionId) {
          const activeSessionId = actualData.id || actualData.sessionId;
        this.logger.log('✅ Sesión activa encontrada para esta IP:', activeSessionId);
        
          // Restaurar el estado completo desde el backend
          const restoredState = await this.restoreFromBackend(activeSessionId);
          if (restoredState) {
        return activeSessionId;
          }
        }
      }
    } catch (error) {
      this.logger.log('⚠️ No se encontró sesión activa para esta IP, continuando con lógica normal');
    }
    
    // SEGUNDO: Si no hay sesión activa para la IP, verificar si la sesión local existe
    if (currentState.sessionId || currentState.id) {
      try {
        const sessionIdToCheck = currentState.id || currentState.sessionId;
        const response = await this.apiService.get(`${this.API_ENDPOINT}/${sessionIdToCheck}`).toPromise();
        if (response) {
          // Manejar tanto respuesta envuelta como directa
          const actualData = (response as any).data || response;
          if (actualData && (actualData.sessionId || actualData.id)) {
            // Restaurar el estado completo desde el backend
            const restoredState = await this.restoreFromBackend(actualData.id || actualData.sessionId);
            if (restoredState) {
              return actualData.id || actualData.sessionId;
            }
          }
        }
      } catch (error) {
        this.logger.log('⚠️ Sesión local no encontrada en backend');
      }
    }
    
    // ✅ NO crear automáticamente una nueva sesión
    // Retornar null para indicar que no se encontró ninguna sesión
    this.logger.log('⚠️ No se encontró ninguna sesión existente');
    return null;
  }

  /**
   * Convierte automáticamente sessionId o UUID a id (UUID) si es necesario
   * Esto permite compatibilidad con URLs antiguas que usan sessionId o UUID
   */
  async convertSessionIdToId(sessionId: string): Promise<string> {
    // Si ya es un UUID (formato xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx), devolverlo tal como está
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(sessionId)) {
      this.logger.log('✅ Ya es un UUID válido, usando directamente:', sessionId);
      return sessionId;
    }

    // Si es un sessionId (formato pji_session_...), buscar la sesión y obtener el id
    if (sessionId.startsWith('pji_session_')) {
      try {
        this.logger.log('🔄 Convirtiendo sessionId a id (UUID):', sessionId);
        const sessionResponse = await this.apiService.get(`${this.API_ENDPOINT}/${sessionId}`).toPromise();
        
        if (sessionResponse) {
          const actualData = (sessionResponse as any).data || sessionResponse;
          if (actualData && actualData.id) {
            this.logger.log('✅ Conversión exitosa sessionId → UUID:', { 
              sessionId: sessionId, 
              id: actualData.id 
            });
            return actualData.id;
          }
        }
      } catch (error) {
        this.logger.warning('❌ No se pudo convertir sessionId a id:', error);
      }
    }

    // Si no se puede convertir, devolver el sessionId original
    this.logger.log('⚠️ No se pudo convertir, usando sessionId original:', sessionId);
    return sessionId;
  }

  /**
   * Verifica si existe una sesión activa para la IP actual sin crear una nueva
   * ✅ IMPORTANTE: Si encuentra una sesión, obtiene y guarda los tokens JWT automáticamente
   */
  async checkActiveSessionByIp(): Promise<string | null> {
    try {
      const publicIp = await this.getPublicIp();
      this.logger.log('🔍 [checkActiveSessionByIp] Buscando sesión por IP:', publicIp);
      
      const activeSessionResponse = await this.apiService.get(`${this.API_ENDPOINT}/ip/${publicIp}`).toPromise();
      
      this.logger.log('📡 [checkActiveSessionByIp] Respuesta del backend:', activeSessionResponse);
      
      if (activeSessionResponse) {
        // Manejar tanto respuesta envuelta como directa
        const actualData = (activeSessionResponse as any).data || activeSessionResponse;
        
        this.logger.log('📋 [checkActiveSessionByIp] Datos procesados:', actualData);
        
        // ✅ NUEVO: La respuesta ahora incluye id, sessionId, tokens y status directamente
        if (actualData && (actualData.sessionId || actualData.id)) {
          const sessionIdToReturn = actualData.id || actualData.sessionId;
          const sessionIdForLogging = actualData.sessionId || 'N/A';
          
          this.logger.log('✅ [checkActiveSessionByIp] Sesión encontrada por IP:', { 
            sessionId: sessionIdForLogging, 
            id: actualData.id,
            status: actualData.status,
            returning: sessionIdToReturn,
            hasTokens: !!(actualData.accessToken && actualData.refreshToken)
          });
          
          // ✅ IMPORTANTE: Guardar tokens JWT que vienen directamente en la respuesta
          if (actualData.accessToken && actualData.refreshToken) {
            this.logger.log('🔑 [checkActiveSessionByIp] Tokens recibidos en la respuesta, guardándolos...');
            if (typeof window !== 'undefined' && window.localStorage) {
              localStorage.setItem('wizard_access_token', actualData.accessToken);
              localStorage.setItem('wizard_refresh_token', actualData.refreshToken);
              this.logger.log('✅ [checkActiveSessionByIp] Tokens guardados en localStorage');
            }
          } else {
            this.logger.warning('⚠️ [checkActiveSessionByIp] No se recibieron tokens en la respuesta. Verificar backend.');
          }
          
          // ✅ Retornar el sessionId (o id) para que el frontend pueda obtener la sesión completa después
          return sessionIdToReturn;
        } else {
          this.logger.warning('⚠️ [checkActiveSessionByIp] Respuesta recibida pero sin sessionId ni id:', actualData);
        }
      } else {
        this.logger.log('⚠️ [checkActiveSessionByIp] No se recibió respuesta del backend (null o undefined)');
      }
    } catch (error) {
      const errorStatus = (error as any)?.status;
      const errorMessage = (error as any)?.message || error;
      
      if (errorStatus === 404) {
        this.logger.log('⚠️ [checkActiveSessionByIp] No se encontró sesión activa para esta IP (404)');
      } else if (errorStatus === 429) {
        this.logger.warning('⚠️ [checkActiveSessionByIp] Rate limit alcanzado (429) al buscar sesión por IP');
      } else {
        this.logger.error('❌ [checkActiveSessionByIp] Error al buscar sesión por IP:', errorMessage);
      }
    }
    
    this.logger.log('⚠️ [checkActiveSessionByIp] Retornando null - no se encontró sesión activa');
    return null;
  }

  /**
   * Crea una nueva sesión forzando nuevo sessionId y guarda en estado local
   */
  async createNewSession(): Promise<string> {
    const currentState = this.getState();
    const newSessionId = this.generateSessionId();
    const publicIp = await this.getPublicIp();

    // ✅ IMPORTANTE: Limpiar tokens viejos ANTES de crear nueva sesión
    // Esto evita que peticiones en vuelo usen tokens de sesiones anteriores
    if (typeof window !== 'undefined' && window.localStorage) {
      this.logger.log('🧹 Limpiando tokens de sesión anterior antes de crear nueva sesión...');
      localStorage.removeItem('wizard_access_token');
      localStorage.removeItem('wizard_refresh_token');
    }

    // Usar wizardSessionService que maneja tokens automáticamente
    const userAgent = typeof navigator !== 'undefined' 
      ? navigator.userAgent 
      : 'Unknown-User-Agent';
    const platform = typeof navigator !== 'undefined'
      ? navigator.platform
      : 'Unknown-Platform';
      
    const createSessionResponse = await this.wizardSessionService.createSession({
      sessionId: newSessionId,
      userId: currentState.userId || undefined, // No enviar string vacío
      publicIp,
      userAgent,
      createOnly: true, // Crear nueva sesión sin reutilizar por IP
      metadata: {
        timestamp: new Date().toISOString(),
        browser: userAgent,
        platform
      }
    }).toPromise();

    const responseData = createSessionResponse?.data as any;
    const createdSessionId = responseData?.sessionId || newSessionId;
    const createdId = responseData?.id; // Capturar el UUID generado por el backend

    // ✅ IMPORTANTE: Verificar y guardar tokens si vienen en la respuesta
    if (responseData?.accessToken && responseData?.refreshToken) {
      this.logger.log('🔑 Tokens recibidos al crear sesión, guardándolos...');
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem('wizard_access_token', responseData.accessToken);
        localStorage.setItem('wizard_refresh_token', responseData.refreshToken);
        this.logger.log('✅ Tokens guardados en localStorage al crear sesión');
      }
    } else {
      this.logger.warning('⚠️ No se recibieron tokens al crear sesión. Verificar backend.');
    }

    // ✅ LIMPIAR campos relacionados con cotización y pago al crear nueva sesión
    const updatedState: WizardState = {
      ...currentState,
      sessionId: createdSessionId,
      id: createdId, // Agregar el UUID al estado local
      timestamp: Date.now(),
      lastActivity: Date.now(),
      // Limpiar campos relacionados con cotización y pago
      quotationId: undefined,
      quotationNumber: undefined,
      policyId: undefined,
      policyNumber: undefined,
      paymentData: null,
      paymentResult: null,
      contractData: null,
      paymentAmount: 0,
      validationResult: null,
      // Mantener solo el selectedPlan y selectedPlanName si existen
      // (estos se establecen al seleccionar el plan)
      selectedPlan: currentState.selectedPlan || '',
      selectedPlanName: currentState.selectedPlanName || '',
      // Resetear paso actual a 0 para nueva sesión
      currentStep: 0,
      completedSteps: [],
      // Limpiar stepData excepto step0 si existe
      stepData: currentState.stepData?.step0 ? {
        step0: currentState.stepData.step0
      } : {}
    };

    if (isPlatformBrowser(this.platformId)) {
      const sanitizedState = this.sanitizeStateForStorage(updatedState);
      sessionStorage.setItem(this.SESSION_KEY, JSON.stringify(sanitizedState));
    }
    this.stateSubject.next(updatedState);

    this.logger.log('✅ Nueva sesión creada:', { sessionId: createdSessionId, id: createdId });
    this.logger.log('🧹 Campos de cotización y pago limpiados para nueva sesión');
    
    // Retornar el id (UUID) si está disponible, sino el sessionId como fallback
    return createdId || createdSessionId;
  }

  /**
   * Actualiza un paso específico de la sesión en el backend
   * ✅ OPTIMIZADO: Retorna los datos actualizados directamente del PATCH
   * 
   * @returns Promise<WizardState> - Estado actualizado desde el backend
   */
  async updateSessionStep(sessionId: string, step: number, stepData: any): Promise<WizardState> {
    try {
      const currentState = this.getState();
      const patchResponse = await this.apiService.patch<WizardSessionData>(
        `${this.API_ENDPOINT}/${sessionId}/step`,
        {
          step,
          stepData,
          quotationId: currentState.quotationId,
          policyId: currentState.policyId
        }
      ).toPromise();

      if (!patchResponse) {
        this.logger.warning('⚠️ No se recibió respuesta del PATCH en updateSessionStep');
        return currentState;
      }

      // Extraer datos de la respuesta del PATCH
      const backendData = (patchResponse as any).data || patchResponse;

      // Convertir a WizardState
      const updatedState: WizardState = {
        id: backendData.id,
        sessionId: backendData.sessionId,
        userId: backendData.userId || undefined,
        currentStep: backendData.currentStep || step,
        stepData: backendData.stepData || {},
        completedSteps: backendData.completedSteps || [],
        status: backendData.status || 'ACTIVE',
        expiresAt: backendData.expiresAt ? new Date(backendData.expiresAt) : new Date(Date.now() + 24 * 60 * 60 * 1000),
        quotationId: backendData.quotationId,
        policyId: backendData.policyId,
        metadata: backendData.metadata || {},
        publicIp: backendData.publicIp,
        userAgent: backendData.userAgent,
        lastActivityAt: backendData.lastActivityAt ? new Date(backendData.lastActivityAt) : new Date(),
        completedAt: backendData.completedAt ? new Date(backendData.completedAt) : undefined,
        selectedPlan: backendData.selectedPlan || '',
        selectedPlanName: backendData.selectedPlanName || '',
        quotationNumber: backendData.quotationNumber || '',
        userData: backendData.userData,
        paymentData: backendData.paymentData,
        contractData: backendData.contractData,
        paymentResult: backendData.paymentResult,
        policyNumber: backendData.policyNumber || '',
        validationRequirements: backendData.stepData?.step5?.validationRequirements || [],
        paymentAmount: backendData.paymentAmount || 0,
        validationResult: backendData.validationResult,
        timestamp: Date.now(),
        lastActivity: Date.now()
      };

      // ✅ SEGURIDAD: Sanitizar estado antes de guardar
      const sanitizedState = this.sanitizeStateForStorage(updatedState);
      // Actualizar estado local
      if (isPlatformBrowser(this.platformId)) {
        sessionStorage.setItem(this.SESSION_KEY, JSON.stringify(sanitizedState));
        this.stateSubject.next(updatedState);
      }

      return updatedState;
    } catch (error) {
      this.logger.error('Error actualizando paso de sesión:', error);
      throw error;
    }
  }
}