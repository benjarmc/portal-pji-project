import { Component, OnInit, Inject } from '@angular/core';
import { LoggerService } from '../../services/logger.service';

@Component({
  selector: 'app-example-logger',
  template: `
    <div class="logger-example">
      <h2>Ejemplo de uso del LoggerService</h2>
      <button (click)="testLogs()">Probar Logs</button>
      <button (click)="toggleDebug()">Alternar Debug</button>
      <p>Debug habilitado: {{ logger.isDebugMode() }}</p>
    </div>
  `,
  styles: [`
    .logger-example {
      padding: 20px;
      border: 1px solid #ccc;
      margin: 20px;
      border-radius: 5px;
    }
    button {
      margin: 5px;
      padding: 10px 15px;
      background-color: #007bff;
      color: white;
      border: none;
      border-radius: 3px;
      cursor: pointer;
    }
    button:hover {
      background-color: #0056b3;
    }
  `]
})
export class ExampleLoggerComponent implements OnInit {
  logger: LoggerService;

  constructor(@Inject(LoggerService) logger: LoggerService) {
    this.logger = logger;
  }

  ngOnInit(): void {
    // Ejemplo de uso básico
    this.logger.log('Componente ExampleLoggerComponent inicializado');
    this.logger.info('LoggerService está funcionando correctamente');
  }

  testLogs(): void {
    // Ejemplos de diferentes tipos de logs
    this.logger.log('Este es un mensaje de log normal', { data: 'información adicional' });
    this.logger.info('Este es un mensaje informativo');
    this.logger.warning('Este es un mensaje de advertencia');
    this.logger.error('Este es un mensaje de error', new Error('Error de ejemplo'));
    this.logger.debug('Este es un mensaje de debug');

    // Ejemplo de tabla
    const sampleData = [
      { id: 1, name: 'Juan', age: 25 },
      { id: 2, name: 'María', age: 30 },
      { id: 3, name: 'Pedro', age: 35 }
    ];
    this.logger.table(sampleData);

    // Ejemplo de grupo
    this.logger.group('Información del Usuario', () => {
      this.logger.log('Nombre: Juan Pérez');
      this.logger.log('Email: juan@example.com');
      this.logger.log('Rol: Administrador');
    });
  }

  toggleDebug(): void {
    const currentState = this.logger.isDebugMode();
    this.logger.setDebugMode(!currentState);
    this.logger.log(`Debug ${!currentState ? 'habilitado' : 'deshabilitado'}`);
  }
}
