import { Component, OnInit, HostListener } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormGroup } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { WelcomeStepComponent } from './steps/welcome-step/welcome-step.component';
import { MainDataStepComponent } from './steps/main-data-step/main-data-step.component';
import { DataEntryStepComponent } from './steps/data-entry-step/data-entry-step.component';
import { PaymentStepComponent } from './steps/payment-step/payment-step.component';
import { ValidationStepComponent } from './steps/validation-step/validation-step.component';
import { ContractStepComponent } from './steps/contract-step/contract-step.component';
import { FinishStepComponent } from './steps/finish-step/finish-step.component';
import { SeoService } from '../services/seo.service';
import { WizardStateService, WizardState } from '../services/wizard-state.service';
import { WizardSessionService } from '../services/wizard-session.service';
import { ContinueWizardModalComponent } from '../components/continue-wizard-modal/continue-wizard-modal.component';

@Component({
  selector: 'app-wizard-flow',
  standalone: true,
  imports: [
    CommonModule,
    WelcomeStepComponent,
    MainDataStepComponent,
    DataEntryStepComponent,
    PaymentStepComponent,
    ValidationStepComponent,
    ContractStepComponent,
    FinishStepComponent,
    ContinueWizardModalComponent
  ],
  templateUrl: './wizard-flow.component.html',
  styleUrls: ['./wizard-flow.component.scss']
})
export class WizardFlowComponent implements OnInit {
  // Propiedades del wizard
  // Setter personalizado para rastrear cambios en currentStep
  set currentStep(value: number) {
    const oldValue = this._currentStep || 0;
    this._currentStep = value;
    
    console.log('🔄 currentStep cambiado:', {
      de: oldValue,
      a: value,
      stepNameDe: this.getStepName(oldValue),
      stepNameA: this.getStepName(value),
      stackTrace: new Error().stack?.split('\n').slice(1, 4).join('\n')
    });
  }

  get currentStep(): number {
    return this._currentStep || 0;
  }

  private _currentStep: number = 0;
  selectedPlan = '';
  selectedPlanName = '';
  quotationId = '';
  quotationNumber = '';
  userId = '';
  currentQuotation: any = null;
  quotationSentByEmail = false;
  isStateRestored = false;
  showContinueModal = false;
  
  // Variables específicas para el modal (como en lp-content.component.ts)
  modalCurrentStep = 0;
  modalSelectedPlan: string | null = null;
  modalSelectedPlanName: string | null = null;
  modalQuotationNumber: string | null = null;
  modalPolicyNumber: string | null = null;
  modalCompletedSteps = 0;
  
  canGoBack = true;

  // Datos de la cotización
  // currentQuotation: any = null;
  // quotationId: string | null = null;
  // userId: string | null = null;

  steps = [
    { key: 'welcome', label: 'Bienvenida' },
    { key: 'main-data', label: 'Datos principales' },
    { key: 'payment', label: 'Pago' },
    { key: 'validation', label: 'Validación' },
    { key: 'data-entry', label: 'Captura de datos' },
    { key: 'contract', label: 'Contrato' },
    { key: 'finish', label: 'Final' }
  ];

