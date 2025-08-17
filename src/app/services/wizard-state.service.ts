import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export interface WizardState {
  currentStep: number;
  selectedPlan: string | null;
  quotationId: string | null;
  quotationNumber: string | null;
  userId: string | null;
  userData: {
    name?: string;
    email?: string;
    phone?: string;
    postalCode?: string;
    tipoUsuario?: 'arrendador' | 'arrendatario' | 'asesor';
  };
  paymentData: {
    cardType?: string;
    lastFourDigits?: string;
  };
  paymentResult?: {
    success: boolean;
    paymentId: string;
    chargeId: string;
    policyId: string;
    policyNumber: string;
    status: string;
    message: string;
  };
  validationRequirements?: Array<{
    type: 'arrendador' | 'arrendatario' | 'aval';
    name: string;
    required: boolean;
    completed: boolean;
    uuid?: string;
  }>;
  completedValidations?: number;
  completedSteps: number[];
  timestamp: number;
  sessionId: string; // Identificador único de sesión
  lastActivity: number; // Última actividad del usuario
}

@Injectable({
  providedIn: 'root'
})
export class WizardStateService {
  private readonly STORAGE_KEY = 'pji_wizard_state';
  private readonly SESSION_KEY = 'pji_wizard_session';
  private readonly SESSION_ID_KEY = 'pji_session_id';
  private readonly EXPIRATION_TIME = 24 * 60 * 60 * 1000; // 24 horas
  private readonly INACTIVITY_TIME = 30 * 60 * 1000; // 30 minutos de inactividad

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {
    // Inicializar sessionId si no existe
    this.initializeSessionId();
  }

  /**
   * Inicializa un ID de sesión único
   */
  private initializeSessionId(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    let sessionId = sessionStorage.getItem(this.SESSION_ID_KEY);
    if (!sessionId) {
      sessionId = this.generateSessionId();
      sessionStorage.setItem(this.SESSION_ID_KEY, sessionId);
    }
  }

  /**
   * Genera un ID de sesión único
   */
  private generateSessionId(): string {
    return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  /**
   * Obtiene el ID de sesión actual
   */
  getSessionId(): string {
    if (!isPlatformBrowser(this.platformId)) return '';
    
    let sessionId = sessionStorage.getItem(this.SESSION_ID_KEY);
    if (!sessionId) {
      sessionId = this.generateSessionId();
      sessionStorage.setItem(this.SESSION_ID_KEY, sessionId);
    }
    return sessionId;
  }

  /**
   * Guarda el estado del wizard con sincronización
   */
  saveState(state: Partial<WizardState>): void {
    if (!isPlatformBrowser(this.platformId)) return;

    const currentState = this.getState();
    const sessionId = this.getSessionId();
    const now = Date.now();
    
    const newState: WizardState = {
      ...currentState,
      ...state,
      timestamp: now,
      sessionId: sessionId,
      lastActivity: now
    };
    
    try {
      // Guardar en localStorage para persistencia a largo plazo
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(newState));
      
      // Guardar en sessionStorage para la sesión actual
      sessionStorage.setItem(this.SESSION_KEY, JSON.stringify(newState));
      
      console.log('💾 Estado del wizard guardado:', {
        step: newState.currentStep,
        plan: newState.selectedPlan,
        sessionId: newState.sessionId,
        timestamp: new Date(now).toLocaleString()
      });
    } catch (error) {
      console.error('❌ Error guardando estado del wizard:', error);
    }
  }

  /**
   * Obtiene el estado del wizard con validación de expiración
   */
  getState(): WizardState {
    if (!isPlatformBrowser(this.platformId)) {
      return this.getDefaultState();
    }

    try {
      // Intentar obtener de sessionStorage primero (más reciente)
      const sessionState = sessionStorage.getItem(this.SESSION_KEY);
      if (sessionState) {
        const state = JSON.parse(sessionState);
        if (this.isStateValid(state)) {
          return state;
        }
      }

      // Si no hay en sessionStorage o es inválido, intentar localStorage
      const localState = localStorage.getItem(this.STORAGE_KEY);
      if (localState) {
        const state = JSON.parse(localState);
        if (this.isStateValid(state)) {
          // Sincronizar con sessionStorage
          this.syncStateToSession(state);
          return state;
        }
      }
    } catch (error) {
      console.error('❌ Error al cargar el estado del wizard:', error);
    }

    return this.getDefaultState();
  }

  /**
   * Verifica si el estado es válido (no expirado, sesión activa)
   */
  private isStateValid(state: WizardState): boolean {
    if (!state || !state.timestamp) return false;

    const now = Date.now();
    const isExpired = (now - state.timestamp) > this.EXPIRATION_TIME;
    const isInactive = (now - state.lastActivity) > this.INACTIVITY_TIME;
    const hasValidSession = state.sessionId === this.getSessionId();

    if (isExpired) {
      console.log('⏰ Estado del wizard expirado (24h)');
      return false;
    }

    if (isInactive) {
      console.log('😴 Estado del wizard inactivo (30min)');
      return false;
    }

    if (!hasValidSession) {
      console.log('🔄 Estado del wizard de sesión anterior');
      return false;
    }

    return true;
  }

