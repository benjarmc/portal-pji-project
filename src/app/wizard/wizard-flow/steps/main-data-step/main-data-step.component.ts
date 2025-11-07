import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, FormArray } from '@angular/forms';
import { QuotationsService } from '../../../../services/quotations.service';
import { PlansService } from '../../../../services/plans.service';
import { WizardStateService } from '../../../../services/wizard-state.service';
import { CreateQuotationDto } from '../../../../models/quotation.model';
import { Plan } from '../../../../models/plan.model';
import { LoggerService } from '../../../../services/logger.service';
interface ComplementaryPlan {
  id: string;
  name: string;
  price: number;
  currency: string;
  selected?: boolean;
}

@Component({
  selector: 'app-main-data-step',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './main-data-step.component.html',
  styleUrls: ['./main-data-step.component.scss']
})
export class MainDataStepComponent implements OnInit {
  @Input() selectedPlan: string | null = null;
  @Output() next = new EventEmitter<FormGroup>();
  @Output() previous = new EventEmitter<void>();
  @Output() goToFinish = new EventEmitter<string>(); // Modificado para incluir el número de cotización

  mainDataForm: FormGroup;
  selectedPlanData: Plan | null = null;
  isCreatingQuotation = false;
  quotationError = '';
  
  // Array de complementos seleccionados
  selectedComplementos: string[] = [];

  constructor(
    private fb: FormBuilder,
    private quotationsService: QuotationsService,
    private plansService: PlansService,
    private wizardStateService: WizardStateService,
    private logger: LoggerService
  ) {
    this.mainDataForm = this.fb.group({
      // Datos personales
      nombre: ['', [Validators.required, Validators.minLength(2)]],
      telefono: ['', [Validators.required, Validators.pattern(/^[0-9]{9,10}$/)]],
      correo: ['', [Validators.required, Validators.email]],
      
      // Monto de renta mensual para calcular precio
      rentaMensual: ['', [Validators.required, Validators.min(1)]],
      
      // Plan
      plan: ['', Validators.required]
    });
  }

  ngOnInit() {
    this.logger.log('MainDataStepComponent ngOnInit - selectedPlan:', this.selectedPlan);
    
    // Cargar estado guardado del usuario
    this.loadSavedUserData();
    
    if (this.selectedPlan) {
      this.mainDataForm.patchValue({ plan: this.selectedPlan });
      
      // ✅ OPTIMIZADO: Solo cargar plan si no está ya cargado
      if (!this.selectedPlanData || this.selectedPlanData.id !== this.selectedPlan) {
        this.loadPlanDetails();
      } else {
        this.logger.log('📦 Plan ya está cargado, usando datos existentes');
      }
    } else {
      this.logger.log('No hay plan seleccionado');
    }
    
    // Escuchar cambios en la renta mensual para recalcular precios
    this.mainDataForm.get('rentaMensual')?.valueChanges.subscribe(() => {
      this.logger.log('💰 Renta mensual cambiada, recalculando precios...');
    });
  }

  /**
   * Cargar datos del usuario guardados previamente
   */
  private loadSavedUserData(): void {
    const savedState = this.wizardStateService.getState();
    this.logger.log('📋 Estado guardado del wizard:', savedState);
    
    if (savedState.userData && Object.keys(savedState.userData).length > 0) {
      this.logger.log('👤 Datos del usuario encontrados:', savedState.userData);
      
      // Cargar datos del usuario en el formulario
      const userData = savedState.userData;
      this.mainDataForm.patchValue({
        nombre: userData.name || '',
        correo: userData.email || '',
        telefono: userData.phone || '',
        rentaMensual: userData.rentaMensual || ''
      });
      
      this.logger.log('✅ Datos del usuario cargados en el formulario');
    } else {
      this.logger.log('⚠️ No hay datos del usuario guardados');
    }
  }

