import { Injectable } from '@angular/core';
import { WebVerification } from 'vdid-sdk-web';
import { Observable, from } from 'rxjs';

export interface VdidConfig {
  publicKey: string;
  version?: 'v1' | 'v2';
}

export interface VerificationOptions {
  method?: 'redirect' | 'popup';
  version?: 'v1' | 'v2';
}

export interface EmailOptions {
  method: 'email';
  email: string;
  version?: 'v1' | 'v2';
}

export interface CaptureOptions {
  typeId?: 'id' | 'passport' | 'first';
  minHeight?: string;
  maxHeight?: string;
  version?: 'v1' | 'v2';
}

@Injectable({
  providedIn: 'root'
})
export class VdidService {
  private vdid!: WebVerification;
  private config!: VdidConfig;

  constructor() {}

  /**
   * Inicializa el SDK de VDID
   */
  initialize(config: VdidConfig): void {
    this.config = config;
    this.vdid = new WebVerification(config.publicKey);
  }

  /**
   * Verifica la identidad del usuario
   */
  verifyIdentity(uuid: string, options?: VerificationOptions): Observable<any> {
    if (!this.vdid) {
      throw new Error('VDID SDK no ha sido inicializado. Llama a initialize() primero.');
    }

    const opts = {
      method: options?.method || 'redirect',
      version: options?.version || this.config.version || 'v2'
    };

    return from(Promise.resolve(this.vdid.verifyIdentity(uuid, opts)));
  }

  /**
   * Obtiene la URL de verificación
   */
  getVerificationUrl(uuid: string, version?: 'v1' | 'v2'): string {
    if (!this.vdid) {
      throw new Error('VDID SDK no ha sido inicializado. Llama a initialize() primero.');
    }

    return this.vdid.getUrl({ 
      uuid, 
      version: version || this.config.version || 'v2' 
    });
  }

  /**
   * Envía verificación por email
   */
  sendVerificationEmail(uuid: string, email: string, version?: 'v1' | 'v2'): Observable<any> {
    if (!this.vdid) {
      throw new Error('VDID SDK no ha sido inicializado. Llama a initialize() primero.');
    }

    const options: EmailOptions = {
      method: 'email',
      email,
      version: version || this.config.version || 'v2'
    };

    return from(Promise.resolve(this.vdid.verifyIdentityMobile(uuid, options)));
  }

  /**
   * Obtiene URL para captura de imágenes
   */
  getImageCaptureUrl(options?: CaptureOptions): string {
    if (!this.vdid) {
      throw new Error('VDID SDK no ha sido inicializado. Llama a initialize() primero.');
    }

    const opts: CaptureOptions = {
      typeId: options?.typeId || 'first',
      minHeight: options?.minHeight,
      maxHeight: options?.maxHeight,
      version: options?.version || this.config.version || 'v2'
    };

    return this.vdid.getUrlToOnlyCaptureImages(opts);
  }

  /**
   * Verifica si el SDK está inicializado
   */
  isInitialized(): boolean {
    return !!this.vdid;
  }
} 