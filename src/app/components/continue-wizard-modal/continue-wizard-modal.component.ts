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
          <h5 class="modal-title">¿Continuar donde lo dejaste?</h5>
        </div>
        <div class="modal-body">
          <p>Detectamos que tienes un proceso de cotización en curso.</p>
          <p><strong>Paso actual:</strong> {{ currentStepLabel }}</p>
          <p><strong>Plan seleccionado:</strong> {{ selectedPlan || 'No seleccionado' }}</p>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" (click)="onContinue()">
            Continuar
          </button>
          <button type="button" class="btn btn-outline-secondary" (click)="onRestart()">
            Empezar de nuevo
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
      background-color: rgba(0, 0, 0, 0.5);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 1000;
    }

    .modal-content {
      background: white;
      border-radius: 12px;
      padding: 24px;
      max-width: 500px;
      width: 90%;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
    }

    .modal-header {
      border-bottom: 1px solid #eee;
      padding-bottom: 16px;
      margin-bottom: 16px;
    }

    .modal-title {
      margin: 0;
      color: #333;
      font-weight: 600;
    }

    .modal-body {
      margin-bottom: 24px;
    }

    .modal-body p {
      margin-bottom: 8px;
      color: #666;
    }

    .modal-footer {
      display: flex;
      gap: 12px;
      justify-content: flex-end;
    }

    .btn {
      padding: 10px 20px;
      border-radius: 8px;
      border: none;
      cursor: pointer;
      font-weight: 500;
      transition: all 0.2s;
    }

    .btn-secondary {
      background-color: #007bff;
      color: white;
    }

    .btn-secondary:hover {
      background-color: #0056b3;
    }

    .btn-outline-secondary {
      background-color: transparent;
      color: #6c757d;
      border: 1px solid #6c757d;
    }

    .btn-outline-secondary:hover {
      background-color: #6c757d;
      color: white;
    }
  `]
})
export class ContinueWizardModalComponent {
  @Input() show = false;
  @Input() currentStep = 0;
  @Input() selectedPlan: string | null = null;
  @Output() continue = new EventEmitter<void>();
  @Output() restart = new EventEmitter<void>();

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