  /**
   * Cargar detalles del plan seleccionado con sus complementos
   * ✅ OPTIMIZADO: Solo carga si no está ya cargado
   */
  private loadPlanDetails(): void {
    this.logger.log('🔄 loadPlanDetails() llamado con selectedPlan:', this.selectedPlan);
    
    // ✅ OPTIMIZADO: Verificar si ya está cargado
    if (this.selectedPlanData && this.selectedPlanData.id === this.selectedPlan) {
      this.logger.log('📦 Plan ya está cargado, omitiendo petición');
      return;
    }
    
    if (this.selectedPlan) {
      this.logger.log('📡 Llamando a plansService.getPlanById...');
      // Usar el endpoint que devuelve plan + complementos
      this.plansService.getPlanById(this.selectedPlan).subscribe({
        next: (response) => {
          this.logger.log('📥 Respuesta recibida:', response);
          if (response.success && response.data) {
            this.selectedPlanData = response.data;
            this.logger.log('✅ Plan cargado con complementos:', this.selectedPlanData);
            this.logger.log('🔗 Complementos disponibles:', this.selectedPlanData.complementaryPlans);
            this.logger.log('📊 selectedPlanData actualizado:', this.selectedPlanData);
          } else {
            this.logger.warning('⚠️ Respuesta sin éxito:', response);
          }
        },
        error: (error) => {
          this.logger.error('❌ Error cargando plan:', error);
          // Fallback: intentar cargar solo el plan básico
          this.loadBasicPlan();
        }
      });
    } else {
      this.logger.warning('⚠️ No hay selectedPlan para cargar');
    }
  }

  /**
   * Cargar plan básico sin complementos (fallback)
   */
  private loadBasicPlan(): void {
    if (this.selectedPlan) {
      this.plansService.getPlanById(this.selectedPlan).subscribe({
        next: (response) => {
          if (response.success && response.data) {
            this.selectedPlanData = response.data;
            this.logger.log('Plan básico cargado (sin complementos):', this.selectedPlanData);
          }
        },
        error: (error) => {
          this.logger.error('Error cargando plan básico:', error);
        }
      });
    }
  }

  onComplementoChange(event: any, complemento: ComplementaryPlan) {
    if (event.target.checked) {
      this.selectedComplementos.push(complemento.id);
    } else {
      const index = this.selectedComplementos.indexOf(complemento.id);
      if (index > -1) {
        this.selectedComplementos.splice(index, 1);
      }
    }
    this.logger.log('Complementos seleccionados:', this.selectedComplementos);
  }

  getComplementaryPlans(): ComplementaryPlan[] {
    if (this.selectedPlanData?.complementaryPlans && this.selectedPlanData.complementaryPlans.length > 0) {
      return this.selectedPlanData.complementaryPlans.map(complement => ({
        id: complement.id,
        name: complement.name,
        price: complement.price,
        currency: complement.currency,
        selected: false
      }));
    }
    
    return [];
  }

  getTotalPrice(): number {
    let total = 0;
    
    // Siempre empezar con el precio del plan base (usar cálculo dinámico si hay renta mensual)
    if (this.selectedPlanData) {
      const rentaMensual = this.mainDataForm.get('rentaMensual')?.value || 0;
      if (rentaMensual > 0) {
        total += this.plansService.calculateDynamicPrice(this.selectedPlanData.name, rentaMensual);
      } else {
        total += this.selectedPlanData.price;
      }
    }
    
    // Agregar precio de complementos seleccionados
    const complementaryPlans = this.getComplementaryPlans();
    complementaryPlans.forEach((complement) => {
      if (this.selectedComplementos.includes(complement.id)) {
        total += complement.price;
      }
    });
    
    return total;
  }

  /**
   * Obtiene el precio del plan base con cálculo dinámico
   */
  getPlanBasePrice(): number {
    if (!this.selectedPlanData) return 0;
    
    const rentaMensual = this.mainDataForm.get('rentaMensual')?.value || 0;
    if (rentaMensual > 0) {
      return this.plansService.calculateDynamicPrice(this.selectedPlanData.name, rentaMensual);
    }
    
    return this.selectedPlanData.price;
  }

  /**
   * Obtiene el precio total de los complementos seleccionados
   */
  getComplementosPrice(): number {
    let complementosPrice = 0;
    
    const complementaryPlans = this.getComplementaryPlans();
    complementaryPlans.forEach((complement) => {
      if (this.selectedComplementos.includes(complement.id)) {
        complementosPrice += complement.price;
      }
    });
    
    return complementosPrice;
  }



