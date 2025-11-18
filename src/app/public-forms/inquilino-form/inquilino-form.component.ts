import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { CaptureDataService } from '../../services/capture-data.service';
import { LoggerService } from '../../services/logger.service';

@Component({
  selector: 'app-inquilino-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './inquilino-form.component.html',
  styleUrls: ['./inquilino-form.component.scss']
})
export class InquilinoFormComponent implements OnInit {
  inquilinoForm!: FormGroup;
  inquilinoId: string | null = null;
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
        this.inquilinoId = id;
        this.loadInquilinoData(id);
      } else {
        this.errorMessage = 'ID de inquilino no proporcionado';
      }
    });
  }

  private initializeForm(): void {
    this.inquilinoForm = this.fb.group({
      fechaAlta: [new Date().toISOString().split('T')[0], Validators.required],
      curp: ['', [Validators.required, Validators.pattern(/^[A-Z]{4}[0-9]{6}[HM][A-Z]{5}[A-Z0-9]{3}$/)]],
      tipoPersona: ['fisica', Validators.required],
      nombre: ['', Validators.required],
      telefono: [''],
      celular: [''],
      estadoCivil: [''],
      canal: [''],
      calle: ['', Validators.required],
      numeroExterior: ['', Validators.required],
      edificio: [''],
      cp: ['', [Validators.required, Validators.pattern(/^[0-9]{5}$/)]],
      colonia: ['', Validators.required],
      alcaldiaMunicipio: ['', Validators.required],
      estado: ['', Validators.required],
      ine: [''],
      pasaporte: [''],
      comprobanteDomicilio: [''],
      comprobanteIngresos: [''],
      comprobanteDomicilioImagen: [''],
      comprobanteIngresos2: [''],
      comprobanteIngresos3: [''],
      comprobanteIngresos4: ['']
    });
  }

  private loadInquilinoData(id: string): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.captureDataService.getInquilinoById(id).subscribe({
      next: (response) => {
        if (response && response.success && response.data) {
          this.logger.log('✅ Datos de inquilino cargados:', response.data);
          this.inquilinoForm.patchValue(response.data);
        } else {
          this.errorMessage = 'No se pudieron cargar los datos del inquilino';
        }
        this.isLoading = false;
      },
      error: (error) => {
        this.logger.error('❌ Error cargando datos de inquilino:', error);
        this.errorMessage = 'Error al cargar los datos. Por favor, verifica que el enlace sea correcto.';
        this.isLoading = false;
      }
    });
  }

  onSubmit(): void {
    if (this.inquilinoForm.invalid) {
      this.markFormGroupTouched(this.inquilinoForm);
      return;
    }

    if (!this.inquilinoId) {
      this.errorMessage = 'ID de inquilino no disponible';
      return;
    }

    this.isSubmitting = true;
    this.submitStatus = 'saving';
    this.errorMessage = '';
    this.successMessage = '';

    const formValue = this.inquilinoForm.value;
    
    // Procesar datos (convertir archivos a strings si es necesario)
    const processedData = {
      ...formValue,
      ine: formValue.ine ? (formValue.ine instanceof File ? formValue.ine.name : formValue.ine) : '',
      pasaporte: formValue.pasaporte ? (formValue.pasaporte instanceof File ? formValue.pasaporte.name : formValue.pasaporte) : '',
      comprobanteDomicilio: formValue.comprobanteDomicilio ? (formValue.comprobanteDomicilio instanceof File ? formValue.comprobanteDomicilio.name : formValue.comprobanteDomicilio) : '',
      comprobanteIngresos: formValue.comprobanteIngresos ? (formValue.comprobanteIngresos instanceof File ? formValue.comprobanteIngresos.name : formValue.comprobanteIngresos) : '',
      comprobanteDomicilioImagen: formValue.comprobanteDomicilioImagen ? (formValue.comprobanteDomicilioImagen instanceof File ? formValue.comprobanteDomicilioImagen.name : formValue.comprobanteDomicilioImagen) : '',
      comprobanteIngresos2: formValue.comprobanteIngresos2 ? (formValue.comprobanteIngresos2 instanceof File ? formValue.comprobanteIngresos2.name : formValue.comprobanteIngresos2) : ''
    };

    // Obtener policyId del inquilino para actualizar
    this.captureDataService.getInquilinoById(this.inquilinoId).subscribe({
      next: (inquilinoResponse) => {
        if (inquilinoResponse && inquilinoResponse.success && inquilinoResponse.data) {
          const policyId = (inquilinoResponse.data as any).policyId;
          
          if (policyId) {
            // Actualizar por policyId
            this.captureDataService.updateInquilinoByPolicyId(policyId, processedData).subscribe({
              next: (response) => {
                if (response?.success) {
                  this.submitStatus = 'saved';
                  this.successMessage = '¡Tus datos han sido guardados exitosamente!';
                  this.logger.log('✅ Datos de inquilino actualizados exitosamente');
                  
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
                this.logger.error('❌ Error actualizando inquilino:', error);
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
          this.errorMessage = 'No se pudieron obtener los datos del inquilino';
          this.isSubmitting = false;
          this.submitStatus = 'error';
        }
      },
      error: (error) => {
        this.logger.error('❌ Error obteniendo datos del inquilino:', error);
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
    return this.inquilinoForm.controls;
  }
}