  validationStatus: 'pending' | 'success' | 'intermediate' | 'failed' = 'pending';
  // quotationSentByEmail: boolean = false;
  // quotationNumber: string = '';
  isFromQuotationUrl: boolean = false;
  // canGoBack: boolean = true;
  // isStateRestored = false; // Flag para controlar si el estado ya fue restaurado

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private seoService: SeoService,
    public wizardStateService: WizardStateService,
    private wizardSessionService: WizardSessionService
  ) {}

  ngOnInit() {
    console.log('🚀 ngOnInit iniciado - Estado inicial:', {
      currentStep: this.currentStep,
      stepName: this.getStepName(this.currentStep),
      wizardStateCurrentStep: this.wizardStateService.getState().currentStep
    });
    
    // Verificar si llegamos desde URL del cotizador
    this.handleUrlParameters();
    
    // Restaurar estado del wizard después de manejar parámetros de URL
    this.restoreWizardState();
    
    // Configurar SEO
    this.setupSEO();
    
    console.log('🚀 ngOnInit completado - Estado final:', {
      currentStep: this.currentStep,
      stepName: this.getStepName(this.currentStep),
      wizardStateCurrentStep: this.wizardStateService.getState().currentStep
    });
  }

  /**
   * Listener para detectar actividad del usuario
   */
  @HostListener('document:click')
  @HostListener('document:keydown')
  @HostListener('document:scroll')
  onUserActivity(): void {
    this.wizardStateService.updateActivity();
  }

  /**
   * Listener para detectar cuando la página se va a recargar
   */
  @HostListener('window:beforeunload')
  onBeforeUnload(): void {
    // Guardar estado antes de recargar
    this.wizardStateService.saveState({
      currentStep: this.currentStep,
      selectedPlan: this.selectedPlan,
      quotationId: this.quotationId,
      quotationNumber: this.quotationNumber || '',
      userId: this.userId
    });
  }

  /**
   * Manejar parámetros de la URL del cotizador
   */
  private handleUrlParameters(): void {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const sessionId = urlParams.get('session');
      const step = urlParams.get('step');
      const planId = urlParams.get('plan');
      
      if (sessionId) {
        console.log('🎯 WIZARD SessionId detectado en URL:', { sessionId, step });
        
        // Cargar el estado de la sesión existente
        this.loadSessionState(sessionId, step ? parseInt(step) : undefined);
        
      } else if (planId) {
        console.log('🎯 Plan detectado en URL (modo legacy):', planId);
        
        // Crear nueva sesión con el plan seleccionado
        this.createNewSessionWithPlan(planId);
        
      } else {
        // Si no hay sessionId ni plan, crear nueva sesión
        console.log('🆕 Creando nueva sesión');
        this.initializeNewSession();
      }
    }
  }

  /**
   * Cargar estado de sesión existente
   */
  private async loadSessionState(sessionId: string, targetStep?: number): Promise<void> {
    try {
      // PRIMERO: Intentar usar el sessionId de la URL
      try {
        console.log('🔍 Intentando cargar sesión desde URL:', sessionId);
        const sessionData = await this.wizardSessionService.getSession(sessionId).toPromise();
        console.log('📡 Respuesta del backend para sesión:', sessionData);
        
        if (sessionData) {
          // Verificar si viene envuelto en ApiResponse o directamente
          const actualData = (sessionData as any).data || sessionData;
          
          if (actualData && actualData.sessionId) {
            console.log('📊 Estado de sesión cargado desde URL:', actualData);
            this.restoreSessionState(actualData, targetStep);
            return;
          }
        }
      } catch (error) {
        console.log('⚠️ Sesión de URL no encontrada, buscando sesión activa por IP');
        console.error('❌ Error detallado:', error);
      }
      
      // SEGUNDO: Si no funciona, buscar sesión activa por IP (sin crear nueva)
      const activeSessionId = await this.wizardStateService.checkActiveSessionByIp();
      
      if (activeSessionId) {
        // TERCERO: Obtener el estado de la sesión activa desde el backend
        const sessionData = await this.wizardSessionService.getSession(activeSessionId).toPromise();
        
        if (sessionData) {
          // Verificar si viene envuelto en ApiResponse o directamente
          const actualData = (sessionData as any).data || sessionData;
          
          if (actualData && actualData.sessionId) {
            console.log('📊 Estado de sesión cargado desde IP:', actualData);
            this.restoreSessionState(actualData, targetStep);
            return;
          }
        }
      }
      
      // CUARTO: Si no hay sesión activa, crear nueva
      console.log('⚠️ No hay sesión activa, creando nueva');
      this.initializeNewSession();
      
    } catch (error) {
      console.error('❌ Error cargando sesión:', error);
      this.initializeNewSession();
    }
  }

  private restoreSessionState(sessionData: any, targetStep?: number): void {
    console.log('🔄 restoreSessionState llamado con:', {
      sessionDataCurrentStep: sessionData.currentStep,
      targetStep: targetStep,
      sessionId: sessionData.sessionId,
      policyId: sessionData.policyId,
      policyNumber: sessionData.policyNumber,
      paymentResult: sessionData.paymentResult
    });
    
    // Restaurar el estado del wizard
    this.currentStep = targetStep || sessionData.currentStep;
    
    console.log('🎯 currentStep establecido:', {
      targetStep: targetStep,
      sessionDataCurrentStep: sessionData.currentStep,
      finalCurrentStep: this.currentStep,
      hasPolicyData: !!(sessionData.policyId && sessionData.policyNumber),
      stepName: this.getStepName(this.currentStep)
    });
    
    console.log('🔍 Verificando estado del wizard después de establecer currentStep:', {
      currentStep: this.currentStep,
      stepName: this.getStepName(this.currentStep),
      wizardStateCurrentStep: this.wizardStateService.getState().currentStep
    });
    
    this.selectedPlan = sessionData.selectedPlan || ''; // ✅ Usar objeto principal
    this.selectedPlanName = sessionData.selectedPlanName || ''; // ✅ Agregar selectedPlanName
    this.quotationId = sessionData.quotationId || '';
    this.quotationNumber = sessionData.quotationNumber || ''; // ✅ Usar objeto principal
    this.userId = sessionData.userId || '';
    
    console.log('📊 Datos restaurados para el modal:', {
      currentStep: this.currentStep,
      selectedPlan: this.selectedPlan,
      selectedPlanName: this.selectedPlanName,
      quotationNumber: this.quotationNumber,
      quotationId: this.quotationId
    });
    
    // Llenar variables específicas del modal con datos reales de la BD
    this.modalCurrentStep = this.currentStep;
    this.modalSelectedPlan = this.selectedPlan;
    this.modalSelectedPlanName = this.selectedPlanName;
    this.modalQuotationNumber = this.quotationNumber;
    this.modalPolicyNumber = sessionData.policyNumber || null;
    this.modalCompletedSteps = this.calculateCompletedSteps(sessionData.stepData || {});
    
    console.log('🔍 stepData usado para calcular progreso:', sessionData.stepData);
    
    console.log('📊 Variables del modal llenadas:', {
      modalCurrentStep: this.modalCurrentStep,
      modalSelectedPlan: this.modalSelectedPlan,
      modalQuotationNumber: this.modalQuotationNumber,
      modalCompletedSteps: this.modalCompletedSteps
    });
    
    // Sincronizar completamente el estado local con los datos de la BD
    this.syncLocalStateWithBD(sessionData);
    
    // Sincronizar el currentStep con wizardStateService
    this.wizardStateService.saveState({ currentStep: this.currentStep });
    
    console.log('🔄 currentStep sincronizado con wizardStateService:', this.currentStep);
    
    // Verificar si hay conflicto después de sincronizar
    const wizardStateAfterSync = this.wizardStateService.getState();
    console.log('🔍 Estado del wizard después de sincronizar:', {
      componentCurrentStep: this.currentStep,
      wizardStateCurrentStep: wizardStateAfterSync.currentStep,
      areTheyEqual: this.currentStep === wizardStateAfterSync.currentStep
    });
    
    // Configurar navegación
    this.canGoBack = targetStep ? false : true;
    this.isFromQuotationUrl = !!targetStep;
    
    console.log('✅ Estado de sesión restaurado y sincronizado con BD');
    
    // Mostrar modal de continuar si se refrescó la página (no si se navegó desde selección de plan)
    const navigatedFromPlan = sessionStorage.getItem('navigatedFromPlan') === 'true';
    const isPageRefresh = !navigatedFromPlan;
    
    console.log('🔍 Verificando si mostrar modal en restoreSessionState:', {
      currentStep: this.currentStep,
      navigatedFromPlan: navigatedFromPlan,
      isPageRefresh: isPageRefresh,
      shouldShowModal: this.currentStep > 0 && isPageRefresh
    });
    
    if (this.currentStep > 0 && isPageRefresh) {
      console.log('🎯 Mostrando modal de continuar (refresco de página)');
      setTimeout(() => {
        this.showContinueModal = true;
      }, 500); // Pequeño delay para asegurar que la UI esté lista
    } else {
      console.log('🚫 No se muestra modal:', {
        reason: this.currentStep <= 0 ? 'Paso inicial' : 'Navegación desde plan'
      });
    }
    
    // Limpiar la marca de navegación desde plan
    sessionStorage.removeItem('navigatedFromPlan');
  }

  /**
   * Sincroniza el estado local con los datos de la base de datos
   */
  private syncLocalStateWithBD(sessionData: any): void {
    const stepData = sessionData.stepData || {};
    
    // Crear estado local con estructura completa del backend
    const localState: any = {
      // Campos principales del backend (estructura completa)
      id: sessionData.id,
      sessionId: sessionData.sessionId,
      userId: sessionData.userId || undefined,
      currentStep: sessionData.currentStep || 0,
      stepData: stepData,
      completedSteps: sessionData.completedSteps || [],
      status: sessionData.status || 'ACTIVE',
      expiresAt: sessionData.expiresAt ? new Date(sessionData.expiresAt) : undefined,
      quotationId: sessionData.quotationId || undefined,
      policyId: sessionData.policyId || undefined,
      metadata: sessionData.metadata || {},
      publicIp: sessionData.publicIp || undefined,
      userAgent: sessionData.userAgent || undefined,
      lastActivityAt: sessionData.lastActivityAt ? new Date(sessionData.lastActivityAt) : undefined,
      completedAt: sessionData.completedAt ? new Date(sessionData.completedAt) : undefined,
      createdAt: sessionData.createdAt ? new Date(sessionData.createdAt) : undefined,
      updatedAt: sessionData.updatedAt ? new Date(sessionData.updatedAt) : undefined,
      
      // Campos de control del frontend
      timestamp: Date.now(),
      lastActivity: Date.now(),
      
      // Campos derivados (para compatibilidad) - usar objeto principal del backend
      selectedPlan: sessionData.selectedPlan || '',
      selectedPlanName: sessionData.selectedPlanName || '',
      quotationNumber: sessionData.quotationNumber || '',
      userData: sessionData.userData || null,
      paymentData: sessionData.paymentData || null,
      contractData: sessionData.contractData || null,
      paymentResult: sessionData.paymentResult || stepData.step5?.validationData || null,
      
      // Campos adicionales para compatibilidad - usar objeto principal del backend
      policyNumber: sessionData.policyNumber || stepData.step5?.policyNumber || stepData.step4?.policyNumber || '',
      paymentAmount: sessionData.paymentAmount || stepData.step4?.paymentAmount || stepData.step5?.paymentAmount || 0,
      validationResult: sessionData.validationResult || stepData.step5?.validationData || null
    };

    console.log('🔄 Sincronizando estado local con BD (estructura completa):', {
      id: localState.id,
      sessionId: localState.sessionId,
      currentStep: localState.currentStep,
      status: localState.status,
      expiresAt: localState.expiresAt,
      selectedPlan: localState.selectedPlan,
      policyId: localState.policyId,
      policyNumber: localState.policyNumber,
      paymentResult: localState.paymentResult,
      quotationId: localState.quotationId,
      completedSteps: localState.completedSteps,
      stepDataKeys: Object.keys(localState.stepData),
      metadata: localState.metadata
    });

    // Guardar el estado completo en el servicio local
    this.wizardStateService.saveState(localState);
  }

  /**
   * Calcula los pasos completados basado en los datos de la BD
   */
  private calculateCompletedStepsFromBD(stepData: any): number[] {
    const completedSteps: number[] = [];
    
    // Verificar cada paso basado en los datos disponibles
    if (stepData.step1 && stepData.step1.selectedPlan) {
      completedSteps.push(1);
    }
    if (stepData.step2 && stepData.step2.userData) {
      completedSteps.push(2);
    }
    if (stepData.step3 && stepData.step3.quotationData) {
      completedSteps.push(3);
    }
    if (stepData.step4 && stepData.step4.paymentData) {
      completedSteps.push(4);
    }
    if (stepData.step5 && stepData.step5.validationData) {
      completedSteps.push(5);
    }
    if (stepData.step6 && stepData.step6.confirmationData) {
      completedSteps.push(6);
    }
    if (stepData.step7 && stepData.step7.propertyData) {
      completedSteps.push(7);
    }
    if (stepData.step8 && stepData.step8.contractData) {
      completedSteps.push(8);
    }
    
    return completedSteps;
  }

  /**
   * Inicializar nueva sesión
   */
  private initializeNewSession(): void {
    console.log('🆕 initializeNewSession llamado:', {
      currentStepAntes: this.currentStep,
      stepNameAntes: this.getStepName(this.currentStep)
    });
    
    // NO sobrescribir currentStep si ya se estableció desde la sesión del backend
    if (this.currentStep === 0) {
      console.log('✅ Estableciendo currentStep = 0 (nueva sesión)');
      this.currentStep = 0;
    } else {
      console.log('✅ Manteniendo currentStep establecido desde sesión:', {
        currentStep: this.currentStep,
        razon: 'Ya establecido desde sesión del backend'
      });
    }
    
    this.canGoBack = true;
    this.isFromQuotationUrl = false;
    
    // El WizardStateService ya maneja la creación de sesión automáticamente
    console.log('✅ Nueva sesión inicializada');
  }

  /**
   * Crear nueva sesión con plan seleccionado
   */
  private createNewSessionWithPlan(planId: string): void {
    console.log('🆕 createNewSessionWithPlan llamado:', {
      planId: planId,
      currentStepAntes: this.currentStep,
      stepNameAntes: this.getStepName(this.currentStep)
    });
    
    // Establecer el plan seleccionado
    this.selectedPlan = planId;
    
    // NO sobrescribir currentStep si ya se estableció desde la sesión del backend
    if (this.currentStep === 0) {
      console.log('✅ Estableciendo currentStep = 0 (nueva sesión)');
      this.currentStep = 0;
    } else {
      console.log('✅ Manteniendo currentStep establecido desde sesión:', {
        currentStep: this.currentStep,
        razon: 'Ya establecido desde sesión del backend'
      });
    }
    this.canGoBack = true;
    this.isFromQuotationUrl = false;
    
    // Guardar el plan en el estado del wizard
    this.wizardStateService.saveState({ 
      selectedPlan: planId,
      currentStep: 0 
    });
    
    // Redirigir a la URL con sessionId para futuras referencias
    const currentState = this.wizardStateService.getState();
    const sessionId = currentState.sessionId;
    
    if (sessionId) {
      // Reemplazar la URL actual con sessionId
      const newUrl = `/cotizador?session=${sessionId}`;
      window.history.replaceState({}, '', newUrl);
      console.log('🔄 URL actualizada con sessionId:', newUrl);
    }
    
    console.log('✅ Nueva sesión con plan inicializada');
  }

  /**
   * Restaura el estado del wizard desde el almacenamiento
   */
  private restoreWizardState(): void {
    console.log('🔄 restoreWizardState iniciado - Estado antes:', {
      currentStep: this.currentStep,
      stepName: this.getStepName(this.currentStep),
      isFromQuotationUrl: this.isFromQuotationUrl
    });
    
    // Solo restaurar si no es desde URL de cotización
    if (this.isFromQuotationUrl) {
      console.log('🔄 No restaurando estado - llegamos desde URL de cotización');
      return;
    }

    if (this.wizardStateService.hasSavedState()) {
      const savedState = this.wizardStateService.getState();
      
      console.log('🔄 Evaluando si sobrescribir currentStep:', {
        currentStepAntes: this.currentStep,
        savedStateCurrentStep: savedState.currentStep,
        stepNameAntes: this.getStepName(this.currentStep),
        stepNameDespues: this.getStepName(savedState.currentStep),
        shouldOverride: false // NUNCA sobrescribir si ya se estableció desde sesión
      });
      
      // NUNCA sobrescribir currentStep si ya se estableció desde la sesión del backend
      // Solo restaurar otros campos, pero mantener el currentStep establecido desde la sesión
      console.log('✅ Manteniendo currentStep establecido desde sesión:', {
        currentStep: this.currentStep,
        razon: 'Ya establecido desde sesión del backend con lógica inteligente'
      });
      this.selectedPlan = savedState.selectedPlan || '';
      this.quotationId = savedState.quotationId || '';
      this.quotationNumber = savedState.quotationNumber || '';
      this.userId = savedState.userId || '';
      
      console.log('🔄 Estado del wizard restaurado:', {
        step: this.currentStep,
        stepName: this.getStepName(this.currentStep),
        plan: this.selectedPlan,
        quotation: this.quotationId,
        user: this.userId
      });
      
      // Llenar variables específicas del modal con datos del estado local
      this.modalCurrentStep = this.currentStep;
      this.modalSelectedPlan = this.selectedPlan;
      this.modalSelectedPlanName = this.selectedPlanName;
      this.modalQuotationNumber = this.quotationNumber;
      this.modalPolicyNumber = savedState.policyNumber || null;
      this.modalCompletedSteps = this.calculateCompletedSteps(savedState.stepData || {});
      
      console.log('📊 Variables del modal llenadas desde estado local:', {
        modalCurrentStep: this.modalCurrentStep,
        modalSelectedPlan: this.modalSelectedPlan,
        modalQuotationNumber: this.modalQuotationNumber,
        modalCompletedSteps: this.modalCompletedSteps
      });
      
      this.isStateRestored = true;
      
      // Solo mostrar modal de continuar si se refrescó la página (no si se navegó desde selección de plan)
      // El modal ya se mostró en lp-content.component.ts cuando se seleccionó el plan
      const navigatedFromPlan = sessionStorage.getItem('navigatedFromPlan') === 'true';
      const isPageRefresh = !navigatedFromPlan;
      
      console.log('🔍 Verificando si mostrar modal:', {
        currentStep: this.currentStep,
        navigatedFromPlan: navigatedFromPlan,
        isPageRefresh: isPageRefresh,
        shouldShowModal: this.currentStep > 0 && isPageRefresh
      });
      
      if (this.currentStep > 0 && isPageRefresh) {
        console.log('🎯 Mostrando modal de continuar (refresco de página)');
        setTimeout(() => {
          this.showContinueModal = true;
        }, 500); // Pequeño delay para asegurar que la UI esté lista
      } else {
        console.log('🚫 No se muestra modal:', {
          reason: this.currentStep <= 0 ? 'Paso inicial' : 'Navegación desde plan'
        });
      }
      
      // Limpiar la marca de navegación desde plan
      sessionStorage.removeItem('navigatedFromPlan');
    } else {
      console.log('🆕 No hay estado guardado - iniciando wizard nuevo');
    }
  }

  /**
   * Calcula el estado de validación basado en los requerimientos
   */
  private calculateValidationStatus(requirements: any[]): 'pending' | 'success' | 'intermediate' | 'failed' {
    if (!requirements || requirements.length === 0) return 'pending';
    
    const completed = requirements.filter(req => req.completed).length;
    const total = requirements.length;
    
    if (completed === total) return 'success';
    if (completed > 0) return 'intermediate';
    return 'pending';
  }

  /**
   * Configura SEO para el wizard
   */
  private setupSEO(): void {
    // Comentado temporalmente hasta que se implemente el servicio SEO
    // this.seoService.setTitle('Wizard de Cotización - Protección Jurídica Inmobiliaria');
    // this.seoService.setMetaDescription('Completa tu cotización paso a paso para obtener protección jurídica inmobiliaria personalizada.');
  }

  setCurrentStep(step: number) {
    console.log(`🔄 setCurrentStep llamado: ${this.currentStep} -> ${step}`);
    this.currentStep = step;
    this.wizardStateService.saveState({ currentStep: step });
    
    // Sincronizar con el backend para actualizar el paso actual
    this.wizardStateService.syncWithBackendCorrected(this.wizardStateService.getState()).catch(error => {
      console.error('❌ Error sincronizando cambio de paso con backend:', error);
    });
    
    console.log(`✅ Paso actualizado a: ${this.currentStep}`);
  }

  // Nuevo método para cuando se envía la cotización por correo
  onQuotationSentByEmail(quotationNumber: string) {
    this.quotationSentByEmail = true;
    this.quotationNumber = quotationNumber;
    
    // Obtener el sessionId actual
    const currentState = this.wizardStateService.getState();
    const sessionId = currentState.sessionId;
    
    // Generar URL con sessionId para continuar el proceso
    const continueUrl = `${window.location.origin}/cotizador?session=${sessionId}&step=3`;
    
    console.log('📧 Cotización enviada por email con URL:', continueUrl);
    
    this.setCurrentStep(5); // Ir al paso de finalización
  }

  // Nuevo método para cuando se hace clic en "Siguiente y Pagar"
  onNextAndPay(quotationData: any) {
    console.log('💰 onNextAndPay llamado con datos:', quotationData);
    console.log('🔍 Estructura completa de quotationData:', JSON.stringify(quotationData, null, 2));
    
    this.currentQuotation = quotationData;
    this.quotationId = quotationData.id || quotationData.quotationId || '';
    this.quotationNumber = quotationData.quotationNumber || '';
    this.userId = quotationData.userId || '';
    
    console.log('📊 Datos extraídos:');
    console.log('  - quotationData.id:', quotationData.id);
    console.log('  - quotationData.quotationId:', quotationData.quotationId);
    console.log('  - quotationData.quotationNumber:', quotationData.quotationNumber);
    console.log('  - quotationData.userId:', quotationData.userId);
    
    console.log('📊 Datos guardados en wizard:');
    console.log('  - currentQuotation:', this.currentQuotation);
    console.log('  - quotationId:', this.quotationId);
    console.log('  - quotationNumber:', this.quotationNumber);
    console.log('  - userId:', this.userId);
    
    this.wizardStateService.saveState({
      quotationId: this.quotationId,
      quotationNumber: this.quotationNumber,
      userId: this.userId
    });
    
    // Verificar que los datos se guardaron correctamente
    const currentState = this.wizardStateService.getState();
    console.log('🔍 Estado después de guardar cotización:', {
      quotationId: currentState.quotationId,
      quotationNumber: currentState.quotationNumber,
      userId: currentState.userId
    });
    
    // Sincronizar con el backend para guardar la información del paso 1
    this.wizardStateService.syncWithBackendCorrected(this.wizardStateService.getState()).catch(error => {
      console.error('❌ Error sincronizando datos del paso 1 con backend:', error);
    });
    
    this.setCurrentStep(2); // Ir al paso 2 (PAYMENT) con la cotización creada
    console.log('✅ Cotización creada, navegando al paso 2 (PAYMENT)');
  }

  onDataEntryCompleted() {
    console.log('📝 Captura de datos completada, navegando al contrato');
    this.setCurrentStep(5); // Ir al paso 5 (CONTRACT)
  }

  // Nuevo método para cuando se completa el pago
  onPaymentCompleted(paymentResult: any) {
    console.log('💰 onPaymentCompleted llamado con resultado:', paymentResult);
    console.log('🔍 Estructura completa de paymentResult:', JSON.stringify(paymentResult, null, 2));
    
    if (paymentResult && paymentResult.success) {
      console.log('📋 Campos disponibles en paymentResult:');
      console.log('  - success:', paymentResult.success);
      console.log('  - paymentId:', paymentResult.paymentId);
      console.log('  - policyId:', paymentResult.policyId);
      console.log('  - policyNumber:', paymentResult.policyNumber);
      console.log('  - status:', paymentResult.status);
      
      // Guardar información completa del pago en el estado del wizard
      this.wizardStateService.saveState({
        paymentResult: paymentResult,
        currentStep: 3, // Marcar que estamos en el paso de validación
        policyId: paymentResult.policyId,
        policyNumber: paymentResult.policyNumber // Agregar policyNumber también
      });
      
      // Sincronizar con el backend para guardar la información del pago
      this.wizardStateService.syncWithBackendCorrected(this.wizardStateService.getState()).catch(error => {
        console.error('❌ Error sincronizando datos del pago con backend:', error);
      });
      
      console.log('✅ Información del pago guardada en el estado del wizard:', {
        paymentId: paymentResult.paymentId,
        policyId: paymentResult.policyId,
        policyNumber: paymentResult.policyNumber,
        status: paymentResult.status
      });
      
      // Marcar el paso de pago como completado
      this.wizardStateService.completeStep(2);
      console.log('✅ Paso de pago marcado como completado');
      
      // Avanzar al siguiente paso (validación)
      this.setCurrentStep(3);
      console.log('✅ Pago completado exitosamente, navegando al paso 3 (VALIDACIÓN)');
      
      // Log del estado actual para debugging
      const currentState = this.wizardStateService.getState();
      console.log('📊 Estado del wizard después del pago:', {
        currentStep: currentState.currentStep,
        completedSteps: currentState.completedSteps,
        policyId: currentState.policyId
      });
      
    } else {
      console.warn('⚠️ onPaymentCompleted llamado sin resultado exitoso:', paymentResult);
      // Si no hay resultado exitoso, mantener en el paso de pago
      this.setCurrentStep(2);
    }
  }

  simulateValidation() {
    console.log('Iniciando validación...');
    setTimeout(() => {
      // Simulación: resultado aleatorio
      const rand = Math.random();
      if (rand < 0.6) {
        this.validationStatus = 'success';
        console.log('Validación exitosa');
      } else if (rand < 0.85) {
        this.validationStatus = 'intermediate';
        console.log('Validación intermedia');
      } else {
        this.validationStatus = 'failed';
        console.log('Validación fallida');
      }
    }, 3000);
  }

  nextStep() {
    if (this.currentStep < this.steps.length - 1) {
      // Marcar paso actual como completado
      this.wizardStateService.completeStep(this.currentStep);
      
      this.setCurrentStep(this.currentStep + 1);
    }
  }

  prevStep() {
    if (this.currentStep > 0 && this.canGoBack) {
      this.setCurrentStep(this.currentStep - 1);
    } else if (!this.canGoBack) {
      console.log('⚠️ No se puede retroceder desde email - Navegación bloqueada');
    }
  }

  goToStep(index: number) {
    if (index >= 0 && index < this.steps.length) {
      this.setCurrentStep(index);
    }
  }

  onMainDataNext(formData: FormGroup) {
    console.log('onMainDataNext llamado en WizardFlowComponent');
    console.log('Form data recibido:', formData.value);
    
    // Extraer ID de cotización del formulario
    const quotationId = formData.get('quotationId')?.value;
    if (quotationId) {
      this.quotationId = quotationId;
      console.log('ID de cotización obtenido:', this.quotationId);
      
      // Guardar en el estado del wizard
      this.wizardStateService.saveState({ 
        quotationId: this.quotationId,
        currentStep: this.currentStep 
      });
    }
    
    this.nextStep();
  }

  onValidationSelectPlan(planId: string) {
    console.log('Plan seleccionado en wizard:', planId);
    this.selectedPlan = planId;
    // Mantener en 'completed' para mostrar selección de complementos
    this.validationStatus = 'success';
    // No avanzar automáticamente, dejar que el usuario seleccione complementos
  }

  onValidationGoToStart() {
    this.goToStep(0);
    this.validationStatus = 'pending';
  }

  onFinishGoToStart() {
    this.goToStep(0);
    this.validationStatus = 'pending';
    this.currentQuotation = null;
    this.quotationId = '';
    
    // Limpiar estado del wizard
    this.wizardStateService.clearState();
  }

  getCurrentStepKey(): string {
    return this.steps[this.currentStep].key;
  }

  getStepName(step: number): string {
    return this.steps[step]?.label || `Paso ${step}`;
  }

  closeWizard() {
    // Limpiar estado al cerrar el wizard
    this.wizardStateService.clearState();
    window.history.back();
  }

  /**
   * Maneja la decisión de continuar el wizard
   */
  onContinueWizard(): void {
    this.showContinueModal = false;
    console.log('✅ Usuario decidió continuar el wizard');
    
    // Navegar al cotizador con la sesión actual
    const currentState = this.wizardStateService.getState();
    if (currentState.sessionId) {
      console.log('🎯 Navegando al cotizador con sesión:', currentState.sessionId);
      this.router.navigate(['/cotizador'], { 
        queryParams: { session: currentState.sessionId }
      });
    } else {
      console.warn('⚠️ No hay sessionId para navegar al cotizador');
    }
  }

  /**
   * Maneja la decisión de reiniciar el wizard
   */
  async onRestartWizard() {
    console.log('🔄 Reiniciando wizard...');
    
    // 1) Eliminar sesión actual de la BD
    const currentState = this.wizardStateService.getState();
    console.log('📊 Estado actual antes de eliminar:', {
      sessionId: currentState.sessionId,
      currentStep: currentState.currentStep,
      status: currentState.status
    });
    
    if (currentState.sessionId) {
      try {
        console.log('🗑️ Eliminando sesión actual de la BD:', currentState.sessionId);
        const deleted = await this.wizardStateService.deleteSession(currentState.sessionId);
        console.log('📋 Resultado de eliminación:', deleted);
        
        if (deleted) {
          console.log('✅ Sesión actual eliminada de la BD');
        } else {
          console.warn('⚠️ No se pudo eliminar la sesión de la BD - intentando marcar como ABANDONED');
          // Fallback: marcar como ABANDONED si no se puede eliminar
          try {
            await this.wizardStateService.updateSessionStatus('ABANDONED');
            console.log('✅ Sesión marcada como ABANDONED como fallback');
          } catch (fallbackError) {
            console.error('❌ Error en fallback ABANDONED:', fallbackError);
          }
        }
      } catch (error) {
        console.warn('⚠️ Error eliminando sesión de la BD:', error);
        // Fallback: marcar como ABANDONED
        try {
          await this.wizardStateService.updateSessionStatus('ABANDONED');
          console.log('✅ Sesión marcada como ABANDONED como fallback');
        } catch (fallbackError) {
          console.error('❌ Error en fallback ABANDONED:', fallbackError);
        }
      }
    } else {
      console.warn('⚠️ No hay sessionId en el estado actual');
    }
    
    // 2) Limpiar estado del wizard
    this.wizardStateService.clearState();
    
    // 3) Crear nueva sesión
    console.log('🆕 Creando nueva sesión...');
    const newSessionId = await this.wizardStateService.createNewSession();
    console.log('✅ Nueva sesión creada:', newSessionId);
    
    // 4) Resetear propiedades del componente
    this.currentStep = 0;
    this.selectedPlan = '';
    this.quotationId = '';
    this.quotationNumber = '';
    this.userId = '';
    this.currentQuotation = null;
    this.validationStatus = 'pending';
    this.quotationSentByEmail = false;
    this.isStateRestored = false;
    this.showContinueModal = false;
    
    // 5) Actualizar URL con nueva sesión
    console.log('🔄 Actualizando URL con nueva sesión:', newSessionId);
    this.router.navigate(['/cotizador'], { 
      queryParams: { session: newSessionId },
      replaceUrl: true // Reemplazar la URL actual
    });
    
    console.log('✅ Wizard reiniciado con nueva sesión');
  }

  /**
   * Calcula el número de pasos completados basado en los datos reales guardados
   * Estructura real del wizard (7 pasos: 0-6):
   * - Paso 0: Bienvenida (tipo de usuario) → stepData.step0.tipoUsuario
   * - Paso 1: Datos principales → stepData.step1 (nombre, telefono, correo, rentaMensual)
   * - Paso 2: Pago → stepData.step2 (paymentMethod, cardData)
   * - Paso 3: Validación → stepData.step3 (validationCode)
   * - Paso 4: Captura de datos → stepData.step4 (propietario, inquilino, fiador, inmueble)
   * - Paso 5: Contrato → stepData.step5 (contractTerms, signatures)
   * - Paso 6: Final → stepData.step6 (deliveryPreferences)
   */
  private calculateCompletedSteps(stepData: any): number {
    let completedSteps = 0;
    
    console.log('🔍 Calculando pasos completados desde stepData:', JSON.stringify(stepData, null, 2));
    
    // Paso 0: Bienvenida - tipo de usuario
    if (stepData.step0 && stepData.step0.tipoUsuario) {
      completedSteps++;
      console.log('✅ Paso 0 completado: tipoUsuario');
    }
    
    // Paso 1: Datos principales - si existe step1, significa que se completó
    if (stepData.step1) {
      completedSteps++;
      console.log('✅ Paso 1 completado: step1 existe');
    }
    
    // Paso 2: Pago - si existe step2, significa que se completó
    if (stepData.step2) {
      completedSteps++;
      console.log('✅ Paso 2 completado: step2 existe');
    }
    
    // Paso 3: Validación - si existe step3, significa que se completó
    if (stepData.step3) {
      completedSteps++;
      console.log('✅ Paso 3 completado: step3 existe');
    }
    
    // Paso 4: Captura de datos - si existe step4, significa que se completó
    if (stepData.step4) {
      completedSteps++;
      console.log('✅ Paso 4 completado: step4 existe');
    }
    
    // Paso 5: Contrato - si existe step5, significa que se completó
    if (stepData.step5) {
      completedSteps++;
      console.log('✅ Paso 5 completado: step5 existe');
    }
    
    // Paso 6: Final - si existe step6, significa que se completó
    if (stepData.step6) {
      completedSteps++;
      console.log('✅ Paso 6 completado: step6 existe');
    }
    
    console.log('📊 Total de pasos completados:', completedSteps);
    return completedSteps;
  }

  /**
   * Obtiene información del estado para debugging
   */
  getStateInfo(): any {
    return this.wizardStateService.getStateInfo();
  }
}

