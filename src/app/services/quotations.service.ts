import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService, ApiResponse } from './api.service';
import { Quotation, CreateQuotationDto, QuotationStats } from '../models/quotation.model';

@Injectable({
  providedIn: 'root'
})
export class QuotationsService {
  private readonly endpoint = '/quotations';

  constructor(private apiService: ApiService) {}

  /**
   * Crear una nueva cotización
   */
  createQuotation(quotationData: CreateQuotationDto): Observable<ApiResponse<Quotation>> {
    return this.apiService.post<Quotation>(this.endpoint, quotationData);
  }

  /**
   * Obtener cotización por ID
   */
  getQuotationById(id: string): Observable<ApiResponse<Quotation>> {
    return this.apiService.get<Quotation>(`${this.endpoint}/${id}`);
  }

  /**
   * Obtener cotizaciones de un usuario
   */
  getUserQuotations(userId: string): Observable<ApiResponse<Quotation[]>> {
    return this.apiService.get<Quotation[]>(`${this.endpoint}/user/${userId}`);
  }

  /**
   * Enviar cotización por email
   */
  sendQuotationEmail(id: string): Observable<ApiResponse<void>> {
    return this.apiService.post<void>(`${this.endpoint}/${id}/send-email`, {});
  }

  /**
   * Convertir cotización a póliza
   */
  convertToPolicy(id: string): Observable<ApiResponse<any>> {
    return this.apiService.post<any>(`${this.endpoint}/${id}/convert-to-policy`, {});
  }

  /**
   * Obtener estadísticas de cotizaciones
   */
  getQuotationsStats(): Observable<ApiResponse<QuotationStats>> {
    return this.apiService.get<QuotationStats>(`${this.endpoint}/stats/overview`);
  }

  /**
   * Obtener todas las cotizaciones (admin)
   */
  getAllQuotations(): Observable<ApiResponse<Quotation[]>> {
    return this.apiService.get<Quotation[]>(this.endpoint);
  }

  /**
   * Actualizar estado de cotización
   */
  updateQuotationStatus(id: string, status: string): Observable<ApiResponse<Quotation>> {
    return this.apiService.patch<Quotation>(`${this.endpoint}/${id}`, { status });
  }

  /**
   * Obtener cotizaciones por estado
   */
  getQuotationsByStatus(status: string): Observable<ApiResponse<Quotation[]>> {
    return this.apiService.get<Quotation[]>(this.endpoint, 
      this.apiService.createParams({ status })
    );
  }

  /**
   * Obtener cotizaciones pendientes
   */
  getPendingQuotations(): Observable<ApiResponse<Quotation[]>> {
    return this.getQuotationsByStatus('PENDING');
  }

  /**
   * Obtener cotizaciones aprobadas
   */
  getApprovedQuotations(): Observable<ApiResponse<Quotation[]>> {
    return this.getQuotationsByStatus('APPROVED');
  }
}
