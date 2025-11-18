import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="confirm-overlay" *ngIf="show" (click)="onOverlayClick($event)">
      <div class="confirm-dialog" (click)="$event.stopPropagation()">
        <div class="confirm-header">
          <div class="confirm-icon">
            <i class="bi bi-exclamation-triangle-fill"></i>
          </div>
          <h3 class="confirm-title">{{ title }}</h3>
        </div>
        
        <div class="confirm-body">
          <p class="confirm-message">{{ message }}</p>
          <p class="confirm-warning" *ngIf="warning">{{ warning }}</p>
        </div>
        
        <div class="confirm-footer">
          <button 
            type="button" 
            class="btn btn-cancel" 
            (click)="onCancel()">
            <i class="bi bi-x-circle me-2"></i>
            Cancelar
          </button>
          <button 
            type="button" 
            class="btn btn-confirm" 
            (click)="onConfirm()">
            <i class="bi bi-check-circle me-2"></i>
            Aceptar
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .confirm-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-color: rgba(0, 0, 0, 0.6);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 1060;
      backdrop-filter: blur(4px);
      animation: fadeIn 0.2s ease-out;
    }

    @keyframes fadeIn {
      from {
        opacity: 0;
      }
      to {
        opacity: 1;
      }
    }

    .confirm-dialog {
      background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%);
      border-radius: 20px;
      padding: 0;
      max-width: 480px;
      width: 90%;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.1);
      animation: slideUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
      overflow: hidden;
    }

    @keyframes slideUp {
      from {
        opacity: 0;
        transform: translateY(30px) scale(0.95);
      }
      to {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }

    .confirm-header {
      padding: 32px 32px 24px 32px;
      text-align: center;
      background: linear-gradient(135deg, #fff5f5 0%, #ffe5e5 100%);
      border-bottom: 1px solid rgba(220, 53, 69, 0.1);
    }

    .confirm-icon {
      margin-bottom: 16px;
    }

    .confirm-icon i {
      font-size: 56px;
      color: #dc3545;
      animation: pulse 2s ease-in-out infinite;
    }

    @keyframes pulse {
      0%, 100% {
        transform: scale(1);
      }
      50% {
        transform: scale(1.05);
      }
    }

    .confirm-title {
      margin: 0;
      color: #2c3e50;
      font-weight: 700;
      font-size: 1.5rem;
      line-height: 1.3;
    }

    .confirm-body {
      padding: 32px;
      text-align: center;
    }

    .confirm-message {
      margin: 0 0 16px 0;
      color: #495057;
      font-size: 1.1rem;
      line-height: 1.6;
      font-weight: 500;
    }

    .confirm-warning {
      margin: 0;
      color: #dc3545;
      font-size: 0.95rem;
      line-height: 1.5;
      font-weight: 600;
      padding: 12px 16px;
      background: rgba(220, 53, 69, 0.1);
      border-radius: 8px;
      border-left: 3px solid #dc3545;
    }

    .confirm-footer {
      padding: 24px 32px 32px 32px;
      display: flex;
      gap: 12px;
      justify-content: flex-end;
      background: #f8f9fa;
      border-top: 1px solid #e9ecef;
    }

    .btn {
      padding: 12px 28px;
      border-radius: 10px;
      border: none;
      cursor: pointer;
      font-weight: 600;
      font-size: 1rem;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      display: flex;
      align-items: center;
      justify-content: center;
      min-width: 120px;
      position: relative;
      overflow: hidden;
    }

    .btn::before {
      content: '';
      position: absolute;
      top: 50%;
      left: 50%;
      width: 0;
      height: 0;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.3);
      transform: translate(-50%, -50%);
      transition: width 0.6s, height 0.6s;
    }

    .btn:hover::before {
      width: 300px;
      height: 300px;
    }

    .btn-cancel {
      background: #ffffff;
      color: #6c757d;
      border: 2px solid #dee2e6;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }

    .btn-cancel:hover {
      background: #f8f9fa;
      border-color: #adb5bd;
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    }

    .btn-cancel:active {
      transform: translateY(0);
    }

    .btn-confirm {
      background: linear-gradient(135deg, #dc3545 0%, #c82333 100%);
      color: white;
      box-shadow: 0 4px 15px rgba(220, 53, 69, 0.4);
    }

    .btn-confirm:hover {
      background: linear-gradient(135deg, #c82333 0%, #bd2130 100%);
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(220, 53, 69, 0.5);
    }

    .btn-confirm:active {
      transform: translateY(0);
    }

    .btn i {
      font-size: 1.1rem;
    }

    @media (max-width: 576px) {
      .confirm-dialog {
        max-width: 95%;
        margin: 20px;
      }

      .confirm-header {
        padding: 24px 24px 20px 24px;
      }

      .confirm-body {
        padding: 24px;
      }

      .confirm-footer {
        padding: 20px 24px 24px 24px;
        flex-direction: column-reverse;
      }

      .btn {
        width: 100%;
      }

      .confirm-title {
        font-size: 1.3rem;
      }

      .confirm-message {
        font-size: 1rem;
      }
    }
  `]
})
export class ConfirmDialogComponent {
  @Input() show = false;
  @Input() title = '¿Estás seguro?';
  @Input() message = '';
  @Input() warning = '';
  @Input() allowOverlayClose = false;
  @Output() confirm = new EventEmitter<void>();
  @Output() cancel = new EventEmitter<void>();

  onConfirm(): void {
    this.confirm.emit();
  }

  onCancel(): void {
    this.cancel.emit();
  }

  onOverlayClick(event: MouseEvent): void {
    if (this.allowOverlayClose && event.target === event.currentTarget) {
      this.onCancel();
    }
  }
}

