import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export interface ValidationData {
  name: string;
  email: string;
  type: 'arrendador' | 'arrendatario' | 'aval';
}

@Component({
  selector: 'app-validation-data-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="modal-backdrop" *ngIf="isOpen" (click)="closeModal()">
      <div class="modal-content" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <h5 class="modal-title">
            <i class="bi bi-person-check me-2"></i>
            Datos para Validación de {{ getTypeLabel() }}
          </h5>
          <button type="button" class="btn-close" (click)="closeModal()"></button>
        </div>
        
        <div class="modal-body">
          <form #validationForm="ngForm" (ngSubmit)="submitForm()">
            <div class="mb-3">
              <label for="name" class="form-label">Nombre Completo *</label>
              <input 
                type="text" 
                id="name"
                name="name"
                [(ngModel)]="validationData.name"
                class="form-control"
                placeholder="Ingresa el nombre completo"
                required>
            </div>
            
            <div class="mb-3">
              <label for="email" class="form-label">Correo Electrónico *</label>
              <input 
                type="email" 
                id="email"
                name="email"
                [(ngModel)]="validationData.email"
                class="form-control"
                placeholder="ejemplo@correo.com"
                required>
            </div>
            
            <div class="alert alert-info">
              <i class="bi bi-info-circle me-2"></i>
              Se enviará un enlace de verificación al correo proporcionado para validar la identidad.
            </div>
          </form>
        </div>
        
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" (click)="closeModal()">
            Cancelar
          </button>
          <button 
            type="button" 
            class="btn btn-primary"
            [disabled]="!validationForm.valid"
            (click)="submitForm()">
            <i class="bi bi-send me-2"></i>
            Enviar Verificación
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .modal-backdrop {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-color: rgba(0, 0, 0, 0.5);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 1050;
    }
    
    .modal-content {
      background: white;
      border-radius: 8px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
      width: 90%;
      max-width: 500px;
      max-height: 90vh;
      overflow-y: auto;
    }
    
    .modal-header {
      padding: 1rem 1.5rem;
      border-bottom: 1px solid #dee2e6;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    
    .modal-title {
      margin: 0;
      color: #495057;
      font-weight: 600;
    }
    
    .modal-body {
      padding: 1.5rem;
    }
    
    .modal-footer {
      padding: 1rem 1.5rem;
      border-top: 1px solid #dee2e6;
      display: flex;
      justify-content: flex-end;
      gap: 0.5rem;
    }
    
    .btn-close {
      background: none;
      border: none;
      font-size: 1.5rem;
      cursor: pointer;
      color: #6c757d;
      
      &:hover {
        color: #495057;
      }
    }
    
    .form-label {
      font-weight: 500;
      color: #495057;
    }
    
    .form-control {
      border-radius: 6px;
      border: 1px solid #ced4da;
      padding: 0.75rem;
      
      &:focus {
        border-color: #007bff;
        box-shadow: 0 0 0 0.2rem rgba(0, 123, 255, 0.25);
      }
    }
    
    .alert-info {
      background-color: #e7f3ff;
      border-color: #b3d9ff;
      color: #0c5460;
      border-radius: 6px;
    }
  `]
})
export class ValidationDataModalComponent {
  @Input() isOpen: boolean = false;
  @Input() validationType: 'arrendador' | 'arrendatario' | 'aval' = 'arrendador';
  @Output() submit = new EventEmitter<ValidationData>();
  @Output() close = new EventEmitter<void>();

  validationData: ValidationData = {
    name: '',
    email: '',
    type: this.validationType
  };

  getTypeLabel(): string {
    switch (this.validationType) {
      case 'arrendador':
        return 'Arrendador';
      case 'arrendatario':
        return 'Arrendatario';
      case 'aval':
        return 'Aval';
      default:
        return 'Usuario';
    }
  }

  submitForm(): void {
    if (this.validationData.name && this.validationData.email) {
      this.validationData.type = this.validationType;
      this.submit.emit(this.validationData);
      this.closeModal();
    }
  }

  closeModal(): void {
    this.close.emit();
  }
}