  async onNext() {
    if (this.mainDataForm.valid) {
      this.logger.log('onNext llamado en MainDataStepComponent');
      this.logger.log('Form value:', this.mainDataForm.value);
      
      // Guardar estado del usuario antes de continuar
      this.saveUserData();
      
      // ✅ CREAR COTIZACIÓN ANTES DE CONTINUAR AL PASO DE PAGO
      // Esto es necesario porque el paso de pago requiere los datos de la cotización
      this.isCreatingQuotation = true;
      this.quotationError = '';
      
      try {
        this.logger.log('🔄 Creando cotización antes de avanzar al paso de pago...');
        const quotationData = await this.createQuotation();
        this.logger.log('✅ Cotización creada exitosamente:', quotationData);
        
        // Emitir evento con datos de cotización (no solo formulario)
        this.next.emit(quotationData);
      } catch (error: any) {
        this.logger.error('❌ Error creando cotización:', error);
        this.quotationError = error.message || 'Error creando cotización. Por favor, intenta nuevamente.';
        // NO avanzar si hay error en la creación de cotización
        return;
      } finally {
        this.isCreatingQuotation = false;
      }
    } else {
      this.logger.log('Formulario inválido');
      this.markFormGroupTouched();
    }
  }

  /**
   * Guardar datos del usuario en el estado del wizard
   */
  private saveUserData(): void {
    const formValue = this.mainDataForm.value;
    const userData = {
      name: formValue.nombre,
      email: formValue.correo,
      phone: formValue.telefono,
      rentaMensual: formValue.rentaMensual
    };
    
    // Guardar en el estado del wizard
    this.wizardStateService.saveState({
      userData: userData
    });
    
    // NO marcar el paso como completado aquí - se hará en wizard-flow cuando se envíe por correo
    // this.wizardStateService.completeStep(1);
  }

  /**
   * Enviar cotización por correo electrónico
   */
  async sendQuotationByEmail(): Promise<void> {
    this.logger.log('🔵 sendQuotationByEmail() llamado');
    this.logger.log('📋 Estado del formulario:', {
      valid: this.mainDataForm.valid,
      invalid: this.mainDataForm.invalid,
      errors: this.mainDataForm.errors,
      value: this.mainDataForm.value
    });
    
    if (this.mainDataForm.valid) {
      this.logger.log('📧 Enviando cotización por correo...');
      
      // Guardar estado del usuario antes de enviar
      this.saveUserData();
      
      this.isCreatingQuotation = true;
      this.quotationError = '';

      try {
        // Crear cotización primero
        this.logger.log('🔄 Paso 1: Creando cotización...');
        const quotationData = await this.createQuotation();
        this.logger.log('📊 Cotización creada:', quotationData);
        
        // El backend devuelve quotationId, pero el modelo del frontend usa id
        const quotationId = quotationData?.quotationId || quotationData?.id;
        const quotationNumber = quotationData?.quotationNumber || 'N/A';
        
        if (quotationData && quotationId) {
          this.logger.log('✅ Cotización creada, enviando por correo...');
          this.logger.log('🆔 ID de cotización:', quotationId);
          
          // ✅ IMPORTANTE: Guardar quotationId y quotationNumber en el estado del wizard
          // para que se sincronicen con el backend y estén disponibles al recargar
          this.wizardStateService.saveState({
            quotationId: quotationId,
            quotationNumber: quotationNumber,
            paymentAmount: quotationData.quotationAmount || this.getTotalPrice(),
            selectedPlanName: quotationData.plan?.name || this.selectedPlanData?.name || ''
          });
          
          this.logger.log('💾 quotationId guardado en estado del wizard:', quotationId);
          
          // Enviar cotización por correo
          this.logger.log('📡 Paso 2: Llamando a sendQuotationEmail...');
          this.quotationsService.sendQuotationEmail(quotationId).subscribe({
            next: (response) => {
              this.logger.log('📥 Respuesta del envío:', response);
              if (response.success) {
                this.logger.log('📧 Cotización enviada por correo exitosamente');
                // Mostrar mensaje de éxito
                this.quotationError = '';
                // Emitir evento con el número de cotización
                this.goToFinish.emit(quotationNumber);
              } else {
                this.logger.error('❌ Error enviando cotización por correo:', response.message);
                this.quotationError = response.message || 'Error enviando cotización por correo';
              }
            },
            error: (error) => {
              this.logger.error('❌ Error enviando cotización por correo:', error);
              this.logger.error('❌ Detalles del error:', { error: error.error, status: error.status, message: error.message });
              this.quotationError = 'Error enviando cotización por correo';
            }
          });
        } else {
          this.logger.error('❌ No se pudo obtener ID de cotización:', quotationData);
          this.quotationError = 'Error: No se pudo crear la cotización';
        }
      } catch (error: any) {
        this.logger.error('❌ Error creando cotización para envío por correo:', error);
        this.quotationError = error.message || 'Error creando cotización';
      } finally {
        this.isCreatingQuotation = false;
      }
    } else {
      this.logger.log('❌ Formulario inválido para envío por correo');
      this.logger.log('📋 Campos con errores:', this.getFormErrors());
      this.markFormGroupTouched();
    }
  }

