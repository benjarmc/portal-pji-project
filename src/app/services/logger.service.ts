import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class LoggerService {
  private isDebugEnabled: boolean;

  constructor() {
    this.isDebugEnabled = environment.debug;
  }

  /**
   * Método para mostrar logs de información
   * @param message - Mensaje principal
   * @param data - Datos adicionales opcionales
   */
  log(message: string, ...data: any[]): void {
    if (this.isDebugEnabled) {
      console.log(`[LOG] ${message}`, ...data);
    }
  }

  /**
   * Método para mostrar logs de error
   * @param message - Mensaje de error
   * @param error - Objeto de error opcional
   */
  error(message: string, error?: any): void {
    if (this.isDebugEnabled) {
      console.error(`[ERROR] ${message}`, error);
    }
  }

  /**
   * Método para mostrar logs de advertencia
   * @param message - Mensaje de advertencia
   * @param data - Datos adicionales opcionales
   */
  warning(message: string, ...data: any[]): void {
    if (this.isDebugEnabled) {
      console.warn(`[WARNING] ${message}`, ...data);
    }
  }

  /**
   * Método para mostrar logs de información detallada
   * @param message - Mensaje principal
   * @param data - Datos adicionales opcionales
   */
  info(message: string, ...data: any[]): void {
    if (this.isDebugEnabled) {
      console.info(`[INFO] ${message}`, ...data);
    }
  }

  /**
   * Método para mostrar logs de depuración
   * @param message - Mensaje de depuración
   * @param data - Datos adicionales opcionales
   */
  debug(message: string, ...data: any[]): void {
    if (this.isDebugEnabled) {
      console.debug(`[DEBUG] ${message}`, ...data);
    }
  }

  /**
   * Método para mostrar logs de tabla
   * @param data - Datos a mostrar en formato tabla
   */
  table(data: any): void {
    if (this.isDebugEnabled) {
      console.table(data);
    }
  }

  /**
   * Método para mostrar logs de grupo
   * @param groupName - Nombre del grupo
   * @param callback - Función que contiene los logs del grupo
   */
  group(groupName: string, callback: () => void): void {
    if (this.isDebugEnabled) {
      console.group(groupName);
      callback();
      console.groupEnd();
    }
  }

  /**
   * Método para verificar si el debug está habilitado
   * @returns boolean - true si el debug está habilitado
   */
  isDebugMode(): boolean {
    return this.isDebugEnabled;
  }

  /**
   * Método para habilitar/deshabilitar el debug dinámicamente
   * @param enabled - Estado del debug
   */
  setDebugMode(enabled: boolean): void {
    this.isDebugEnabled = enabled;
  }
}
