import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { ValidationService } from '../services/validation.service';
import { WizardStateService } from '../services/wizard-state.service';
import { Subject, timer } from 'rxjs';
import { takeUntil, debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { LoggerService } from '../services/logger.service';
interface ValidationResult {
  uuid: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  globalResult: string;
  globalResultDescription: string;
  fullName: string;
  documentType: string;
  totalChecks: number;
  successChecks: number;
  failedChecks: number;
  resultFaceMatch: string;
  scoreFaceMatch: number;
  resutlLiveness: string;
  scoreLiveness: number;
  documentData: any[];
  documentVerifications: any[];
}

@Component({
  selector: 'app-validation-complete',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="validation-complete-container">
      <div class="validation-card">
        <!-- Header -->
        <div class="validation-header">
          <div class="status-icon" [ngClass]="getStatusClass()">
            <i [class]="getStatusIcon()"></i>
          </div>
          <h2>{{ getStatusTitle() }}</h2>
          <p class="status-description">{{ getStatusDescription() }}</p>
        </div>

        <!-- Loading State -->
        <div *ngIf="isLoading" class="loading-state">
          <div class="spinner"></div>
          <p>Procesando la verificación de identidad...</p>
        </div>

        <!-- Error State -->
        <div *ngIf="error" class="error-state">
          <div class="error-icon">
            <i class="fas fa-exclamation-triangle"></i>
          </div>
          <h3>Error en la Verificación</h3>
          <p>{{ error }}</p>
          <button class="btn btn-primary" (click)="retryValidation()">
            Volver a Verificación
          </button>
        </div>

        <!-- Completion State -->
        <div *ngIf="validationResult && !isLoading && !error" class="completion-state">
          <!-- Simple completion message -->
          <div class="completion-message">
            <p>El proceso de verificación de identidad ha finalizado.</p>
            <p>Los resultados han sido procesados y registrados en el sistema.</p>
          </div>

          <!-- Actions -->
          <div class="actions">
            <button class="btn btn-primary btn-lg" (click)="goToHome()">
              <i class="fas fa-home"></i>
              Continuar
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .validation-complete-container {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #F9F9F9 0%, #1D4C2C 50%, #A8CF41 100%);
      padding: 20px;
      position: relative;
    }

    .validation-complete-container::before {
      content: '';
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: linear-gradient(135deg, #F9F9F9 0%, #1D4C2C 50%, #A8CF41 100%);
      z-index: -1;
      pointer-events: none;
    }

    .validation-card {
      background: white;
      border-radius: 16px;
      box-shadow: 0 20px 40px rgba(0,0,0,0.1);
      padding: 40px;
      max-width: 800px;
      width: 100%;
    }

    .validation-header {
      text-align: center;
      margin-bottom: 30px;
    }

    .status-icon {
      width: 80px;
      height: 80px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 20px;
      font-size: 32px;
    }

    .status-icon.success {
      background: #d4edda;
      color: #155724;
    }

    .status-icon.warning {
      background: #fff3cd;
      color: #856404;
    }

    .status-icon.error {
      background: #f8d7da;
      color: #721c24;
    }

    .status-icon.loading {
      background: #d1ecf1;
      color: #0c5460;
    }

    .status-description {
      color: #6c757d;
      font-size: 16px;
      margin-top: 10px;
    }

    .loading-state {
      text-align: center;
      padding: 40px;
    }

    .spinner {
      width: 40px;
      height: 40px;
      border: 4px solid #f3f3f3;
      border-top: 4px solid #007bff;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin: 0 auto 20px;
    }

    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }

    .error-state {
      text-align: center;
      padding: 40px;
    }

    .completion-state {
      text-align: center;
      padding: 40px;
    }

    .completion-message {
      margin-bottom: 30px;
    }

    .completion-message p {
      font-size: 16px;
      color: #495057;
      margin-bottom: 15px;
      line-height: 1.6;
    }

    .error-icon {
      font-size: 48px;
      color: #dc3545;
      margin-bottom: 20px;
    }

    .validation-summary {
      background: #f8f9fa;
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 30px;
    }

    .summary-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 15px;
      margin-top: 15px;
    }

    .summary-item {
      display: flex;
      flex-direction: column;
    }

    .summary-item .label {
      font-weight: 600;
      color: #495057;
      font-size: 14px;
    }

    .summary-item .value {
      color: #212529;
      font-size: 16px;
      margin-top: 5px;
    }

    .status-badge {
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
    }

    .status-badge.success {
      background: #d4edda;
      color: #155724;
    }

    .status-badge.warning {
      background: #fff3cd;
      color: #856404;
    }

    .status-badge.error {
      background: #f8d7da;
      color: #721c24;
    }

    .detailed-results {
      margin-bottom: 30px;
    }

    .result-section {
      margin-bottom: 25px;
    }

    .result-section h5 {
      color: #495057;
      margin-bottom: 15px;
      font-size: 18px;
    }

    .result-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px 0;
      border-bottom: 1px solid #e9ecef;
    }

    .result-item:last-child {
      border-bottom: none;
    }

    .result-label {
      font-weight: 500;
      color: #495057;
    }

    .result-value {
      font-weight: 600;
    }

    .result-value.success {
      color: #28a745;
    }

    .result-value.warning {
      color: #ffc107;
    }

    .verification-list {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 10px;
    }

    .verification-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 15px;
      border-radius: 6px;
      font-size: 14px;
    }

    .verification-item.success {
      background: #d4edda;
      color: #155724;
    }

    .verification-item.failed {
      background: #f8d7da;
      color: #721c24;
    }

    .verification-name {
      font-weight: 500;
    }

    .verification-result {
      font-weight: 600;
      text-transform: uppercase;
      font-size: 12px;
    }

    .actions {
      display: flex;
      gap: 15px;
      justify-content: center;
      flex-wrap: wrap;
    }

    .btn {
      padding: 12px 24px;
      border: none;
      border-radius: 8px;
      font-weight: 600;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
      transition: all 0.3s ease;
    }

    .btn-success {
      background: #28a745;
      color: white;
    }

    .btn-success:hover {
      background: #218838;
      transform: translateY(-2px);
    }

    .btn-warning {
      background: #ffc107;
      color: #212529;
    }

    .btn-warning:hover {
      background: #e0a800;
      transform: translateY(-2px);
    }

    .btn-secondary {
      background: #6c757d;
      color: white;
    }

    .btn-secondary:hover {
      background: #5a6268;
      transform: translateY(-2px);
    }

    .btn-lg {
      padding: 15px 30px;
      font-size: 16px;
    }

    @media (max-width: 768px) {
      .validation-card {
        padding: 20px;
        margin: 10px;
      }
      
      .actions {
        flex-direction: column;
      }
      
      .btn {
        width: 100%;
        justify-content: center;
      }
    }
  `]
})
export class ValidationCompleteComponent implements OnInit, OnDestroy {
  validationResult: ValidationResult | null = null;
  isLoading = true;
  error: string | null = null;
  uuid: string | null = null;
  
  // Control de peticiones
  private destroy$ = new Subject<void>();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private validationService: ValidationService,
    private wizardStateService: WizardStateService,
    private logger: LoggerService
  ) {}

  ngOnInit(): void {
    // Simular carga de resultado de validación completada
    this.simulateValidationComplete();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Simular validación completada exitosamente
   */
  private simulateValidationComplete(): void {
    this.isLoading = true;
    
    // Simular carga de 2 segundos
    setTimeout(() => {
      this.validationResult = {
        uuid: 'validation-complete-' + Date.now(),
        status: 'COMPLETED',
        globalResult: 'Success',
        globalResultDescription: 'Validación de identidad completada exitosamente',
        fullName: 'Usuario Verificado',
        documentType: 'INE',
        totalChecks: 5,
        successChecks: 5,
        failedChecks: 0,
        resultFaceMatch: 'Success',
        scoreFaceMatch: 95,
        resutlLiveness: 'Success',
        scoreLiveness: 0.98,
        documentData: [],
        documentVerifications: [
          { name: 'Identificación del Documento', result: 'Ok' },
          { name: 'Comprobación Facial', result: 'Ok' },
          { name: 'Prueba de Vida', result: 'Ok' },
          { name: 'Verificación de Datos', result: 'Ok' },
          { name: 'Validación Final', result: 'Ok' }
        ]
      };
      
      this.isLoading = false;
      
      // Actualizar el estado del wizard
      this.updateWizardState();
      
      this.logger.log('✅ Validación simulada completada exitosamente');
    }, 2000);
  }

  /**
   * Actualizar el estado del wizard con el resultado de la validación
   */
  private updateWizardState(): void {
    if (!this.validationResult) return;

    // Guardar el resultado de la validación en el estado del wizard
    this.wizardStateService.saveState({
      paymentResult: {
        uuid: this.validationResult.uuid,
        status: this.validationResult.status,
        globalResult: this.validationResult.globalResult,
        globalResultDescription: this.validationResult.globalResultDescription,
        fullName: this.validationResult.fullName,
        documentType: this.validationResult.documentType,
        isSuccessful: this.isValidationSuccessful(),
        timestamp: new Date().toISOString()
      }
    });

    this.logger.log('✅ Estado del wizard actualizado con resultado de validación');
  }

  /**
   * Determinar si la validación fue exitosa
   */
  isValidationSuccessful(): boolean {
    if (!this.validationResult) return false;
    
    // Criterios para considerar exitosa la validación:
    // 1. Estado debe ser 'Checked'
    // 2. Resultado global debe ser exitoso (no 'DocumentExpired' u otros errores)
    // 3. Coincidencia facial debe ser >= 70%
    // 4. Prueba de vida debe ser >= 90%
    
    const isStatusOk = this.validationResult.status === 'COMPLETED';
    const isGlobalResultOk = !['DocumentExpired', 'Failed', 'Error'].includes(this.validationResult.globalResult);
    const isFaceMatchOk = this.validationResult.scoreFaceMatch >= 70;
    const isLivenessOk = this.validationResult.scoreLiveness >= 0.9;
    
    return isStatusOk && isGlobalResultOk && isFaceMatchOk && isLivenessOk;
  }

  /**
   * Obtener clase CSS para el estado
   */
  getStatusClass(): string {
    if (this.isLoading) return 'loading';
    if (this.error) return 'error';
    if (this.isValidationSuccessful()) return 'success';
    return 'warning';
  }

  /**
   * Obtener icono para el estado
   */
  getStatusIcon(): string {
    if (this.isLoading) return 'fas fa-spinner fa-spin';
    if (this.error) return 'fas fa-exclamation-triangle';
    if (this.isValidationSuccessful()) return 'fas fa-check-circle';
    return 'fas fa-exclamation-circle';
  }

  /**
   * Obtener título del estado
   */
  getStatusTitle(): string {
    if (this.isLoading) return 'Procesando Verificación';
    if (this.error) return 'Error en el Proceso';
    return 'Verificación Finalizada';
  }

  /**
   * Obtener descripción del estado
   */
  getStatusDescription(): string {
    if (this.isLoading) return 'Procesando la verificación de identidad...';
    if (this.error) return 'Hubo un problema durante el proceso de verificación.';
    return 'El proceso de verificación ha finalizado.';
  }

  /**
   * Obtener clase CSS para el resultado
   */
  getResultClass(): string {
    if (!this.validationResult) return '';
    
    switch (this.validationResult.globalResult) {
      case 'Success':
      case 'Approved':
        return 'success';
      case 'DocumentExpired':
      case 'Failed':
      case 'Error':
        return 'error';
      default:
        return 'warning';
    }
  }

  /**
   * Obtener verificaciones clave para mostrar
   */
  getKeyVerifications(): any[] {
    if (!this.validationResult) return [];
    
    return this.validationResult.documentVerifications
      .filter(v => ['Identificación del Documento', 'Comprobación Facial', 'Prueba de Vida'].includes(v.name))
      .slice(0, 5);
  }

  /**
   * Ir al home
   */
  goToHome(): void {
    this.logger.log('🏠 Yendo al home');
    this.router.navigate(['/']);
  }

  /**
   * Continuar al siguiente paso del wizard
   */
  continueToNextStep(): void {
    this.logger.log('🚀 Continuando al siguiente paso del wizard');
    
    // Marcar el paso de validación como completado
    this.wizardStateService.completeStep(3); // Paso 3 es validación
    
    // Navegar al wizard en el siguiente paso
    this.router.navigate(['/cotizador'], { 
      queryParams: { step: 4 } // Paso 4 es captura de datos
    });
  }

  /**
   * Volver al paso de validación
   */
  retryValidation(): void {
    this.logger.log('🔄 Volviendo al paso de validación');
    
    // Navegar de vuelta al paso de validación
    this.router.navigate(['/cotizador'], { 
      queryParams: { step: 3 } // Paso 3 es validación
    });
  }

  /**
   * Volver al wizard
   */
  goToWizard(): void {
    this.logger.log('🔙 Volviendo al wizard');
    this.router.navigate(['/cotizador']);
  }
}
