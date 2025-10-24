import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService, ApiResponse } from './api.service';
import { LoggerService } from './logger.service';
export interface ValidationRequest {
  name: string;
  email: string;
  type: 'arrendador' | 'arrendatario' | 'aval';
  quotationId?: string; // Hacer quotationId opcional también
  policyId?: string; // Agregar policyId opcional
}

export interface ValidationResponse {
  id: string;
  uuid: string;
  type: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  quotationId: string;
  name: string;
  email: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ValidationStatusResponse {
  success: boolean;
  data: ValidationResponse;
  message?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ValidationService {
  private readonly endpoint = '/validation';

  constructor(private apiService: ApiService, private logger: LoggerService) {}

  /**
   * Iniciar proceso de validación de identidad
   * El backend se encargará de crear la verificación en VDID y enviar el email
   */
  startValidation(validationRequest: ValidationRequest): Observable<ApiResponse<ValidationResponse>> {
    this.logger.log('🚀 Iniciando validación a través del backend:', validationRequest);
    return this.apiService.post<ValidationResponse>(`${this.endpoint}/start`, validationRequest);
  }

  /**
   * Obtener estado de una validación
   */
  getValidationStatus(uuid: string): Observable<ApiResponse<ValidationResponse>> {
    return this.apiService.get<ValidationResponse>(`${this.endpoint}/status/${uuid}`);
  }

  /**
   * Obtener todas las validaciones de una cotización
   */
  getValidationsByQuotation(quotationId: string): Observable<ApiResponse<ValidationResponse[]>> {
    return this.apiService.get<ValidationResponse[]>(`${this.endpoint}/quotation/${quotationId}`);
  }

  /**
   * Obtener todas las validaciones de una póliza
   */
  getValidationsByPolicy(policyId: string): Observable<ApiResponse<ValidationResponse[]>> {
    return this.apiService.get<ValidationResponse[]>(`${this.endpoint}/policy/${policyId}`);
  }

  /**
   * Obtener validaciones de un usuario
   */
  getValidationsByUser(userId: string): Observable<ApiResponse<ValidationResponse[]>> {
    return this.apiService.get<ValidationResponse[]>(`${this.endpoint}/user/${userId}`);
  }

  /**
   * Completar validación
   */
  completeValidation(uuid: string, result: any): Observable<ApiResponse<ValidationResponse>> {
    return this.apiService.post<ValidationResponse>(`${this.endpoint}/complete/${uuid}`, result);
  }

  /**
   * Cancelar validación
   */
  cancelValidation(uuid: string): Observable<ApiResponse<ValidationResponse>> {
    return this.apiService.post<ValidationResponse>(`${this.endpoint}/cancel/${uuid}`, {});
  }

  /**
   * Reenviar verificación por email
   */
  resendVerification(uuid: string): Observable<ApiResponse<any>> {
    return this.apiService.post<any>(`${this.endpoint}/resend/${uuid}`, {});
  }
}