  /**
   * Sincroniza el estado de localStorage a sessionStorage
   */
  private syncStateToSession(state: WizardState): void {
    try {
      const updatedState = {
        ...state,
        sessionId: this.getSessionId(),
        lastActivity: Date.now()
      };
      sessionStorage.setItem(this.SESSION_KEY, JSON.stringify(updatedState));
      console.log('🔄 Estado sincronizado de localStorage a sessionStorage');
    } catch (error) {
      console.error('❌ Error sincronizando estado:', error);
    }
  }

  /**
   * Actualiza un paso específico
   */
  updateStep(step: number, data: any): void {
    const currentState = this.getState();
    
    switch (step) {
      case 0: // Welcome step
        break;
      case 1: // Main data step
        currentState.userData = { ...currentState.userData, ...data };
        break;
      case 2: // Validation step
        break;
      case 3: // Contract step
        break;
      case 4: // Payment step
        currentState.paymentData = { ...currentState.paymentData, ...data };
        break;
      case 5: // Finish step
        break;
    }

    // Marcar paso como completado
    if (!currentState.completedSteps.includes(step)) {
      currentState.completedSteps.push(step);
    }

    this.saveState(currentState);
  }

  /**
   * Marca un paso como completado
   */
  completeStep(step: number): void {
    const currentState = this.getState();
    if (!currentState.completedSteps.includes(step)) {
      currentState.completedSteps.push(step);
      this.saveState(currentState);
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
      localStorage.removeItem(this.STORAGE_KEY);
      sessionStorage.removeItem(this.SESSION_KEY);
      console.log('🧹 Estado del wizard limpiado');
    } catch (error) {
      console.error('❌ Error limpiando estado del wizard:', error);
    }
  }

  /**
   * Verifica si hay un estado guardado válido
   */
  hasSavedState(): boolean {
    if (!isPlatformBrowser(this.platformId)) return false;
    
    try {
      const sessionState = sessionStorage.getItem(this.SESSION_KEY);
      const localState = localStorage.getItem(this.STORAGE_KEY);
      
      if (sessionState) {
        const state = JSON.parse(sessionState);
        return this.isStateValid(state);
      }
      
      if (localState) {
        const state = JSON.parse(localState);
        return this.isStateValid(state);
      }
      
      return false;
    } catch (error) {
      console.error('❌ Error verificando estado guardado:', error);
      return false;
    }
  }

  /**
   * Obtiene el estado por defecto
   */
  private getDefaultState(): WizardState {
    return {
      currentStep: 0,
      selectedPlan: null,
      quotationId: null,
      quotationNumber: null,
      userId: null,
      userData: {},
      paymentData: {},
      completedSteps: [],
      timestamp: Date.now(),
      sessionId: this.getSessionId(),
      lastActivity: Date.now()
    };
  }

  /**
   * Restaura el wizard al último estado válido
   */
  restoreWizard(): WizardState {
    const state = this.getState();
    
    // Si hay un estado guardado válido, sugerir continuar
    if (this.hasSavedState() && state.completedSteps.length > 0) {
      // Determinar el paso actual basado en el último completado
      const lastCompleted = this.getLastCompletedStep();
      state.currentStep = Math.min(lastCompleted + 1, 5); // Máximo 6 pasos (0-5)
      
      console.log('🔄 Wizard restaurado al paso:', state.currentStep);
    }
    
    return state;
  }

  /**
   * Actualiza la actividad del usuario (última interacción)
   */
  updateActivity(): void {
    const currentState = this.getState();
    if (currentState.currentStep > 0) { // Solo si no es el paso inicial
      this.saveState({ lastActivity: Date.now() });
    }
  }

  /**
   * Obtiene información del estado para debugging
   */
  getStateInfo(): any {
    const state = this.getState();
    return {
      currentStep: state.currentStep,
      hasPlan: !!state.selectedPlan,
      hasQuotation: !!state.quotationId,
      hasUser: !!state.userId,
      completedSteps: state.completedSteps,
      timestamp: new Date(state.timestamp).toLocaleString(),
      lastActivity: new Date(state.lastActivity).toLocaleString(),
      sessionId: state.sessionId,
      isValid: this.isStateValid(state)
    };
  }

  /**
   * Limpia estados expirados
   */
  cleanupExpiredStates(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    try {
      // Limpiar localStorage expirado
      const localState = localStorage.getItem(this.STORAGE_KEY);
      if (localState) {
        const state = JSON.parse(localState);
        if (!this.isStateValid(state)) {
          localStorage.removeItem(this.STORAGE_KEY);
          console.log('🧹 Estado expirado limpiado de localStorage');
        }
      }

      // Limpiar sessionStorage expirado
      const sessionState = sessionStorage.getItem(this.SESSION_KEY);
      if (sessionState) {
        const state = JSON.parse(sessionState);
        if (!this.isStateValid(state)) {
          sessionStorage.removeItem(this.SESSION_KEY);
          console.log('🧹 Estado expirado limpiado de sessionStorage');
        }
      }
    } catch (error) {
      console.error('❌ Error limpiando estados expirados:', error);
    }
  }
}
