import { Component, Input, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface ToastConfig {
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  duration?: number;
}

@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div *ngIf="visible" 
         class="toast-notification"
         [class.toast-success]="type === 'success'"
         [class.toast-error]="type === 'error'"
         [class.toast-info]="type === 'info'"
         [class.toast-warning]="type === 'warning'">
      <div class="toast-content">
        <i class="toast-icon" [ngClass]="getIconClass()"></i>
        <span class="toast-message">{{ message }}</span>
        <button class="toast-close" (click)="closeToast()" aria-label="Cerrar">
          <i class="bi bi-x"></i>
        </button>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }

    .toast-notification {
      min-width: 300px;
      max-width: 500px;
      background: white;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      overflow: hidden;
      animation: slideIn 0.3s ease-out;
    }

    @keyframes slideIn {
      from {
        transform: translateX(100%);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }

    .toast-content {
      display: flex;
      align-items: center;
      padding: 16px;
      gap: 12px;
    }

    .toast-icon {
      font-size: 20px;
      flex-shrink: 0;
    }

    .toast-message {
      flex: 1;
      font-size: 14px;
      line-height: 1.5;
      color: #333;
    }

    .toast-close {
      background: none;
      border: none;
      cursor: pointer;
      padding: 4px;
      color: #666;
      font-size: 18px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: color 0.2s;
    }

    .toast-close:hover {
      color: #333;
    }

    .toast-success {
      border-left: 4px solid #28a745;
    }

    .toast-success .toast-icon {
      color: #28a745;
    }

    .toast-error {
      border-left: 4px solid #dc3545;
    }

    .toast-error .toast-icon {
      color: #dc3545;
    }

    .toast-info {
      border-left: 4px solid #17a2b8;
    }

    .toast-info .toast-icon {
      color: #17a2b8;
    }

    .toast-warning {
      border-left: 4px solid #ffc107;
    }

    .toast-warning .toast-icon {
      color: #ffc107;
    }

    @media (max-width: 576px) {
      .toast-notification {
        min-width: auto;
        max-width: none;
      }
    }
  `]
})
export class ToastComponent implements OnInit, OnDestroy {
  @Input() message: string = '';
  @Input() type: 'success' | 'error' | 'info' | 'warning' = 'info';
  @Input() duration: number = 4000;

  visible: boolean = false;
  private timeoutId: any;
  public close: () => void = () => {};

  ngOnInit() {
    // Mostrar con animación
    setTimeout(() => {
      this.visible = true;
    }, 10);

    // Auto-cerrar después de la duración especificada
    if (this.duration > 0) {
      this.timeoutId = setTimeout(() => {
        this.closeToast();
      }, this.duration);
    }
  }

  ngOnDestroy() {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
    }
  }

  closeToast() {
    this.visible = false;
    // El servicio manejará la destrucción después de la animación
    if (this.close) {
      this.close();
    }
  }

  getIconClass(): string {
    switch (this.type) {
      case 'success':
        return 'bi bi-check-circle-fill';
      case 'error':
        return 'bi bi-x-circle-fill';
      case 'warning':
        return 'bi bi-exclamation-triangle-fill';
      default:
        return 'bi bi-info-circle-fill';
    }
  }
}

