import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ValidationDataModalComponent, ValidationData } from '../../../components/validation-data-modal/validation-data-modal.component';
import { environment } from '../../../../environments/environment';
import { PlansService } from '../../../services/plans.service';
import { QuotationsService } from '../../../services/quotations.service';
import { WizardStateService } from '../../../services/wizard-state.service';
import { ValidationService, ValidationRequest } from '../../../services/validation.service';
import { Plan } from '../../../models/plan.model';
import { ActivatedRoute } from '@angular/router';

export interface AlternativePlan {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  features: string[];
  isPopular?: boolean;
  complementaryPlans?: ComplementaryPlan[];
}

export interface PaymentResult {
  success: boolean;
  paymentId: string;
  chargeId: string;
  policyId: string;
  policyNumber: string;
  status: string;
  message: string;
}

export interface ValidationRequirement {
  type: 'arrendador' | 'arrendatario' | 'aval';
  name: string;
  required: boolean;
  completed: boolean;
  uuid?: string;
}

export interface ComplementaryPlan {
  id: string;
  name: string;
  price: number;
  currency: string;
  selected?: boolean;
}

@Component({
  selector: 'app-validation-step',
  standalone: true,
  imports: [CommonModule, FormsModule, ValidationDataModalComponent],
  templateUrl: './validation-step.component.html',
  styleUrls: ['./validation-step.component.scss']
})
export class ValidationStepComponent implements OnInit {
  @Input() validationStatus: 'pending' | 'success' | 'intermediate' | 'failed' = 'pending';
  @Output() next = new EventEmitter<void>();
  @Output() selectPlan = new EventEmitter<string>();
  @Output() goToStart = new EventEmitter<void>();

  constructor(
    private plansService: PlansService,
    private quotationsService: QuotationsService,
    private wizardStateService: WizardStateService,
    private validationService: ValidationService,
    private route: ActivatedRoute
  ) {}

  alternativePlans: AlternativePlan[] = [];
  selectedPlan: AlternativePlan | null = null;

  // Propiedades para el modal de datos
  showValidationModal = false;
  currentValidationType: 'arrendador' | 'arrendatario' | 'aval' = 'arrendador';

  // Propiedades para cotización desde email o wizard
  quotationNumber: string = '';
  quotationAmount: number = 0;
  quotationCurrency: string = 'MXN';
  isFromEmail: boolean = false;
  isFromWizard: boolean = false;
  
  // Propiedades para información del pago y póliza
  paymentResult: PaymentResult | null = null;
  policyGenerated: boolean = false;
  paymentAmount: number = 0;
  
  // Propiedades para validación según tipo de usuario
  userType: 'arrendador' | 'arrendatario' | 'asesor' = 'arrendador';
  validationRequirements: ValidationRequirement[] = [];
  totalValidations: number = 0;
  completedValidations: number = 0;

  ngOnInit() {
    // Verificar si llegamos desde email
    this.checkIfFromEmail();
    
    // La validación se maneja desde el componente padre
    this.loadPlans();
    
    // Configurar validaciones según tipo de usuario
    this.setupValidationRequirements();
    
    // Cargar información del pago si viene del wizard
    this.loadPaymentInfo();
    
    // Cargar validaciones existentes si hay policyId
    this.loadExistingValidations();
    
    // Iniciar verificación automática de estado cada 30 segundos
    this.startAutoStatusCheck();
  }

  /**
   * Verificar si llegamos desde email y obtener cotización
   */
  private checkIfFromEmail(): void {
    this.route.queryParams.subscribe(params => {
      const quotationNumber = params['quotation'];
      const planId = params['plan'];
      
      if (quotationNumber && planId) {
        console.log('🎯 Llegamos desde email con cotización:', quotationNumber);
        this.isFromEmail = true;
        this.quotationNumber = quotationNumber;
        
        // Obtener detalles de la cotización
        this.loadQuotationDetails(quotationNumber);
      } else {
        // Verificar si hay cotización en el estado del wizard
        this.checkWizardState();
      }
    });
  }

  /**
   * Verificar estado del wizard para cotización
   */
  private checkWizardState(): void {
    const wizardState = this.wizardStateService.getState();
    
    if (wizardState.quotationNumber && wizardState.quotationId) {
      console.log('🎯 Cotización encontrada en estado del wizard:', wizardState.quotationNumber);
      this.isFromWizard = true;
      this.quotationNumber = wizardState.quotationNumber;
      
      // Obtener detalles de la cotización desde el estado
      this.loadQuotationFromState(wizardState);
    }
  }

