import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { VdidService, VerificationOptions, CaptureOptions } from '../../services/vdid.service';

@Component({
  selector: 'app-vdid-integration',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="vdid-integration">
      <div class="row">
        <div class="col-md-6">
          <h5>Verificación de Identidad</h5>
          
          <!-- Configuración inicial -->
          <div class="mb-3" *ngIf="!isInitialized">
            <label for="apiKey" class="form-label">API Key</label>
            <input 
              type="text" 
              class="form-control" 
              id="publicKey" 
              [(ngModel)]="publicKey"
              placeholder="Ingresa tu Public Key de VDID">
            <button 
              class="btn btn-primary mt-2" 
              (click)="initializeSDK()"
              [disabled]="!publicKey">
              Inicializar SDK
            </button>
          </div>

          <!-- Opciones de verificación -->
          <div *ngIf="isInitialized">
            <div class="mb-3">
              <label for="uuid" class="form-label">UUID de Verificación</label>
              <input 
                type="text" 
                class="form-control" 
                id="uuid" 
                [(ngModel)]="verificationUuid"
                placeholder="Ingresa el UUID de verificación">
            </div>

            <div class="mb-3">
              <label class="form-label">Método de Verificación</label>
              <div class="form-check">
                <input 
                  class="form-check-input" 
                  type="radio" 
                  name="method" 
                  id="redirect" 
                  value="redirect"
                  [(ngModel)]="verificationMethod">
                <label class="form-check-label" for="redirect">
                  Redirección
                </label>
              </div>
              <div class="form-check">
                <input 
                  class="form-check-input" 
                  type="radio" 
                  name="method" 
                  id="popup" 
                  value="popup"
                  [(ngModel)]="verificationMethod">
                <label class="form-check-label" for="popup">
                  Popup
                </label>
              </div>
            </div>

            <div class="mb-3">
              <label class="form-label">Versión de Diseño</label>
              <div class="form-check">
                <input 
                  class="form-check-input" 
                  type="radio" 
                  name="version" 
                  id="v2" 
                  value="v2"
                  [(ngModel)]="designVersion">
                <label class="form-check-label" for="v2">
                  v2 (Recomendado)
                </label>
              </div>
              <div class="form-check">
                <input 
                  class="form-check-input" 
                  type="radio" 
                  name="version" 
                  id="v1" 
                  value="v1"
                  [(ngModel)]="designVersion">
                <label class="form-check-label" for="v1">
                  v1 (Legacy)
                </label>
              </div>
            </div>

            <button 
              class="btn btn-success me-2" 
              (click)="startVerification()"
              [disabled]="!verificationUuid">
              Iniciar Verificación
            </button>

            <button 
              class="btn btn-info me-2" 
              (click)="getVerificationUrl()"
              [disabled]="!verificationUuid">
              Obtener URL
            </button>

            <button 
              class="btn btn-warning" 
              (click)="showEmailForm = !showEmailForm">
              Enviar por Email
            </button>
          </div>
        </div>

        <div class="col-md-6">
          <!-- Formulario de email -->
          <div *ngIf="showEmailForm && isInitialized" class="card">
            <div class="card-header">
              <h6>Enviar Verificación por Email</h6>
            </div>
            <div class="card-body">
              <div class="mb-3">
                <label for="email" class="form-label">Email del Usuario</label>
                <input 
                  type="email" 
                  class="form-control" 
                  id="email" 
                  [(ngModel)]="userEmail"
                  placeholder="usuario@ejemplo.com">
              </div>
              <button 
                class="btn btn-primary" 
                (click)="sendVerificationEmail()"
                [disabled]="!userEmail || !verificationUuid">
                Enviar Email
              </button>
            </div>
          </div>

          <!-- Captura de imágenes -->
          <div class="card mt-3">
            <div class="card-header">
              <h6>Captura de Imágenes</h6>
            </div>
            <div class="card-body">
              <div class="mb-3">
                <label class="form-label">Tipo de Documento</label>
                <select class="form-select" [(ngModel)]="captureType">
                  <option value="first">Seleccionar tipo</option>
                  <option value="id">ID (Frente y reverso)</option>
                  <option value="passport">Pasaporte (Una foto)</option>
                </select>
              </div>
              <button 
                class="btn btn-secondary" 
                (click)="getImageCaptureUrl()">
                Obtener URL de Captura
              </button>
            </div>
          </div>

          <!-- Resultados -->
          <div class="card mt-3" *ngIf="verificationUrl">
            <div class="card-header">
              <h6>URL Generada</h6>
            </div>
            <div class="card-body">
              <div class="mb-2">
                <label class="form-label">URL:</label>
                <input 
                  type="text" 
                  class="form-control" 
                  [value]="verificationUrl" 
                  readonly>
              </div>
              <button 
                class="btn btn-outline-primary btn-sm" 
                (click)="copyToClipboard(verificationUrl)">
                Copiar URL
              </button>
              <button 
                class="btn btn-outline-success btn-sm ms-2" 
                (click)="openUrl(verificationUrl)">
                Abrir URL
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .vdid-integration {
      padding: 20px;
    }
    .card {
      border: 1px solid #dee2e6;
      border-radius: 0.375rem;
    }
    .card-header {
      background-color: #f8f9fa;
      border-bottom: 1px solid #dee2e6;
      padding: 0.75rem 1rem;
    }
    .form-check {
      margin-bottom: 0.5rem;
    }
  `]
})
export class VdidIntegrationComponent implements OnInit {
  @Input() publicKey: string = '';
  @Output() verificationStarted = new EventEmitter<string>();
  @Output() verificationCompleted = new EventEmitter<any>();

  // Propiedades del componente
  isInitialized = false;
  verificationUuid = '';
  verificationMethod: 'redirect' | 'popup' = 'redirect';
  designVersion: 'v1' | 'v2' = 'v2';
  userEmail = '';
  showEmailForm = false;
  captureType: 'id' | 'passport' | 'first' = 'first';
  verificationUrl = '';

  constructor(private vdidService: VdidService) {}

  ngOnInit(): void {
    // Si se proporciona una public key como input, inicializar automáticamente
    if (this.publicKey) {
      this.initializeSDK();
    }
  }

  /**
   * Inicializa el SDK de VDID
   */
  initializeSDK(): void {
    try {
      console.log('🔧 Inicializando VDID SDK con publicKey:', this.publicKey);
      this.vdidService.initialize({
        publicKey: this.publicKey,
        version: this.designVersion
      });
      this.isInitialized = true;
      console.log('✅ VDID SDK inicializado correctamente');
      console.log('🔍 SDK inicializado:', this.vdidService.isInitialized());
    } catch (error) {
      console.error('❌ Error al inicializar VDID SDK:', error);
    }
  }

  /**
   * Inicia el proceso de verificación
   */
  startVerification(): void {
    if (!this.verificationUuid) {
      alert('Por favor ingresa un UUID de verificación');
      return;
    }

    const options: VerificationOptions = {
      method: this.verificationMethod,
      version: this.designVersion
    };

    this.verificationStarted.emit(this.verificationUuid);

    this.vdidService.verifyIdentity(this.verificationUuid, options).subscribe({
      next: () => {
        console.log('Verificación iniciada correctamente');
        this.verificationCompleted.emit({ uuid: this.verificationUuid, status: 'started' });
      },
      error: (error) => {
        console.error('Error al iniciar verificación:', error);
        alert('Error al iniciar la verificación');
      }
    });
  }

  /**
   * Obtiene la URL de verificación
   */
  getVerificationUrl(): void {
    if (!this.verificationUuid) {
      alert('Por favor ingresa un UUID de verificación');
      return;
    }

    try {
      this.verificationUrl = this.vdidService.getVerificationUrl(
        this.verificationUuid, 
        this.designVersion
      );
    } catch (error) {
      console.error('Error al obtener URL:', error);
      alert('Error al obtener la URL de verificación');
    }
  }

  /**
   * Envía verificación por email
   */
  sendVerificationEmail(): void {
    if (!this.verificationUuid || !this.userEmail) {
      alert('Por favor ingresa UUID y email');
      return;
    }

    this.vdidService.sendVerificationEmail(
      this.verificationUuid, 
      this.userEmail, 
      this.designVersion
    ).subscribe({
      next: () => {
        console.log('Email enviado correctamente');
        alert('Email de verificación enviado correctamente');
      },
      error: (error) => {
        console.error('Error al enviar email:', error);
        alert('Error al enviar el email de verificación');
      }
    });
  }

  /**
   * Obtiene URL para captura de imágenes
   */
  getImageCaptureUrl(): void {
    try {
      const options: CaptureOptions = {
        typeId: this.captureType,
        version: this.designVersion
      };

      this.verificationUrl = this.vdidService.getImageCaptureUrl(options);
    } catch (error) {
      console.error('Error al obtener URL de captura:', error);
      alert('Error al obtener la URL de captura de imágenes');
    }
  }

  /**
   * Copia URL al portapapeles
   */
  copyToClipboard(text: string): void {
    navigator.clipboard.writeText(text).then(() => {
      alert('URL copiada al portapapeles');
    }).catch(() => {
      alert('Error al copiar URL');
    });
  }

  /**
   * Abre URL en nueva pestaña
   */
  openUrl(url: string): void {
    window.open(url, '_blank');
  }
} 