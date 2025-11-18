import { Component, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Subject } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { WizardStateService } from '../../../../services/wizard-state.service';
import { LoggerService } from '../../../../services/logger.service';
@Component({
  selector: 'app-welcome-step',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './welcome-step.component.html',
  styleUrls: ['./welcome-step.component.scss']
})
export class WelcomeStepComponent implements OnInit {
  @Output() next = new EventEmitter<void>();

  welcomeForm: FormGroup;
  tipoUsuario: string | null = null;
  hasUserType = false;
  // ✅ Estado de carga para la selección de tipo de usuario
  loadingUserType = false;
  
  // Debounce para cambios en el formulario
  private formChangesSubject = new Subject<string>();

  constructor(
    private wizardStateService: WizardStateService,
    private fb: FormBuilder,
    private logger: LoggerService
  ) {
    this.welcomeForm = this.fb.group({
      tipoUsuario: ['', Validators.required]
    });
    
    // Configurar debounce para cambios en el formulario
    this.formChangesSubject.pipe(
      debounceTime(1500) // 1.5 segundos de debounce (coincide con el del servicio)
    ).subscribe(tipoUsuario => {
      if (tipoUsuario) {
        this.logger.log('🔄 Tipo de usuario cambiado (debounced):', tipoUsuario);
        // Solo una llamada a saveState después del debounce
        this.wizardStateService.saveState({
          stepData: {
            step0: {
              tipoUsuario: tipoUsuario,
              timestamp: new Date()
            }
          },
          userData: { tipoUsuario }
        });
        this.logger.log('💾 Tipo de usuario guardado en estado:', tipoUsuario);
      }
    });
  }

  ngOnInit() {
    this.logger.log('🔍 WelcomeStepComponent ngOnInit iniciado');
    
    // Obtener el estado del wizard para ver si ya se seleccionó el tipo de usuario
    const state = this.wizardStateService.getState();
    this.logger.log('📊 Estado del wizard obtenido:', state);
    
    // Leer desde step0 primero, luego desde userData para compatibilidad
    this.tipoUsuario = state.stepData?.step0?.tipoUsuario || state.userData?.tipoUsuario || null;
    this.hasUserType = !!this.tipoUsuario;
    
    // Si ya hay un tipo de usuario seleccionado, llenar el formulario
    if (this.tipoUsuario) {
      this.welcomeForm.patchValue({ tipoUsuario: this.tipoUsuario });
    }
    
    this.logger.log('👤 Tipo de usuario:', this.tipoUsuario);
    this.logger.log('✅ ¿Tiene tipo de usuario?', this.hasUserType);

    // Escuchar cambios en el tipo de usuario para guardarlo en el estado
    this.welcomeForm.get('tipoUsuario')?.valueChanges.subscribe(tipoUsuario => {
      if (tipoUsuario) {
        // Actualizar variables locales inmediatamente para que la UI responda rápido
        this.tipoUsuario = tipoUsuario;
        this.hasUserType = true;
        
        this.logger.log('💾 Tipo de usuario guardado en step0:', tipoUsuario);
        
        // Emitir al subject para el debounce (esto sincronizará con backend después del debounce)
        // Solo una llamada después del debounce evita múltiples peticiones
        this.formChangesSubject.next(tipoUsuario);
      }
    });
  }

  selectUserType(tipo: string) {
    this.logger.log('🎯 Seleccionando tipo de usuario:', tipo);
    this.welcomeForm.patchValue({ tipoUsuario: tipo });
    this.welcomeForm.get('tipoUsuario')?.markAsTouched();
  }

  onNext() {
    // ✅ Evitar múltiples clics mientras se procesa
    if (this.loadingUserType) {
      this.logger.log('⚠️ Ya hay una selección de tipo de usuario en progreso, ignorando clic');
      return;
    }

    if (this.welcomeForm.valid) {
      const tipoUsuario = this.welcomeForm.get('tipoUsuario')?.value;
      if (tipoUsuario) {
        // ✅ Activar estado de carga
        this.loadingUserType = true;

        // ✅ CAMBIO CRÍTICO: Completar paso → Usar saveAndSync() para persistir en BD
        this.wizardStateService.saveAndSync({
          stepData: {
            step0: {
              tipoUsuario: tipoUsuario,
              timestamp: new Date()
            }
          },
          userData: { tipoUsuario }, // Mantener para compatibilidad
          currentStep: 1 // Avanzar al siguiente paso
        }).then(() => {
          this.logger.log('🚀 Continuando con tipo de usuario:', tipoUsuario);
          // ✅ Desactivar estado de carga antes de emitir
          this.loadingUserType = false;
          this.next.emit();
        }).catch(error => {
          this.logger.error('❌ Error guardando tipo de usuario:', error);
          // ✅ Desactivar estado de carga incluso si hay error
          this.loadingUserType = false;
          // Aún así permitir continuar, los datos están guardados localmente
          this.next.emit();
        });
      }
    } else {
      this.logger.log('⚠️ Formulario inválido, no se puede continuar');
    }
  }

  getTipoUsuarioLabel(tipo: string): string {
    switch (tipo) {
      case 'arrendador':
        return 'Arrendador (Dueño del inmueble)';
      case 'arrendatario':
        return 'Arrendatario (Inquilino)';
      case 'asesor':
        return 'Asesor Inmobiliario';
      default:
        return tipo;
    }
  }
} 