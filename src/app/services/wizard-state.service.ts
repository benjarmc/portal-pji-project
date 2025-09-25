import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject, Observable } from 'rxjs';

export interface WizardState {
  currentStep: number;
  selectedPlan: string;
  quotationId?: string;
  quotationNumber?: string;
  userId?: string;
  userData?: any;
  paymentData?: any;
  contractData?: any;     // Datos del contrato
  rentaMensual?: number;  // Monto de renta mensual para el contrato
  completedSteps: number[];
  timestamp: number;
  sessionId: string;
  lastActivity: number;
  paymentResult?: any;
  transactionId?: string; // ID único para seguimiento
  policyId?: string;      // ID de la póliza
  policyNumber?: string;  // Número de póliza
  paymentAmount?: number; // Monto del pago procesado
}

@Injectable({
  providedIn: 'root'
})
export class WizardStateService {
  private readonly SESSION_KEY = 'pji_wizard_state';
  private readonly TRANSACTION_PREFIX = 'pji_txn_';
  
  // Subject para notificar cambios en el estado
  private stateSubject = new BehaviorSubject<WizardState | null>(null);
  public stateChanges$: Observable<WizardState | null> = this.stateSubject.asObservable();
  
  // Configuración de expiración
  private readonly SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutos de inactividad

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {
    // Inicializar el estado al cargar el servicio
    const initialState = this.getState();
    this.stateSubject.next(initialState);
  }

  /**
   * Genera un ID único de transacción
   */
  private generateTransactionId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    return `${this.TRANSACTION_PREFIX}${timestamp}_${random}`;
  }

  /**
   * Genera un ID único de sesión
   */
  private generateSessionId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    return `session_${timestamp}_${random}`;
  }

  /**
   * Obtiene o genera un ID de transacción
   */
  getTransactionId(): string {
    const state = this.getState();
    if (!state.transactionId) {
      // Generar nuevo ID de transacción
      const newTransactionId = this.generateTransactionId();
      this.saveState({ transactionId: newTransactionId });
      return newTransactionId;
    }
    return state.transactionId;
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
          return state;
        } else {
          console.log('⏰ Estado de sesión expirado o inválido');
          this.clearState();
        }
      }
    } catch (error) {
      console.error('❌ Error al cargar el estado del wizard:', error);
    }

    return this.getDefaultState();
  }

  /**
   * Verifica si el estado es válido
   */
  private isStateValid(state: WizardState): boolean {
    if (!state || !state.timestamp || !state.lastActivity) return false;

    const now = Date.now();
    const isInactive = (now - state.lastActivity) > this.SESSION_TIMEOUT;

    if (isInactive) {
      console.log('😴 Estado del wizard inactivo (30min)');
      return false;
    }

    return true;
  }

  /**
   * Guarda el estado del wizard
   */
  saveState(state: Partial<WizardState>): void {
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

    // Asegurar que siempre tenga un transactionId
    if (!newState.transactionId) {
      newState.transactionId = this.generateTransactionId();
    }

    try {
      sessionStorage.setItem(this.SESSION_KEY, JSON.stringify(newState));
      
      // Emitir cambios en el estado
      this.stateSubject.next(newState);
      
      // Solo loggear cambios importantes de paso
      if (newState.currentStep !== currentState.currentStep) {
        console.log(`🔄 Paso del wizard: ${currentState.currentStep} → ${newState.currentStep}`);
      }
    } catch (error) {
      console.error('❌ Error guardando estado del wizard:', error);
    }
  }

  /**
   * Marca un paso como completado
   */
  completeStep(step: number): void {
    const currentState = this.getState();
    if (!currentState.completedSteps.includes(step)) {
      currentState.completedSteps.push(step);
      this.saveState({ completedSteps: currentState.completedSteps });
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
      console.log('🧹 Estado del wizard limpiado de sessionStorage');
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
      if (sessionState) {
        const state = JSON.parse(sessionState);
        return this.isStateValid(state);
      }
    } catch (error) {
      console.error('❌ Error verificando estado guardado:', error);
    }
    
    return false;
  }

  /**
   * Obtiene información del estado para debugging
   */
  getStateInfo(): any {
    const state = this.getState();
    return {
      currentStep: state.currentStep,
      transactionId: state.transactionId,
      sessionId: state.sessionId,
      quotationId: state.quotationId,
      userId: state.userId,
      completedSteps: state.completedSteps,
      hasPaymentResult: !!state.paymentResult,
      hasPolicy: !!(state.policyId && state.policyNumber),
      timestamp: state.timestamp ? new Date(state.timestamp).toLocaleString() : 'N/A',
      lastActivity: state.lastActivity ? new Date(state.lastActivity).toLocaleString() : 'N/A'
    };
  }

  /**
   * Obtiene el estado por defecto
   */
  private getDefaultState(): WizardState {
    return {
      currentStep: 0,
      selectedPlan: '',
      quotationId: '',
      quotationNumber: '',
      userId: '',
      userData: {},
      paymentData: {},
      completedSteps: [],
      timestamp: Date.now(),
      sessionId: this.generateSessionId(),
      lastActivity: Date.now(),
      transactionId: this.generateTransactionId()
    };
  }

  /**
   * Actualiza la actividad del usuario
   */
  updateActivity(): void {
    const currentState = this.getState();
    this.saveState({ lastActivity: Date.now() });
  }

  /**
   * Obtiene información de la transacción actual
   */
  getTransactionInfo(): any {
    const state = this.getState();
    return {
      transactionId: state.transactionId,
      sessionId: state.sessionId,
      currentStep: state.currentStep,
      quotationId: state.quotationId,
      userId: state.userId,
      paymentResult: state.paymentResult,
      policyId: state.policyId,
      policyNumber: state.policyNumber,
      timestamp: state.timestamp,
      lastActivity: state.lastActivity
    };
  }
}
