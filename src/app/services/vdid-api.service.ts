import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface VdidCreateVerificationRequest {
  email: string;
  name: string;
  type: 'arrendador' | 'arrendatario' | 'aval';
  quotationId: string;
}

export interface VdidCreateVerificationResponse {
  success: boolean;
  uuid: string;
  message?: string;
  error?: string;
}

export interface VdidVerificationStatus {
  uuid: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  email: string;
  name: string;
  type: string;
  quotationId: string;
}

@Injectable({
  providedIn: 'root'
})
export class VdidApiService {
  private readonly baseUrl = 'https://veridocid.azure-api.net/api/id/v3';
  private readonly apiKey = environment.vdid?.apiKey || '';

  constructor(private http: HttpClient) {}

  /**
   * Crear una nueva verificación en VDID
   */
  createVerification(request: VdidCreateVerificationRequest): Observable<VdidCreateVerificationResponse> {
    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      'Ocp-Apim-Subscription-Key': this.apiKey
    });

    const payload = {
      email: request.email,
      name: request.name,
      metadata: {
        type: request.type,
        quotationId: request.quotationId,
        timestamp: new Date().toISOString()
      }
    };

    console.log('🚀 Creando verificación VDID:', payload);
    
    return this.http.post<VdidCreateVerificationResponse>(
      `${this.baseUrl}/createVerification`,
      payload,
      { headers }
    );
  }

  /**
   * Obtener estado de una verificación
   */
  getVerificationStatus(uuid: string): Observable<VdidVerificationStatus> {
    const headers = new HttpHeaders({
      'Ocp-Apim-Subscription-Key': this.apiKey
    });

    return this.http.get<VdidVerificationStatus>(
      `${this.baseUrl}/verificationStatus/${uuid}`,
      { headers }
    );
  }

  /**
   * Enviar verificación por email
   */
  sendVerificationEmail(uuid: string, email: string): Observable<any> {
    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      'Ocp-Apim-Subscription-Key': this.apiKey
    });

    const payload = {
      uuid,
      email,
      method: 'email'
    };

    return this.http.post(
      `${this.baseUrl}/sendVerification`,
      payload,
      { headers }
    );
  }
}