  /**
   * Crear cotización en el backend
   */
  private async createQuotation(): Promise<any> {
    const formValue = this.mainDataForm.value;
    
    // Validar que tengamos todos los campos requeridos
    if (!this.selectedPlan) {
      throw new Error('No se ha seleccionado un plan');
    }

    if (!formValue.nombre || !formValue.correo || !formValue.telefono || !formValue.rentaMensual) {
      throw new Error('Todos los campos son obligatorios');
    }

    // Validar que el plan esté cargado
    if (!this.selectedPlanData) {
      throw new Error('Los datos del plan no están disponibles');
    }

    this.logger.log('📋 Creando cotización para plan:', this.selectedPlan);

    // Create simplified DTO with only available fields
    const quotationDto: CreateQuotationDto = {
      planId: this.selectedPlan,
      sessionId: this.wizardStateService.getState().sessionId, // Session ID (pji_session_ format)
      wizardSessionId: this.wizardStateService.getState().id, // Session UUID
      monthlyRent: formValue.rentaMensual, // Monthly rent amount
      rentPercentage: 0, // Will be calculated in backend
      complementAmount: this.getComplementosPrice(), // Complement amount
      userData: {
        name: formValue.nombre,
        email: formValue.correo,
        phone: formValue.telefono,
        postalCode: formValue.codigoPostal || '00000'
      }
    };

    this.logger.log('📤 Enviando cotización:', quotationDto);

    return new Promise((resolve, reject) => {
      this.quotationsService.createQuotation(quotationDto).subscribe({
        next: (response) => {
          if (response.success && response.data) {
            this.logger.log('✅ Cotización creada exitosamente:', response.data);
            // Crear objeto con datos completos para el componente de pago
            const quotationData = {
              ...response.data,
              quotationAmount: this.getTotalPrice(), // Agregar monto total
              quotationCurrency: this.selectedPlanData?.currency || 'MXN', // Agregar moneda
              userId: response.data.userId, // Agregar userId del usuario creado
              plan: {
                name: this.selectedPlanData?.name || '', // Ya no se usa nombre hardcodeado
                price: this.getTotalPrice()
              }
            };
            this.logger.log('📊 Datos completos de cotización para pago:', quotationData);
            this.mainDataForm.patchValue({ quotationId: response.data.id });
            resolve(quotationData); // Resolve with the enriched data
          } else {
            this.logger.error('❌ Error en respuesta:', response);
            reject(new Error(response.message || 'Error creando cotización'));
          }
        },
        error: (error) => {
          this.logger.error('❌ Error HTTP:', error);
          // Intentar obtener más detalles del error
          let errorMessage = 'Error interno del servidor';
          if (error.error && error.error.message) {
            errorMessage = error.error.message;
          } else if (error.message) {
            errorMessage = error.message;
          }
          reject(new Error(errorMessage));
        }
      });
    });
  }

  /**
   * Marcar todos los campos del formulario como tocados para mostrar errores
   */
  private markFormGroupTouched(): void {
    Object.keys(this.mainDataForm.controls).forEach(key => {
      const control = this.mainDataForm.get(key);
      if (control) {
        control.markAsTouched();
      }
    });
  }

  onPrevious() {
    this.previous.emit();
  }

  /**
   * Obtener todos los errores del formulario
   */
  private getFormErrors(): any {
    const errors: any = {};
    Object.keys(this.mainDataForm.controls).forEach(key => {
      const control = this.mainDataForm.get(key);
      if (control && control.errors) {
        errors[key] = control.errors;
      }
    });
    return errors;
  }

  /**
   * Obtener mensaje de error para un campo específico
   */
  getErrorMessage(fieldName: string): string {
    const field = this.mainDataForm.get(fieldName);
    if (field && field.errors && field.touched) {
      if (field.errors['required']) return 'Este campo es requerido';
      if (field.errors['email']) return 'Email inválido';
      if (field.errors['minlength']) return `Mínimo ${field.errors['minlength'].requiredLength} caracteres`;
      if (field.errors['pattern']) {
        if (fieldName === 'telefono') return 'Teléfono inválido (9-10 dígitos)';
        return 'Formato inválido';
      }
      if (field.errors['min']) return `Valor mínimo: ${field.errors['min'].min}`;
    }
    return '';
  }
} 