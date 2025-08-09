import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

declare global {
  interface Window {
    OpenPay: any;
  }
}

export interface OpenPayCardData {
  card_number: string;
  holder_name: string;
  expiration_year: string;
  expiration_month: string;
  cvv2: string;
}

export interface OpenPayTokenResponse {
  id: string;
  holder_name: string;
  brand: string;
  card_number: string;
  expiration_month: string;
  expiration_year: string;
}

export interface OpenPayErrorResponse {
  status: number;
  description: string;
  request_id: string;
  message: string;
}

@Injectable({
  providedIn: 'root'
})
export class OpenPayService {
  private isConfigured = false;

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {}

  /**
   * Configura OpenPay con las credenciales
   */
  configure(merchantId: string, publicKey: string, sandboxMode: boolean = false): void {
    if (!isPlatformBrowser(this.platformId) || !window.OpenPay) {
      console.warn('OpenPay no está disponible en el servidor');
      return;
    }

    try {
      window.OpenPay.setId(merchantId);
      window.OpenPay.setApiKey(publicKey);
      window.OpenPay.setSandboxMode(sandboxMode);
      this.isConfigured = true;
      console.log('OpenPay configurado correctamente');
    } catch (error) {
      console.error('Error configurando OpenPay:', error);
    }
  }

  /**
   * Valida un número de tarjeta
   */
  validateCardNumber(cardNumber: string): boolean {
    if (!isPlatformBrowser(this.platformId) || !window.OpenPay) {
      return false;
    }
    return window.OpenPay.card.validateCardNumber(cardNumber);
  }

  /**
   * Valida el código de seguridad (CVV)
   */
  validateCVC(cvc: string): boolean {
    if (!isPlatformBrowser(this.platformId) || !window.OpenPay) {
      return false;
    }
    return window.OpenPay.card.validateCVC(cvc);
  }

  /**
   * Valida la fecha de expiración
   */
  validateExpiry(month: string, year: string): boolean {
    if (!isPlatformBrowser(this.platformId) || !window.OpenPay) {
      return false;
    }
    return window.OpenPay.card.validateExpiry(month, year);
  }

  /**
   * Obtiene el tipo de tarjeta
   */
  getCardType(cardNumber: string): string {
    if (!isPlatformBrowser(this.platformId) || !window.OpenPay) {
      return '';
    }
    return window.OpenPay.card.cardType(cardNumber);
  }

  /**
   * Crea un token de tarjeta
   */
  createToken(cardData: OpenPayCardData): Promise<OpenPayTokenResponse> {
    return new Promise((resolve, reject) => {
      if (!isPlatformBrowser(this.platformId) || !window.OpenPay) {
        reject(new Error('OpenPay no está disponible'));
        return;
      }

      if (!this.isConfigured) {
        reject(new Error('OpenPay no está configurado'));
        return;
      }

      window.OpenPay.token.create(cardData, 
        (response: any) => {
          resolve(response.data);
        },
        (error: OpenPayErrorResponse) => {
          reject(error);
        }
      );
    });
  }

  /**
   * Configura el device data para detección de fraude
   */
  setupDeviceData(formId?: string, fieldName: string = 'deviceDataId'): string {
    if (!isPlatformBrowser(this.platformId) || !window.OpenPay) {
      return '';
    }
    return window.OpenPay.deviceData.setup(formId, fieldName);
  }

  /**
   * Verifica si OpenPay está disponible
   */
  isAvailable(): boolean {
    return isPlatformBrowser(this.platformId) && !!window.OpenPay;
  }

  /**
   * Verifica si está en modo sandbox
   */
  isSandboxMode(): boolean {
    if (!isPlatformBrowser(this.platformId) || !window.OpenPay) {
      return false;
    }
    return window.OpenPay.getSandboxMode();
  }
}
