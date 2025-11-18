import { Injectable, ComponentRef, ApplicationRef, Injector, createComponent, EnvironmentInjector, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ToastComponent, ToastConfig } from '../components/toast/toast.component';

@Injectable({
  providedIn: 'root'
})
export class ToastService {
  private toasts: Array<{ componentRef: ComponentRef<ToastComponent>, container: HTMLElement }> = [];
  private toastContainer: HTMLElement | null = null;

  constructor(
    private appRef: ApplicationRef,
    private injector: Injector,
    private environmentInjector: EnvironmentInjector,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    if (isPlatformBrowser(this.platformId)) {
      this.createToastContainer();
    }
  }

  private createToastContainer(): void {
    if (!isPlatformBrowser(this.platformId) || typeof document === 'undefined') {
      return;
    }
    this.toastContainer = document.createElement('div');
    this.toastContainer.id = 'toast-container';
    this.toastContainer.style.position = 'fixed';
    this.toastContainer.style.top = '20px';
    this.toastContainer.style.right = '20px';
    this.toastContainer.style.zIndex = '10000';
    this.toastContainer.style.display = 'flex';
    this.toastContainer.style.flexDirection = 'column';
    this.toastContainer.style.gap = '12px';
    this.toastContainer.style.pointerEvents = 'none';
    document.body.appendChild(this.toastContainer);
  }

  show(config: ToastConfig): void {
    if (!isPlatformBrowser(this.platformId) || typeof document === 'undefined') {
      return;
    }

    if (!this.toastContainer) {
      this.createToastContainer();
    }

    if (!this.toastContainer) {
      return;
    }

    // Crear el componente usando createComponent (Angular moderno)
    const componentRef = createComponent(ToastComponent, {
      environmentInjector: this.environmentInjector
    });
    
    // Configurar propiedades
    componentRef.instance.message = config.message;
    componentRef.instance.type = config.type;
    componentRef.instance.duration = config.duration || 4000;

    // Adjuntar a la vista
    this.appRef.attachView(componentRef.hostView);
    
    // Crear contenedor individual para este toast
    const container = document.createElement('div');
    container.style.pointerEvents = 'auto';
    container.appendChild(componentRef.location.nativeElement);
    
    // Agregar al contenedor principal
    this.toastContainer.appendChild(container);

    // Guardar referencia
    this.toasts.push({ componentRef, container });

    // Configurar el método close para limpiar
    componentRef.instance.close = () => {
      componentRef.instance.visible = false;
      setTimeout(() => {
        this.removeToast(componentRef);
      }, 300); // Esperar a que termine la animación
    };
  }

  success(message: string, duration?: number): void {
    this.show({ message, type: 'success', duration });
  }

  error(message: string, duration?: number): void {
    this.show({ message, type: 'error', duration: duration || 5000 });
  }

  info(message: string, duration?: number): void {
    this.show({ message, type: 'info', duration });
  }

  warning(message: string, duration?: number): void {
    this.show({ message, type: 'warning', duration });
  }

  private removeToast(componentRef: ComponentRef<ToastComponent>): void {
    const toastIndex = this.toasts.findIndex(t => t.componentRef === componentRef);
    if (toastIndex > -1) {
      const toast = this.toasts[toastIndex];
      this.toasts.splice(toastIndex, 1);
      this.appRef.detachView(componentRef.hostView);
      componentRef.destroy();
      if (toast.container && toast.container.parentNode) {
        toast.container.parentNode.removeChild(toast.container);
      }
    }
  }
}

