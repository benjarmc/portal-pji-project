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
import { SeoService } from '../../services/seo.service';
import { WizardStateService, WizardState } from '../../services/wizard-state.service';
import { WizardSessionService } from '../../services/wizard-session.service';
import { ContinueWizardModalComponent } from '../../components/continue-wizard-modal/continue-wizard-modal.component';
import { LoggerService } from '../../services/logger.service';
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
    
    this.logger.log('🔄 currentStep cambiado:', {
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
    private wizardSessionService: WizardSessionService,
    private logger: LoggerService
  ) {}

  async ngOnInit() {
    this.logger.log('🚀 ngOnInit iniciado - Estado inicial:', {
      currentStep: this.currentStep,
      stepName: this.getStepName(this.currentStep),
      wizardStateCurrentStep: this.wizardStateService.getState().currentStep
    });
    
    // Verificar si llegamos desde URL del cotizador
    await this.handleUrlParameters();
    
    // Restaurar estado del wizard después de manejar parámetros de URL
    this.restoreWizardState();
    
    // Configurar SEO
    this.setupSEO();
    
    this.logger.log('🚀 ngOnInit completado - Estado final:', {
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
  private async handleUrlParameters(): Promise<void> {
    if (typeof window !== 'undefined') {
      // Obtener parámetros de la ruta
      const sessionId = this.route.snapshot.paramMap.get('sessionId');
      const step = this.route.snapshot.queryParamMap.get('step');
      const planId = this.route.snapshot.queryParamMap.get('plan');
      
      // REDIRECCIÓN AUTOMÁTICA: Si se accede con query param session, redirigir a nueva estructura
      const legacySessionId = this.route.snapshot.queryParamMap.get('session');
      if (legacySessionId && !sessionId) {
        this.logger.log('🔄 Redirigiendo URL antigua a nueva estructura:', { 
          from: `cotizador?session=${legacySessionId}`, 
          to: `cotizador/${legacySessionId}` 
        });
        
        // Convertir sessionId a UUID si es necesario
        const convertedSessionId = await this.wizardStateService.convertSessionIdToId(legacySessionId);
        
        // Redirigir a la nueva estructura
        const newUrl = `/cotizador/${convertedSessionId}${step ? `?step=${step}` : ''}`;
        this.router.navigateByUrl(newUrl, { replaceUrl: true });
        this.logger.log('✅ Redirección completada:', newUrl);
        return;
      }
      
      if (sessionId) {
        this.logger.log('🎯 WIZARD SessionId detectado en URL:', { sessionId, step });
        
        // Convertir automáticamente sessionId a id (UUID) si es necesario
        const convertedSessionId = await this.wizardStateService.convertSessionIdToId(sessionId);
        
        // Si se convirtió, actualizar la URL a la nueva estructura
        if (convertedSessionId !== sessionId) {
          const newUrl = `/cotizador/${convertedSessionId}${step ? `?step=${step}` : ''}`;
          this.router.navigateByUrl(newUrl, { replaceUrl: true });
          this.logger.log('🔄 URL actualizada con nueva estructura:', newUrl);
        }
        
        // Cargar el estado de la sesión existente
        this.loadSessionState(convertedSessionId, step ? parseInt(step) : undefined);
        
      } else if (planId) {
        this.logger.log('🎯 Plan detectado en URL (modo legacy):', planId);
        
        // Crear nueva sesión con el plan seleccionado
        this.createNewSessionWithPlan(planId);
        
      } else {
        // Si no hay sessionId ni plan, crear nueva sesión
        this.logger.log('🆕 Creando nueva sesión');
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
        this.logger.log('🔍 Intentando cargar sesión desde URL:', sessionId);
        const sessionData = await this.wizardSessionService.getSession(sessionId).toPromise();
        this.logger.log('📡 Respuesta del backend para sesión:', sessionData);
        
        if (sessionData) {
          // Verificar si viene envuelto en ApiResponse o directamente
          const actualData = (sessionData as any).data || sessionData;
          
          if (actualData && (actualData.id || actualData.sessionId)) {
            this.logger.log('📊 Estado de sesión cargado desde URL:', actualData);
            this.restoreSessionState(actualData, targetStep);
            return;
          }
        }
      } catch (error) {
        // Verificar si es un error 404 (sesión no existe)
        this.logger.log('🔍 Debugging error:', {
          error: error,
          errorType: typeof error,
          errorStatus: (error as any)?.status,
          errorMessage: (error as any)?.message,
          is404: error && (error as any).status === 404
        });
        
        if (error && (error as any).status === 404) {
          this.logger.log('❌ Sesión no existe en la base de datos (404), redirigiendo al home');
          this.logger.error('❌ Error detallado:', error);
          
          // Limpiar estado local
          this.wizardStateService.clearState();
          
          // Redirigir al home
          this.router.navigate(['/'], { replaceUrl: true });
          return;
        }
        
        this.logger.log('⚠️ Sesión de URL no encontrada, buscando sesión activa por IP');
        this.logger.error('❌ Error detallado:', error);
      }
      
      // SEGUNDO: Si no funciona, buscar sesión activa por IP (sin crear nueva)
      const activeSessionId = await this.wizardStateService.checkActiveSessionByIp();
      
      if (activeSessionId) {
        // TERCERO: Obtener el estado de la sesión activa desde el backend
        try {
          const sessionData = await this.wizardSessionService.getSession(activeSessionId).toPromise();
          
          if (sessionData) {
            // Verificar si viene envuelto en ApiResponse o directamente
            const actualData = (sessionData as any).data || sessionData;
            
            if (actualData && (actualData.id || actualData.sessionId)) {
              this.logger.log('📊 Estado de sesión cargado desde IP:', actualData);
              this.restoreSessionState(actualData, targetStep);
              return;
            }
          }
        } catch (error) {
          // Verificar si es un error 404 (sesión no existe)
          if (error && (error as any).status === 404) {
            this.logger.log('❌ Sesión activa no existe en la base de datos (404), redirigiendo al home');
            this.logger.error('❌ Error detallado:', error);
            
            // Limpiar estado local
            this.wizardStateService.clearState();
            
            // Redirigir al home
            this.router.navigate(['/'], { replaceUrl: true });
            return;
          }
          
          this.logger.log('⚠️ Error obteniendo sesión activa por IP:', error);
        }
      }
      
      // CUARTO: Si no hay sesión activa, crear nueva
      this.logger.log('⚠️ No hay sesión activa, creando nueva');
      this.initializeNewSession();
      
    } catch (error) {
      this.logger.error('❌ Error cargando sesión:', error);
      this.initializeNewSession();
    }
  }

  private restoreSessionState(sessionData: any, targetStep?: number): void {
    this.logger.log('🔄 restoreSessionState llamado con:', {
      sessionDataCurrentStep: sessionData.currentStep,
      targetStep: targetStep,
      id: sessionData.id,
      sessionId: sessionData.sessionId,
      policyId: sessionData.policyId,
      policyNumber: sessionData.policyNumber,
      paymentResult: sessionData.paymentResult
    });
    
    // Restaurar el estado del wizard
    this.currentStep = targetStep || sessionData.currentStep;
    
    this.logger.log('🎯 currentStep establecido:', {
      targetStep: targetStep,
      sessionDataCurrentStep: sessionData.currentStep,
      finalCurrentStep: this.currentStep,
      hasPolicyData: !!(sessionData.policyId && sessionData.policyNumber),
      stepName: this.getStepName(this.currentStep)
    });
    
    this.logger.log('🔍 Verificando estado del wizard después de establecer currentStep:', {
      currentStep: this.currentStep,
      stepName: this.getStepName(this.currentStep),
      wizardStateCurrentStep: this.wizardStateService.getState().currentStep
    });
    
    this.selectedPlan = sessionData.selectedPlan || ''; // ✅ Usar objeto principal
    this.selectedPlanName = sessionData.selectedPlanName || ''; // ✅ Agregar selectedPlanName
    this.quotationId = sessionData.quotationId || '';
    this.quotationNumber = sessionData.quotationNumber || ''; // ✅ Usar objeto principal
    this.userId = sessionData.userId || '';
    
    this.logger.log('📊 Datos restaurados para el modal:', {
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
    
    this.logger.log('🔍 stepData usado para calcular progreso:', sessionData.stepData);
    
    this.logger.log('📊 Variables del modal llenadas:', {
      modalCurrentStep: this.modalCurrentStep,
      modalSelectedPlan: this.modalSelectedPlan,
      modalQuotationNumber: this.modalQuotationNumber,
      modalCompletedSteps: this.modalCompletedSteps
    });
    
    // Sincronizar completamente el estado local con los datos de la BD
    this.syncLocalStateWithBD(sessionData);
    
    // Sincronizar el currentStep con wizardStateService
    this.wizardStateService.saveState({ currentStep: this.currentStep });
    
    this.logger.log('🔄 currentStep sincronizado con wizardStateService:', this.currentStep);
    
    // Verificar si hay conflicto después de sincronizar
    const wizardStateAfterSync = this.wizardStateService.getState();
    this.logger.log('🔍 Estado del wizard después de sincronizar:', {
      componentCurrentStep: this.currentStep,
      wizardStateCurrentStep: wizardStateAfterSync.currentStep,
      areTheyEqual: this.currentStep === wizardStateAfterSync.currentStep
    });
    
    // Configurar navegación
    this.canGoBack = targetStep ? false : true;
    this.isFromQuotationUrl = !!targetStep;
    
    this.logger.log('✅ Estado de sesión restaurado y sincronizado con BD');
    
    // Mostrar modal de continuar si se refrescó la página (no si se navegó desde selección de plan)
    const navigatedFromPlan = sessionStorage.getItem('navigatedFromPlan') === 'true';
    const isPageRefresh = !navigatedFromPlan;
    
    this.logger.log('🔍 Verificando si mostrar modal en restoreSessionState:', {
      currentStep: this.currentStep,
      navigatedFromPlan: navigatedFromPlan,
      isPageRefresh: isPageRefresh,
      shouldShowModal: this.currentStep > 0 && isPageRefresh
    });
    
    if (this.currentStep > 0 && isPageRefresh) {
      this.logger.log('🎯 Mostrando modal de continuar (refresco de página)');
      setTimeout(() => {
        this.showContinueModal = true;
      }, 500); // Pequeño delay para asegurar que la UI esté lista
    } else {
      this.logger.log('🚫 No se muestra modal:', {
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

    this.logger.log('🔄 Sincronizando estado local con BD (estructura completa):', {
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
    this.logger.log('🆕 initializeNewSession llamado:', {
      currentStepAntes: this.currentStep,
      stepNameAntes: this.getStepName(this.currentStep)
    });
    
    // NO sobrescribir currentStep si ya se estableció desde la sesión del backend
    if (this.currentStep === 0) {
      this.logger.log('✅ Estableciendo currentStep = 0 (nueva sesión)');
      this.currentStep = 0;
    } else {
      this.logger.log('✅ Manteniendo currentStep establecido desde sesión:', {
        currentStep: this.currentStep,
        razon: 'Ya establecido desde sesión del backend'
      });
    }
    
    this.canGoBack = true;
    this.isFromQuotationUrl = false;
    
    // El WizardStateService ya maneja la creación de sesión automáticamente
    this.logger.log('✅ Nueva sesión inicializada');
  }

  /**
   * Crear nueva sesión con plan seleccionado
   */
  private createNewSessionWithPlan(planId: string): void {
    this.logger.log('🆕 createNewSessionWithPlan llamado:', {
      planId: planId,
      currentStepAntes: this.currentStep,
      stepNameAntes: this.getStepName(this.currentStep)
    });
    
    // Establecer el plan seleccionado
    this.selectedPlan = planId;
    
    // NO sobrescribir currentStep si ya se estableció desde la sesión del backend
    if (this.currentStep === 0) {
      this.logger.log('✅ Estableciendo currentStep = 0 (nueva sesión)');
      this.currentStep = 0;
    } else {
      this.logger.log('✅ Manteniendo currentStep establecido desde sesión:', {
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
    
    // Redirigir a la URL con nueva estructura usando id (UUID)
    const currentState = this.wizardStateService.getState();
    const sessionId = currentState.id || currentState.sessionId; // Usar id si está disponible, sino sessionId como fallback
    
    if (sessionId) {
      // Usar la nueva estructura de URL: /cotizador/uuid
      const newUrl = `/cotizador/${sessionId}`;
      this.router.navigateByUrl(newUrl, { replaceUrl: true });
      this.logger.log('🔄 URL actualizada con nueva estructura:', newUrl);
    }
    
    this.logger.log('✅ Nueva sesión con plan inicializada');
  }

  /**
   * Restaura el estado del wizard desde el almacenamiento
   */
  private restoreWizardState(): void {
    this.logger.log('🔄 restoreWizardState iniciado - Estado antes:', {
      currentStep: this.currentStep,
      stepName: this.getStepName(this.currentStep),
      isFromQuotationUrl: this.isFromQuotationUrl
    });
    
    // Solo restaurar si no es desde URL de cotización
    if (this.isFromQuotationUrl) {
      this.logger.log('🔄 No restaurando estado - llegamos desde URL de cotización');
      return;
    }

    if (this.wizardStateService.hasSavedState()) {
      const savedState = this.wizardStateService.getState();
      
      this.logger.log('🔄 Evaluando si sobrescribir currentStep:', {
        currentStepAntes: this.currentStep,
        savedStateCurrentStep: savedState.currentStep,
        stepNameAntes: this.getStepName(this.currentStep),
        stepNameDespues: this.getStepName(savedState.currentStep),
        shouldOverride: false // NUNCA sobrescribir si ya se estableció desde sesión
      });
      
      // NUNCA sobrescribir currentStep si ya se estableció desde la sesión del backend
      // Solo restaurar otros campos, pero mantener el currentStep establecido desde la sesión
      this.logger.log('✅ Manteniendo currentStep establecido desde sesión:', {
        currentStep: this.currentStep,
        razon: 'Ya establecido desde sesión del backend con lógica inteligente'
      });
      this.selectedPlan = savedState.selectedPlan || '';
      this.quotationId = savedState.quotationId || '';
      this.quotationNumber = savedState.quotationNumber || '';
      this.userId = savedState.userId || '';
      
      this.logger.log('🔄 Estado del wizard restaurado:', {
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
      
      this.logger.log('📊 Variables del modal llenadas desde estado local:', {
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
      
      this.logger.log('🔍 Verificando si mostrar modal:', {
        currentStep: this.currentStep,
        navigatedFromPlan: navigatedFromPlan,
        isPageRefresh: isPageRefresh,
        shouldShowModal: this.currentStep > 0 && isPageRefresh
      });
      
      if (this.currentStep > 0 && isPageRefresh) {
        this.logger.log('🎯 Mostrando modal de continuar (refresco de página)');
        setTimeout(() => {
          this.showContinueModal = true;
        }, 500); // Pequeño delay para asegurar que la UI esté lista
      } else {
        this.logger.log('🚫 No se muestra modal:', {
          reason: this.currentStep <= 0 ? 'Paso inicial' : 'Navegación desde plan'
        });
      }
      
      // Limpiar la marca de navegación desde plan
      sessionStorage.removeItem('navigatedFromPlan');
    } else {
      this.logger.log('🆕 No hay estado guardado - iniciando wizard nuevo');
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
    this.logger.log(`🔄 setCurrentStep llamado: ${this.currentStep} -> ${step}`);
    this.currentStep = step;
    this.wizardStateService.saveState({ currentStep: step });
    
    // Sincronizar con el backend para actualizar el paso actual
    this.wizardStateService.syncWithBackendCorrected(this.wizardStateService.getState()).catch(error => {
      this.logger.error('❌ Error sincronizando cambio de paso con backend:', error);
    });
    
    this.logger.log(`✅ Paso actualizado a: ${this.currentStep}`);
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
    
    this.logger.log('📧 Cotización enviada por email con URL:', continueUrl);
    
    // Marcar pasos 1 y 2 como completados (proceso de cotización completado)
    this.wizardStateService.completeStep(1);
    this.wizardStateService.completeStep(2);
    
    // Ir al paso de finalización (finish-step) - proceso completado
    this.setCurrentStep(6);
  }

  // Nuevo método para cuando se hace clic en "Siguiente y Pagar"
  onNextAndPay(quotationData: any) {
    this.logger.log('💰 onNextAndPay llamado con datos:', quotationData);
    this.logger.log('🔍 Estructura completa de quotationData:', JSON.stringify(quotationData, null, 2));
    
    this.currentQuotation = quotationData;
    this.quotationId = quotationData.id || quotationData.quotationId || '';
    this.quotationNumber = quotationData.quotationNumber || '';
    this.userId = quotationData.userId || '';
    
    this.logger.log('📊 Datos extraídos:');
    this.logger.log('  - quotationData.id:', quotationData.id);
    this.logger.log('  - quotationData.quotationId:', quotationData.quotationId);
    this.logger.log('  - quotationData.quotationNumber:', quotationData.quotationNumber);
    this.logger.log('  - quotationData.userId:', quotationData.userId);
    
    this.logger.log('📊 Datos guardados en wizard:');
    this.logger.log('  - currentQuotation:', this.currentQuotation);
    this.logger.log('  - quotationId:', this.quotationId);
    this.logger.log('  - quotationNumber:', this.quotationNumber);
    this.logger.log('  - userId:', this.userId);
    
    this.wizardStateService.saveState({
      quotationId: this.quotationId,
      quotationNumber: this.quotationNumber,
      userId: this.userId
    });
    
    // Verificar que los datos se guardaron correctamente
    const currentState = this.wizardStateService.getState();
    this.logger.log('🔍 Estado después de guardar cotización:', {
      quotationId: currentState.quotationId,
      quotationNumber: currentState.quotationNumber,
      userId: currentState.userId
    });
    
    // Sincronizar con el backend para guardar la información del paso 1
    this.wizardStateService.syncWithBackendCorrected(this.wizardStateService.getState()).catch(error => {
      this.logger.error('❌ Error sincronizando datos del paso 1 con backend:', error);
    });
    
    this.setCurrentStep(2); // Ir al paso 2 (PAYMENT) con la cotización creada
    this.logger.log('✅ Cotización creada, navegando al paso 2 (PAYMENT)');
  }

  onDataEntryCompleted() {
    this.logger.log('📝 Captura de datos completada, navegando al contrato');
    this.setCurrentStep(5); // Ir al paso 5 (CONTRACT)
  }

  // Nuevo método para cuando se completa el pago
  onPaymentCompleted(paymentResult: any) {
    this.logger.log('💰 onPaymentCompleted llamado con resultado:', paymentResult);
    this.logger.log('🔍 Estructura completa de paymentResult:', JSON.stringify(paymentResult, null, 2));
    
    if (paymentResult && paymentResult.success) {
      this.logger.log('📋 Campos disponibles en paymentResult:');
      this.logger.log('  - success:', paymentResult.success);
      this.logger.log('  - paymentId:', paymentResult.paymentId);
      this.logger.log('  - policyId:', paymentResult.policyId);
      this.logger.log('  - policyNumber:', paymentResult.policyNumber);
      this.logger.log('  - status:', paymentResult.status);
      
      // Guardar información completa del pago en el estado del wizard
      this.wizardStateService.saveState({
        paymentResult: paymentResult,
        currentStep: 3, // Marcar que estamos en el paso de validación
        policyId: paymentResult.policyId,
        policyNumber: paymentResult.policyNumber // Agregar policyNumber también
      });
      
      // Sincronizar con el backend para guardar la información del pago
      this.wizardStateService.syncWithBackendCorrected(this.wizardStateService.getState()).catch(error => {
        this.logger.error('❌ Error sincronizando datos del pago con backend:', error);
      });
      
      this.logger.log('✅ Información del pago guardada en el estado del wizard:', {
        paymentId: paymentResult.paymentId,
        policyId: paymentResult.policyId,
        policyNumber: paymentResult.policyNumber,
        status: paymentResult.status
      });
      
      // Marcar el paso de pago como completado
      this.wizardStateService.completeStep(2);
      this.logger.log('✅ Paso de pago marcado como completado');
      
      // Avanzar al siguiente paso (validación)
      this.setCurrentStep(3);
      this.logger.log('✅ Pago completado exitosamente, navegando al paso 3 (VALIDACIÓN)');
      
      // Log del estado actual para debugging
      const currentState = this.wizardStateService.getState();
      this.logger.log('📊 Estado del wizard después del pago:', {
        currentStep: currentState.currentStep,
        completedSteps: currentState.completedSteps,
        policyId: currentState.policyId
      });
      
    } else {
      this.logger.warning('⚠️ onPaymentCompleted llamado sin resultado exitoso:', paymentResult);
      // Si no hay resultado exitoso, mantener en el paso de pago
      this.setCurrentStep(2);
    }
  }

  simulateValidation() {
    this.logger.log('Iniciando validación...');
    setTimeout(() => {
      // Simulación: resultado aleatorio
      const rand = Math.random();
      if (rand < 0.6) {
        this.validationStatus = 'success';
        this.logger.log('Validación exitosa');
      } else if (rand < 0.85) {
        this.validationStatus = 'intermediate';
        this.logger.log('Validación intermedia');
      } else {
        this.validationStatus = 'failed';
        this.logger.log('Validación fallida');
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
      this.logger.log('⚠️ No se puede retroceder desde email - Navegación bloqueada');
    }
  }

  goToStep(index: number) {
    if (index >= 0 && index < this.steps.length) {
      this.setCurrentStep(index);
    }
  }

  onMainDataNext(formData: FormGroup) {
    this.logger.log('onMainDataNext llamado en WizardFlowComponent');
    this.logger.log('Form data recibido:', formData.value);
    
    // Extraer ID de cotización del formulario
    const quotationId = formData.get('quotationId')?.value;
    if (quotationId) {
      this.quotationId = quotationId;
      this.logger.log('ID de cotización obtenido:', this.quotationId);
      
      // Guardar en el estado del wizard
      this.wizardStateService.saveState({ 
        quotationId: this.quotationId,
        currentStep: this.currentStep 
      });
    }
    
    this.nextStep();
  }

  onValidationSelectPlan(planId: string) {
    this.logger.log('Plan seleccionado en wizard:', planId);
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
    // Navegar a la página principal usando window.location para asegurar que funcione en todos los ambientes
    window.location.href = '/';
  }

  /**
   * Maneja la decisión de continuar el wizard
   */
  onContinueWizard(): void {
    this.showContinueModal = false;
    this.logger.log('✅ Usuario decidió continuar el wizard');
    
    // Navegar al cotizador con la sesión actual
    const currentState = this.wizardStateService.getState();
    if (currentState.sessionId) {
      this.logger.log('🎯 Navegando al cotizador con sesión:', currentState.sessionId);
      const sessionId = currentState.id || currentState.sessionId;
      this.router.navigate(['/cotizador', sessionId]);
    } else {
      this.logger.warning('⚠️ No hay sessionId para navegar al cotizador');
    }
  }

  /**
   * Maneja la decisión de reiniciar el wizard
   */
  async onRestartWizard() {
    this.logger.log('🔄 Reiniciando wizard...');
    
    // 1) Eliminar sesión actual de la BD
    const currentState = this.wizardStateService.getState();
    this.logger.log('📊 Estado actual antes de eliminar:', {
      sessionId: currentState.sessionId,
      currentStep: currentState.currentStep,
      status: currentState.status
    });
    
    if (currentState.sessionId) {
      try {
        this.logger.log('🗑️ Eliminando sesión actual de la BD:', currentState.sessionId);
        const deleted = await this.wizardStateService.deleteSession(currentState.sessionId);
        this.logger.log('📋 Resultado de eliminación:', deleted);
        
        if (deleted) {
          this.logger.log('✅ Sesión actual eliminada de la BD');
        } else {
          this.logger.warning('⚠️ No se pudo eliminar la sesión de la BD - intentando marcar como ABANDONED');
          // Fallback: marcar como ABANDONED si no se puede eliminar
          try {
            await this.wizardStateService.updateSessionStatus('ABANDONED');
            this.logger.log('✅ Sesión marcada como ABANDONED como fallback');
          } catch (fallbackError) {
            this.logger.error('❌ Error en fallback ABANDONED:', fallbackError);
          }
        }
      } catch (error) {
        this.logger.warning('⚠️ Error eliminando sesión de la BD:', error);
        // Fallback: marcar como ABANDONED
        try {
          await this.wizardStateService.updateSessionStatus('ABANDONED');
          this.logger.log('✅ Sesión marcada como ABANDONED como fallback');
        } catch (fallbackError) {
          this.logger.error('❌ Error en fallback ABANDONED:', fallbackError);
        }
      }
    } else {
      this.logger.warning('⚠️ No hay sessionId en el estado actual');
    }
    
    // 2) Limpiar estado del wizard
    this.wizardStateService.clearState();
    
    // 3) Crear nueva sesión
    this.logger.log('🆕 Creando nueva sesión...');
    const newSessionId = await this.wizardStateService.createNewSession();
    this.logger.log('✅ Nueva sesión creada:', newSessionId);
    
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
    this.logger.log('🔄 Actualizando URL con nueva sesión:', newSessionId);
    const sessionId = this.wizardStateService.getState().id || newSessionId;
    this.router.navigate(['/cotizador', sessionId], { 
      replaceUrl: true // Reemplazar la URL actual
    });
    
    this.logger.log('✅ Wizard reiniciado con nueva sesión');
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
    
    this.logger.log('🔍 Calculando pasos completados desde stepData:', JSON.stringify(stepData, null, 2));
    
    // Paso 0: Bienvenida - tipo de usuario
    if (stepData.step0 && stepData.step0.tipoUsuario) {
      completedSteps++;
      this.logger.log('✅ Paso 0 completado: tipoUsuario');
    }
    
    // Paso 1: Datos principales - si existe step1, significa que se completó
    if (stepData.step1) {
      completedSteps++;
      this.logger.log('✅ Paso 1 completado: step1 existe');
    }
    
    // Paso 2: Pago - si existe step2, significa que se completó
    if (stepData.step2) {
      completedSteps++;
      this.logger.log('✅ Paso 2 completado: step2 existe');
    }
    
    // Paso 3: Validación - si existe step3, significa que se completó
    if (stepData.step3) {
      completedSteps++;
      this.logger.log('✅ Paso 3 completado: step3 existe');
    }
    
    // Paso 4: Captura de datos - si existe step4, significa que se completó
    if (stepData.step4) {
      completedSteps++;
      this.logger.log('✅ Paso 4 completado: step4 existe');
    }
    
    // Paso 5: Contrato - si existe step5, significa que se completó
    if (stepData.step5) {
      completedSteps++;
      this.logger.log('✅ Paso 5 completado: step5 existe');
    }
    
    // Paso 6: Final - si existe step6, significa que se completó
    if (stepData.step6) {
      completedSteps++;
      this.logger.log('✅ Paso 6 completado: step6 existe');
    }
    
    this.logger.log('📊 Total de pasos completados:', completedSteps);
    return completedSteps;
  }

  /**
   * Obtiene información del estado para debugging
   */
  getStateInfo(): any {
    return this.wizardStateService.getStateInfo();
  }
}

