import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService, ApiResponse } from './api.service';

export interface WizardSessionData {
  sessionId: string;
  userId?: string;
  currentStep: number;
  stepData: any;
  completedSteps: number[];
  status: string;
  quotationId?: string;
  policyId?: string;
  metadata?: any;
}

@Injectable({
  providedIn: 'root'
})
export class WizardSessionService {
  private readonly endpoint = '/wizard-session';

  constructor(private apiService: ApiService) {}

  /**
   * Crear nueva sesión del wizard
   */
  createSession(sessionData: { sessionId: string; userId?: string; metadata?: any }): Observable<ApiResponse<WizardSessionData>> {
    return this.apiService.post<WizardSessionData>(this.endpoint, sessionData);
  }

  /**
   * Obtener sesión por ID
   */
  getSession(sessionId: string): Observable<ApiResponse<WizardSessionData>> {
    return this.apiService.get<WizardSessionData>(`${this.endpoint}/${sessionId}`);
  }

  /**
   * Actualizar paso del wizard
   */
  updateStep(sessionId: string, step: number, stepData: any, quotationId?: string, policyId?: string): Observable<ApiResponse<WizardSessionData>> {
    return this.apiService.patch<WizardSessionData>(`${this.endpoint}/${sessionId}/step`, {
      step,
      stepData,
      quotationId,
      policyId
    });
  }

  /**
   * Marcar paso como completado
   */
  completeStep(sessionId: string, step: number, additionalData?: any): Observable<ApiResponse<WizardSessionData>> {
    return this.apiService.patch<WizardSessionData>(`${this.endpoint}/${sessionId}/complete-step`, {
      step,
      additionalData
    });
  }

  /**
   * Vincular sesión a usuario
   */
  linkToUser(sessionId: string, userId: string): Observable<ApiResponse<WizardSessionData>> {
    return this.apiService.patch<WizardSessionData>(`${this.endpoint}/${sessionId}/link-user`, {
      userId
    });
  }

  /**
   * Completar sesión del wizard
   */
  completeSession(sessionId: string): Observable<ApiResponse<WizardSessionData>> {
    return this.apiService.patch<WizardSessionData>(`${this.endpoint}/${sessionId}/complete`, {});
  }

  /**
   * Abandonar sesión del wizard
   */
  abandonSession(sessionId: string): Observable<ApiResponse<WizardSessionData>> {
    return this.apiService.patch<WizardSessionData>(`${this.endpoint}/${sessionId}/abandon`, {});
  }

  /**
   * Eliminar sesión del wizard completamente
   */
  deleteSession(sessionId: string): Observable<ApiResponse<{ deleted: boolean; sessionId: string }>> {
    return this.apiService.patch<{ deleted: boolean; sessionId: string }>(`${this.endpoint}/${sessionId}/delete`, {});
  }

  /**
   * Obtener sesiones por usuario
   */
  getSessionsByUser(userId: string): Observable<ApiResponse<WizardSessionData[]>> {
    return this.apiService.get<WizardSessionData[]>(`${this.endpoint}/user/${userId}`);
  }

  /**
   * Obtener estadísticas de sesiones
   */
  getSessionStats(): Observable<ApiResponse<{
    total: number;
    active: number;
    completed: number;
    abandoned: number;
    expired: number;
  }>> {
    return this.apiService.get(`${this.endpoint}/stats/overview`);
  }

  /**
   * Limpiar sesiones expiradas
   */
  cleanupExpiredSessions(): Observable<ApiResponse<{ cleaned: number }>> {
    return this.apiService.post(`${this.endpoint}/cleanup/expired`, {});
  }

  /**
   * Obtener sesión por ID de cotización
   */
  getSessionByQuotation(quotationId: string): Observable<ApiResponse<WizardSessionData>> {
    return this.apiService.get<WizardSessionData>(`${this.endpoint}/quotation/${quotationId}`);
  }
}
