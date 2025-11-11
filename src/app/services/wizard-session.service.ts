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
  // Tokens JWT
  accessToken?: string;
  refreshToken?: string;
  expiresIn?: number;
  tokenType?: 'Bearer';
}

export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: 'Bearer';
}

@Injectable({
  providedIn: 'root'
})
export class WizardSessionService {
  private readonly endpoint = '/wizard-session';
  private readonly TOKEN_KEY = 'wizard_access_token';
  private readonly REFRESH_TOKEN_KEY = 'wizard_refresh_token';

  constructor(private apiService: ApiService) {}

  /**
   * Guardar tokens en localStorage
   */
  private saveTokens(tokens: SessionTokens): void {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem(this.TOKEN_KEY, tokens.accessToken);
      localStorage.setItem(this.REFRESH_TOKEN_KEY, tokens.refreshToken);
    }
  }

  /**
   * Obtener access token del localStorage
   */
  getAccessToken(): string | null {
    if (typeof window !== 'undefined' && window.localStorage) {
      return localStorage.getItem(this.TOKEN_KEY);
    }
    return null;
  }

  /**
   * Obtener refresh token del localStorage
   */
  getRefreshToken(): string | null {
    if (typeof window !== 'undefined' && window.localStorage) {
      return localStorage.getItem(this.REFRESH_TOKEN_KEY);
    }
    return null;
  }

  /**
   * Limpiar tokens del localStorage
   */
  clearTokens(): void {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.removeItem(this.TOKEN_KEY);
      localStorage.removeItem(this.REFRESH_TOKEN_KEY);
    }
  }

  /**
   * Crear nueva sesión del wizard (retorna tokens)
   */
  createSession(sessionData: { sessionId: string; userId?: string; metadata?: any; publicIp?: string; userAgent?: string; createOnly?: boolean }): Observable<ApiResponse<WizardSessionData>> {
    return new Observable(observer => {
      this.apiService.post<WizardSessionData>(this.endpoint, sessionData).subscribe({
        next: (response) => {
          // Guardar tokens si vienen en la respuesta
          if (response.data?.accessToken && response.data?.refreshToken) {
            this.saveTokens({
              accessToken: response.data.accessToken,
              refreshToken: response.data.refreshToken,
              expiresIn: response.data.expiresIn || 1800,
              tokenType: response.data.tokenType || 'Bearer',
            });
          }
          observer.next(response);
          observer.complete();
        },
        error: (error) => observer.error(error)
      });
    });
  }

  /**
   * Refrescar access token usando refresh token
   */
  refreshAccessToken(): Observable<ApiResponse<WizardSessionData>> {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) {
      throw new Error('No hay refresh token disponible');
    }

    return new Observable(observer => {
      this.apiService.post<WizardSessionData>(`${this.endpoint}/refresh`, { refreshToken }).subscribe({
        next: (response) => {
          // Actualizar tokens
          if (response.data?.accessToken && response.data?.refreshToken) {
            this.saveTokens({
              accessToken: response.data.accessToken,
              refreshToken: response.data.refreshToken,
              expiresIn: response.data.expiresIn || 1800,
              tokenType: response.data.tokenType || 'Bearer',
            });
          }
          observer.next(response);
          observer.complete();
        },
        error: (error) => {
          // Si el refresh token expiró, limpiar tokens
          if (error.status === 401) {
            this.clearTokens();
          }
          observer.error(error);
        }
      });
    });
  }

  /**
   * Obtener sesión por ID
   * @param sessionId ID de la sesión
   * @param withTokens Si es true, solicita tokens al backend (útil para continuar sesión existente)
   */
  getSession(sessionId: string, withTokens?: boolean): Observable<ApiResponse<WizardSessionData>> {
    const params = withTokens ? this.apiService.createParams({ withTokens: 'true' }) : undefined;
    return this.apiService.get<WizardSessionData>(`${this.endpoint}/${sessionId}`, params);
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

  /**
   * Forzar sincronización de datos desde tablas relacionadas
   * Útil cuando se detecta que hay policyId pero faltan datos de pago
   */
  forceSync(sessionId: string): Observable<ApiResponse<WizardSessionData>> {
    return this.apiService.post<WizardSessionData>(`${this.endpoint}/${sessionId}/sync`, {});
  }
}
