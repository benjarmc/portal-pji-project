import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
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

interface CacheEntry {
  data: ApiResponse<WizardSessionData>;
  timestamp: number;
}

@Injectable({
  providedIn: 'root'
})
export class WizardSessionService {
  private readonly endpoint = '/wizard-session';
  private readonly TOKEN_KEY = 'wizard_access_token';
  private readonly REFRESH_TOKEN_KEY = 'wizard_refresh_token';
  
  // ✅ Sistema de caché para evitar múltiples llamadas GET al mismo endpoint
  private sessionCache = new Map<string, CacheEntry>();
  private readonly CACHE_TTL = 5000; // 5 segundos de caché (evita errores 429)
  private readonly MAX_CACHE_SIZE = 10; // Máximo 10 entradas en caché

  constructor(private apiService: ApiService) {}
  
  /**
   * Limpia el caché de sesiones
   */
  private clearSessionCache(): void {
    this.sessionCache.clear();
  }
  
  /**
   * Limpia entradas expiradas del caché
   */
  private cleanExpiredCache(): void {
    const now = Date.now();
    for (const [key, entry] of this.sessionCache.entries()) {
      if (now - entry.timestamp > this.CACHE_TTL) {
        this.sessionCache.delete(key);
      }
    }
    
    // Si el caché es muy grande, eliminar las entradas más antiguas
    if (this.sessionCache.size > this.MAX_CACHE_SIZE) {
      const entries = Array.from(this.sessionCache.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp);
      
      // Eliminar las entradas más antiguas
      const toRemove = entries.slice(0, entries.length - this.MAX_CACHE_SIZE);
      toRemove.forEach(([key]) => this.sessionCache.delete(key));
    }
  }
  
  /**
   * Genera una clave única para el caché basada en el sessionId y parámetros
   */
  private getCacheKey(sessionId: string, withTokens?: boolean): string {
    return `${sessionId}_${withTokens ? 'tokens' : 'no-tokens'}`;
  }
  
  /**
   * Obtiene una entrada del caché si existe y no está expirada
   */
  private getCachedSession(sessionId: string, withTokens?: boolean): ApiResponse<WizardSessionData> | null {
    this.cleanExpiredCache();
    const key = this.getCacheKey(sessionId, withTokens);
    const entry = this.sessionCache.get(key);
    
    if (entry && (Date.now() - entry.timestamp) < this.CACHE_TTL) {
      return entry.data;
    }
    
    return null;
  }
  
  /**
   * Guarda una entrada en el caché
   */
  private setCachedSession(sessionId: string, withTokens: boolean | undefined, data: ApiResponse<WizardSessionData>): void {
    this.cleanExpiredCache();
    const key = this.getCacheKey(sessionId, withTokens);
    this.sessionCache.set(key, {
      data,
      timestamp: Date.now()
    });
  }
  
  /**
   * Invalida el caché para un sessionId específico
   */
  private invalidateCache(sessionId: string): void {
    const keysToDelete: string[] = [];
    for (const key of this.sessionCache.keys()) {
      if (key.startsWith(`${sessionId}_`)) {
        keysToDelete.push(key);
      }
    }
    keysToDelete.forEach(key => this.sessionCache.delete(key));
  }

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
   * @param forceRefresh Si es true, fuerza una nueva llamada al backend ignorando el caché
   * ✅ MEJORADO: Implementa caché para evitar múltiples llamadas GET al mismo endpoint
   */
  getSession(sessionId: string, withTokens?: boolean, forceRefresh: boolean = false): Observable<ApiResponse<WizardSessionData>> {
    // Si no se fuerza refresh, verificar caché primero
    if (!forceRefresh) {
      const cached = this.getCachedSession(sessionId, withTokens);
      if (cached) {
        return of(cached);
      }
    }
    
    const params = withTokens ? this.apiService.createParams({ withTokens: 'true' }) : undefined;
    return this.apiService.get<WizardSessionData>(`${this.endpoint}/${sessionId}`, params).pipe(
      tap(response => {
        // Guardar en caché solo si la respuesta es exitosa
        if (response && response.success !== false) {
          this.setCachedSession(sessionId, withTokens, response);
        }
      })
    );
  }

  /**
   * Actualizar paso del wizard
   * ✅ MEJORADO: Invalida el caché después de actualizar
   */
  updateStep(sessionId: string, step: number, stepData: any, quotationId?: string, policyId?: string): Observable<ApiResponse<WizardSessionData>> {
    return this.apiService.patch<WizardSessionData>(`${this.endpoint}/${sessionId}/step`, {
      step,
      stepData,
      quotationId,
      policyId
    }).pipe(
      tap(() => {
        // Invalidar caché después de actualizar
        this.invalidateCache(sessionId);
      })
    );
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
   * ✅ MEJORADO: Invalida el caché después de sincronizar
   */
  forceSync(sessionId: string): Observable<ApiResponse<WizardSessionData>> {
    return this.apiService.post<WizardSessionData>(`${this.endpoint}/${sessionId}/sync`, {}).pipe(
      tap(() => {
        // Invalidar caché después de sincronizar
        this.invalidateCache(sessionId);
      })
    );
  }
}
