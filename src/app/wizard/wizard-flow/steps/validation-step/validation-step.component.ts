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
  failed?: boolean;
  errorMessage?: string;
  requiresRetry?: boolean;
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
    
    // ✅ Verificar si ya hay validationRequirements guardados en el estado
    // Primero intentar desde el nivel superior, luego desde stepData.step5
    let validationRequirementsFromState = wizardState.validationRequirements;
    
    // Si no hay en el nivel superior, intentar desde stepData.step6
    if (!validationRequirementsFromState || validationRequirementsFromState.length === 0) {
      validationRequirementsFromState = wizardState.stepData?.step6?.validationRequirements;
      this.logger.log('📋 validationRequirements no encontrado en nivel superior, buscando en stepData.step6...');
    }
    
    if (validationRequirementsFromState && validationRequirementsFromState.length > 0) {
      this.logger.log('📋 Cargando validationRequirements existentes del estado:', validationRequirementsFromState);
      this.logger.log(`📊 Total de validaciones encontradas: ${validationRequirementsFromState.length}`);
      
      // ✅ CRÍTICO: Verificar que se tengan todas las validaciones requeridas según el tipo de usuario
      // Si faltan validaciones, completarlas con las requeridas
      const requiredTypes = this.getRequiredValidationTypes();
      const existingTypes = validationRequirementsFromState.map((r: any) => r.type);
      const missingTypes = requiredTypes.filter((type: string) => !existingTypes.includes(type)) as Array<'arrendador' | 'arrendatario' | 'aval'>;
      
      if (missingTypes.length > 0) {
        this.logger.warning(`⚠️ Faltan validaciones requeridas: ${missingTypes.join(', ')}. Agregándolas...`);
        
        // Agregar las validaciones faltantes
        const missingRequirements: ValidationRequirement[] = missingTypes.map((type: 'arrendador' | 'arrendatario' | 'aval') => {
          const name = this.getValidationNameForType(type);
          return { type, name, required: true, completed: false };
        });
        
        validationRequirementsFromState = [...validationRequirementsFromState, ...missingRequirements];
        this.logger.log(`✅ Validaciones faltantes agregadas. Total ahora: ${validationRequirementsFromState.length}`);
      }
      
      // ✅ Asegurar que validationRequirementsFromState no sea undefined
      if (validationRequirementsFromState && validationRequirementsFromState.length > 0) {
        // ✅ Filtrar duplicados por tipo, manteniendo solo uno por tipo
        const uniqueRequirements = new Map<string, ValidationRequirement>();
        validationRequirementsFromState.forEach((req: ValidationRequirement) => {
          const existing = uniqueRequirements.get(req.type);
          if (!existing) {
            uniqueRequirements.set(req.type, req);
          } else {
            // Si ya existe, mantener el que tenga UUID o esté completado
            if ((req.uuid && !existing.uuid) || (req.completed && !existing.completed)) {
              uniqueRequirements.set(req.type, req);
            }
          }
        });
        
        this.validationRequirements = Array.from(uniqueRequirements.values());
      }
      this.completedValidations = this.validationRequirements.filter(req => req.completed).length;
      this.totalValidations = this.validationRequirements.length;
      this.logger.log(`✅ Validaciones cargadas (duplicados filtrados): ${this.completedValidations}/${this.totalValidations} completadas`);
      this.logger.log(`📋 Detalles de validaciones:`, this.validationRequirements.map(r => ({
        type: r.type,
        name: r.name,
        completed: r.completed,
        failed: r.failed,
        hasUuid: !!r.uuid
      })));
      
      // ✅ Verificar si todas las validaciones están completadas
      if (this.completedValidations === this.validationRequirements.length && this.validationRequirements.length > 0) {
        this.logger.log('🎉 Todas las validaciones completadas (detectado al cargar desde estado)');
        this.logger.log(`📊 Valores: completedValidations=${this.completedValidations}, totalValidations=${this.totalValidations}, validationRequirements.length=${this.validationRequirements.length}`);
        this.validationStatus = 'success';
      } else {
        this.logger.log(`⏳ Validaciones pendientes: ${this.completedValidations}/${this.totalValidations}`);
      }
      
      // ✅ Sincronizar al nivel superior si estaba solo en stepData o si se agregaron validaciones faltantes
      if (!wizardState.validationRequirements || wizardState.validationRequirements.length === 0 || missingTypes.length > 0) {
        this.wizardStateService.saveState({
          validationRequirements: this.validationRequirements
        });
        this.logger.log('✅ validationRequirements sincronizado al nivel superior');
      }
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
    this.logger.log(`📊 Total de validaciones configuradas: ${this.totalValidations}`);
    this.logger.log(`📋 Lista completa de validaciones:`, this.validationRequirements.map(r => ({
      type: r.type,
      name: r.name,
      required: r.required,
      completed: r.completed,
      failed: r.failed,
      hasUuid: !!r.uuid
    })));
    
    // ✅ CRÍTICO: Verificar que todas las validaciones requeridas estén presentes
    if (this.userType === 'arrendador' && this.validationRequirements.length !== 2) {
      this.logger.warning(`⚠️ Para arrendador se esperan 2 validaciones, pero hay ${this.validationRequirements.length}`);
    } else if (this.userType === 'arrendatario' && this.validationRequirements.length !== 2) {
      this.logger.warning(`⚠️ Para arrendatario se esperan 2 validaciones, pero hay ${this.validationRequirements.length}`);
    } else if (this.userType === 'asesor' && this.validationRequirements.length !== 2) {
      this.logger.warning(`⚠️ Para asesor se esperan 2 validaciones, pero hay ${this.validationRequirements.length}`);
    }
  }

  /**
   * Obtiene los tipos de validación requeridos según el tipo de usuario
   */
  private getRequiredValidationTypes(): string[] {
    switch (this.userType) {
      case 'arrendador':
        return ['arrendatario', 'aval'];
      case 'arrendatario':
        return ['arrendador', 'aval'];
      case 'asesor':
        return ['arrendador', 'arrendatario'];
      default:
        return [];
    }
  }

  /**
   * Obtiene el nombre de la validación según el tipo
   */
  private getValidationNameForType(type: string): string {
    switch (type) {
      case 'arrendador':
        return 'Datos del Arrendador';
      case 'arrendatario':
        return 'Datos del Inquilino';
      case 'aval':
        return 'Datos del Aval';
      default:
        return 'Validación';
    }
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
  /**
   * Cargar validaciones existentes por policy_id si está disponible
   * ✅ NUEVO: Siempre consulta el backend por policy_id para verificar si hay validaciones realizadas o pendientes
   */
  private loadExistingValidationsIfNeeded(): void {
    const wizardState = this.wizardStateService.getState();
    const policyId = wizardState.policyId;
    
    if (!policyId) {
      this.logger.log('ℹ️ No hay policyId disponible, saltando carga de validaciones existentes');
      return;
    }
    
    // ✅ SIEMPRE consultar el backend por policy_id para verificar validaciones existentes
    // Esto permite detectar validaciones que ya fueron iniciadas o completadas, incluso si no hay UUIDs en el estado local
    this.logger.log(`🔍 Consultando validaciones existentes por policy_id: ${policyId}`);
    this.loadExistingValidations();
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
          
          // ✅ CRÍTICO: Filtrar validaciones duplicadas del mismo tipo
          // Si hay múltiples validaciones del mismo tipo, mantener solo la más reciente o la completada
          const validationsByType = new Map<string, any>();
          response.data.forEach(existingValidation => {
            const existing = validationsByType.get(existingValidation.type);
            
            if (!existing) {
              // Primera validación de este tipo, agregarla
              validationsByType.set(existingValidation.type, existingValidation);
            } else {
              // Ya existe una validación de este tipo, decidir cuál mantener
              // Prioridad: COMPLETED > más reciente (por completedAt o createdAt)
              const shouldReplace = 
                existingValidation.status === 'COMPLETED' && existing.status !== 'COMPLETED' ||
                (existingValidation.status === existing.status && 
                 new Date(existingValidation.completedAt || existingValidation.createdAt) > 
                 new Date(existing.completedAt || existing.createdAt));
              
              if (shouldReplace) {
                this.logger.log(`🔄 Reemplazando validación ${existingValidation.type} (${existing.status}) por una más reciente o completada (${existingValidation.status})`);
                validationsByType.set(existingValidation.type, existingValidation);
              } else {
                this.logger.log(`ℹ️ Manteniendo validación ${existingValidation.type} existente (${existing.status}), descartando duplicada (${existingValidation.status})`);
              }
            }
          });
          
          // Crear un mapa de validaciones existentes para actualizar (sin duplicados)
          const existingValidationsMap = new Map<string, any>();
          validationsByType.forEach((validation, type) => {
            existingValidationsMap.set(type, validation);
          });
          
          this.logger.log(`📋 Validaciones únicas después de filtrar duplicados: ${existingValidationsMap.size}`, 
            Array.from(existingValidationsMap.entries()).map(([type, v]) => ({ type, status: v.status, uuid: v.uuid })));
          
          // ✅ CRÍTICO: Verificar que validationRequirements tenga todas las validaciones requeridas antes de actualizar
          if (!this.validationRequirements || this.validationRequirements.length === 0) {
            this.logger.error(`❌ ERROR: validationRequirements está vacío antes de actualizar desde BD`);
            // Si está vacío, no podemos continuar, las validaciones deberían haberse configurado en setupValidationRequirements()
            return;
          }
          
          this.logger.log(`📋 Validaciones requeridas ANTES de actualizar desde BD: ${this.validationRequirements.length}`, 
            this.validationRequirements.map(r => ({ type: r.type, name: r.name, hasUuid: !!r.uuid })));
          
          // ✅ CRÍTICO: Actualizar validationRequirements, manteniendo TODAS las requeridas
          // Si una validación no existe en la BD, mantenerla como pendiente (sin UUID)
          this.validationRequirements = this.validationRequirements.map(requirement => {
            const existingValidation = existingValidationsMap.get(requirement.type);
            
            if (existingValidation) {
              // ✅ Actualizar UUID si existe
              if (existingValidation.uuid) {
                requirement.uuid = existingValidation.uuid;
              }
              
              // ✅ Actualizar estado según el status de la validación
              // IMPORTANTE: Si está COMPLETED o FAILED, no se consultará más la API
              requirement.completed = existingValidation.status === 'COMPLETED';
              requirement.failed = existingValidation.status === 'FAILED';
              
              // ✅ Si está pendiente o en progreso, marcar como no completada pero con UUID
              // Estas son las únicas que se seguirán consultando
              if (existingValidation.status === 'PENDING' || existingValidation.status === 'IN_PROGRESS') {
                requirement.completed = false;
                requirement.failed = false;
                requirement.requiresRetry = false;
                requirement.errorMessage = undefined;
              }
              
              // ✅ Si está fallida, obtener el mensaje de error del vdidResult
              if (requirement.failed && existingValidation.vdidResult) {
                requirement.errorMessage = existingValidation.vdidResult.globalResultDescription || 'Error en la validación';
                requirement.requiresRetry = true;
              }
              
              // ✅ Si está completada o fallida, no se consultará más la API hasta nueva solicitud
              if (requirement.completed || requirement.failed) {
                this.logger.log(`✅ Validación ${existingValidation.type} está ${existingValidation.status}, no se consultará más la API hasta nueva solicitud`);
              }
              
              this.logger.log(`🔄 Actualizado requirement para ${existingValidation.type}:`, {
                uuid: requirement.uuid,
                completed: requirement.completed,
                failed: requirement.failed,
                status: existingValidation.status,
                errorMessage: requirement.errorMessage,
                requiresRetry: requirement.requiresRetry
              });
            } else {
              // ✅ CRÍTICO: Si la validación no existe en la BD, mantenerla como pendiente
              // Esto asegura que se muestre el botón "Iniciar Validación VDID"
              this.logger.log(`ℹ️ Validación ${requirement.type} no iniciada aún, manteniendo como pendiente`);
              // No hacer nada, mantener el requirement como está (pendiente, sin UUID)
            }
            
            return requirement;
          });
          
          // ✅ Resetear contador de validaciones completadas después de actualizar
          this.completedValidations = this.validationRequirements.filter(req => req.completed).length;
          
          // ✅ CRÍTICO: Verificar que todas las validaciones requeridas se mantuvieron después de actualizar
          this.logger.log(`📋 Validaciones requeridas DESPUÉS de actualizar desde BD: ${this.validationRequirements.length}`, 
            this.validationRequirements.map(r => ({ 
              type: r.type, 
              name: r.name, 
              completed: r.completed, 
              failed: r.failed,
              hasUuid: !!r.uuid 
            })));
          
          // ✅ CRÍTICO: Actualizar totalValidations para asegurar que coincida con el número de validaciones requeridas
          this.totalValidations = this.validationRequirements.length;
          
          if (this.totalValidations < 2) {
            this.logger.error(`❌ ERROR: Se perdieron validaciones durante la actualización. Total actual: ${this.totalValidations}, se esperan al menos 2`);
          }
          
          // ✅ Verificar si todas las validaciones están completadas y actualizar validationStatus
          if (this.completedValidations === this.totalValidations && this.totalValidations > 0) {
            this.logger.log('🎉 Todas las validaciones completadas (detectado al cargar desde BD)');
            this.validationStatus = 'success';
            this.logger.log('🚀 El usuario puede continuar al siguiente paso');
          }
          
          // ✅ Actualizar el estado con los validationRequirements actualizados
          this.wizardStateService.saveState({
            validationRequirements: this.validationRequirements
          });
          
          // ✅ Resumen de validaciones encontradas (usar validaciones únicas)
          const uniqueValidations = Array.from(existingValidationsMap.values());
          const completed = uniqueValidations.filter(v => v.status === 'COMPLETED').length;
          const pending = uniqueValidations.filter(v => v.status === 'PENDING' || v.status === 'IN_PROGRESS').length;
          const failed = uniqueValidations.filter(v => v.status === 'FAILED').length;
          
          this.logger.log(`📊 Resumen de validaciones para policyId ${policyId}:`, {
            totalEnBD: response.data.length,
            totalUnicas: uniqueValidations.length,
            duplicadosFiltrados: response.data.length - uniqueValidations.length,
            completadas: completed,
            pendientes: pending,
            fallidas: failed,
            totalRequeridas: this.totalValidations,
            completadasEnUI: this.completedValidations,
            enUI: `${this.completedValidations}/${this.totalValidations}`,
            validationStatus: this.validationStatus
          });
        } else {
          // ✅ CRÍTICO: Si no hay validaciones en la BD, asegurar que todas las requeridas estén presentes
          // Las validaciones ya fueron configuradas en setupValidationRequirements()
          // Solo asegurarnos de que se guarden en el estado
          this.logger.log(`ℹ️ No se encontraron validaciones existentes para policyId ${policyId} - todas las validaciones están pendientes de iniciar`);
          this.logger.log(`📋 Validaciones requeridas configuradas: ${this.validationRequirements.length}`, this.validationRequirements);
          
          // ✅ Asegurar que todas las validaciones requeridas estén guardadas en el estado
          if (this.validationRequirements && this.validationRequirements.length > 0) {
            this.wizardStateService.saveState({
              validationRequirements: this.validationRequirements
            });
            this.logger.log(`✅ Validaciones requeridas guardadas en el estado: ${this.validationRequirements.length}`);
          }
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
   * Marcar validación como fallida
   */
  /**
   * Marcar validación como fallida
   * ✅ OPTIMIZADO: Detiene el auto-check si todas las validaciones están completadas o fallidas
   */
  markValidationFailed(type: string, validationData: any): void {
    const requirement = this.validationRequirements.find(req => req.type === type);
    if (requirement) {
      requirement.completed = false;
      requirement.failed = true;
      requirement.errorMessage = validationData.globalResultDescription || 'Error en la validación';
      requirement.requiresRetry = true; // Siempre requiere reintentar cuando falla
      
      this.logger.error(`❌ Validación ${type} fallida:`, {
        globalResult: validationData.globalResult,
        errorMessage: requirement.errorMessage
      });
      
      // Mostrar toast con el error
      const personType = type === 'arrendatario' ? 'inquilino' : 
                        type === 'aval' ? 'fiador' : 'propietario';
      this.toastService.error(`Validación fallida (${personType}): ${requirement.errorMessage}. Por favor, intenta nuevamente.`);
      
      // Guardar estado
      this.wizardStateService.saveState({
        validationRequirements: this.validationRequirements
      });
      
      // ✅ Verificar si hay validaciones pendientes (no completadas ni fallidas)
      const pendingValidations = this.validationRequirements.filter(req => 
        req.uuid && !req.completed && !req.failed
      );
      
      // ✅ Si no hay validaciones pendientes, detener el auto-check
      if (pendingValidations.length === 0) {
        this.stopAutoStatusCheck();
        this.logger.log('✅ Todas las validaciones están completadas o fallidas, deteniendo verificación automática');
      }
    }
  }

  /**
   * Marcar validación como completada
   * ✅ OPTIMIZADO: Detiene el auto-check si todas las validaciones están completadas o fallidas
   */
  markValidationCompleted(type: string): void {
    const requirement = this.validationRequirements.find(req => req.type === type);
    if (requirement && !requirement.completed) {
      requirement.completed = true;
      requirement.failed = false; // Asegurar que no esté marcada como fallida
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
      
      // ✅ Verificar si hay validaciones pendientes (no completadas ni fallidas)
      const pendingValidations = this.validationRequirements.filter(req => 
        req.uuid && !req.completed && !req.failed
      );
      
      // ✅ Si no hay validaciones pendientes, detener el auto-check
      if (pendingValidations.length === 0) {
        this.stopAutoStatusCheck();
        this.logger.log('✅ Todas las validaciones están completadas o fallidas, deteniendo verificación automática');
      }
      
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
    
    // Buscar el requerimiento correspondiente
    const requirement = this.validationRequirements.find(req => req.type === type);
    
    // Si ya tenemos un UUID para esta validación
    if (requirement && requirement.uuid) {
      // Si la validación falló, permitir reiniciar abriendo el modal
      if (requirement.failed) {
        this.logger.log(`🔄 Reiniciando validación fallida para ${type}, UUID anterior: ${requirement.uuid}`);
        // Limpiar el UUID anterior para crear una nueva validación
        requirement.uuid = undefined;
        requirement.failed = false;
        requirement.errorMessage = undefined;
        requirement.requiresRetry = false;
        // Abrir el modal para recoger datos y crear una nueva validación
        this.showValidationModal = true;
      } else {
        // Si la validación está en progreso o completada, solo mostrar información
        this.logger.log(`🔑 Validación ya iniciada para ${type}, UUID: ${requirement.uuid}`);
        // Mostrar información de la validación en progreso
      }
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
            requirement.failed = false; // Limpiar estado de fallo si se reinicia
            requirement.errorMessage = undefined; // Limpiar mensaje de error
            requirement.requiresRetry = false; // Limpiar flag de reintento
            this.logger.log(`🔑 UUID asignado a ${validationData.type}:`, response.data.uuid);
          }
          
          // Mostrar mensaje de éxito
          this.logger.log(`✅ Enlace de verificación enviado a ${validationData.email}`);
          this.logger.log(`📧 El backend se encargó de crear la verificación VDID y enviar el email`);
          
          // Mostrar toast de éxito
          const personType = validationData.type === 'arrendatario' ? 'inquilino' : 
                            validationData.type === 'aval' ? 'fiador' : 'propietario';
          this.toastService.success(`Correo de validación enviado exitosamente a ${validationData.email} (${personType})`);
          
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
          this.toastService.error(response.message || 'Error al enviar el correo de validación. Por favor, intenta nuevamente.');
        }
      },
      error: (error) => {
        this.logger.error('❌ Error en servicio de validación:', error);
        const errorMessage = error?.error?.message || error?.message || 'Error al enviar el correo de validación';
        this.toastService.error(`Error al enviar el correo: ${errorMessage}`);
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
   * ✅ OPTIMIZADO: Solo consulta validaciones que están PENDING o IN_PROGRESS
   * No consulta validaciones que ya están COMPLETED o FAILED
   */
  checkValidationStatuses(): void {
    // ✅ Solo consultar validaciones que tienen UUID y NO están completadas ni fallidas
    const pendingValidations = this.validationRequirements.filter(req => 
      req.uuid && !req.completed && !req.failed
    );

    if (pendingValidations.length === 0) {
      // ✅ Si no hay validaciones pendientes, detener el auto-check
      this.stopAutoStatusCheck();
      this.logger.log('ℹ️ No hay validaciones pendientes, deteniendo verificación automática');
      return;
    }

    this.logger.log(`🔍 Verificando estado de ${pendingValidations.length} validación(es) pendiente(s)...`);

    pendingValidations.forEach(requirement => {
      if (requirement.uuid) {
        this.validationService.getValidationStatus(requirement.uuid).subscribe({
          next: (response) => {
            if (response.success && response.data) {
              const status = response.data.status;
              this.logger.log(`📊 Estado de validación ${requirement.type}:`, status);

              if (status === 'COMPLETED') {
                this.markValidationCompleted(requirement.type);
              } else if (status === 'FAILED') {
                // Marcar como fallida y mostrar el error
                this.markValidationFailed(requirement.type, response.data);
              }
              // ✅ Si está PENDING o IN_PROGRESS, no hacer nada (se seguirá consultando en el próximo ciclo)
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
          const personType = type === 'arrendatario' ? 'inquilino' : 
                            type === 'aval' ? 'fiador' : 'propietario';
          const message = response.data?.message || response.message || `Correo de validación reenviado exitosamente (${personType})`;
          this.toastService.success(message);
        } else {
          this.logger.error('❌ Error reenviando verificación:', response.message);
          this.toastService.error(response.message || 'Error al reenviar el correo de validación. Por favor, intenta nuevamente.');
        }
      },
      error: (error) => {
        this.logger.error('❌ Error en servicio de reenvío:', error);
        const errorMessage = error?.error?.message || error?.message || 'Error al reenviar el correo';
        this.toastService.error(`Error al reenviar el correo: ${errorMessage}`);
      }
    });
  }

  /**
   * Reenviar correo de confirmación de pago
   */
  resendPaymentEmail(): void {
    // Si no hay paymentResult, no se puede reenviar
    if (!this.paymentResult) {
      this.logger.error('❌ No se puede reenviar correo de pago: no hay paymentResult disponible');
      return;
    }

    // Obtener policyId del paymentResult o del wizardState
    const policyId = this.paymentResult.policyId || this.wizardStateService.getState().policyId;
    
    // Si paymentId es 'N/A' o no está disponible, usar policyId
    const paymentId = this.paymentResult.paymentId;
    const hasValidPaymentId = paymentId && paymentId !== 'N/A';

    if (!hasValidPaymentId && !policyId) {
      this.logger.error('❌ No se puede reenviar correo de pago: no hay paymentId ni policyId disponible');
      this.toastService.error('No se puede reenviar el correo: faltan datos del pago');
      return;
    }

    // Si no hay paymentId válido pero hay policyId, usar el endpoint por policyId
    if (!hasValidPaymentId && policyId) {
      this.logger.log(`📧 Reenviando correo de confirmación de pago por policyId: ${policyId}`);
      this.paymentsService.resendPaymentEmailByPolicyId(policyId).subscribe({
        next: (response) => {
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
      return;
    }

    // Si hay paymentId válido, usar el endpoint normal (puede incluir policyId como fallback)
    this.logger.log(`📧 Reenviando correo de confirmación de pago para paymentId: ${paymentId}${policyId ? ` (con policyId de respaldo: ${policyId})` : ''}`);

    this.paymentsService.resendPaymentEmail(paymentId, policyId).subscribe({
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
    // ✅ Verificar si hay validaciones pendientes con UUID que NO estén completadas ni fallidas
    const pendingValidations = this.validationRequirements.filter(req => 
      req.uuid && !req.completed && !req.failed
    );

    if (pendingValidations.length === 0) {
      this.logger.log('ℹ️ No hay validaciones pendientes con UUID (todas están completadas o fallidas), omitiendo verificación automática');
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
   * Detener verificación automática de estado
   * ✅ NUEVO: Se llama cuando todas las validaciones están completadas o fallidas
   */
  private stopAutoStatusCheck(): void {
    if (this.autoStatusCheckInterval) {
      clearInterval(this.autoStatusCheckInterval);
      this.autoStatusCheckInterval = null;
      this.logger.log('🛑 Verificación automática detenida (todas las validaciones están completadas o fallidas)');
    }
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