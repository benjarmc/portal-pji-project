import { Component, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Subject } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { WizardStateService } from '../../../services/wizard-state.service';

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
  
  // Debounce para cambios en el formulario
  private formChangesSubject = new Subject<string>();

  constructor(
    private wizardStateService: WizardStateService,
    private fb: FormBuilder
  ) {
    this.welcomeForm = this.fb.group({
      tipoUsuario: ['', Validators.required]
    });
    
    // Configurar debounce para cambios en el formulario
    this.formChangesSubject.pipe(
      debounceTime(1000) // 1 segundo de debounce
    ).subscribe(tipoUsuario => {
      if (tipoUsuario) {
        console.log('🔄 Tipo de usuario cambiado (debounced):', tipoUsuario);
        this.wizardStateService.saveState({
          userData: { tipoUsuario }
        });
        console.log('💾 Tipo de usuario guardado en estado:', tipoUsuario);
      }
    });
  }

  ngOnInit() {
    console.log('🔍 WelcomeStepComponent ngOnInit iniciado');
    
    // Obtener el estado del wizard para ver si ya se seleccionó el tipo de usuario
    const state = this.wizardStateService.getState();
    console.log('📊 Estado del wizard obtenido:', state);
    
    // Leer desde step0 primero, luego desde userData para compatibilidad
    this.tipoUsuario = state.stepData?.step0?.tipoUsuario || state.userData?.tipoUsuario || null;
    this.hasUserType = !!this.tipoUsuario;
    
    // Si ya hay un tipo de usuario seleccionado, llenar el formulario
    if (this.tipoUsuario) {
      this.welcomeForm.patchValue({ tipoUsuario: this.tipoUsuario });
    }
    
    console.log('👤 Tipo de usuario:', this.tipoUsuario);
    console.log('✅ ¿Tiene tipo de usuario?', this.hasUserType);

    // Escuchar cambios en el tipo de usuario para guardarlo en el estado
    this.welcomeForm.get('tipoUsuario')?.valueChanges.subscribe(tipoUsuario => {
      if (tipoUsuario) {
        // Actualizar variables locales inmediatamente
        this.tipoUsuario = tipoUsuario;
        this.hasUserType = true;
        
        // Guardar en stepData.step0 (paso inicial)
        this.wizardStateService.saveState({
          stepData: {
            step0: {
              tipoUsuario: tipoUsuario,
              timestamp: new Date()
            }
          },
          userData: { tipoUsuario } // Mantener para compatibilidad
        });
        console.log('💾 Tipo de usuario guardado en step0:', tipoUsuario);
        
        // Emitir al subject para el debounce
        this.formChangesSubject.next(tipoUsuario);
      }
    });
  }

  selectUserType(tipo: string) {
    console.log('🎯 Seleccionando tipo de usuario:', tipo);
    this.welcomeForm.patchValue({ tipoUsuario: tipo });
    this.welcomeForm.get('tipoUsuario')?.markAsTouched();
  }

  onNext() {
    if (this.welcomeForm.valid) {
      const tipoUsuario = this.welcomeForm.get('tipoUsuario')?.value;
      if (tipoUsuario) {
        // Guardar en stepData.step0 antes de continuar
        this.wizardStateService.saveState({
          stepData: {
            step0: {
              tipoUsuario: tipoUsuario,
              timestamp: new Date()
            }
          },
          userData: { tipoUsuario }, // Mantener para compatibilidad
          currentStep: 1 // Avanzar al siguiente paso
        });
        console.log('🚀 Continuando con tipo de usuario:', tipoUsuario);
        this.next.emit();
      }
    } else {
      console.log('⚠️ Formulario inválido, no se puede continuar');
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