  /**
   * Cargar cotización desde el estado del wizard
   */
  private loadQuotationFromState(wizardState: any): void {
    console.log('📊 Cargando cotización desde estado del wizard:', wizardState);
    
    // Intentar obtener el monto real desde la cotización
    if (wizardState.quotationId) {
      this.loadQuotationFromAPI(wizardState.quotationId);
    } else {
      // Usar valores por defecto si no hay cotización
      this.quotationAmount = 299.00;
      this.quotationCurrency = 'MXN';
      console.log('💰 Usando monto por defecto:', this.quotationAmount, this.quotationCurrency);
    }
  }

  /**
   * Cargar cotización desde la API para obtener el monto real
   */
  private loadQuotationFromAPI(quotationId: string): void {
    // Primero intentar obtener el monto desde el estado del wizard (si viene del pago)
    const wizardState = this.wizardStateService.getState();
    if (wizardState.paymentResult) {
      // El monto real se obtiene del paso de pago, no necesitamos calcularlo aquí
      return;
    }
    
    // Si no hay paymentResult, calcular desde el plan seleccionado
    if (this.selectedPlan) {
      const rentaMensual = this.getRentaMensualFromWizardState();
      if (rentaMensual > 0) {
        // Calcular precio dinámico
        this.quotationAmount = this.calculateDynamicPrice(this.selectedPlan.name, rentaMensual);
      } else {
        this.quotationAmount = this.selectedPlan.price;
      }
      
      // Agregar precio de complementos si están seleccionados
      const complementaryPlans = this.getComplementaryPlans();
      const complementPrice = complementaryPlans
        .filter(complement => complement.selected)
        .reduce((sum, complement) => sum + complement.price, 0);
      
      this.quotationAmount += complementPrice;
      this.quotationCurrency = this.selectedPlan.currency || 'MXN';
      
      console.log('💰 Monto calculado desde plan:', this.quotationAmount, this.quotationCurrency);
    } else {
      // Fallback a valor por defecto
      this.quotationAmount = 299.00;
      this.quotationCurrency = 'MXN';
      console.log('💰 Usando monto por defecto (sin plan):', this.quotationAmount, this.quotationCurrency);
    }
  }

  /**
   * Obtener renta mensual desde el estado del wizard
   */
  private getRentaMensualFromWizardState(): number {
    try {
      const wizardState = this.wizardStateService.getState();
      return wizardState.userData?.rentaMensual || 0;
    } catch (error) {
      console.error('❌ Error obteniendo renta mensual del estado:', error);
      return 0;
    }
  }

  /**
   * Calcular precio dinámico basado en la renta mensual
   */
  private calculateDynamicPrice(planName: string, rentaMensual: number): number {
    // Lógica de cálculo dinámico (debería ser la misma que en PlansService)
    const priceRanges: Record<string, Record<string, number>> = {
      'Esencial': {
        '0-5000': 0.05,
        '5001-15000': 0.04,
        '15001+': 0.03
      },
      'Premium': {
        '0-5000': 0.06,
        '5001-15000': 0.05,
        '15001+': 0.04
      },
      'Diamante': {
        '0-5000': 0.07,
        '5001-15000': 0.06,
        '15001+': 0.05
      }
    };

    const planRanges = priceRanges[planName];
    if (!planRanges) {
      return 0;
    }

    let percentage = 0;
    if (rentaMensual <= 5000) {
      percentage = planRanges['0-5000'];
    } else if (rentaMensual <= 15000) {
      percentage = planRanges['5001-15000'];
    } else {
      percentage = planRanges['15001+'];
    }

    return rentaMensual * percentage * 12; // Precio anual
  }

  /**
   * Cargar detalles de la cotización
   */
  private loadQuotationDetails(quotationNumber: string): void {
    // Buscar la cotización por número
    // Por ahora usamos un valor por defecto, pero podrías implementar un endpoint
    // para buscar cotizaciones por número
    console.log('📊 Cargando detalles de cotización:', quotationNumber);
    
    // Simular obtención de monto (reemplazar con llamada real a la API)
    this.quotationAmount = 299.00; // Este valor debería venir de la API
    this.quotationCurrency = 'MXN';
    
    console.log('💰 Monto de cotización:', this.quotationAmount, this.quotationCurrency);
  }

