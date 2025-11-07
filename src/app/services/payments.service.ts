import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService, ApiResponse } from './api.service';
import { OpenPayService, OpenPayCardData, OpenPayTokenResponse } from './openpay.service';
import { LoggerService } from './logger.service';
import { OpenPayErrorHandler } from '../utils/openpay-error-handler';
export interface PaymentData {
  quotationId: string;
  cardData: OpenPayCardData;
  amount: number;
  currency: string;
  description: string;
}

export interface PaymentResponse {
  id: string;
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  amount: number;
  currency: string;
  chargeId?: string;
  transactionId?: string;
  createdAt: Date;
  updatedAt: Date;
  // Propiedades adicionales para respuestas simuladas
  success?: boolean;
  message?: string;
  paymentId?: string;
  policyId?: string;
  policyNumber?: string;
}

export interface PaymentHistory {
  id: string;
  quotationId: string;
  amount: number;
  status: string;
  createdAt: Date;
}

@Injectable({
  providedIn: 'root'
})
export class PaymentsService {
  private readonly endpoint = '/payments';

  constructor(
    private apiService: ApiService,
    private openPayService: OpenPayService,
    private logger: LoggerService
  ) {}

  /**
   * Generar token de tarjeta con OpenPay
   */
  generateCardToken(cardData: OpenPayCardData): Observable<OpenPayTokenResponse> {
    return new Observable(observer => {
      try {
        // Validar tarjeta antes de generar token
        if (!this.openPayService.validateCardNumber(cardData.card_number)) {
          observer.error(new Error('Número de tarjeta inválido'));
          return;
        }

        if (!this.openPayService.validateCVC(cardData.cvv2)) {
          observer.error(new Error('CVV inválido'));
          return;
        }

        if (!this.openPayService.validateExpiry(cardData.expiration_month, cardData.expiration_year)) {
          observer.error(new Error('Fecha de expiración inválida'));
          return;
        }

        // Generar token usando OpenPay
        this.openPayService.createToken(cardData).then(
          (tokenResponse: OpenPayTokenResponse) => {
            observer.next(tokenResponse);
            observer.complete();
          },
          (error: any) => {
            observer.error(new Error(error.message || 'Error generando token de tarjeta'));
          }
        );
      } catch (error: any) {
        observer.error(new Error(error.message || 'Error validando datos de tarjeta'));
      }
    });
  }

  /**
   * Procesar pago completo
   */
  processPayment(paymentData: PaymentData, userId?: string): Observable<ApiResponse<PaymentResponse>> {
    return new Observable(observer => {
      // Primero generar token de tarjeta
      this.generateCardToken(paymentData.cardData).subscribe({
        next: (tokenResponse) => {
          // Verificar que el token tenga card_number válido
          if (!tokenResponse.card_number) {
            observer.error(new Error('Token de tarjeta inválido: falta número de tarjeta'));
            return;
          }

          // Luego procesar pago en el backend
          const paymentPayload = {
            quotationId: paymentData.quotationId,
            token: tokenResponse.id,
            deviceDataId: this.openPayService.isAvailable() ? this.openPayService.setupDeviceData() : 'device-' + Date.now(),
            amount: paymentData.amount,
            currency: paymentData.currency,
            description: paymentData.description,
            userId: userId // Enviar userId real si está disponible
          };

          this.logger.log('💰 Payload de pago enviado al backend:', paymentPayload);

          this.apiService.post<PaymentResponse>(`${this.endpoint}/process`, paymentPayload).subscribe({
            next: (response) => observer.next(response),
            error: (error) => {
              // Mejorar manejo de errores del backend
              const errorData = error.error || error;
              const friendlyMessage = OpenPayErrorHandler.getErrorMessage(errorData);
              const enhancedError = {
                ...error,
                message: friendlyMessage,
                originalError: errorData
              };
              this.logger.error('Error procesando pago:', enhancedError);
              observer.error(enhancedError);
            }
          });
        },
        error: (error) => observer.error(error)
      });
    });
  }

  /**
   * Validar tarjeta
   */
  validateCard(cardData: OpenPayCardData): Observable<ApiResponse<any>> {
    return this.apiService.post<any>(`${this.endpoint}/validate-card`, cardData);
  }

  /**
   * Obtener historial de pagos
   */
  getPaymentHistory(): Observable<ApiResponse<PaymentHistory[]>> {
    return this.apiService.get<PaymentHistory[]>(`${this.endpoint}/history`);
  }

  /**
   * Obtener pago por ID
   */
  getPaymentById(paymentId: string): Observable<ApiResponse<PaymentResponse>> {
    return this.apiService.get<PaymentResponse>(`${this.endpoint}/${paymentId}`);
  }

  /**
   * Obtener pago por policyId
   */
  getPaymentByPolicyId(policyId: string): Observable<ApiResponse<PaymentResponse>> {
    return this.apiService.get<PaymentResponse>(`${this.endpoint}/policy/${policyId}`);
  }

  /**
   * Obtener estado de pago por charge ID
   */
  getPaymentStatus(chargeId: string): Observable<ApiResponse<any>> {
    return this.apiService.get<any>(`${this.endpoint}/status/${chargeId}`);
  }

  /**
   * Crear webhook de pago
   */
  createPaymentWebhook(webhookData: any): Observable<ApiResponse<any>> {
    return this.apiService.post<any>(`${this.endpoint}/webhooks/create`, webhookData);
  }

  /**
   * Procesar webhook de OpenPay
   */
  processOpenPayWebhook(webhookData: any): Observable<ApiResponse<any>> {
    return this.apiService.post<any>(`${this.endpoint}/webhooks/openpay`, webhookData);
  }

  /**
   * Obtener token de pago (para casos especiales)
   */
  getPaymentToken(paymentData: any): Observable<ApiResponse<any>> {
    return this.apiService.post<any>(`${this.endpoint}/tokens`, paymentData);
  }

  /**
   * Reenviar correo de confirmación de pago
   */
  resendPaymentEmail(paymentId: string): Observable<ApiResponse<{ success: boolean; message: string }>> {
    this.logger.log(`📧 Reenviando correo de confirmación de pago para paymentId: ${paymentId}`);
    return this.apiService.post<{ success: boolean; message: string }>(`${this.endpoint}/${paymentId}/resend-email`, {});
  }
}
