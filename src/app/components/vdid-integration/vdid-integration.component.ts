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
              <div *ngIf="verificationUuid" class="alert alert-info">
                <strong>UUID del Backend:</strong> {{ verificationUuid }}
              </div>
              <input 
                type="text" 
                class="form-control" 
                id="uuid" 
                [(ngModel)]="verificationUuid"
                placeholder="Ingresa el UUID de verificación o usa el del backend">
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

            <div class="mb-3">
              <label class="form-label">Opciones de Verificación</label>
              <div class="form-check">
                <input 
                  class="form-check-input" 
                  type="checkbox" 
                  id="methodRedirect" 
                  [(ngModel)]="verificationMethod"
                  value="redirect">
                <label class="form-check-label" for="methodRedirect">
                  Usar Redirección
                </label>
              </div>
              <div class="form-check">
                <input 
                  class="form-check-input" 
                  type="checkbox" 
                  id="methodPopup" 
                  [(ngModel)]="verificationMethod"
                  value="popup">
                <label class="form-check-label" for="methodPopup">
                  Usar Popup
                </label>
              </div>
            </div>

            <button 
              class="btn btn-success w-100" 
              (click)="startVerification()"
              [disabled]="!verificationUuid">
              Iniciar Verificación
            </button>
          </div>
        </div>

        <div class="col-md-6">
          <h5>Estado de Verificación</h5>
          <div class="card">
            <div class="card-body">
              <div *ngIf="verificationStatus === 'pending'" class="text-center">
                <i class="pi pi-clock" style="font-size: 2rem; color: #6c757d;"></i>
                <p class="mt-2">Esperando inicio de verificación...</p>
              </div>
              
              <div *ngIf="verificationStatus === 'in_progress'" class="text-center">
                <i class="pi pi-spin pi-spinner" style="font-size: 2rem; color: #007bff;"></i>
                <p class="mt-2">Verificación en progreso...</p>
              </div>
              
              <div *ngIf="verificationStatus === 'completed'" class="text-center">
                <i class="pi pi-check-circle" style="font-size: 2rem; color: #28a745;"></i>
                <p class="mt-2">Verificación completada exitosamente</p>
                <button class="btn btn-primary mt-2" (click)="getVerificationResult()">
                  Ver Resultado
                </button>
              </div>
              
              <div *ngIf="verificationStatus === 'failed'" class="text-center">
                <i class="pi pi-times-circle" style="font-size: 2rem; color: #dc3545;"></i>
                <p class="mt-2">Verificación falló</p>
                <button class="btn btn-warning mt-2" (click)="retryVerification()">
                  Reintentar
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .vdid-integration {
      padding: 1rem;
      background: #f8f9fa;
      border-radius: 8px;
    }
    .card {
      border: 1px solid #dee2e6;
      border-radius: 8px;
    }
    .btn {
      border-radius: 6px;
    }
  `]
})
export class VdidIntegrationComponent implements OnInit {
  @Input() publicKey: string = '';
  @Input() verificationUuid: string = ''; // UUID generado por el backend
  @Output() verificationStarted = new EventEmitter<string>();
  @Output() verificationCompleted = new EventEmitter<any>();

  // Estado del componente
  isInitialized = false;
  verificationMethod: 'redirect' | 'popup' = 'redirect';
  designVersion: 'v1' | 'v2' = 'v2';
  verificationStatus: 'pending' | 'in_progress' | 'completed' | 'failed' = 'pending';

  // Opciones de verificación
  verificationOptions: VerificationOptions = {
    method: 'redirect',
    version: 'v2'
  };

  // Opciones de captura
  captureOptions: CaptureOptions = {
    typeId: 'id',
    version: 'v2'
  };

  constructor(private vdidService: VdidService) {}

  ngOnInit() {
    // Si se proporciona una publicKey, inicializar automáticamente
    if (this.publicKey) {
      this.initializeSDK();
    }
    
    // Si se proporciona un UUID, configurar automáticamente
    if (this.verificationUuid) {
      console.log('🔑 UUID de verificación recibido:', this.verificationUuid);
    }
  }

  /**
   * Inicializar el SDK de VDID
   */
  initializeSDK() {
    try {
      this.vdidService.initialize({ publicKey: this.publicKey, version: 'v2' });
      this.isInitialized = true;
      console.log('✅ SDK de VDID inicializado correctamente');
    } catch (error) {
      console.error('❌ Error inicializando SDK de VDID:', error);
    }
  }

  /**
   * Iniciar proceso de verificación
   */
  startVerification() {
    if (!this.verificationUuid) {
      console.error('❌ UUID de verificación requerido');
      return;
    }

    try {
      this.verificationStatus = 'in_progress';
      this.verificationStarted.emit(this.verificationUuid);

      // Configurar opciones de verificación
      const options: VerificationOptions = {
        method: this.verificationMethod,
        version: this.designVersion
      };

      // Iniciar verificación usando el método correcto del servicio
      this.vdidService.verifyIdentity(this.verificationUuid, options).subscribe({
        next: () => {
          console.log('🚀 Verificación iniciada correctamente');
        },
        error: (error: any) => {
          console.error('❌ Error iniciando verificación:', error);
          this.verificationStatus = 'failed';
        }
      });

    } catch (error) {
      console.error('❌ Error configurando verificación:', error);
      this.verificationStatus = 'failed';
    }
  }

  /**
   * Obtener resultado de verificación
   */
  getVerificationResult() {
    if (!this.verificationUuid) {
      console.error('❌ UUID de verificación requerido');
      return;
    }

    // Usar el método correcto del servicio
    const verificationUrl = this.vdidService.getVerificationUrl(this.verificationUuid);
    console.log('📊 URL de verificación:', verificationUrl);
    
    // Emitir evento con la URL
    this.verificationCompleted.emit({ 
      uuid: this.verificationUuid, 
      url: verificationUrl,
      status: 'url_generated'
    });
  }

  /**
   * Reintentar verificación
   */
  retryVerification() {
    this.verificationStatus = 'pending';
    this.verificationUuid = '';
  }

  /**
   * Manejar evento de verificación completada
   */
  onVerificationComplete(result: any) {
    this.verificationStatus = 'completed';
    this.verificationCompleted.emit(result);
  }

  /**
   * Manejar evento de verificación fallida
   */
  onVerificationFailed(error: any) {
    this.verificationStatus = 'failed';
    console.error('❌ Verificación fallida:', error);
  }
} 