  /**
   * Carga los planes desde la base de datos
   */
  loadPlans() {
    this.plansService.getPlans().subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.alternativePlans = response.data.map(plan => ({
            id: plan.id,
            name: plan.name,
            description: plan.description,
            price: plan.price,
            currency: plan.currency,
            features: Array.isArray(plan.features) ? plan.features : [], // Asegurar que sea array
            isPopular: plan.name.toLowerCase().includes('investigación') || 
                      plan.name.toLowerCase().includes('investigacion'),
            complementaryPlans: Array.isArray(plan.complementaryPlans) ? plan.complementaryPlans.map(complement => ({
              id: complement.id,
              name: complement.name,
              price: complement.price,
              currency: complement.currency,
              selected: false
            })) : []
          }));
          console.log('Planes cargados con complementos:', this.alternativePlans);
        }
      },
      error: (error) => {
        console.error('Error al cargar planes:', error);
        // Fallback a planes por defecto si hay error
        this.loadDefaultPlans();
      }
    });
  }

  /**
   * Planes por defecto en caso de error
   */
  loadDefaultPlans() {
    this.alternativePlans = [
      { 
        id: 'default-juridica', 
        name: 'Póliza Jurídica Digital', 
        description: 'Protección esencial para tu arrendamiento.',
        price: 0,
        currency: 'MXN',
        features: ['Falta de pago', 'Abandono', 'Devolución voluntaria']
      },
      { 
        id: 'default-investigacion', 
        name: 'Investigación Digital (Más Popular)', 
        description: 'Cobertura ampliada y negociación de contrato.',
        price: 0,
        currency: 'MXN',
        features: ['Intervención legal', 'Negociación de contrato', 'Asesoría jurídica'],
        isPopular: true
      },
      { 
        id: 'default-total', 
        name: 'Protección Total', 
        description: 'Máxima protección legal y financiera.',
        price: 0,
        currency: 'MXN',
        features: ['Recuperación judicial', 'Cobertura completa', 'Soporte 24/7']
      }
    ];
  }

  onNext() {
    this.next.emit();
  }

  onSelectPlan(planId: string) {
    console.log('Plan seleccionado:', planId);
    this.selectedPlan = this.alternativePlans.find(plan => plan.id === planId) || null;
    console.log('Plan encontrado:', this.selectedPlan);
    console.log('Complementos disponibles:', this.selectedPlan?.complementaryPlans);
    this.selectPlan.emit(planId);
  }

  onComplementChange() {
    // Recalcular total cuando cambian los complementos
    console.log('Complementos actualizados:', this.selectedPlan?.complementaryPlans);
  }

  getTotalPrice(): number {
    let total = 0;
    
    if (this.selectedPlan) {
      total += this.selectedPlan.price;
    }
    
    // Agregar precio de complementos seleccionados
    const complementaryPlans = this.getComplementaryPlans();
    total += complementaryPlans
      .filter(complement => complement.selected)
      .reduce((sum, complement) => sum + complement.price, 0);
    
    return total;
  }

  getComplementaryPlans(): ComplementaryPlan[] {
    if (this.selectedPlan?.complementaryPlans && Array.isArray(this.selectedPlan.complementaryPlans)) {
      return this.selectedPlan.complementaryPlans;
    }
    
    // Complementos de ejemplo cuando no hay plan seleccionado
    return [
      { id: '1', name: 'Complemento 1', price: 99.00, currency: 'MXN', selected: false },
      { id: '2', name: 'Complemento 2', price: 99.00, currency: 'MXN', selected: false },
      { id: '3', name: 'Complemento 3', price: 99.00, currency: 'MXN', selected: false },
      { id: '4', name: 'Complemento 4', price: 99.00, currency: 'MXN', selected: false },
      { id: '5', name: 'Complemento 5', price: 99.00, currency: 'MXN', selected: false },
      { id: '6', name: 'Complemento 6', price: 99.00, currency: 'MXN', selected: false }
    ];
  }

  onGoToStart() {
    this.goToStart.emit();
  }

  /**
   * Verifica si un valor es un array
   */
  isArray(value: any): boolean {
    return Array.isArray(value);
  }

  /**
   * Configurar requisitos de validación según tipo de usuario
   */
  private setupValidationRequirements(): void {
    // Obtener tipo de usuario del estado del wizard
    const wizardState = this.wizardStateService.getState();
    const userTypeFromState = wizardState.userData?.tipoUsuario;
    this.userType = userTypeFromState || 'arrendador';
    
    console.log('👤 Configurando validaciones para tipo de usuario:', this.userType);
    
    // Verificar si ya hay validationRequirements guardados en el estado
    if (wizardState.validationRequirements && wizardState.validationRequirements.length > 0) {
      console.log('📋 Cargando validationRequirements existentes del estado:', wizardState.validationRequirements);
      this.validationRequirements = wizardState.validationRequirements;
      this.completedValidations = this.validationRequirements.filter(req => req.completed).length;
      console.log(`✅ Validaciones cargadas: ${this.completedValidations}/${this.validationRequirements.length} completadas`);
    } else {
      // Configurar validaciones según tipo de usuario (primera vez)
      switch (this.userType) {
        case 'arrendador':
          this.validationRequirements = [
            { type: 'arrendatario', name: 'Datos del Inquilino', required: true, completed: false },
            { type: 'aval', name: 'Datos del Aval', required: true, completed: false }
          ];
          break;
        case 'arrendatario':
          this.validationRequirements = [
            { type: 'arrendador', name: 'Datos del Arrendador', required: true, completed: false },
            { type: 'aval', name: 'Datos del Aval', required: true, completed: false }
          ];
          break;
        case 'asesor':
          this.validationRequirements = [
            { type: 'arrendador', name: 'Datos del Arrendador', required: true, completed: false },
            { type: 'arrendatario', name: 'Datos del Arrendatario', required: true, completed: false }
          ];
          break;
        default:
          this.validationRequirements = [];
      }
      
      this.completedValidations = 0;
      
      // Guardar validationRequirements en el estado
      this.wizardStateService.saveState({
        validationRequirements: this.validationRequirements
      });
      
      console.log('✅ Validaciones configuradas y guardadas:', this.validationRequirements);
    }
    
    this.totalValidations = this.validationRequirements.length;
    console.log(`📊 Total de validaciones: ${this.totalValidations}`);
  }

  /**
   * Cargar validaciones existentes por policyId si está disponible
   */
  private loadExistingValidations(): void {
    const wizardState = this.wizardStateService.getState();
    const policyId = wizardState.policyId;
    
    if (policyId) {
      console.log(`🔍 Cargando validaciones existentes para policyId: ${policyId}`);
      
      this.validationService.getValidationsByPolicy(policyId).subscribe({
        next: (response) => {
          if (response.success && response.data && response.data.length > 0) {
            console.log(`✅ Encontradas ${response.data.length} validaciones existentes para policyId ${policyId}:`, response.data);
            
            // Actualizar validationRequirements con los UUIDs existentes
            response.data.forEach(existingValidation => {
              const requirement = this.validationRequirements.find(req => req.type === existingValidation.type);
              if (requirement) {
                requirement.uuid = existingValidation.uuid;
                requirement.completed = existingValidation.status === 'COMPLETED';
                
                if (requirement.completed) {
                  this.completedValidations++;
                }
                
                console.log(`🔄 Actualizado requirement para ${existingValidation.type}:`, {
                  uuid: requirement.uuid,
                  completed: requirement.completed,
                  status: existingValidation.status
                });
              }
            });
            
            // Actualizar el estado con los validationRequirements actualizados
            this.wizardStateService.saveState({
              validationRequirements: this.validationRequirements
            });
            
            console.log(`📊 Estado actualizado: ${this.completedValidations}/${this.totalValidations} validaciones completadas`);
          } else {
            console.log(`ℹ️ No se encontraron validaciones existentes para policyId ${policyId}`);
          }
        },
        error: (error) => {
          console.error(`❌ Error cargando validaciones existentes para policyId ${policyId}:`, error);
        }
      });
    } else {
      console.log('ℹ️ No hay policyId disponible, saltando carga de validaciones existentes');
    }
  }

  /**
   * Cargar información del pago desde el estado del wizard
   */
  private loadPaymentInfo(): void {
    const wizardState = this.wizardStateService.getState();
    
    console.log('📊 wizardState completo en validation-step:', wizardState);
    console.log('🔍 Campos específicos de póliza:', {
      policyId: wizardState.policyId,
      policyNumber: wizardState.policyNumber,
      paymentResult: wizardState.paymentResult,
      paymentAmount: wizardState.paymentAmount,
      quotationAmount: this.quotationAmount
    });
    
    // Verificar si hay información de pago en el estado
    if (wizardState.paymentResult) {
      console.log('📋 paymentResult encontrado en wizardState:', wizardState.paymentResult);
      console.log('🔍 Campos de paymentResult:');
      console.log('  - policyId:', wizardState.paymentResult.policyId);
      console.log('  - policyNumber:', wizardState.paymentResult.policyNumber);
      console.log('  - paymentId:', wizardState.paymentResult.paymentId);
      console.log('  - status:', wizardState.paymentResult.status);
      
      this.paymentResult = wizardState.paymentResult;
      this.policyGenerated = true;
      
      // Obtener el monto del pago desde el estado del wizard
      // El monto real se guarda en el paso de pago
      this.paymentAmount = wizardState.paymentAmount || this.quotationAmount;
      
      console.log('💰 Monto asignado desde paymentResult:', {
        wizardStatePaymentAmount: wizardState.paymentAmount,
        quotationAmount: this.quotationAmount,
        finalPaymentAmount: this.paymentAmount
      });
      
      console.log('✅ paymentResult asignado al componente de validación');
    } else if (wizardState.policyId && wizardState.policyNumber) {
      console.log('📋 Datos de póliza encontrados directamente en wizardState');
      console.log('🔍 Campos directos de póliza:');
      console.log('  - policyId:', wizardState.policyId);
      console.log('  - policyNumber:', wizardState.policyNumber);
      
      // Crear paymentResult desde los campos directos
      this.paymentResult = {
        success: true,
        policyId: wizardState.policyId,
        policyNumber: wizardState.policyNumber,
        paymentId: wizardState.paymentResult?.paymentId || 'N/A',
        chargeId: wizardState.paymentResult?.chargeId || 'N/A',
        status: 'COMPLETED',
        message: 'Pago procesado exitosamente'
      };
      
      this.policyGenerated = true;
      this.paymentAmount = wizardState.paymentAmount || this.quotationAmount;
      
      console.log('💰 Monto asignado desde campos directos:', {
        wizardStatePaymentAmount: wizardState.paymentAmount,
        quotationAmount: this.quotationAmount,
        finalPaymentAmount: this.paymentAmount
      });
      
      console.log('✅ Datos de póliza asignados al componente de validación desde campos directos');
    } else {
      console.log('⚠️ No hay paymentResult ni datos de póliza en wizardState');
      console.log('📊 wizardState completo:', wizardState);
    }
  }

  /**
   * Marcar validación como completada
   */
  markValidationCompleted(type: string): void {
    const requirement = this.validationRequirements.find(req => req.type === type);
    if (requirement && !requirement.completed) {
      requirement.completed = true;
      this.completedValidations++;
      console.log(`✅ Validación ${type} completada. Progreso: ${this.completedValidations}/${this.totalValidations}`);
      
      // Guardar validationRequirements actualizados en el estado
      this.wizardStateService.saveState({
        validationRequirements: this.validationRequirements
      });
      
      // Sincronizar con el backend para persistir los validationRequirements
      this.wizardStateService.syncWithBackendCorrected(this.wizardStateService.getState()).then(() => {
        console.log('✅ validationRequirements actualizados sincronizados con el backend');
      }).catch(error => {
        console.error('❌ Error sincronizando validationRequirements actualizados con backend:', error);
      });
      
      // Mostrar mensaje de éxito para esta validación
      console.log(`🎯 Validación de ${type} completada exitosamente`);
      console.log(`📧 El enlace de verificación fue enviado y completado`);
      
      // Si todas las validaciones están completadas, permitir continuar
      if (this.completedValidations === this.totalValidations) {
        console.log('🎉 Todas las validaciones completadas');
        this.validationStatus = 'success';
        
        // Mostrar mensaje de éxito
        console.log('🎯 Todas las validaciones de identidad han sido completadas exitosamente');
        console.log('🚀 El usuario puede continuar al siguiente paso');
        
        // Aquí podrías mostrar una notificación visual al usuario
        // o actualizar la UI para mostrar el botón de continuar
      }
    }
  }

  /**
   * Iniciar proceso de validación para un tipo específico
   */
  startValidation(type: string): void {
    console.log(`🚀 Iniciando validación para: ${type}`);
    
    // Establecer el tipo de validación actual
    this.currentValidationType = type as 'arrendador' | 'arrendatario' | 'aval';
    
    // Si ya tenemos un UUID para esta validación, mostrar directamente el modal
    const requirement = this.validationRequirements.find(req => req.type === type);
    if (requirement && requirement.uuid) {
      console.log(`🔑 Validación ya iniciada para ${type}, UUID: ${requirement.uuid}`);
      // Mostrar información de la validación en progreso
    } else {
      // Si no hay UUID, abrir el modal para recoger datos y crear la validación
      this.showValidationModal = true;
    }
  }

  /**
   * Manejar envío de datos del modal
   */
  onValidationDataSubmit(validationData: ValidationData): void {
    console.log('📝 Datos de validación recibidos:', validationData);
    
    // Obtener datos necesarios del estado del wizard
    const wizardState = this.wizardStateService.getState();
    const quotationId = wizardState.quotationId;
    const policyId = wizardState.policyId;
    
    if (!quotationId) {
      console.error('❌ Falta quotationId para iniciar validación');
      return;
    }
    
    // Crear solicitud de validación para el backend
    const validationRequest: ValidationRequest = {
      name: validationData.name,
      email: validationData.email,
      type: validationData.type,
      quotationId,
      policyId: policyId || undefined // Incluir policyId si está disponible
    };
    
    console.log(`🚀 Iniciando validación a través del backend para ${validationData.type}:`, validationRequest);
    console.log(`📋 Datos enviados: quotationId=${quotationId}, policyId=${policyId}`);
    
    // Iniciar validación en el backend (el backend se encarga de VDID)
    this.validationService.startValidation(validationRequest).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          console.log('✅ Validación iniciada exitosamente en el backend:', response.data);
          
          // Guardar UUID en el requerimiento
          const requirement = this.validationRequirements.find(req => req.type === validationData.type);
          if (requirement) {
            requirement.uuid = response.data.uuid;
            requirement.completed = false; // Marcar como en progreso
            console.log(`🔑 UUID asignado a ${validationData.type}:`, response.data.uuid);
          }
          
          // Mostrar mensaje de éxito
          console.log(`✅ Enlace de verificación enviado a ${validationData.email}`);
          console.log(`📧 El backend se encargó de crear la verificación VDID y enviar el email`);
          
          // Guardar validationRequirements actualizados en el estado
          this.wizardStateService.saveState({
            validationRequirements: this.validationRequirements
          });
          
          // Sincronizar con el backend para persistir los validationRequirements
          this.wizardStateService.syncWithBackendCorrected(this.wizardStateService.getState()).then(() => {
            console.log('✅ validationRequirements sincronizados con el backend');
          }).catch(error => {
            console.error('❌ Error sincronizando validationRequirements con backend:', error);
          });
          
          // Cerrar el modal
          this.showValidationModal = false;
          
        } else {
          console.error('❌ Error iniciando validación en el backend:', response.message);
        }
      },
      error: (error) => {
        console.error('❌ Error en servicio de validación:', error);
      }
    });
  }

  /**
   * Cerrar modal de datos de validación
   */
  onValidationModalClose(): void {
    this.showValidationModal = false;
  }

  /**
   * Verificar estado de todas las validaciones pendientes
   */
  checkValidationStatuses(): void {
    const pendingValidations = this.validationRequirements.filter(req => 
      req.uuid && !req.completed
    );

    if (pendingValidations.length === 0) {
      return;
    }

    console.log('🔍 Verificando estado de validaciones pendientes...');

    pendingValidations.forEach(requirement => {
      if (requirement.uuid) {
        this.validationService.getValidationStatus(requirement.uuid).subscribe({
          next: (response) => {
            if (response.success && response.data) {
              const status = response.data.status;
              console.log(`📊 Estado de validación ${requirement.type}:`, status);

              if (status === 'COMPLETED') {
                this.markValidationCompleted(requirement.type);
              }
            }
          },
          error: (error) => {
            console.error(`❌ Error verificando estado de ${requirement.type}:`, error);
          }
        });
      }
    });
  }

  /**
   * Reenviar verificación por email
   */
  resendVerification(type: string): void {
    const requirement = this.validationRequirements.find(req => req.type === type);
    if (!requirement || !requirement.uuid) {
      console.error('❌ No se puede reenviar: UUID no disponible');
      return;
    }

    console.log(`📧 Reenviando verificación para ${type}...`);

    this.validationService.resendVerification(requirement.uuid).subscribe({
      next: (response) => {
        if (response.success) {
          console.log(`✅ Verificación reenviada exitosamente a ${type}`);
        } else {
          console.error('❌ Error reenviando verificación:', response.message);
        }
      },
      error: (error) => {
        console.error('❌ Error en servicio de reenvío:', error);
      }
    });
  }

  /**
   * Iniciar verificación automática de estado
   */
  private startAutoStatusCheck(): void {
    // Verificar estado cada 30 segundos
    setInterval(() => {
      this.checkValidationStatuses();
    }, 30000); // 30 segundos

    console.log('⏰ Verificación automática de estado iniciada (cada 30 segundos)');
  }
} 