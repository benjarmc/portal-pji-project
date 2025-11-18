import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { CaptureDataService } from '../../services/capture-data.service';
import { LoggerService } from '../../services/logger.service';

@Component({
  selector: 'app-fiador-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './fiador-form.component.html',
  styleUrls: ['./fiador-form.component.scss']
})
export class FiadorFormComponent implements OnInit {
  fiadorForm!: FormGroup;
  fiadorId: string | null = null;
  isLoading = false;
  isSubmitting = false;
  submitStatus: 'idle' | 'saving' | 'saved' | 'error' = 'idle';
  errorMessage = '';
  successMessage = '';

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private captureDataService: CaptureDataService,
    private logger: LoggerService
  ) {
    this.initializeForm();
  }

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      const id = params.get('id');
      if (id) {
        this.fiadorId = id;
        this.loadFiadorData(id);
      } else {
        this.errorMessage = 'ID de fiador no proporcionado';
      }
    });
  }

  private initializeForm(): void {
    this.fiadorForm = this.fb.group({
      fechaAlta: [new Date().toISOString().split('T')[0], Validators.required],
      curp: ['', [Validators.required, Validators.pattern(/^[A-Z]{4}[0-9]{6}[HM][A-Z]{5}[A-Z0-9]{3}$/)]],
      tipoPersona: ['fisica', Validators.required],
      nombre: ['', Validators.required],
      telefono: [''],
      celular: [''],
      calle: ['', Validators.required],
      numeroExterior: ['', Validators.required],
      edificio: [''],
      cp: ['', [Validators.required, Validators.pattern(/^[0-9]{5}$/)]],
      colonia: ['', Validators.required],
      alcaldiaMunicipio: ['', Validators.required],
      estado: ['', Validators.required],
      ine: [''],
      escrituras: [''],
      actaMatrimonio: [''],
      empresaLabora: [''],
      relacionFiador: [''],
      estadoCivil: [''],
      regimenPatrimonial: [''],
      nombreConyuge: [''],
      // Datos del inmueble garantía
      calleGarantia: ['', Validators.required],
      numeroExteriorGarantia: ['', Validators.required],
      edificioGarantia: [''],
      numeroInteriorGarantia: [''],
      cpGarantia: ['', Validators.required],
      coloniaGarantia: ['', Validators.required],
      alcaldiaMunicipioGarantia: ['', Validators.required],
      estadoGarantia: ['', Validators.required],
      entreCalleGarantia: [''],
      yCalleGarantia: [''],
      escrituraGarantia: [''],
      numeroEscrituraGarantia: [''],
      fechaEscrituraGarantia: [''],
      notarioNumero: [''],
      ciudadNotario: [''],
      nombreNotario: [''],
      datosRegistrales: [''],
      fechaRegistro: ['']
    });
  }

  private loadFiadorData(id: string): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.captureDataService.getFiadorById(id).subscribe({
      next: (response) => {
        if (response && response.success && response.data) {
          this.logger.log('✅ Datos de fiador cargados:', response.data);
          this.fiadorForm.patchValue(response.data);
        } else {
          this.errorMessage = 'No se pudieron cargar los datos del fiador';
        }
        this.isLoading = false;
      },
      error: (error) => {
        this.logger.error('❌ Error cargando datos de fiador:', error);
        this.errorMessage = 'Error al cargar los datos. Por favor, verifica que el enlace sea correcto.';
        this.isLoading = false;
      }
    });
  }

  onSubmit(): void {
    if (this.fiadorForm.invalid) {
      this.markFormGroupTouched(this.fiadorForm);
      return;
    }

    if (!this.fiadorId) {
      this.errorMessage = 'ID de fiador no disponible';
      return;
    }

    this.isSubmitting = true;
    this.submitStatus = 'saving';
    this.errorMessage = '';
    this.successMessage = '';

    const formValue = this.fiadorForm.value;
    
    // Procesar datos (convertir archivos a strings si es necesario)
    const processedData = {
      ...formValue,
      ine: formValue.ine ? (formValue.ine instanceof File ? formValue.ine.name : formValue.ine) : '',
      escrituras: formValue.escrituras ? (formValue.escrituras instanceof File ? formValue.escrituras.name : formValue.escrituras) : '',
      actaMatrimonio: formValue.actaMatrimonio ? (formValue.actaMatrimonio instanceof File ? formValue.actaMatrimonio.name : formValue.actaMatrimonio) : '',
      fechaEscrituraGarantia: formValue.fechaEscrituraGarantia && formValue.fechaEscrituraGarantia.trim() !== '' 
        ? formValue.fechaEscrituraGarantia 
        : null,
      fechaRegistro: formValue.fechaRegistro && formValue.fechaRegistro.trim() !== '' 
        ? formValue.fechaRegistro 
        : null
    };

    // Obtener policyId del fiador para actualizar
    this.captureDataService.getFiadorById(this.fiadorId).subscribe({
      next: (fiadorResponse) => {
        if (fiadorResponse && fiadorResponse.success && fiadorResponse.data) {
          const policyId = (fiadorResponse.data as any).policyId;
          
          if (policyId) {
            // Actualizar por policyId
            this.captureDataService.updateFiadorByPolicyId(policyId, processedData).subscribe({
              next: (response) => {
                if (response?.success) {
                  this.submitStatus = 'saved';
                  this.successMessage = '¡Tus datos han sido guardados exitosamente!';
                  this.logger.log('✅ Datos de fiador actualizados exitosamente');
                  
                  // Ocultar mensaje después de 5 segundos
                  setTimeout(() => {
                    this.submitStatus = 'idle';
                  }, 5000);
                } else {
                  throw new Error('Error en la respuesta del servidor');
                }
                this.isSubmitting = false;
              },
              error: (error) => {
                this.logger.error('❌ Error actualizando fiador:', error);
                this.submitStatus = 'error';
                this.errorMessage = error?.error?.message || 'Error al guardar los datos. Por favor, intenta nuevamente.';
                this.isSubmitting = false;
              }
            });
          } else {
            this.errorMessage = 'No se pudo identificar la póliza asociada';
            this.isSubmitting = false;
            this.submitStatus = 'error';
          }
        } else {
          this.errorMessage = 'No se pudieron obtener los datos del fiador';
          this.isSubmitting = false;
          this.submitStatus = 'error';
        }
      },
      error: (error) => {
        this.logger.error('❌ Error obteniendo datos del fiador:', error);
        this.errorMessage = 'Error al obtener los datos. Por favor, intenta nuevamente.';
        this.isSubmitting = false;
        this.submitStatus = 'error';
      }
    });
  }

  private markFormGroupTouched(formGroup: FormGroup): void {
    Object.keys(formGroup.controls).forEach(key => {
      const control = formGroup.get(key);
      control?.markAsTouched();

      if (control instanceof FormGroup) {
        this.markFormGroupTouched(control);
      }
    });
  }

  get formControls() {
    return this.fiadorForm.controls;
  }
}


