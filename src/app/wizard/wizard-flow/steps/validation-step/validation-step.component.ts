import { Component, Input, Output, EventEmitter, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ValidationDataModalComponent, ValidationData } from '../../../../components/validation-data-modal/validation-data-modal.component';
import { environment } from '../../../../../environments/environment';
import { PlansService } from '../../../../services/plans.service';
import { QuotationsService } from '../../../../services/quotations.service';
import { PaymentsService } from '../../../../services/payments.service';
import { ToastService } from '../../../../services/toast.service';
import { WizardStateService } from '../../../../services/wizard-state.service';
import { WizardSessionService } from '../../../../services/wizard-session.service';
import { ValidationService, ValidationRequest } from '../../../../services/validation.service';
import { Plan } from '../../../../models/plan.model';
import { ActivatedRoute } from '@angular/router';
import { LoggerService } from '../../../../services/logger.service';
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
export class ValidationStepComponent implements OnInit, OnDestroy {
  @Input() validationStatus: 'pending' | 'success' | 'intermediate' | 'failed' = 'pending';
  @Output() next = new EventEmitter<void>();
  @Output() selectPlan = new EventEmitter<string>();
  @Output() goToStart = new EventEmitter<void>();

  constructor(
    private plansService: PlansService,
    private quotationsService: QuotationsService,
    private paymentsService: PaymentsService,
    private toastService: ToastService,
    private wizardStateService: WizardStateService,
    private wizardSessionService: WizardSessionService,
    private validationService: ValidationService,
    private route: ActivatedRoute,
    private logger: LoggerService
  ) {}

  alternativePlans: AlternativePlan[] = [];
  selectedPlan: AlternativePlan | null = null;
  
  // Flag para evitar inicialización múltiple
  private isInitialized = false;
  
  // Flag para evitar cargar planes múltiples veces
  private plansLoaded = false;
  private isLoadingPlans = false;
  private loadPlansAttempts = 0;
  private maxLoadPlansAttempts = 3;
  
  // Flag para evitar cargar validaciones múltiples veces
  private isLoadingValidations = false;
  private loadValidationsAttempts = 0;
  private maxLoadValidationsAttempts = 3;
  
  // Control de verificación automática
  private autoStatusCheckInterval: any = null;

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

  async ngOnInit() {
    // ✅ OPTIMIZADO: Evitar doble inicialización
    if (this.isInitialized) {
      this.logger.log('⚠️ ValidationStepComponent ya está inicializado, omitiendo ngOnInit duplicado');
      return;
    }
    
    this.isInitialized = true;
    this.logger.log('🚀 ValidationStepComponent ngOnInit iniciado');
    
    // Verificar si llegamos desde email
    this.checkIfFromEmail();
    
    // ✅ NUEVO: Restaurar policyId desde backend si no está en estado local (al recargar)
    await this.ensurePolicyIdFromSession();
    
    // Configurar validaciones según tipo de usuario
    this.setupValidationRequirements();
    
    // Cargar información del pago si viene del wizard (solo lee estado local, no hace peticiones)
    await this.loadPaymentInfo(); // ✅ Cambiado a async para esperar la recuperación de policyNumber
    
    // ✅ OPTIMIZADO: Solo cargar validaciones existentes si ya se inició al menos una validación
    // (tiene UUID) o si hay policyId y no hay validaciones en estado local
    this.loadExistingValidationsIfNeeded();
    
    // ✅ OPTIMIZADO: Solo cargar planes si el estado es 'intermediate' (se necesitan planes alternativos)
    // o si ya están cargados en el estado local, no hacer petición HTTP
    if (this.validationStatus === 'intermediate' || this.needsPlansForDisplay()) {
      this.loadPlans();
    }
    
    // ✅ OPTIMIZADO: Solo iniciar verificación automática si hay validaciones pendientes con UUID
    this.startAutoStatusCheckIfNeeded();
  }

