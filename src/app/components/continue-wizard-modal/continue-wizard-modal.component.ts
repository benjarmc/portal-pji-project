import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-continue-wizard-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="modal-overlay" *ngIf="show">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">
            <i class="bi bi-arrow-clockwise me-2"></i>
            ¿Continuar donde lo dejaste?
          </h5>
        </div>
        
        <div class="modal-body">
          <div class="alert alert-info mb-3">
            <i class="bi bi-info-circle me-2"></i>
            <strong>Detectamos que tienes un proceso de cotización en curso.</strong>
          </div>
          
          <div class="wizard-status">
            <div class="status-item">
              <span class="status-label">Paso actual:</span>
              <span class="status-value">{{ currentStepLabel }}</span>
            </div>
            
            <div class="status-item" *ngIf="selectedPlan">
              <span class="status-label">Plan seleccionado:</span>
              <span class="status-value">{{ selectedPlan }}</span>
            </div>
            
            <div class="status-item" *ngIf="quotationNumber">
              <span class="status-label">Cotización:</span>
              <span class="status-value">{{ quotationNumber }}</span>
            </div>
            
            <div class="status-item" *ngIf="completedSteps > 0">
              <span class="status-label">Progreso:</span>
              <span class="status-value">{{ completedSteps }} de 6 pasos completados</span>
            </div>
          </div>
          
          <div class="progress-info mt-3">
            <div class="progress mb-2" style="height: 8px;">
              <div class="progress-bar bg-success" 
                   [style.width.%]="(completedSteps / 6) * 100"
                   role="progressbar">
              </div>
            </div>
            <small class="text-muted">
              {{ Math.round((completedSteps / 6) * 100) }}% completado
            </small>
          </div>
        </div>
        
        <div class="modal-footer">
          <button type="button" class="btn btn-outline-secondary" (click)="onRestart()">
            <i class="bi bi-arrow-clockwise me-2"></i>
            Empezar de nuevo
          </button>
          <button type="button" class="btn btn-primary" (click)="onContinue()">
            <i class="bi bi-play-circle me-2"></i>
            Continuar
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-color: rgba(0, 0, 0, 0.6);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 1050;
      backdrop-filter: blur(4px);
    }

    .modal-content {
      background: white;
      border-radius: 16px;
      padding: 0;
      max-width: 550px;
      width: 90%;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      animation: modalSlideIn 0.3s ease-out;
    }

    @keyframes modalSlideIn {
      from {
        opacity: 0;
        transform: translateY(-20px) scale(0.95);
      }
      to {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }

    .modal-header {
      border-bottom: 1px solid #e9ecef;
      padding: 24px 24px 16px 24px;
      margin: 0;
    }

    .modal-title {
      margin: 0;
      color: #2c3e50;
      font-weight: 600;
      font-size: 1.25rem;
      display: flex;
      align-items: center;
    }

    .modal-body {
      padding: 24px;
      margin: 0;
    }

    .alert-info {
      background-color: #e7f3ff;
      border-color: #b3d9ff;
      color: #0c5460;
      border-radius: 8px;
      border: none;
      padding: 16px;
    }

    .wizard-status {
      background-color: #f8f9fa;
      border-radius: 8px;
      padding: 16px;
    }

    .status-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 0;
      border-bottom: 1px solid #e9ecef;
    }

    .status-item:last-child {
      border-bottom: none;
    }

    .status-label {
      font-weight: 500;
      color: #6c757d;
      font-size: 0.9rem;
    }

    .status-value {
      font-weight: 600;
      color: #2c3e50;
      text-align: right;
    }

    .progress-info {
      text-align: center;
    }

    .progress {
      border-radius: 4px;
      background-color: #e9ecef;
    }

    .progress-bar {
      border-radius: 4px;
      transition: width 0.6s ease;
    }

    .modal-footer {
      border-top: 1px solid #e9ecef;
      padding: 20px 24px;
      margin: 0;
      display: flex;
      gap: 12px;
      justify-content: flex-end;
    }

    .btn {
      padding: 12px 24px;
      border-radius: 8px;
      border: none;
      cursor: pointer;
      font-weight: 500;
      font-size: 0.95rem;
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .btn-primary {
      background-color: #007bff;
      color: white;
    }

    .btn-primary:hover {
      background-color: #0056b3;
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(0, 123, 255, 0.3);
    }

    .btn-outline-secondary {
      background-color: transparent;
      color: #6c757d;
      border: 1px solid #6c757d;
    }

    .btn-outline-secondary:hover {
      background-color: #6c757d;
      color: white;
      transform: translateY(-1px);
    }

    .bi {
      font-size: 1.1rem;
    }
  `]
})
export class ContinueWizardModalComponent {
  @Input() show = false;
  @Input() currentStep = 0;
  @Input() selectedPlan: string | null = null;
  @Input() quotationNumber: string | null = null;
  @Input() completedSteps: number = 0;
  @Output() continue = new EventEmitter<void>();
  @Output() restart = new EventEmitter<void>();

  // Hacer Math disponible en el template
  Math = Math;

  get currentStepLabel(): string {
    const steps = [
      'Bienvenida',
      'Datos principales', 
      'Pago',
      'Validación',
      'Contrato',
      'Final'
    ];
    return steps[this.currentStep] || 'Desconocido';
  }

  onContinue(): void {
    this.continue.emit();
  }

  onRestart(): void {
    this.restart.emit();
  }
}
