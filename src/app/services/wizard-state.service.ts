import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export interface WizardState {
  currentStep: number;
  selectedPlan: string | null;
  userData: {
    name?: string;
    email?: string;
    phone?: string;
  };
  paymentData: {
    cardType?: string;
    lastFourDigits?: string;
  };
  completedSteps: number[];
  timestamp: number;
}

@Injectable({
  providedIn: 'root'
})
export class WizardStateService {
  private readonly STORAGE_KEY = 'pji_wizard_state';
  private readonly SESSION_KEY = 'pji_wizard_session';

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {}

  /**
   * Guarda el estado del wizard
   */
  saveState(state: Partial<WizardState>): void {
    if (!isPlatformBrowser(this.platformId)) return;

    const currentState = this.getState();
    const newState = { ...currentState, ...state, timestamp: Date.now() };
    
    // Guardar en localStorage para persistencia
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(newState));
    
    // Guardar en sessionStorage para la sesión actual
    sessionStorage.setItem(this.SESSION_KEY, JSON.stringify(newState));
  }

  /**
   * Obtiene el estado del wizard
   */
  getState(): WizardState {
    if (!isPlatformBrowser(this.platformId)) {
      return this.getDefaultState();
    }

    try {
      // Intentar obtener de sessionStorage primero (más reciente)
      const sessionState = sessionStorage.getItem(this.SESSION_KEY);
      if (sessionState) {
        return JSON.parse(sessionState);
      }

      // Si no hay en sessionStorage, intentar localStorage
      const localState = localStorage.getItem(this.STORAGE_KEY);
      if (localState) {
        const state = JSON.parse(localState);
        
        // Verificar si el estado no es muy antiguo (24 horas)
        const isRecent = (Date.now() - state.timestamp) < (24 * 60 * 60 * 1000);
        if (isRecent) {
          return state;
        }
      }
    } catch (error) {
      console.error('Error al cargar el estado del wizard:', error);
    }

    return this.getDefaultState();
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
    
    localStorage.removeItem(this.STORAGE_KEY);
    sessionStorage.removeItem(this.SESSION_KEY);
  }

  /**
   * Verifica si hay un estado guardado
   */
  hasSavedState(): boolean {
    if (!isPlatformBrowser(this.platformId)) return false;
    
    const sessionState = sessionStorage.getItem(this.SESSION_KEY);
    const localState = localStorage.getItem(this.STORAGE_KEY);
    
    return !!(sessionState || localState);
  }

  /**
   * Obtiene el estado por defecto
   */
  private getDefaultState(): WizardState {
    return {
      currentStep: 0,
      selectedPlan: null,
      userData: {},
      paymentData: {},
      completedSteps: [],
      timestamp: Date.now()
    };
  }

  /**
   * Restaura el wizard al último estado válido
   */
  restoreWizard(): WizardState {
    const state = this.getState();
    
    // Si hay un estado guardado, sugerir continuar
    if (this.hasSavedState() && state.completedSteps.length > 0) {
      // Determinar el paso actual basado en el último completado
      const lastCompleted = this.getLastCompletedStep();
      state.currentStep = Math.min(lastCompleted + 1, 5); // Máximo 6 pasos (0-5)
    }
    
    return state;
  }
}