  /**
   * Verificar si llegamos desde email y obtener cotización
   */
  private checkIfFromEmail(): void {
    this.route.queryParams.subscribe(params => {
      const quotationNumber = params['quotation'];
      const planId = params['plan'];
      
      if (quotationNumber && planId) {
        this.logger.log('🎯 Llegamos desde email con cotización:', quotationNumber);
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
      this.logger.log('🎯 Cotización encontrada en estado del wizard:', wizardState.quotationNumber);
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
    this.logger.log('📊 Cargando cotización desde estado del wizard:', wizardState);
    
    // Intentar obtener el monto real desde la cotización
    if (wizardState.quotationId) {
      this.loadQuotationFromAPI(wizardState.quotationId);
    } else {
      // Usar valores por defecto si no hay cotización
      this.quotationAmount = 0; // Ya no se usa precio hardcodeado
      this.quotationCurrency = 'MXN';
      this.logger.log('💰 Usando monto por defecto:', this.quotationAmount, this.quotationCurrency);
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
      
      this.logger.log('💰 Monto calculado desde plan:', this.quotationAmount, this.quotationCurrency);
    } else {
      // Fallback a valor por defecto
      this.quotationAmount = 0; // Ya no se usa precio hardcodeado
      this.quotationCurrency = 'MXN';
      this.logger.log('💰 Usando monto por defecto (sin plan):', this.quotationAmount, this.quotationCurrency);
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
      this.logger.error('❌ Error obteniendo renta mensual del estado:', error);
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
    this.logger.log('📊 Cargando detalles de cotización:', quotationNumber);
    
    // Simular obtención de monto (reemplazar con llamada real a la API)
    this.quotationAmount = 0; // Ya no se usa precio hardcodeado
    this.quotationCurrency = 'MXN';
    
    this.logger.log('💰 Monto de cotización:', this.quotationAmount, this.quotationCurrency);
  }

  /**
   * Verificar si se necesitan planes para mostrar en el paso actual
   */
  private needsPlansForDisplay(): boolean {
    // Solo se necesitan planes si el estado es 'intermediate' (para mostrar planes alternativos)
    // o si ya hay planes cargados en el estado local
    return this.validationStatus === 'intermediate' || this.alternativePlans.length > 0;
  }

  /**
   * Carga los planes desde la base de datos
   * ✅ OPTIMIZADO: Solo carga si realmente se necesitan (estado intermediate)
   * Evita múltiples llamadas simultáneas y maneja errores 429
   */
  loadPlans() {
    // ✅ OPTIMIZADO: Solo cargar planes si el estado es 'intermediate'
    // En estado 'pending' no se necesitan planes, solo se muestran las validaciones
    if (this.validationStatus !== 'intermediate' && this.alternativePlans.length === 0) {
      this.logger.log('ℹ️ No se necesitan planes en el paso actual, omitiendo carga');
      return;
    }
    
    // Si ya se están cargando planes, no hacer otra petición
    if (this.isLoadingPlans) {
      this.logger.log('⏳ Planes ya se están cargando, omitiendo llamada duplicada');
      return;
    }
    
    // Si ya se cargaron planes y hay planes disponibles, no recargar
    if (this.plansLoaded && this.alternativePlans.length > 0) {
      this.logger.log('📦 Planes ya cargados, usando cache local');
      return;
    }
    
    // Si ya se intentó demasiadas veces, no intentar más
    if (this.loadPlansAttempts >= this.maxLoadPlansAttempts) {
      this.logger.warning('⚠️ Máximo de intentos alcanzado para cargar planes, usando cache del servicio');
      return;
    }
    
    this.isLoadingPlans = true;
    this.loadPlansAttempts++;
    
    this.plansService.getPlans().subscribe({
      next: (response) => {
        this.isLoadingPlans = false;
        this.loadPlansAttempts = 0; // Resetear contador en éxito
        
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
          this.plansLoaded = true;
          this.logger.log('✅ Planes cargados con complementos:', this.alternativePlans);
        }
      },
      error: (error) => {
        this.isLoadingPlans = false;
        
        // Manejar error 429 con retry con backoff
        const is429Error = error?.status === 429 || 
                          error?.message?.includes('429') || 
                          error?.message?.includes('Too Many Requests');
        
        if (is429Error && this.loadPlansAttempts < this.maxLoadPlansAttempts) {
          const delay = Math.min(1000 * Math.pow(2, this.loadPlansAttempts), 10000); // Backoff exponencial, máximo 10s
          this.logger.warning(`⚠️ Error 429 al cargar planes, reintentando en ${delay}ms (intento ${this.loadPlansAttempts}/${this.maxLoadPlansAttempts})`);
          
          setTimeout(() => {
            this.loadPlans();
          }, delay);
          return;
        }
        
        this.logger.error('Error al cargar planes:', error);
        // Fallback a planes por defecto si hay error
        this.loadDefaultPlans();
      }
    });
  }

  /**
   * Planes por defecto en caso de error - eliminado para evitar conflictos con API
   */
  loadDefaultPlans() {
    // Ya no se cargan planes hardcodeados, todo debe venir de la API
    this.alternativePlans = [];
    this.logger.warning('⚠️ No se pudieron cargar planes desde la API');
  }

  onNext() {
    this.next.emit();
  }

  onSelectPlan(planId: string) {
    this.logger.log('Plan seleccionado:', planId);
    this.selectedPlan = this.alternativePlans.find(plan => plan.id === planId) || null;
    this.logger.log('Plan encontrado:', this.selectedPlan);
    this.logger.log('Complementos disponibles:', this.selectedPlan?.complementaryPlans);
    this.selectPlan.emit(planId);
  }

  onComplementChange() {
    // Recalcular total cuando cambian los complementos
    this.logger.log('Complementos actualizados:', this.selectedPlan?.complementaryPlans);
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
    
    // Ya no se devuelven complementos hardcodeados, todo debe venir de la API
    this.logger.warning('⚠️ No hay complementos disponibles desde la API');
    return [];
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
    
    this.logger.log('👤 Configurando validaciones para tipo de usuario:', this.userType);
    
    // Verificar si ya hay validationRequirements guardados en el estado
    if (wizardState.validationRequirements && wizardState.validationRequirements.length > 0) {
      this.logger.log('📋 Cargando validationRequirements existentes del estado:', wizardState.validationRequirements);
      this.validationRequirements = wizardState.validationRequirements;
      this.completedValidations = this.validationRequirements.filter(req => req.completed).length;
      this.logger.log(`✅ Validaciones cargadas: ${this.completedValidations}/${this.validationRequirements.length} completadas`);
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
      
      this.logger.log('✅ Validaciones configuradas y guardadas:', this.validationRequirements);
    }
    
    this.totalValidations = this.validationRequirements.length;
    this.logger.log(`📊 Total de validaciones: ${this.totalValidations}`);
  }

  /**
   * Asegurar que el policyId esté disponible desde la sesión del backend
   * Esto es necesario cuando se recarga la página y el estado local no tiene el policyId
   */
  private async ensurePolicyIdFromSession(): Promise<void> {
    const wizardState = this.wizardStateService.getState();
    
    // Si ya hay policyId en el estado local, no hacer nada (viene de otro paso)
    if (wizardState.policyId) {
      this.logger.log('✅ policyId ya disponible en estado local:', wizardState.policyId);
      return;
    }
    
    // Si no hay sessionId, no podemos restaurar desde backend
    const sessionId = wizardState.sessionId || wizardState.id;
    if (!sessionId) {
      this.logger.log('⚠️ No hay sessionId disponible para restaurar policyId desde backend');
      return;
    }
    
    // Intentar obtener el policyId desde el backend
    try {
      this.logger.log('🔍 No hay policyId en estado local, restaurando desde backend...', { sessionId });
      
      const response = await this.wizardSessionService.getSession(sessionId).toPromise();
      if (response) {
        const sessionData = (response as any).data || response;
        
        if (sessionData.policyId) {
          this.logger.log('✅ policyId encontrado en backend, actualizando estado local:', sessionData.policyId);
          
          // Construir paymentResult si viene del backend pero no está en el estado local
          let paymentResult = sessionData.paymentResult || wizardState.paymentResult;
          if (!paymentResult && sessionData.policyId) {
            paymentResult = {
              success: true,
              policyId: sessionData.policyId,
              policyNumber: sessionData.policyNumber || '',
              paymentId: sessionData.paymentResult?.paymentId || 'N/A',
              chargeId: sessionData.paymentResult?.chargeId || 'N/A',
              status: 'COMPLETED',
              message: 'Pago procesado exitosamente'
            };
          }
          
          // Actualizar el estado local con el policyId del backend
          await this.wizardStateService.saveState({
            policyId: sessionData.policyId,
            policyNumber: sessionData.policyNumber || wizardState.policyNumber,
            paymentResult: paymentResult,
            paymentAmount: sessionData.paymentAmount || wizardState.paymentAmount
          });
          
          this.logger.log('✅ Estado local actualizado con policyId del backend:', {
            policyId: sessionData.policyId,
            policyNumber: sessionData.policyNumber,
            hasPaymentResult: !!paymentResult
          });
        } else {
          this.logger.log('ℹ️ No hay policyId en la sesión del backend aún');
        }
      }
    } catch (error) {
      this.logger.error('❌ Error restaurando policyId desde backend:', error);
      // No lanzar error, continuar con el flujo normal
    }
  }

  /**
   * Determinar si se necesitan cargar validaciones existentes desde el backend
   * ✅ OPTIMIZADO: Solo hace petición si realmente es necesario
   */
  private loadExistingValidationsIfNeeded(): void {
    const wizardState = this.wizardStateService.getState();
    const policyId = wizardState.policyId;
    
    if (!policyId) {
      this.logger.log('ℹ️ No hay policyId disponible, saltando carga de validaciones existentes');
      return;
    }
    
    // Verificar si ya hay UUIDs en validationRequirements (significa que ya se iniciaron validaciones)
    const hasExistingUUIDs = this.validationRequirements.some(req => req.uuid);
    
    if (hasExistingUUIDs) {
      this.logger.log('✅ Ya hay UUIDs en validationRequirements, cargando datos desde backend para actualizar estados');
      this.loadExistingValidations();
      return;
    }
    
    // Si no hay UUIDs, verificar si hay validaciones guardadas en el estado local
    if (wizardState.validationRequirements && wizardState.validationRequirements.length > 0) {
      const hasUUIDsInState = wizardState.validationRequirements.some((req: any) => req.uuid);
      
      if (hasUUIDsInState) {
        this.logger.log('✅ Hay UUIDs en el estado local, cargando desde backend para sincronizar');
        this.loadExistingValidations();
        return;
      }
    }
    
    // Si no hay UUIDs ni en el componente ni en el estado local, no hacer petición
    // Las validaciones aún no se han iniciado, no tiene sentido consultar el backend
    this.logger.log('ℹ️ No hay validaciones iniciadas aún (sin UUIDs), omitiendo petición al backend');
  }

  /**
   * Cargar validaciones existentes por policyId si está disponible
   * ✅ OPTIMIZADO: Maneja errores 429 con retry y backoff
   */
  private loadExistingValidations(): void {
    const wizardState = this.wizardStateService.getState();
    const policyId = wizardState.policyId;
    
    if (!policyId) {
      this.logger.log('ℹ️ No hay policyId disponible, saltando carga de validaciones existentes');
      return;
    }
    
    // Si ya se están cargando validaciones, no hacer otra petición
    if (this.isLoadingValidations) {
      this.logger.log('⏳ Validaciones ya se están cargando, omitiendo llamada duplicada');
      return;
    }
    
    // Si ya se intentó demasiadas veces, no intentar más
    if (this.loadValidationsAttempts >= this.maxLoadValidationsAttempts) {
      this.logger.warning('⚠️ Máximo de intentos alcanzado para cargar validaciones');
      return;
    }
    
    this.isLoadingValidations = true;
    this.loadValidationsAttempts++;
    
    this.logger.log(`🔍 Cargando validaciones existentes para policyId: ${policyId}`);
    
    this.validationService.getValidationsByPolicy(policyId).subscribe({
      next: (response) => {
        this.isLoadingValidations = false;
        this.loadValidationsAttempts = 0; // Resetear contador en éxito
        
        if (response.success && response.data && response.data.length > 0) {
          this.logger.log(`✅ Encontradas ${response.data.length} validaciones existentes para policyId ${policyId}:`, response.data);
          
          // Actualizar validationRequirements con los UUIDs existentes
          response.data.forEach(existingValidation => {
            const requirement = this.validationRequirements.find(req => req.type === existingValidation.type);
            if (requirement) {
              requirement.uuid = existingValidation.uuid;
              requirement.completed = existingValidation.status === 'COMPLETED';
              
              if (requirement.completed) {
                this.completedValidations++;
              }
              
              this.logger.log(`🔄 Actualizado requirement para ${existingValidation.type}:`, {
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
          
          this.logger.log(`📊 Estado actualizado: ${this.completedValidations}/${this.totalValidations} validaciones completadas`);
        } else {
          this.logger.log(`ℹ️ No se encontraron validaciones existentes para policyId ${policyId}`);
        }
      },
      error: (error) => {
        this.isLoadingValidations = false;
        
        // Manejar error 429 con retry con backoff
        const is429Error = error?.status === 429 || 
                          error?.message?.includes('429') || 
                          error?.message?.includes('Too Many Requests');
        
        if (is429Error && this.loadValidationsAttempts < this.maxLoadValidationsAttempts) {
          const delay = Math.min(1000 * Math.pow(2, this.loadValidationsAttempts), 10000); // Backoff exponencial, máximo 10s
          this.logger.warning(`⚠️ Error 429 al cargar validaciones, reintentando en ${delay}ms (intento ${this.loadValidationsAttempts}/${this.maxLoadValidationsAttempts})`);
          
          setTimeout(() => {
            this.loadExistingValidations();
          }, delay);
          return;
        }
        
        this.logger.error(`❌ Error cargando validaciones existentes para policyId ${policyId}:`, error);
      }
    });
  }

  /**
   * Cargar información del pago desde el estado del wizard
   * ✅ Mejorado: Intenta recuperar policyNumber desde la sesión si no está disponible
   */
  private async loadPaymentInfo(): Promise<void> {
    const wizardState = this.wizardStateService.getState();
    
    this.logger.log('📊 wizardState completo en validation-step:', wizardState);
    this.logger.log('🔍 Campos específicos de póliza:', {
      policyId: wizardState.policyId,
      policyNumber: wizardState.policyNumber,
      paymentResult: wizardState.paymentResult,
      paymentAmount: wizardState.paymentAmount,
      quotationAmount: this.quotationAmount
    });
    
    // ✅ Si hay policyId pero no hay policyNumber, intentar recuperarlo desde la sesión
    if (wizardState.policyId && (!wizardState.policyNumber || wizardState.policyNumber === '' || wizardState.policyNumber === 'N/A')) {
      this.logger.log('⚠️ Hay policyId pero no hay policyNumber válido, intentando recuperar desde sesión...');
      try {
        const sessionId = wizardState.id || wizardState.sessionId;
        if (sessionId) {
          const sessionResponse = await this.wizardSessionService.getSession(sessionId).toPromise();
          if (sessionResponse) {
            const sessionData = (sessionResponse as any).data || sessionResponse;
            if (sessionData.policyNumber && sessionData.policyNumber !== '' && sessionData.policyNumber !== 'N/A') {
              this.logger.log('✅ policyNumber recuperado desde sesión:', sessionData.policyNumber);
              await this.wizardStateService.saveState({
                policyNumber: sessionData.policyNumber
              });
              // Actualizar wizardState local para usar el valor recuperado
              wizardState.policyNumber = sessionData.policyNumber;
            }
          }
        }
      } catch (error) {
        this.logger.warning('⚠️ No se pudo recuperar policyNumber desde sesión:', error);
      }
    }
    
    // Verificar si hay información de pago en el estado
    if (wizardState.paymentResult) {
      this.logger.log('📋 paymentResult encontrado en wizardState:', wizardState.paymentResult);
      this.logger.log('🔍 Campos de paymentResult:');
      this.logger.log('  - policyId:', wizardState.paymentResult.policyId);
      this.logger.log('  - policyNumber:', wizardState.paymentResult.policyNumber);
      this.logger.log('  - paymentId:', wizardState.paymentResult.paymentId);
      this.logger.log('  - status:', wizardState.paymentResult.status);
      
      // ✅ Si paymentResult.policyNumber está vacío o es 'N/A', usar el de wizardState
      const finalPolicyNumber = (wizardState.paymentResult.policyNumber && 
                                 wizardState.paymentResult.policyNumber !== '' && 
                                 wizardState.paymentResult.policyNumber !== 'N/A') 
                                 ? wizardState.paymentResult.policyNumber 
                                 : (wizardState.policyNumber && 
                                    wizardState.policyNumber !== '' && 
                                    wizardState.policyNumber !== 'N/A' 
                                    ? wizardState.policyNumber 
                                    : '');
      
      this.paymentResult = {
        ...wizardState.paymentResult,
        policyNumber: finalPolicyNumber
      };
      
      // Si aún no hay policyNumber, actualizar el estado
      if (!finalPolicyNumber || finalPolicyNumber === '') {
        this.logger.warning('⚠️ paymentResult no tiene policyNumber válido, actualizando desde wizardState');
        await this.wizardStateService.saveState({
          paymentResult: {
            ...wizardState.paymentResult,
            policyNumber: wizardState.policyNumber || ''
          }
        });
        if (this.paymentResult) {
          this.paymentResult.policyNumber = wizardState.policyNumber || '';
        }
      }
      
      this.policyGenerated = true;
      
      // Obtener el monto del pago desde el estado del wizard
      // El monto real se guarda en el paso de pago
      this.paymentAmount = wizardState.paymentAmount || this.quotationAmount;
      
      this.logger.log('💰 Monto asignado desde paymentResult:', {
        wizardStatePaymentAmount: wizardState.paymentAmount,
        quotationAmount: this.quotationAmount,
        finalPaymentAmount: this.paymentAmount
      });
      
      this.logger.log('✅ paymentResult asignado al componente de validación:', {
        policyId: this.paymentResult?.policyId,
        policyNumber: this.paymentResult?.policyNumber,
        status: this.paymentResult?.status
      });
    } else if (wizardState.policyId && wizardState.policyNumber && wizardState.policyNumber !== '' && wizardState.policyNumber !== 'N/A') {
      this.logger.log('📋 Datos de póliza encontrados directamente en wizardState');
      this.logger.log('🔍 Campos directos de póliza:');
      this.logger.log('  - policyId:', wizardState.policyId);
      this.logger.log('  - policyNumber:', wizardState.policyNumber);
      
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
      
      this.logger.log('💰 Monto asignado desde campos directos:', {
        wizardStatePaymentAmount: wizardState.paymentAmount,
        quotationAmount: this.quotationAmount,
        finalPaymentAmount: this.paymentAmount
      });
      
      this.logger.log('✅ Datos de póliza asignados al componente de validación desde campos directos:', {
        policyId: this.paymentResult.policyId,
        policyNumber: this.paymentResult.policyNumber
      });
    } else {
      this.logger.log('⚠️ No hay paymentResult ni datos de póliza válidos en wizardState');
      this.logger.log('📊 wizardState completo:', wizardState);
      this.logger.log('🔍 Detalles específicos:', {
        hasPolicyId: !!wizardState.policyId,
        hasPolicyNumber: !!(wizardState.policyNumber && wizardState.policyNumber !== '' && wizardState.policyNumber !== 'N/A'),
        hasPaymentResult: !!wizardState.paymentResult,
        policyNumberValue: wizardState.policyNumber
      });
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
      this.logger.log(`✅ Validación ${type} completada. Progreso: ${this.completedValidations}/${this.totalValidations}`);
      
          // Guardar validationRequirements actualizados en el estado (solo localmente)
          this.wizardStateService.saveState({
            validationRequirements: this.validationRequirements
          });
          
          // ✅ OPTIMIZADO: Sincronizar con debounce para evitar múltiples peticiones
          // Usar saveAndSync solo cuando sea crítico, no en cada cambio
          // La sincronización se hará automáticamente con debounce cuando sea necesario
      
      // Mostrar mensaje de éxito para esta validación
      this.logger.log(`🎯 Validación de ${type} completada exitosamente`);
      this.logger.log(`📧 El enlace de verificación fue enviado y completado`);
      
      // Si todas las validaciones están completadas, permitir continuar
      if (this.completedValidations === this.totalValidations) {
        this.logger.log('🎉 Todas las validaciones completadas');
        this.validationStatus = 'success';
        
        // Mostrar mensaje de éxito
        this.logger.log('🎯 Todas las validaciones de identidad han sido completadas exitosamente');
        this.logger.log('🚀 El usuario puede continuar al siguiente paso');
        
        // Aquí podrías mostrar una notificación visual al usuario
        // o actualizar la UI para mostrar el botón de continuar
      }
    }
  }

  /**
   * Iniciar proceso de validación para un tipo específico
   */
  startValidation(type: string): void {
    this.logger.log(`🚀 Iniciando validación para: ${type}`);
    
    // Establecer el tipo de validación actual
    this.currentValidationType = type as 'arrendador' | 'arrendatario' | 'aval';
    
    // Si ya tenemos un UUID para esta validación, mostrar directamente el modal
    const requirement = this.validationRequirements.find(req => req.type === type);
    if (requirement && requirement.uuid) {
      this.logger.log(`🔑 Validación ya iniciada para ${type}, UUID: ${requirement.uuid}`);
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
    this.logger.log('📝 Datos de validación recibidos:', validationData);
    
    // Obtener datos necesarios del estado del wizard
    const wizardState = this.wizardStateService.getState();
    const quotationId = wizardState.quotationId;
    const policyId = wizardState.policyId;
    
    // Verificar que al menos uno de los IDs esté disponible
    if (!quotationId && !policyId) {
      this.logger.error('❌ Falta quotationId o policyId para iniciar validación');
      this.logger.error('📊 Estado del wizard:', wizardState);
      return;
    }
    
    // Crear solicitud de validación para el backend
    const validationRequest: ValidationRequest = {
      name: validationData.name,
      email: validationData.email,
      type: validationData.type,
      quotationId: quotationId || undefined, // Enviar quotationId si está disponible
      policyId: policyId || undefined // Enviar policyId si está disponible
    };
    
    this.logger.log(`🚀 Iniciando validación a través del backend para ${validationData.type}:`, validationRequest);
    this.logger.log(`📋 Datos enviados: quotationId=${quotationId || 'N/A'}, policyId=${policyId || 'N/A'}`);
    
    // Iniciar validación en el backend (el backend se encarga de VDID)
    this.validationService.startValidation(validationRequest).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.logger.log('✅ Validación iniciada exitosamente en el backend:', response.data);
          
          // Guardar UUID en el requerimiento
          const requirement = this.validationRequirements.find(req => req.type === validationData.type);
          if (requirement) {
            requirement.uuid = response.data.uuid;
            requirement.completed = false; // Marcar como en progreso
            this.logger.log(`🔑 UUID asignado a ${validationData.type}:`, response.data.uuid);
          }
          
          // Mostrar mensaje de éxito
          this.logger.log(`✅ Enlace de verificación enviado a ${validationData.email}`);
          this.logger.log(`📧 El backend se encargó de crear la verificación VDID y enviar el email`);
          
          // Guardar validationRequirements actualizados en el estado (solo localmente)
          this.wizardStateService.saveState({
            validationRequirements: this.validationRequirements
          });
          
          // ✅ OPTIMIZADO: Sincronizar con debounce para evitar múltiples peticiones
          // Usar saveAndSync solo cuando sea crítico, no en cada cambio
          // La sincronización se hará automáticamente con debounce cuando sea necesario
          
          // ✅ OPTIMIZADO: Iniciar verificación automática si aún no está activa
          if (!this.autoStatusCheckInterval) {
            this.startAutoStatusCheckIfNeeded();
          }
          
          // Cerrar el modal
          this.showValidationModal = false;
          
        } else {
          this.logger.error('❌ Error iniciando validación en el backend:', response.message);
        }
      },
      error: (error) => {
        this.logger.error('❌ Error en servicio de validación:', error);
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

    this.logger.log('🔍 Verificando estado de validaciones pendientes...');

    pendingValidations.forEach(requirement => {
      if (requirement.uuid) {
        this.validationService.getValidationStatus(requirement.uuid).subscribe({
          next: (response) => {
            if (response.success && response.data) {
              const status = response.data.status;
              this.logger.log(`📊 Estado de validación ${requirement.type}:`, status);

              if (status === 'COMPLETED') {
                this.markValidationCompleted(requirement.type);
              }
            }
          },
          error: (error) => {
            this.logger.error(`❌ Error verificando estado de ${requirement.type}:`, error);
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
      this.logger.error('❌ No se puede reenviar: UUID no disponible');
      return;
    }

    this.logger.log(`📧 Reenviando verificación para ${type}...`);

    this.validationService.resendVerification(requirement.uuid).subscribe({
      next: (response) => {
        if (response.success) {
          this.logger.log(`✅ Verificación reenviada exitosamente a ${type}`);
        } else {
          this.logger.error('❌ Error reenviando verificación:', response.message);
        }
      },
      error: (error) => {
        this.logger.error('❌ Error en servicio de reenvío:', error);
      }
    });
  }

  /**
   * Reenviar correo de confirmación de pago
   */
  resendPaymentEmail(): void {
    if (!this.paymentResult || !this.paymentResult.paymentId || this.paymentResult.paymentId === 'N/A') {
      this.logger.error('❌ No se puede reenviar correo de pago: no hay paymentId disponible');
      return;
    }

    this.logger.log(`📧 Reenviando correo de confirmación de pago para paymentId: ${this.paymentResult.paymentId}`);

    this.paymentsService.resendPaymentEmail(this.paymentResult.paymentId).subscribe({
      next: (response) => {
        // El backend devuelve { success: true, message: "..." }
        // Verificar si la respuesta es exitosa (puede estar en response.success o response.data.success)
        const responseData = response.data || response;
        const isSuccess = response.success && (responseData?.success !== false);
        
        if (isSuccess) {
          this.logger.log('✅ Correo de confirmación de pago reenviado exitosamente');
          const message = responseData?.message || response.message || 'Correo de confirmación reenviado exitosamente';
          this.toastService.success(message);
        } else {
          this.logger.error('❌ Error reenviando correo de pago:', responseData?.message || response.message || 'Respuesta inesperada');
          this.toastService.error('Error al reenviar el correo. Por favor, intenta nuevamente.');
        }
      },
      error: (error) => {
        this.logger.error('❌ Error en servicio de reenvío de correo de pago:', error);
        const errorMessage = error?.error?.message || error?.message || 'Error desconocido';
        this.toastService.error(`Error al reenviar el correo: ${errorMessage}`);
      }
    });
  }

  /**
   * Determinar si se necesita iniciar la verificación automática de estado
   * ✅ OPTIMIZADO: Solo inicia si hay validaciones pendientes con UUID
   */
  private startAutoStatusCheckIfNeeded(): void {
    // Verificar si hay validaciones pendientes con UUID
    const pendingValidations = this.validationRequirements.filter(req => 
      req.uuid && !req.completed
    );

    if (pendingValidations.length === 0) {
      this.logger.log('ℹ️ No hay validaciones pendientes con UUID, omitiendo verificación automática');
      return;
    }

    this.logger.log(`⏰ Iniciando verificación automática para ${pendingValidations.length} validación(es) pendiente(s)`);
    this.startAutoStatusCheck();
  }

  /**
   * Iniciar verificación automática de estado
   * ✅ OPTIMIZADO: Solo se llama si hay validaciones pendientes con UUID
   */
  private startAutoStatusCheck(): void {
    // Evitar múltiples intervalos
    if (this.autoStatusCheckInterval) {
      this.logger.log('⏰ Verificación automática ya está activa');
      return;
    }
    
    // Verificar estado cada 30 segundos
    this.autoStatusCheckInterval = setInterval(() => {
      this.checkValidationStatuses();
    }, 30000); // 30 segundos

    this.logger.log('⏰ Verificación automática de estado iniciada (cada 30 segundos)');
  }
  
  /**
   * Limpiar intervalo de verificación automática al destruir el componente
   */
  ngOnDestroy(): void {
    if (this.autoStatusCheckInterval) {
      clearInterval(this.autoStatusCheckInterval);
      this.autoStatusCheckInterval = null;
      this.logger.log('🧹 Verificación automática detenida');
    }
    
    // Resetear flag de inicialización para permitir reinicialización si se vuelve a crear el componente
    this.isInitialized = false;
    this.logger.log('🧹 ValidationStepComponent destruido, flags reseteados');
  }
} 