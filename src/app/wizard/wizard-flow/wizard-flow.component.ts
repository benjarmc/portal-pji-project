import { Component, OnInit, HostListener } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormGroup } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { WelcomeStepComponent } from './steps/welcome-step/welcome-step.component';
import { MainDataStepComponent } from './steps/main-data-step/main-data-step.component';
import { DataEntryStepComponent } from './steps/data-entry-step/data-entry-step.component';
import { PaymentStepComponent } from './steps/payment-step/payment-step.component';
import { ValidationStepComponent } from './steps/validation-step/validation-step.component';
import { BuroCreditoStepComponent } from './steps/buro-credito-step/buro-credito-step.component';
import { ContractStepComponent } from './steps/contract-step/contract-step.component';
import { FinishStepComponent } from './steps/finish-step/finish-step.component';
import { SeoService } from '../../services/seo.service';
import { WizardStateService, WizardState } from '../../services/wizard-state.service';
import { WizardSessionService } from '../../services/wizard-session.service';
import { ContinueWizardModalComponent } from '../../components/continue-wizard-modal/continue-wizard-modal.component';
import { ConfirmDialogComponent } from '../../components/confirm-dialog/confirm-dialog.component';
import { LoggerService } from '../../services/logger.service';
import { QuotationsService } from '../../services/quotations.service';
import { PaymentsService } from '../../services/payments.service';
import { environment } from '../../../environments/environment';
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
    BuroCreditoStepComponent,
    ContractStepComponent,
    FinishStepComponent,
    ContinueWizardModalComponent,
    ConfirmDialogComponent
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
  showConfirmDialog = false;
  confirmDialogTitle = '¿Estás seguro?';
  confirmDialogMessage = '';
  confirmDialogWarning = '';
  
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
    { key: 'buro-credito', label: 'Buro de Crédito' },
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
    private quotationsService: QuotationsService,
    private paymentsService: PaymentsService,
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
        // ✅ NUEVO: Si no hay sessionId ni plan, buscar primero por IP
        this.logger.log('🔍 No hay sessionId en URL, buscando sesión por IP...');
        await this.findAndRestoreSessionByIp();
      }
    }
  }

  /**
   * ✅ NUEVO: Buscar sesión por IP y restaurarla
   * Si encuentra una sesión, actualiza la URL con el UUID y restaura el estado
   * Si no encuentra ninguna, crea una nueva sesión
   */
  private async findAndRestoreSessionByIp(): Promise<void> {
    try {
      this.logger.log('🔍 Buscando sesión activa por IP...');
      
      // Buscar sesión por IP
      const activeSessionId = await this.wizardStateService.checkActiveSessionByIp();
      
      if (activeSessionId) {
        this.logger.log('✅ Sesión encontrada por IP:', activeSessionId);
        
        // Convertir a UUID si es necesario
        const uuid = await this.wizardStateService.convertSessionIdToId(activeSessionId);
        
        // Actualizar la URL con el UUID de la sesión encontrada
        const newUrl = `/cotizador/${uuid}`;
        this.router.navigateByUrl(newUrl, { replaceUrl: true });
        this.logger.log('✅ URL actualizada con UUID de sesión encontrada:', newUrl);
        
        // Cargar el estado de la sesión encontrada
        await this.loadSessionState(uuid);
        return;
      }
      
      // Si no se encontró sesión por IP, crear una nueva
      this.logger.log('⚠️ No se encontró sesión por IP, creando nueva sesión');
      this.initializeNewSession();
      
    } catch (error) {
      this.logger.error('❌ Error buscando sesión por IP:', error);
      // En caso de error, crear una nueva sesión
      this.initializeNewSession();
    }
  }

  /**
   * Cargar estado de sesión existente
   * ✅ SIEMPRE hace GET al backend para asegurar sincronización automática
   * ✅ El backend sincroniza automáticamente los datos desde tablas relacionadas
   */
  private async loadSessionState(sessionId: string, targetStep?: number): Promise<void> {
    try {
      // ✅ CRÍTICO: SIEMPRE hacer GET al backend para ejecutar sincronización automática
      // El backend sincroniza automáticamente paymentData, paymentResult, etc. desde tablas relacionadas
      this.logger.log('🔄 Cargando sesión desde backend (siempre ejecuta sincronización automática)...', {
        sessionId,
        targetStep
      });

      let sessionData: any = null;
      let actualData: any = null;

      // PRIMERO: Intentar cargar desde URL
      try {
        this.logger.log('🔍 Intentando cargar sesión desde URL:', sessionId);
        // ✅ IMPORTANTE: Solicitar tokens al cargar sesión desde URL
        const response = await this.wizardSessionService.getSession(sessionId, true).toPromise();
        
        if (response) {
          actualData = (response as any).data || response;
          
          // ✅ IMPORTANTE: Guardar tokens si vienen en la respuesta
          if (actualData.accessToken && actualData.refreshToken) {
            this.logger.log('🔑 Tokens recibidos al cargar sesión desde URL, guardándolos...');
            if (typeof window !== 'undefined' && window.localStorage) {
              localStorage.setItem('wizard_access_token', actualData.accessToken);
              localStorage.setItem('wizard_refresh_token', actualData.refreshToken);
              this.logger.log('✅ Tokens guardados en localStorage');
            }
          }
          
          // ✅ CRÍTICO: Si hay policyId pero faltan indicadores de pago, forzar sincronización
          // ✅ SEGURIDAD: Solo verificar indicadores, NO datos completos
          if (actualData.policyId && (!actualData.hasPaymentData || !actualData.hasPaymentResult)) {
            this.logger.log('🔄 Detectado policyId sin indicadores de pago, forzando sincronización...', {
              policyId: actualData.policyId,
              hasPaymentData: actualData.hasPaymentData || false,
              hasPaymentResult: actualData.hasPaymentResult || false
            });
            try {
              const syncedData = await this.wizardSessionService.forceSync(sessionId).toPromise();
              if (syncedData) {
                const syncedActualData = (syncedData as any).data || syncedData;
                this.logger.log('✅ Sincronización forzada completada:', {
                  hasPaymentData: syncedActualData.hasPaymentData || false,
                  hasPaymentResult: syncedActualData.hasPaymentResult || false,
                  paymentStatus: syncedActualData.paymentStatus,
                  paymentAmount: syncedActualData.paymentAmount
                });
                // Usar datos sincronizados (solo indicadores)
                Object.assign(actualData, {
                  hasPaymentData: syncedActualData.hasPaymentData,
                  hasPaymentResult: syncedActualData.hasPaymentResult,
                  paymentStatus: syncedActualData.paymentStatus,
                  paymentAmount: syncedActualData.paymentAmount
                });
              }
            } catch (syncError) {
              this.logger.warning('⚠️ Error forzando sincronización:', syncError);
              // Continuar con los datos originales
            }
          }
          
          if (actualData && (actualData.id || actualData.sessionId)) {
            this.logger.log('📊 Estado de sesión cargado desde URL:', actualData);
            this.restoreSessionState(actualData, targetStep);
            return;
          }
        }
      } catch (error) {
        const errorStatus = (error as any)?.status;
        
        // Si es 404, redirigir al home directamente
        if (errorStatus === 404) {
          this.logger.log('❌ Sesión no existe en la base de datos (404), redirigiendo al home');
          this.wizardStateService.clearState();
          this.router.navigate(['/'], { replaceUrl: true });
          return;
        }
        
        // Si es 429 (Too Many Requests), usar estado local si está disponible
        if (errorStatus === 429) {
          this.logger.warning('⚠️ Rate limit alcanzado (429), usando estado local si está disponible');
          const currentState = this.wizardStateService.getState();
          if (currentState.sessionId === sessionId || currentState.id === sessionId) {
            this.restoreSessionState(currentState, targetStep);
            return;
          }
        }
        
        this.logger.log('⚠️ Error cargando sesión desde URL, intentando por IP:', error);
      }

      // SEGUNDO: Solo si falló la carga desde URL, buscar por IP
      // ✅ OPTIMIZADO: Solo buscar por IP si realmente falló la carga desde URL
      const activeSessionId = await this.wizardStateService.checkActiveSessionByIp();
      
      if (activeSessionId && activeSessionId !== sessionId) {
        // Solo hacer GET adicional si el sessionId es diferente Y no hemos cargado datos aún
        try {
          this.logger.log('🔍 Sesión activa por IP diferente, cargando:', activeSessionId);
          // ✅ IMPORTANTE: Solicitar tokens al cargar sesión por IP
          const response = await this.wizardSessionService.getSession(activeSessionId, true).toPromise();
          
          if (response) {
            actualData = (response as any).data || response;
            
            // ✅ IMPORTANTE: Guardar tokens si vienen en la respuesta
            if (actualData.accessToken && actualData.refreshToken) {
              this.logger.log('🔑 Tokens recibidos al cargar sesión por IP, guardándolos...');
              if (typeof window !== 'undefined' && window.localStorage) {
                localStorage.setItem('wizard_access_token', actualData.accessToken);
                localStorage.setItem('wizard_refresh_token', actualData.refreshToken);
                this.logger.log('✅ Tokens guardados en localStorage');
              }
            }
            
            // ✅ CRÍTICO: Si hay policyId pero faltan indicadores de pago, forzar sincronización
            // ✅ SEGURIDAD: Solo verificar indicadores, NO datos completos
            if (actualData.policyId && (!actualData.hasPaymentData || !actualData.hasPaymentResult)) {
              this.logger.log('🔄 Detectado policyId sin indicadores de pago, forzando sincronización...', {
                policyId: actualData.policyId,
                hasPaymentData: actualData.hasPaymentData || false,
                hasPaymentResult: actualData.hasPaymentResult || false
              });
              try {
                const syncedData = await this.wizardSessionService.forceSync(activeSessionId).toPromise();
                if (syncedData) {
                  const syncedActualData = (syncedData as any).data || syncedData;
                  this.logger.log('✅ Sincronización forzada completada:', {
                    hasPaymentData: syncedActualData.hasPaymentData || false,
                    hasPaymentResult: syncedActualData.hasPaymentResult || false,
                    paymentStatus: syncedActualData.paymentStatus,
                    paymentAmount: syncedActualData.paymentAmount
                  });
                  // Usar datos sincronizados (solo indicadores)
                  Object.assign(actualData, {
                    hasPaymentData: syncedActualData.hasPaymentData,
                    hasPaymentResult: syncedActualData.hasPaymentResult,
                    paymentStatus: syncedActualData.paymentStatus,
                    paymentAmount: syncedActualData.paymentAmount
                  });
                }
              } catch (syncError) {
                this.logger.warning('⚠️ Error forzando sincronización:', syncError);
                // Continuar con los datos originales
              }
            }
            
            if (actualData && (actualData.id || actualData.sessionId)) {
              this.logger.log('📊 Estado de sesión cargado desde IP:', actualData);
              this.restoreSessionState(actualData, targetStep);
              return;
            }
          }
        } catch (error) {
          const errorStatus = (error as any)?.status;
          
          if (errorStatus === 404) {
            this.logger.log('❌ Sesión activa no existe (404), redirigiendo al home');
            this.wizardStateService.clearState();
            this.router.navigate(['/'], { replaceUrl: true });
            return;
          }
          
          // Si es 429, usar estado local si está disponible
          if (errorStatus === 429) {
            const currentState = this.wizardStateService.getState();
            if (currentState.sessionId === activeSessionId || currentState.id === activeSessionId) {
              this.logger.warning('⚠️ Rate limit alcanzado (429), usando estado local');
              this.restoreSessionState(currentState, targetStep);
              return;
            }
          }
          
          this.logger.log('⚠️ Error obteniendo sesión activa por IP:', error);
        }
      } else if (activeSessionId === sessionId) {
        // Si el sessionId activo es el mismo que el de la URL, ya intentamos cargarlo arriba
        // Si llegamos aquí es porque falló, así que crear nueva sesión
        this.logger.log('⚠️ Sesión de URL no se pudo cargar, creando nueva');
      }
      
      // TERCERO: Si no hay sesión activa o no se pudo cargar, crear nueva
      this.logger.log('🆕 No hay sesión activa o no se pudo cargar, creando nueva');
      this.initializeNewSession();
      
    } catch (error) {
      this.logger.error('❌ Error cargando sesión:', error);
      // En caso de error, intentar usar estado local si está disponible
      const currentState = this.wizardStateService.getState();
      if (currentState.sessionId || currentState.id) {
        this.logger.log('🔄 Usando estado local como fallback después de error');
        this.restoreSessionState(currentState, targetStep);
      } else {
        this.initializeNewSession();
      }
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
    
    // ✅ Obtener quotationId de la sesión del backend O del estado local del wizard
    const localState = this.wizardStateService.getState();
    this.quotationId = sessionData.quotationId || localState.quotationId || '';
    this.quotationNumber = sessionData.quotationNumber || localState.quotationNumber || ''; // ✅ Usar objeto principal
    this.userId = sessionData.userId || localState.userId || '';
    
    // Si encontramos quotationId en el estado local pero no en la sesión, guardarlo para sincronizar
    if (localState.quotationId && !sessionData.quotationId) {
      this.logger.log('🔑 quotationId encontrado en estado local, sincronizando con backend...');
      this.wizardStateService.saveState({
        quotationId: localState.quotationId,
        quotationNumber: localState.quotationNumber,
        userId: localState.userId
      });
    }
    
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
    this.modalCompletedSteps = this.calculateCompletedSteps(sessionData.stepData || {}, this.currentStep);
    
    this.logger.log('🔍 stepData usado para calcular progreso:', sessionData.stepData);
    this.logger.log('🔍 Paso actual para cálculo de progreso:', this.currentStep);
    
    this.logger.log('📊 Variables del modal llenadas:', {
      modalCurrentStep: this.modalCurrentStep,
      modalSelectedPlan: this.modalSelectedPlan,
      modalQuotationNumber: this.modalQuotationNumber,
      modalCompletedSteps: this.modalCompletedSteps,
      currentStepName: this.getStepName(this.modalCurrentStep)
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
    
    // ✅ NUEVO: Verificar y recuperar datos faltantes desde paso 2 en adelante
    if (this.currentStep >= 2) {
      this.verifyAndRecoverMissingData(sessionData);
    }
    
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
   * ✅ OPTIMIZADO: Hace merge inteligente entre datos locales (paso anterior) y datos de BD (refresh)
   * - Prioriza datos locales si son más recientes (vienen de paso anterior)
   * - Usa datos de BD si no hay datos locales o están desactualizados (viene de refresh)
   */
  private syncLocalStateWithBD(sessionData: any): void {
    const stepData = sessionData.stepData || {};
    
    // ✅ Obtener estado local actual para hacer merge inteligente
    const currentLocalState = this.wizardStateService.getState();
    const isRefresh = !currentLocalState.sessionId || currentLocalState.sessionId !== sessionData.sessionId;
    
    this.logger.log('🔄 Sincronizando estado:', {
      source: isRefresh ? 'BD (refresh)' : 'Merge (paso anterior + BD)',
      localSessionId: currentLocalState.sessionId,
      bdSessionId: sessionData.sessionId
    });
    
    // Construir paymentResult desde BD si existe policyId y policyNumber
    const bdPaymentResult = sessionData.paymentResult || 
                           (sessionData.policyId && sessionData.policyNumber ? {
                             success: true,
                             policyId: sessionData.policyId,
                             policyNumber: sessionData.policyNumber,
                             paymentId: sessionData.paymentResult?.paymentId || 'N/A',
                             chargeId: sessionData.paymentResult?.chargeId || 'N/A',
                             status: 'COMPLETED',
                             message: 'Pago procesado exitosamente'
                           } : null);
    
    // ✅ MERGE INTELIGENTE: Priorizar datos locales si existen y son válidos, sino usar datos de BD
    const mergedState: any = {
      // Campos principales del backend (siempre desde BD)
      id: sessionData.id,
      sessionId: sessionData.sessionId,
      userId: sessionData.userId || currentLocalState.userId,
      currentStep: sessionData.currentStep || currentLocalState.currentStep || 0,
      stepData: { ...currentLocalState.stepData, ...stepData }, // Merge de stepData
      completedSteps: sessionData.completedSteps || currentLocalState.completedSteps || [],
      status: sessionData.status || currentLocalState.status || 'ACTIVE',
      expiresAt: sessionData.expiresAt ? new Date(sessionData.expiresAt) : currentLocalState.expiresAt,
      quotationId: sessionData.quotationId || currentLocalState.quotationId,
      policyId: sessionData.policyId || currentLocalState.policyId,
      metadata: { ...currentLocalState.metadata, ...(sessionData.metadata || {}) },
      publicIp: sessionData.publicIp || currentLocalState.publicIp,
      userAgent: sessionData.userAgent || currentLocalState.userAgent,
      lastActivityAt: sessionData.lastActivityAt ? new Date(sessionData.lastActivityAt) : currentLocalState.lastActivityAt,
      completedAt: sessionData.completedAt ? new Date(sessionData.completedAt) : currentLocalState.completedAt,
      createdAt: sessionData.createdAt ? new Date(sessionData.createdAt) : currentLocalState.createdAt,
      updatedAt: sessionData.updatedAt ? new Date(sessionData.updatedAt) : currentLocalState.updatedAt,
      
      // Campos de control del frontend
      timestamp: Date.now(),
      lastActivity: Date.now(),
      
      // ✅ MERGE INTELIGENTE: Priorizar datos locales si existen, sino usar BD
      selectedPlan: currentLocalState.selectedPlan || sessionData.selectedPlan || '',
      selectedPlanName: currentLocalState.selectedPlanName || sessionData.selectedPlanName || '',
      quotationNumber: currentLocalState.quotationNumber || sessionData.quotationNumber || '',
      userData: currentLocalState.userData || sessionData.userData || null,
      paymentData: currentLocalState.paymentData || sessionData.paymentData || null,
      contractData: currentLocalState.contractData || sessionData.contractData || null,
      
      // ✅ MERGE INTELIGENTE: paymentResult - priorizar local si existe, sino construir desde BD
      paymentResult: currentLocalState.paymentResult || bdPaymentResult,
      
      // Campos adicionales - merge inteligente
      policyNumber: currentLocalState.policyNumber || sessionData.policyNumber || '',
      paymentAmount: currentLocalState.paymentAmount || sessionData.paymentAmount || null,
      validationResult: currentLocalState.validationResult || sessionData.validationResult || stepData.step5?.validationData || null,
      
      // ✅ MERGE INTELIGENTE: validationRequirements y captureData
      validationRequirements: currentLocalState.validationRequirements || 
                               sessionData.validationRequirements || 
                               stepData.step5?.validationRequirements || 
                               null,
      captureData: currentLocalState.captureData || 
                   sessionData.captureData || 
                   sessionData.contractData || 
                   null
    };

    this.logger.log('🔄 Estado mergeado (local + BD):', {
      id: mergedState.id,
      sessionId: mergedState.sessionId,
      currentStep: mergedState.currentStep,
      hasLocalPaymentResult: !!currentLocalState.paymentResult,
      hasBdPaymentResult: !!bdPaymentResult,
      finalPaymentResult: !!mergedState.paymentResult,
      hasLocalUserData: !!currentLocalState.userData,
      hasBdUserData: !!sessionData.userData,
      finalUserData: !!mergedState.userData
    });

    // Guardar el estado mergeado en el servicio local
    this.wizardStateService.saveState(mergedState);
  }

  /**
   * Verifica y recupera datos faltantes desde paso 2 en adelante
   * ✅ Si faltan datos críticos que deberían existir según el paso actual,
   * los busca en la API y actualiza la sesión
   * 
   * Lógica:
   * - Paso 2 (Payment): Usa quotationId para buscar cotización
   * - Paso 3+ (Validation y superiores): Usa policyId para buscar pago directamente
   */
  private async verifyAndRecoverMissingData(sessionData: any): Promise<void> {
    const currentState = this.wizardStateService.getState();
    const step = this.currentStep;
    
    this.logger.log('🔍 Verificando datos faltantes para paso:', {
      step,
      stepName: this.getStepName(step),
      quotationId: currentState.quotationId,
      policyId: currentState.policyId,
      hasPaymentResult: !!currentState.paymentResult,
      hasPaymentAmount: !!currentState.paymentAmount
    });
    
    try {
      // Paso 2 (Payment): Debería tener quotationId y quotationNumber
      // ✅ Usa quotationId para buscar datos de cotización
      if (step === 2) {
        if (!currentState.quotationId && sessionData.quotationId) {
          this.logger.log('📋 Recuperando datos de cotización faltantes desde quotationId...');
          await this.recoverQuotationData(sessionData.quotationId);
        }
      }
      
      // Paso 3 (Validation) y superiores: Debería tener policyId, policyNumber, paymentResult, paymentAmount
      // ✅ Usa policyId directamente para buscar el pago
      if (step >= 3) {
        // Si hay policyId pero no hay paymentResult o paymentAmount, buscar el pago directamente por policyId
        if (currentState.policyId && (!currentState.paymentResult || !currentState.paymentAmount)) {
          this.logger.log('💳 Recuperando datos de pago faltantes desde policyId (paso 3+)...');
          await this.recoverPaymentDataByPolicy(currentState.policyId);
        }
        // Si no hay quotationId pero debería haberlo (paso 3+), intentar recuperarlo
        else if (!currentState.quotationId && sessionData.quotationId) {
          this.logger.log('📋 Recuperando datos de cotización faltantes desde quotationId...');
          await this.recoverQuotationData(sessionData.quotationId);
        }
      }
      
      // Paso 4+ (Data Entry): Si hay policyId pero no hay captureData, se cargará en el step
      // Paso 5+ (Contract): Si hay policyId pero no hay contractData, se cargará en el step
      
    } catch (error) {
      this.logger.error('❌ Error recuperando datos faltantes:', error);
      // No lanzar error, continuar con el flujo normal
    }
  }

  /**
   * Recupera datos de cotización desde la API
   */
  private async recoverQuotationData(quotationId: string): Promise<void> {
    try {
      const currentState = this.wizardStateService.getState();
      const response = await this.quotationsService.getQuotationById(quotationId).toPromise();
      if (response?.success && response.data) {
        const quotation = response.data;
        this.logger.log('✅ Cotización recuperada:', quotation);
        
        // Actualizar estado con datos de cotización
        this.wizardStateService.saveState({
          quotationId: quotation.id || quotationId,
          quotationNumber: quotation.quotationNumber || currentState.quotationNumber,
          paymentAmount: parseFloat(quotation.finalPrice || quotation.basePrice || '0') || currentState.paymentAmount
        });
        
        // Sincronizar con backend
        await this.wizardStateService.syncWithBackendCorrected(this.wizardStateService.getState());
        this.logger.log('✅ Datos de cotización actualizados en sesión');
      }
    } catch (error) {
      this.logger.error('❌ Error recuperando cotización:', error);
    }
  }

  /**
   * Recupera datos de pago desde la API usando policyId
   * ✅ Busca el pago directamente desde la API usando policyId (pasos 3+)
   * ✅ Usa policyNumber y quotationNumber de la sesión si están disponibles
   */
  private async recoverPaymentDataByPolicy(policyId: string): Promise<void> {
    try {
      const currentState = this.wizardStateService.getState();
      
      this.logger.log('🔍 Buscando pago directamente por policyId:', policyId);
      
      // ✅ Primero intentar obtener policyNumber desde la sesión (más eficiente)
      let sessionPolicyNumber = currentState.policyNumber;
      if (!sessionPolicyNumber) {
        // Si no está en el estado local, obtenerlo desde la sesión del backend
        try {
          const sessionResponse = await this.wizardSessionService.getSession(
            currentState.id || currentState.sessionId
          ).toPromise();
          if (sessionResponse) {
            const sessionData = (sessionResponse as any).data || sessionResponse;
            sessionPolicyNumber = sessionData.policyNumber;
            this.logger.log('📋 policyNumber obtenido desde sesión:', sessionPolicyNumber);
          }
        } catch (error) {
          this.logger.warning('⚠️ No se pudo obtener policyNumber desde sesión');
        }
      }
      
      // Buscar el pago directamente por policyId desde la API
      const paymentResponse = await this.paymentsService.getPaymentByPolicyId(policyId).toPromise();
      
      this.logger.log('📡 Respuesta completa del endpoint getPaymentByPolicyId:', paymentResponse);
      
      // Manejar diferentes formatos de respuesta
      let payment: any = null;
      
      if (paymentResponse) {
        // Si viene envuelto en ApiResponse
        if ((paymentResponse as any).success && (paymentResponse as any).data) {
          payment = (paymentResponse as any).data;
          this.logger.log('✅ Pago encontrado en formato ApiResponse:', payment);
        }
        // Si viene directamente el objeto Payment
        else if ((paymentResponse as any).id || (paymentResponse as any).policyId) {
          payment = paymentResponse;
          this.logger.log('✅ Pago encontrado en formato directo:', payment);
        }
        // Si viene en otro formato
        else {
          this.logger.warning('⚠️ Formato de respuesta inesperado:', paymentResponse);
        }
      }
      
      if (payment && (payment.policyId === policyId || payment.id)) {
        // ✅ Obtener policyNumber: primero de la sesión, luego del pago, luego del estado local
        const policyNumber = sessionPolicyNumber || 
                            (payment as any).policyNumber || 
                            (payment as any).policy?.policyNumber || 
                            currentState.policyNumber || 
                            'N/A';
        
        this.logger.log('📋 policyNumber obtenido (sesión > pago > estado):', policyNumber);
        
        // Construir paymentResult desde los datos del pago
        const paymentResult = {
          success: true,
          policyId: payment.policyId || policyId,
          policyNumber: policyNumber !== 'N/A' ? policyNumber : (currentState.policyNumber || 'N/A'),
          paymentId: payment.id || payment.paymentId || 'N/A',
          chargeId: payment.openpayChargeId || payment.chargeId || 'N/A',
          status: (payment.status as string) === 'POLICY_CREATED' ? 'COMPLETED' : (payment.status || 'COMPLETED'),
          message: 'Pago procesado exitosamente'
        };
        
        this.logger.log('✅ Datos de pago recuperados directamente por policyId:', paymentResult);
        
        // Actualizar estado con datos de pago (incluyendo paymentData completo)
        this.wizardStateService.saveState({
          paymentResult: paymentResult,
          paymentData: payment, // ✅ Guardar paymentData completo
          policyId: payment.policyId || policyId,
          policyNumber: policyNumber !== 'N/A' ? policyNumber : currentState.policyNumber,
          paymentAmount: payment.amount || currentState.paymentAmount
        });
        
        // Sincronizar con backend
        await this.wizardStateService.syncWithBackendCorrected(this.wizardStateService.getState());
        this.logger.log('✅ Datos de pago actualizados en sesión desde policyId');
        return;
      }
      
      // Si no se encontró directamente, intentar desde quotationId como fallback
      if (currentState.quotationId) {
        this.logger.log('⚠️ No se encontró pago por policyId, intentando desde quotationId como fallback...');
        try {
          await this.recoverPaymentDataByQuotation(currentState.quotationId);
          const updatedState = this.wizardStateService.getState();
          if (updatedState.paymentResult && updatedState.policyId === policyId) {
            this.logger.log('✅ Pago recuperado exitosamente desde quotationId (fallback)');
            return;
          }
        } catch (error) {
          this.logger.warning('⚠️ No se pudo recuperar pago desde quotationId tampoco');
        }
      }
      
      // Si no se encontraron datos, loguear advertencia
      this.logger.warning('⚠️ No se encontraron datos de pago para policyId:', policyId);
      this.logger.log('💡 Sugerencia: Verificar que el pago esté asociado correctamente a la póliza');
      
    } catch (error: any) {
      this.logger.error('❌ Error recuperando pago por policyId:', error);
      this.logger.error('❌ Detalles del error:', {
        message: error?.message,
        status: error?.status,
        error: error?.error,
        url: error?.url
      });
      
      // Intentar fallback desde quotationId si hay error
      const currentState = this.wizardStateService.getState();
      if (currentState.quotationId) {
        this.logger.log('🔄 Intentando recuperar desde quotationId como fallback después de error...');
        try {
          await this.recoverPaymentDataByQuotation(currentState.quotationId);
        } catch (fallbackError) {
          this.logger.error('❌ Error en fallback desde quotationId:', fallbackError);
        }
      }
    }
  }

  /**
   * Recupera datos de pago desde la API usando quotationId
   * ✅ Usa quotationNumber de la sesión si está disponible
   */
  private async recoverPaymentDataByQuotation(quotationId: string): Promise<void> {
    try {
      const currentState = this.wizardStateService.getState();
      
      // ✅ Primero intentar obtener quotationNumber desde la sesión (más eficiente)
      let sessionQuotationNumber = currentState.quotationNumber;
      if (!sessionQuotationNumber) {
        // Si no está en el estado local, obtenerlo desde la sesión del backend
        try {
          const sessionResponse = await this.wizardSessionService.getSession(
            currentState.id || currentState.sessionId
          ).toPromise();
          if (sessionResponse) {
            const sessionData = (sessionResponse as any).data || sessionResponse;
            sessionQuotationNumber = sessionData.quotationNumber;
            this.logger.log('📋 quotationNumber obtenido desde sesión:', sessionQuotationNumber);
          }
        } catch (error) {
          this.logger.warning('⚠️ No se pudo obtener quotationNumber desde sesión');
        }
      }
      
      // Primero obtener la cotización para ver si tiene paymentId
      const quotationResponse = await this.quotationsService.getQuotationById(quotationId).toPromise();
      
      if (quotationResponse?.success && quotationResponse.data) {
        const quotation = quotationResponse.data;
        
        // Si la cotización tiene un paymentId, obtener el pago
        if ((quotation as any).paymentId) {
          const paymentResponse = await this.paymentsService.getPaymentById((quotation as any).paymentId).toPromise();
          
          if (paymentResponse?.success && paymentResponse.data) {
            const payment = paymentResponse.data;
            
            // ✅ Obtener policyNumber: primero de la sesión, luego del pago, luego del estado local
            const sessionPolicyNumber = currentState.policyNumber;
            const policyNumber = sessionPolicyNumber || 
                                (payment as any).policyNumber || 
                                (payment as any).policy?.policyNumber || 
                                currentState.policyNumber || 
                                'N/A';
            
            // Construir paymentResult desde los datos del pago
            const paymentResult = {
              success: true,
              policyId: (payment as any).policyId || currentState.policyId || 'N/A',
              policyNumber: policyNumber !== 'N/A' ? policyNumber : (currentState.policyNumber || 'N/A'),
              paymentId: payment.id || (payment as any).paymentId || 'N/A',
              chargeId: (payment as any).openpayChargeId || (payment as any).chargeId || 'N/A',
              status: ((payment as any).status as string) === 'POLICY_CREATED' ? 'COMPLETED' : (payment.status || 'COMPLETED'),
              message: 'Pago procesado exitosamente'
            };
            
            this.logger.log('✅ Datos de pago recuperados desde quotationId:', paymentResult);
            
            // Actualizar estado con datos de pago
            this.wizardStateService.saveState({
              paymentResult: paymentResult,
              quotationNumber: sessionQuotationNumber || quotation.quotationNumber || currentState.quotationNumber,
              policyId: paymentResult.policyId !== 'N/A' ? paymentResult.policyId : undefined,
              policyNumber: policyNumber !== 'N/A' ? policyNumber : undefined,
              paymentAmount: payment.amount || currentState.paymentAmount
            });
            
            // Sincronizar con backend
            await this.wizardStateService.syncWithBackendCorrected(this.wizardStateService.getState());
            this.logger.log('✅ Datos de pago actualizados en sesión');
          }
        }
      }
    } catch (error) {
      this.logger.error('❌ Error recuperando pago por quotationId:', error);
    }
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
      this.selectedPlanName = savedState.selectedPlanName || '';
      this.quotationId = savedState.quotationId || '';
      this.quotationNumber = savedState.quotationNumber || '';
      this.userId = savedState.userId || '';
      
      // Si tenemos quotationId en el estado local pero no en el componente, actualizarlo
      if (savedState.quotationId && !this.quotationId) {
        this.quotationId = savedState.quotationId;
        this.logger.log('🔑 quotationId restaurado desde estado local:', this.quotationId);
      }
      
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
      this.modalCompletedSteps = this.calculateCompletedSteps(savedState.stepData || {}, this.currentStep);
      
      this.logger.log('📊 Variables del modal llenadas desde estado local:', {
        modalCurrentStep: this.modalCurrentStep,
        modalSelectedPlan: this.modalSelectedPlan,
        modalQuotationNumber: this.modalQuotationNumber,
        modalCompletedSteps: this.modalCompletedSteps,
        currentStepName: this.getStepName(this.modalCurrentStep)
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
    
    this.logger.log('📧 Cotización enviada por email:', quotationNumber);
    
    // ✅ Agrupar todos los cambios en una sola actualización para evitar múltiples sincronizaciones
    const currentState = this.wizardStateService.getState();
    const updatedCompletedSteps = [...(currentState.completedSteps || [])];
    if (!updatedCompletedSteps.includes(1)) {
      updatedCompletedSteps.push(1);
    }
    if (!updatedCompletedSteps.includes(2)) {
      updatedCompletedSteps.push(2);
    }
    
    // Actualizar estado local primero (sin sincronizar todavía)
    this.currentStep = 6;
    this.wizardStateService.saveState({
      currentStep: 6,
      completedSteps: updatedCompletedSteps,
      quotationNumber: quotationNumber,
      metadata: {
        ...(currentState.metadata || {}),
        quotationSentByEmail: true
      }
    });
    
    // ✅ Sincronizar una sola vez con todos los cambios agrupados
    this.wizardStateService.syncWithBackendCorrected(this.wizardStateService.getState()).catch(error => {
      this.logger.error('❌ Error sincronizando estado después de enviar cotización:', error);
      // No bloquear el cambio de pantalla si hay error de sincronización
    });
    
    this.logger.log('✅ Cotización enviada, cambiando al paso de finalización (step 6)');
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
      userId: this.userId,
      paymentAmount: quotationData.quotationAmount || quotationData.finalPrice || quotationData.basePrice || 0,
      selectedPlanName: quotationData.plan?.name || this.selectedPlanName || ''
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
    this.setCurrentStep(6); // Ir al paso 6 (CONTRACT)
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

  nextStep(): void {
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
    // En desarrollo, permitir navegación libre entre pasos
    // En producción, solo permitir navegación secuencial
    const isDevelopment = !environment.production;
    
    if (index >= 0 && index < this.steps.length) {
      if (isDevelopment) {
        // Modo desarrollo: permitir navegación libre
        this.logger.log(`🔧 [DEV] Navegación libre al paso ${index}`);
        this.setCurrentStep(index);
      } else {
        // Modo producción: solo permitir navegación secuencial o a pasos completados
        const currentState = this.wizardStateService.getState();
        const isCompleted = currentState.completedSteps.includes(index);
        const isNext = index === this.currentStep + 1;
        
        if (isNext || isCompleted || index < this.currentStep) {
          this.setCurrentStep(index);
        } else {
          this.logger.log(`⚠️ No se puede navegar al paso ${index} - no está completado y no es el siguiente`);
        }
      }
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
    // Limpiar estado del wizard
    this.wizardStateService.clearState();
    
    // Redirigir a la landing page en lugar de solo resetear el wizard
    this.logger.log('🏠 Redirigiendo a la landing page');
    window.location.href = '/';
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
   * ✅ OPTIMIZADO: Solo navega si no estamos ya en la ruta correcta para evitar doble inicialización
   */
  onContinueWizard(): void {
    this.logger.log('✅ Usuario decidió continuar el wizard');
    
    // Obtener estado actual y sessionId
    const currentState = this.wizardStateService.getState();
    const sessionId = currentState.id || currentState.sessionId;
    
    if (!sessionId) {
      this.logger.warning('⚠️ No hay sessionId para navegar al cotizador');
      this.showContinueModal = false;
      return;
    }
    
    // ✅ OPTIMIZADO: Verificar si ya estamos en la ruta correcta
    const currentUrl = this.router.url;
    const expectedUrl = `/cotizador/${sessionId}`;
    
    if (currentUrl === expectedUrl || currentUrl.startsWith(expectedUrl + '/')) {
      this.logger.log('✅ Ya estamos en la ruta correcta, solo cerrando modal (evita doble inicialización)');
      this.showContinueModal = false;
      return;
    }
    
    // Solo navegar si estamos en una ruta diferente
    this.logger.log('🎯 Navegando al cotizador con sesión:', sessionId);
    this.showContinueModal = false;
    this.router.navigate(['/cotizador', sessionId]);
  }

  /**
   * Maneja la decisión de reiniciar el wizard
   */
  onRestartWizard() {
    // Mostrar diálogo de confirmación moderno
    this.confirmDialogTitle = '¿Estás seguro de que deseas empezar de nuevo?';
    this.confirmDialogMessage = 'Se perderá todo el progreso actual y se iniciará un nuevo proceso de cotización.';
    this.confirmDialogWarning = 'Esta acción no se puede deshacer.';
    this.showConfirmDialog = true;
  }

  /**
   * Confirma el reinicio del wizard
   */
  async onConfirmRestart() {
    this.showConfirmDialog = false;
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
    
    this.logger.log('✅ Wizard reiniciado exitosamente');
  }

  /**
   * Cancela el reinicio del wizard
   */
  onCancelRestart() {
    this.showConfirmDialog = false;
    this.logger.log('❌ Usuario canceló el reinicio del wizard');
  }

  /**
   * Calcula el número de pasos completados basado en los datos reales guardados
   * ✅ MEJORADO: Incluye el paso actual si está en progreso
   * Estructura real del wizard (7 pasos: 0-6):
   * - Paso 0: Bienvenida (tipo de usuario) → stepData.step0.tipoUsuario
   * - Paso 1: Datos principales → stepData.step1 (nombre, telefono, correo, rentaMensual)
   * - Paso 2: Pago → stepData.step2 (paymentMethod, cardData)
   * - Paso 3: Validación → stepData.step3 (validationCode)
   * - Paso 4: Captura de datos → stepData.step4 (propietario, inquilino, fiador, inmueble)
   * - Paso 5: Contrato → stepData.step5 (contractTerms, signatures)
   * - Paso 6: Final → stepData.step6 (deliveryPreferences)
   */
  private calculateCompletedSteps(stepData: any, currentStep?: number): number {
    let completedSteps = 0;
    
    this.logger.log('🔍 Calculando pasos completados desde stepData:', JSON.stringify(stepData, null, 2));
    this.logger.log('🔍 Paso actual:', currentStep);
    
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
    
    // ✅ MEJORADO: Si el paso actual es mayor que los pasos completados,
    // significa que está en progreso, así que lo incluimos en el conteo para el progreso visual
    // pero solo si no está ya completado
    if (currentStep !== undefined && currentStep >= 0) {
      const currentStepKey = `step${currentStep}`;
      const isCurrentStepCompleted = stepData[currentStepKey] !== undefined;
      
      // Si el paso actual no está completado pero estamos en ese paso, incluirlo en el progreso visual
      // Esto ayuda a mostrar mejor el progreso real del usuario
      if (!isCurrentStepCompleted && currentStep > completedSteps) {
        this.logger.log(`ℹ️ Paso actual ${currentStep} está en progreso, ajustando conteo visual`);
        // No incrementamos completedSteps aquí porque no está completado,
        // pero el modal mostrará correctamente el paso actual
      }
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



