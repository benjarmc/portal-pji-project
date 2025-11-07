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
  userData?: any;                 // = stepData.step2?.userData
  paymentData?: any;              // = stepData.step4?.paymentData
  contractData?: any;             // = stepData.step7?.propertyData || stepData.step8?.contractData
  paymentResult?: any;            // = stepData.step5?.validationData
  
  // Campos adicionales para compatibilidad (deprecated - usar stepData)
  policyNumber?: string;          // = stepData.step5?.policyNumber
  paymentAmount?: number;         // = stepData.step4?.paymentAmount
  validationResult?: any;        // = stepData.step5?.validationData
  validationRequirements?: ValidationRequirement[]; // = stepData.step5?.validationRequirements
  captureData?: {                // Datos de captura del paso 5
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
    nombre: string;
    telefono: string;
    correo: string;
    rentaMensual: number;
    complementos?: string[];
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
    timestamp?: Date;
  };
  step4?: { 
    // Inputs del paso de captura de datos
    propietario: any;
    inquilino: any;
    fiador: any;
    inmueble: any;
    timestamp?: Date;
  };
  step5?: { 
    // Inputs del paso de validación
    validationRequirements?: ValidationRequirement[];
    timestamp?: Date;
  };
  step6?: { 
    // Inputs del paso de contrato
    contractTerms?: any;
    signatures?: any;
    timestamp?: Date;
  };
  step7?: { 
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
  
  // ✅ Debounce para sincronización con backend (evita múltiples llamadas rápidas)
  private syncSubject = new Subject<WizardState>();
  private syncDebounceTime = 3000; // 3 segundos de debounce para sincronización (aumentado para evitar 429)
  private pendingSyncState: WizardState | null = null;
  private syncPromise: Promise<WizardState> | null = null;
  private lastSyncTime: number = 0;
  private minTimeBetweenSyncs = 5000; // Mínimo 5 segundos entre sincronizaciones (aumentado para evitar 429)

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
   */
  private setupSyncDebounce(): void {
    this.syncSubject.pipe(
      debounceTime(this.syncDebounceTime)
    ).subscribe(async (state) => {
      if (this.pendingSyncState && this.syncPromise) {
        try {
          const syncedState = await this.executeSync(this.pendingSyncState);
          // Resolver la promesa pendiente con el estado sincronizado
          const promise = this.syncPromise as any;
          if (promise.resolve) {
            promise.resolve(syncedState);
          }
          this.pendingSyncState = null;
          this.syncPromise = null;
        } catch (error) {
          this.logger.error('❌ Error en sincronización con debounce:', error);
          const promise = this.syncPromise as any;
          if (promise.reject) {
            promise.reject(error);
          }
          this.pendingSyncState = null;
          this.syncPromise = null;
        }
      }
    });
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
    if (!isPlatformBrowser(this.platformId)) {
      return this.getDefaultState();
    }

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
          // Guardar el estado actualizado sin hacer sync con backend
          sessionStorage.setItem(this.SESSION_KEY, JSON.stringify(updatedState));
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
   * Guarda el estado del wizard SOLO localmente (sessionStorage)
   * NO sincroniza con backend automáticamente
   * 
   * Para sincronizar con backend, usar saveAndSync() o syncWithBackendCorrected()
   */
  async saveState(state: Partial<WizardState>): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) return;

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
      // Guardar localmente primero
      sessionStorage.setItem(this.SESSION_KEY, JSON.stringify(newState));
      
      // Emitir cambios en el estado
      this.stateSubject.next(newState);
      
      // Solo loggear cambios importantes de paso
      if (newState.currentStep !== currentState.currentStep) {
        this.logger.log(`🔄 Paso del wizard: ${currentState.currentStep} → ${newState.currentStep}`);
      }

      // ✅ CAMBIO: NO sincronizar automáticamente con backend
      // La sincronización debe ser explícita usando saveAndSync() o syncWithBackendCorrected()
      // Esto evita múltiples peticiones innecesarias

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
   */
  async saveAndSync(state: Partial<WizardState>): Promise<WizardState> {
    // 1. Guardar localmente primero
    await this.saveState(state);
    
    // 2. Obtener el estado actualizado
    const currentState = this.getState();
    
    // 3. Sincronizar con backend
    return await this.syncWithBackendCorrected(currentState);
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
   * Sincroniza el estado con el backend - OPTIMIZADO CON DEBOUNCE
   * Flujo optimizado: Usa respuesta del PATCH directamente, sin GET adicional
   * 1. Actualizar backend con datos del paso actual
   * 2. Usar respuesta del PATCH directamente (elimina GET innecesario)
   * 3. Sincronizar sessionStorage con la respuesta del backend
   * 
   * ✅ CON DEBOUNCE: Evita múltiples llamadas rápidas que causan errores 429
   * ✅ CON RATE LIMITING: Asegura mínimo tiempo entre sincronizaciones
   * 
   * @returns Promise<WizardState> - Estado sincronizado desde el backend
   */
  async syncWithBackendCorrected(state: WizardState): Promise<WizardState> {
    const now = Date.now();
    const timeSinceLastSync = now - this.lastSyncTime;
    
    // Si ya hay una sincronización en progreso, retornar la promesa pendiente o estado actual
    if (this.syncInProgress && this.syncPromise) {
      this.logger.log('⏳ Sincronización ya en progreso, esperando...');
      // Actualizar el estado pendiente con el más reciente
      this.pendingSyncState = state;
      return this.syncPromise;
    }
    
    // Si no ha pasado suficiente tiempo desde la última sincronización, esperar
    if (timeSinceLastSync < this.minTimeBetweenSyncs && this.pendingSyncState) {
      this.logger.log(`⏳ Esperando ${this.minTimeBetweenSyncs - timeSinceLastSync}ms antes de sincronizar...`);
      // Actualizar el estado pendiente con el más reciente
      this.pendingSyncState = state;
      // Si ya hay una promesa pendiente, retornarla
      if (this.syncPromise) {
        return this.syncPromise;
      }
    }
    
    // Si hay una sincronización pendiente con debounce, actualizar el estado pendiente
    if (this.pendingSyncState && this.syncPromise) {
      this.logger.log('🔄 Actualizando estado pendiente de sincronización');
      this.pendingSyncState = state;
      return this.syncPromise;
    }
    
    // Guardar estado pendiente y crear promesa
    this.pendingSyncState = state;
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
    this.syncSubject.next(state);
    
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
      const sessionId = state.sessionId;
      
      if (!sessionId) {
        this.logger.warning('⚠️ No hay sessionId para sincronizar');
        return this.getState();
      }

      // 1. Preparar datos del paso actual para enviar al backend
      const stepData = this.mapStateToStepData(state);
      const currentStepData = stepData[`step${state.currentStep}` as keyof WizardStepData] || {};
      
      this.logger.log('📡 Enviando datos del paso actual al backend:', {
        sessionId,
        step: state.currentStep,
        stepData: currentStepData,
        userData: state.userData,
        selectedPlan: state.selectedPlan,
        selectedPlanName: state.selectedPlanName,
        quotationNumber: state.quotationNumber,
        quotationId: state.quotationId,
        userId: state.userId,
        policyId: state.policyId,
        policyNumber: state.policyNumber,
        completedSteps: state.completedSteps
      });

      // 2. Actualizar el backend con los datos del paso actual
      const updateData = {
        step: state.currentStep,
        stepData: currentStepData,
        lastActivityAt: new Date().toISOString(),
        // Incluir campos derivados importantes cuando sea relevante
        ...(state.userData && Object.keys(state.userData).length > 0 ? { userData: state.userData } : {}),
        ...(state.selectedPlan ? { selectedPlan: state.selectedPlan } : {}),
        ...(state.selectedPlanName ? { selectedPlanName: state.selectedPlanName } : {}),
        // ✅ NO incluir quotationId ni quotationNumber si estamos en paso 0 o 1
        // La cotización solo debe crearse cuando el usuario completa el paso 1 y hace clic en "Siguiente y Pagar" o "Enviar cotización"
        ...(state.currentStep >= 2 && state.quotationNumber ? { quotationNumber: state.quotationNumber } : {}),
        ...(state.currentStep >= 2 && state.quotationId ? { quotationId: state.quotationId } : {}),
        ...(state.userId ? { userId: state.userId } : {}),
        ...(state.policyId ? { policyId: state.policyId } : {}),
        ...(state.policyNumber ? { policyNumber: state.policyNumber } : {}),
        ...(state.completedSteps && state.completedSteps.length > 0 ? { completedSteps: state.completedSteps } : {})
      };

      // ✅ OPTIMIZACIÓN: Usar respuesta del PATCH directamente (elimina GET innecesario)
      const patchResponse = await this.apiService.patch<WizardSessionData>(
        `${this.API_ENDPOINT}/${sessionId}/step`,
        updateData
      ).toPromise();

      if (!patchResponse) {
        this.logger.warning('⚠️ No se recibió respuesta del PATCH');
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

      // 3. Sincronizar sessionStorage con la respuesta del backend
      const syncedState: WizardState = {
        // Campos principales del backend
        id: backendData.id,
        sessionId: backendData.sessionId,
        userId: backendData.userId || undefined,
        currentStep: backendData.currentStep || 0,
        stepData: backendData.stepData || {},
        completedSteps: backendData.completedSteps || [],
        status: backendData.status || 'ACTIVE',
        expiresAt: backendData.expiresAt ? new Date(backendData.expiresAt) : new Date(Date.now() + 24 * 60 * 60 * 1000),
        // ✅ LIMPIAR quotationId y quotationNumber si estamos en paso 0 o 1
        // La cotización solo debe existir a partir del paso 2 (después de que el usuario completa datos y hace clic en "Siguiente y Pagar")
        quotationId: (backendData.currentStep || 0) >= 2 ? backendData.quotationId : undefined,
        policyId: backendData.policyId,
        metadata: backendData.metadata || {},
        publicIp: backendData.publicIp,
        userAgent: backendData.userAgent,
        lastActivityAt: backendData.lastActivityAt ? new Date(backendData.lastActivityAt) : new Date(),
        completedAt: backendData.completedAt ? new Date(backendData.completedAt) : undefined,
        
        // Campos derivados del backend (fuente de verdad)
        selectedPlan: backendData.selectedPlan || '',
        selectedPlanName: backendData.selectedPlanName || '',
        // ✅ LIMPIAR quotationNumber si estamos en paso 0 o 1
        quotationNumber: (backendData.currentStep || 0) >= 2 ? (backendData.quotationNumber || '') : '',
        userData: backendData.userData,
        paymentData: backendData.paymentData,
        contractData: backendData.contractData,
        paymentResult: backendData.paymentResult,
        policyNumber: backendData.policyNumber || '',
        validationRequirements: backendData.stepData?.step5?.validationRequirements || [],
        paymentAmount: backendData.paymentAmount || 0,
        validationResult: backendData.validationResult,
        
        // Campos de compatibilidad del frontend
        timestamp: Date.now(),
        lastActivity: Date.now()
      };

      // 4. Guardar en sessionStorage
      if (isPlatformBrowser(this.platformId)) {
        sessionStorage.setItem(this.SESSION_KEY, JSON.stringify(syncedState));
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
      
      // Si es un error 429 (Too Many Requests), esperar más tiempo antes de reintentar
      if (error?.status === 429 || error?.message?.includes('429') || error?.message?.includes('Too Many Requests')) {
        this.logger.warning('⚠️ Error 429 detectado, aumentando tiempo de espera...');
        // Aumentar el tiempo mínimo entre sincronizaciones temporalmente
        this.minTimeBetweenSyncs = Math.min(this.minTimeBetweenSyncs * 2, 10000); // Máximo 10 segundos
        this.syncDebounceTime = Math.min(this.syncDebounceTime * 1.5, 5000); // Máximo 5 segundos
        this.logger.log(`⏱️ Nuevos tiempos: minTimeBetweenSyncs=${this.minTimeBetweenSyncs}ms, syncDebounceTime=${this.syncDebounceTime}ms`);
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
        const createSessionResponse = await this.apiService.post(this.API_ENDPOINT, {
          sessionId: sessionId || state.sessionId,
          userId: state.userId || undefined, // No enviar string vacío
          publicIp,
          userAgent: navigator.userAgent,
          createOnly: false, // Permitir reutilización por IP
          metadata: {
            timestamp: new Date().toISOString(),
            browser: navigator.userAgent,
            platform: navigator.platform
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
          
          // Actualizar el estado local con los nuevos valores
          if (isPlatformBrowser(this.platformId)) {
            sessionStorage.setItem(this.SESSION_KEY, JSON.stringify(state));
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
            sessionStorage.setItem(this.SESSION_KEY, JSON.stringify(state));
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
            sessionStorage.setItem(this.SESSION_KEY, JSON.stringify(state));
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
            sessionStorage.setItem(this.SESSION_KEY, JSON.stringify(state));
          }
        }
        
        // Sincronizar datos de validación desde stepData.step3
        if (stepData.step3 && stepData.step3.validationCode && !state.paymentResult) {
          this.logger.log('🔄 Sincronizando datos de validación desde stepData.step3:', stepData.step3);
          state.paymentResult = {
            validationCode: stepData.step3.validationCode
          };
          if (isPlatformBrowser(this.platformId)) {
            sessionStorage.setItem(this.SESSION_KEY, JSON.stringify(state));
          }
        }
        
        // Sincronizar datos de captura desde stepData.step4
        if (stepData.step4 && (stepData.step4.propietario || stepData.step4.inquilino || stepData.step4.inmueble) && !state.contractData) {
          this.logger.log('🔄 Sincronizando datos de captura desde stepData.step4:', stepData.step4);
          state.contractData = {
            propietario: stepData.step4.propietario,
            inquilino: stepData.step4.inquilino,
            fiador: stepData.step4.fiador,
            inmueble: stepData.step4.inmueble
          };
          if (isPlatformBrowser(this.platformId)) {
            sessionStorage.setItem(this.SESSION_KEY, JSON.stringify(state));
          }
        }
        
        // Sincronizar datos de contrato desde stepData.step6
        if (stepData.step6 && stepData.step6.contractTerms && !state.contractData?.contractTerms) {
          this.logger.log('🔄 Sincronizando datos de contrato desde stepData.step6:', stepData.step6);
          state.contractData = {
            ...state.contractData,
            contractTerms: stepData.step6.contractTerms,
            signatures: stepData.step6.signatures
          };
          if (isPlatformBrowser(this.platformId)) {
            sessionStorage.setItem(this.SESSION_KEY, JSON.stringify(state));
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
                    sessionStorage.setItem(this.SESSION_KEY, JSON.stringify(state));
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
                    sessionStorage.setItem(this.SESSION_KEY, JSON.stringify(state));
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
   */
  private mapStateToStepData(state: WizardState): WizardStepData {
    // Si ya tenemos stepData estructurado, usarlo directamente
    if (state.stepData && Object.keys(state.stepData).length > 0) {
      return state.stepData;
    }
    
    // Si no, construir desde los campos derivados (compatibilidad hacia atrás)
    const stepData: WizardStepData = {};
    
    // Siempre incluir datos básicos para el paso actual
    const baseStepData = {
        timestamp: new Date() 
    };
    
    // Paso 0: Tipo de usuario
    if (state.userData?.tipoUsuario) {
      stepData.step0 = {
        tipoUsuario: state.userData.tipoUsuario,
        ...baseStepData
      };
    }
    
    // Paso 1: Datos principales (inputs del formulario)
    if (state.userData && (state.userData.name || state.userData.email || state.userData.phone || state.userData.rentaMensual)) {
      stepData.step1 = {
        nombre: state.userData.name || '',
        telefono: state.userData.phone || '',
        correo: state.userData.email || '',
        rentaMensual: state.userData.rentaMensual || 0,
        complementos: state.userData.complementos || [],
        ...baseStepData
      };
    }
    
    // Paso 2: Datos de pago (inputs del formulario de pago)
    if (state.paymentData) {
      stepData.step2 = { 
        paymentMethod: state.paymentData.method || '',
        cardData: state.paymentData.cardData || null,
        ...baseStepData
      };
    }
    
    // Paso 3: Datos de validación (inputs del formulario de validación)
    if (state.paymentResult) {
      stepData.step3 = { 
        validationCode: state.paymentResult.validationCode || '',
        ...baseStepData
      };
    }
    
    // Paso 4: Datos de captura (inputs de los formularios de captura)
    if (state.contractData) {
      stepData.step4 = { 
        propietario: state.contractData.propietario || null,
        inquilino: state.contractData.inquilino || null,
        fiador: state.contractData.fiador || null,
        inmueble: state.contractData.inmueble || null,
        ...baseStepData
      };
    }
    
    // Paso 5: Datos de validación (validationRequirements)
    if (state.validationRequirements && state.validationRequirements.length > 0) {
      stepData.step5 = { 
        validationRequirements: state.validationRequirements,
        ...baseStepData
      };
    }
    
    // Paso 6: Datos de contrato (inputs del formulario de contrato)
    if (state.contractData && state.contractData.contractTerms) {
      stepData.step6 = { 
        contractTerms: state.contractData.contractTerms,
        signatures: state.contractData.signatures || null,
        ...baseStepData
      };
    }
    
    // Paso 7: Datos finales (inputs del formulario final)
    if (state.userData && state.userData.deliveryPreferences) {
      stepData.step7 = {
        deliveryPreferences: state.userData.deliveryPreferences,
        ...baseStepData
      };
    }
    
    return stepData;
  }

  /**
   * Restaura el estado desde el backend
   */
  async restoreFromBackend(sessionId: string): Promise<WizardState | null> {
    try {
      const response = await this.apiService.get(`${this.API_ENDPOINT}/${sessionId}`).toPromise();
      
      if (response && response.success && response.data) {
        const session = response.data as any;
        
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
        const hasPaymentResult = !!session.paymentResult;
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
        
        // Convertir datos del backend al formato del frontend
        const frontendState: WizardState = {
          id: session.id,
          sessionId: session.sessionId,
          userId: session.userId,
          currentStep: adjustedCurrentStep || 0,
          stepData: session.stepData || {},
          completedSteps: session.completedSteps || [],
          status: session.status || 'ACTIVE',
          expiresAt: session.expiresAt ? new Date(session.expiresAt) : undefined,
          quotationId: session.quotationId,
          policyId: session.policyId,
          metadata: session.metadata || {},
          publicIp: session.publicIp,
          userAgent: session.userAgent,
          lastActivityAt: session.lastActivityAt ? new Date(session.lastActivityAt) : undefined,
          completedAt: session.completedAt ? new Date(session.completedAt) : undefined,
          createdAt: session.createdAt ? new Date(session.createdAt) : undefined,
          updatedAt: session.updatedAt ? new Date(session.updatedAt) : undefined,
          timestamp: Date.now(),
          lastActivity: Date.now(),
          // Campos derivados - usar directamente de la BD
          selectedPlan: session.selectedPlan || '',
          selectedPlanName: session.selectedPlanName || '',
          quotationNumber: session.quotationNumber || session.stepData?.step3?.quotationNumber || '',
          userData: session.userData || session.stepData?.step2?.userData,
          paymentData: session.paymentData || session.stepData?.step4?.paymentData,
          contractData: session.contractData || session.stepData?.step7?.propertyData || session.stepData?.step8?.contractData,
          paymentResult: session.paymentResult || session.stepData?.step5?.validationData,
          
          // Campos adicionales para compatibilidad
          policyNumber: session.policyNumber || session.stepData?.step5?.policyNumber || session.stepData?.step4?.policyNumber || '',
          paymentAmount: session.paymentAmount || session.stepData?.step4?.paymentAmount || session.stepData?.step5?.paymentAmount || 0,
          validationResult: session.validationResult || session.stepData?.step5?.validationData,
          validationRequirements: session.stepData?.step5?.validationRequirements || [],
        };

        // Guardar en sessionStorage
        sessionStorage.setItem(this.SESSION_KEY, JSON.stringify(frontendState));
        this.stateSubject.next(frontendState);
        
        this.logger.log('💾 Estado restaurado guardado en sessionStorage:', {
          policyId: frontendState.policyId,
          policyNumber: frontendState.policyNumber,
          paymentResult: frontendState.paymentResult,
          currentStep: frontendState.currentStep
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
        sessionStorage.setItem(this.SESSION_KEY, JSON.stringify(updatedState));
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

        // Guardar localmente
        sessionStorage.setItem(this.SESSION_KEY, JSON.stringify(restoredState));
        this.stateSubject.next(restoredState);
        
        // Crear sesión en backend
        const publicIp = await this.getPublicIp();
        await this.apiService.post(this.API_ENDPOINT, {
          sessionId: newSessionId,
          userId: quotation.userId || undefined, // No enviar string vacío
          quotationId: quotation.id || '',
          publicIp,
          userAgent: navigator.userAgent,
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
   */
  async getOrCreateSession(): Promise<string> {
    const currentState = this.getState();
    
    // PRIMERO: Buscar si hay una sesión activa para esta IP
    try {
      const publicIp = await this.getPublicIp();
      const activeSessionResponse = await this.apiService.get(`${this.API_ENDPOINT}/ip/${publicIp}`).toPromise();
      
      if (activeSessionResponse) {
        // Manejar tanto respuesta envuelta como directa
        const actualData = (activeSessionResponse as any).data || activeSessionResponse;
        
        if (actualData && actualData.sessionId) {
          const activeSessionId = actualData.sessionId;
        this.logger.log('✅ Sesión activa encontrada para esta IP:', activeSessionId);
        
        // Actualizar el estado local con el sessionId de la sesión activa
        const updatedState = {
          ...currentState,
          sessionId: activeSessionId
        };
        
        if (isPlatformBrowser(this.platformId)) {
          sessionStorage.setItem(this.SESSION_KEY, JSON.stringify(updatedState));
        }
        
        this.stateSubject.next(updatedState);
        return activeSessionId;
        }
      }
    } catch (error) {
      this.logger.log('⚠️ No se encontró sesión activa para esta IP, continuando con lógica normal');
    }
    
    // SEGUNDO: Si no hay sesión activa para la IP, verificar si la sesión local existe
    if (currentState.sessionId) {
      try {
        const response = await this.apiService.get(`${this.API_ENDPOINT}/${currentState.sessionId}`).toPromise();
        if (response) {
          // Manejar tanto respuesta envuelta como directa
          const actualData = (response as any).data || response;
          if (actualData && actualData.sessionId) {
          return currentState.sessionId;
          }
        }
      } catch (error) {
        this.logger.log('⚠️ Sesión local no encontrada en backend, creando nueva');
      }
    }
    
    // TERCERO: Crear nueva sesión
    const newSessionId = this.generateSessionId();
    const publicIp = await this.getPublicIp();
    
    try {
      const createSessionResponse = await this.apiService.post(this.API_ENDPOINT, {
        sessionId: newSessionId,
        userId: currentState.userId,
        publicIp,
        userAgent: navigator.userAgent,
        metadata: {
          timestamp: new Date().toISOString(),
          browser: navigator.userAgent,
          platform: navigator.platform
        }
      }).toPromise();
      
      if (createSessionResponse) {
        // Manejar tanto respuesta envuelta como directa
        const actualData = (createSessionResponse as any).data || createSessionResponse;
        const createdSessionId = actualData?.sessionId || newSessionId;
        const createdId = actualData?.id; // Capturar el UUID generado por el backend
        
        // Actualizar el estado local con el nuevo sessionId y id
        const updatedState = {
          ...currentState,
          sessionId: createdSessionId,
          id: createdId // Agregar el UUID al estado local
        };
        
        if (isPlatformBrowser(this.platformId)) {
          sessionStorage.setItem(this.SESSION_KEY, JSON.stringify(updatedState));
        }
        
        this.stateSubject.next(updatedState);
        this.logger.log('✅ Nueva sesión creada:', { sessionId: createdSessionId, id: createdId });
        
        // Retornar el id (UUID) si está disponible, sino el sessionId como fallback
        return createdId || createdSessionId;
      }
    } catch (error) {
      this.logger.error('❌ Error creando sesión:', error);
    }
    
    return newSessionId;
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
   */
  async checkActiveSessionByIp(): Promise<string | null> {
    try {
      const publicIp = await this.getPublicIp();
      this.logger.log('publicIp: ', publicIp);
      const activeSessionResponse = await this.apiService.get(`${this.API_ENDPOINT}/ip/${publicIp}`).toPromise();
      
      if (activeSessionResponse) {
        // Manejar tanto respuesta envuelta como directa
        const actualData = (activeSessionResponse as any).data || activeSessionResponse;
        
        if (actualData && actualData.sessionId) {
          // Usar el id (UUID) si está disponible, sino el sessionId como fallback
          const sessionIdToReturn = actualData.id || actualData.sessionId;
          this.logger.log('✅ Sesión activa encontrada por IP:', { 
            sessionId: actualData.sessionId, 
            id: actualData.id,
            returning: sessionIdToReturn 
          });
          return sessionIdToReturn;
        }
      }
    } catch (error) {
      this.logger.log('⚠️ No se encontró sesión activa para esta IP:', error);
    }
    return null;
  }

  /**
   * Crea una nueva sesión forzando nuevo sessionId y guarda en estado local
   */
  async createNewSession(): Promise<string> {
    const currentState = this.getState();
    const newSessionId = this.generateSessionId();
    const publicIp = await this.getPublicIp();

    // Usar wizardSessionService que maneja tokens automáticamente
    const createSessionResponse = await this.wizardSessionService.createSession({
      sessionId: newSessionId,
      userId: currentState.userId || undefined, // No enviar string vacío
      publicIp,
      userAgent: navigator.userAgent,
      createOnly: true, // Crear nueva sesión sin reutilizar por IP
      metadata: {
        timestamp: new Date().toISOString(),
        browser: navigator.userAgent,
        platform: navigator.platform
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
      sessionStorage.setItem(this.SESSION_KEY, JSON.stringify(updatedState));
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

      // Actualizar estado local
      if (isPlatformBrowser(this.platformId)) {
        sessionStorage.setItem(this.SESSION_KEY, JSON.stringify(updatedState));
        this.stateSubject.next(updatedState);
      }

      return updatedState;
    } catch (error) {
      this.logger.error('Error actualizando paso de sesión:', error);
      throw error;
    }
  }
}