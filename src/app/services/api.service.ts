import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, timeout, map } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { LoggerService } from './logger.service';

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private readonly baseUrl = environment.api.baseUrl;
  private readonly timeout = environment.api.timeout;

  constructor(
    private http: HttpClient,
    private logger: LoggerService
  ) {}

  /**
   * GET request
   */
  get<T>(endpoint: string, params?: HttpParams): Observable<ApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = this.createAuthHeaders();
    return this.http.get<T | ApiResponse<T>>(url, { params, headers })
      .pipe(
        timeout(this.timeout),
        map((response: T | ApiResponse<T>) => {
          // Si la respuesta ya es un ApiResponse, retornarla tal cual
          if (response && typeof response === 'object' && 'success' in response) {
            return response as ApiResponse<T>;
          }
          // Si la respuesta es directamente el objeto T, envolverlo en ApiResponse
          return {
            success: true,
            data: response as T
          } as ApiResponse<T>;
        }),
        catchError((error) => this.handleError(error))
      );
  }

  /**
   * POST request
   */
  post<T>(endpoint: string, data: any): Observable<ApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = this.createAuthHeaders();
    return this.http.post<ApiResponse<T>>(url, data, { headers })
      .pipe(
        timeout(this.timeout),
        catchError((error) => this.handleError(error))
      );
  }

  /**
   * PUT request
   */
  put<T>(endpoint: string, data: any): Observable<ApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = this.createAuthHeaders();
    return this.http.put<ApiResponse<T>>(url, data, { headers })
      .pipe(
        timeout(this.timeout),
        catchError((error) => this.handleError(error))
      );
  }

  /**
   * PATCH request
   */
  patch<T>(endpoint: string, data: any): Observable<ApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = this.createAuthHeaders();
    return this.http.patch<ApiResponse<T>>(url, data, { headers })
      .pipe(
        timeout(this.timeout),
        catchError((error) => this.handleError(error))
      );
  }

  /**
   * DELETE request
   */
  delete<T>(endpoint: string): Observable<ApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = this.createAuthHeaders();
    return this.http.delete<ApiResponse<T>>(url, { headers })
      .pipe(
        timeout(this.timeout),
        catchError((error) => this.handleError(error))
      );
  }

  /**
   * Manejo centralizado de errores
   */
  private handleError(error: HttpErrorResponse): Observable<never> {
    let errorMessage = 'Ha ocurrido un error inesperado';

    if (error.error instanceof ErrorEvent) {
      // Error del cliente
      errorMessage = `Error: ${error.error.message}`;
    } else {
      // Error del servidor
      if (error.status === 0) {
        errorMessage = 'No se puede conectar con el servidor';
      } else if (error.status === 401) {
        errorMessage = 'No autorizado';
      } else if (error.status === 403) {
        errorMessage = 'Acceso denegado';
      } else if (error.status === 404) {
        errorMessage = 'Recurso no encontrado';
      } else if (error.status === 500) {
        errorMessage = 'Error interno del servidor';
      } else if (error.error?.message) {
        errorMessage = error.error.message;
      } else {
        errorMessage = `Error ${error.status}: ${error.statusText}`;
      }
    }

    this.logger.error('API Error:', error);
    
    // Crear un error personalizado que mantenga el status code
    const customError = new Error(errorMessage) as any;
    customError.status = error.status;
    customError.statusText = error.statusText;
    customError.originalError = error;
    
    return throwError(() => customError);
  }

  /**
   * Crear HttpParams desde un objeto
   */
  createParams(params: Record<string, any>): HttpParams {
    let httpParams = new HttpParams();
    Object.keys(params).forEach(key => {
      if (params[key] !== null && params[key] !== undefined) {
        httpParams = httpParams.set(key, params[key].toString());
      }
    });
    return httpParams;
  }

  /**
   * Crear headers con autenticación
   */
  createAuthHeaders(token?: string): HttpHeaders {
    let headers = new HttpHeaders({
      'Content-Type': 'application/json'
    });

    // Agregar API Key del frontend
    const apiKey = environment.api.apiKey;
    if (apiKey) {
      headers = headers.set('X-API-Key', apiKey);
    }

    // Agregar access token si está disponible (para sesiones del wizard)
    const accessToken = token || this.getWizardAccessToken();
    if (accessToken) {
      headers = headers.set('Authorization', `Bearer ${accessToken}`);
      this.logger.log('🔑 Token JWT incluido en headers');
    } else {
      this.logger.warning('⚠️ No hay access token disponible para autenticación');
    }

    return headers;
  }

  /**
   * Obtener access token del wizard desde localStorage
   */
  private getWizardAccessToken(): string | null {
    if (typeof window !== 'undefined' && window.localStorage) {
      const token = localStorage.getItem('wizard_access_token');
      if (token) {
        this.logger.log('🔑 Token JWT encontrado en localStorage');
      } else {
        this.logger.warning('⚠️ No se encontró token JWT en localStorage');
      }
      return token;
    }
    return null;
  }
}
