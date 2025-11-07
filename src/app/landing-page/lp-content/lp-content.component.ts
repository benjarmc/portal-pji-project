import { Component, OnInit } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { WizardStateService } from '../../services/wizard-state.service';
import { WizardSessionService } from '../../services/wizard-session.service';
import { CommonModule } from '@angular/common';
import { ContinueWizardModalComponent } from '../../components/continue-wizard-modal/continue-wizard-modal.component';
import { LpHeaderComponent } from '../lp-header/lp-header.component';
import { LpFooterComponent } from '../lp-footer/lp-footer.component';
import { SeoService } from '../../services/seo.service';
import { PlansService } from '../../services/plans.service';
import { Plan } from '../../models/plan.model';
import { LoggerService } from '../../services/logger.service';

@Component({
  selector: 'app-lp-content',
  standalone: true,
  imports: [
    CommonModule,
    LpHeaderComponent,
    LpFooterComponent,
    ContinueWizardModalComponent
  ],
  templateUrl: './lp-content.component.html',
  styleUrls: ['./lp-content.component.scss']
})
export class LpContentComponent implements OnInit {
  faqOpenIndex: number | null = 0;
  plans: Plan[] = [];
  loadingPlans = true;
  private plansLoaded = false; // Flag para evitar múltiples llamadas
  // Estado del modal de continuar sesión
  showContinueModal = false;
  pendingPlanId: string | null = null;
  existingSessionId: string | null = null;
  // Datos mínimos para el modal (podrían venir de restauración en el futuro)
  modalCurrentStep = 0;
  modalSelectedPlan: string | null = null;
  modalSelectedPlanName: string | null = null;
  modalQuotationNumber: string | null = null;
  modalPolicyNumber: string | null = null;
  modalCompletedSteps = 0;

  faqs = [
    {
      question: '¿Qué pasa si mi inquilino no paga la renta?',
      answer: 'Iniciamos de inmediato el proceso legal para recuperar rentas y, si es necesario, desocupar el inmueble. Nuestro equipo de abogados se encarga de todo.'
    },
    {
      question: '¿La firma electrónica es legal?',
      answer: 'Sí, la firma electrónica tiene validez legal y es utilizada en todos nuestros procesos.'
    },
    {
      question: '¿Cuánto tarda la contratación?',
      answer: 'El proceso es inmediato y 100% digital. En minutos puedes tener tu póliza.'
    }
  ];

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private seoService: SeoService,
    private plansService: PlansService,
    private wizardStateService: WizardStateService,
    private wizardSessionService: WizardSessionService,
    private logger: LoggerService
  ) {}

  ngOnInit() {
    this.seoService.setPageSeo({
      title: 'Protección Jurídica Inmobiliaria - Seguros para Propietarios',
      description: 'Protege tu inversión inmobiliaria con nuestras pólizas jurídicas digitales. Cobertura legal completa para propietarios de inmuebles en renta.',
      keywords: 'seguro inmobiliario, protección jurídica, póliza digital, propietarios, renta, legal',
      type: 'website'
    });
    
    this.loadPlans();
  }

  /**
   * Carga los planes desde la base de datos
   * ✅ OPTIMIZADO: Evita múltiples llamadas usando cache del servicio
   */
  loadPlans() {
    // Si ya se cargaron planes, no recargar
    if (this.plansLoaded && this.plans.length > 0) {
      this.logger.log('📦 Planes ya cargados, usando cache');
      return;
    }
    
    this.logger.log('🔍 loadPlans() llamado');
    this.loadingPlans = true;
    
    this.plansService.getPlans().subscribe({
      next: (response) => {
        this.loadingPlans = false;
        this.logger.log('📡 Respuesta del servicio:', response);
        if (response.success && response.data && response.data.length > 0) {
          this.plans = response.data;
          this.plansLoaded = true;
          this.logger.log('✅ Planes cargados en landing page:', this.plans);
          this.logger.log('📊 Cantidad de planes:', this.plans.length);
        } else {
          this.logger.log('⚠️ Respuesta sin datos o vacía:', response);
          this.plans = [];
        }
      },
      error: (error) => {
        this.loadingPlans = false;
        this.logger.error('❌ Error al cargar planes:', error);
        this.plans = [];
      }
    });
  }

  toggleFaq(index: number) {
    this.faqOpenIndex = this.faqOpenIndex === index ? null : index;
  }

  scrollToPlans() {
    const plansSection = document.getElementById('lp-plans-section');
    if (plansSection) {
      plansSection.scrollIntoView({ behavior: 'smooth' });
    }
  }

  async startWizard(planId: string) {
    this.logger.log('🚀 Iniciando wizard con plan ID:', planId);

    // Obtener el nombre del plan
    const selectedPlan = this.plans.find(plan => plan.id === planId);
    const planName = selectedPlan?.name || 'Plan Desconocido';
    this.logger.log('📋 Plan seleccionado:', { id: planId, name: planName });

    // 1) Verificar si hay sesión activa por IP (siempre validar con backend)
    this.logger.log('🔍 Verificando sesión activa por IP...');
    let existingSessionId: string | null = await this.wizardStateService.checkActiveSessionByIp();
    this.logger.log('📋 Resultado de verificación de sesión:', existingSessionId);

    // 2) Si hay sesión activa, validar que existe en el backend antes de mostrar modal
    if (existingSessionId) {
      try {
        this.logger.log('📡 Validando sesión existente en el backend...');
        const sessionData = await this.wizardSessionService.getSession(existingSessionId).toPromise();
        
        if (sessionData) {
          // Manejar tanto respuesta envuelta como directa
          const actualData = (sessionData as any).data || sessionData;
          
          // ✅ VALIDAR: Solo mostrar modal si la sesión tiene datos reales (no es solo un estado por defecto)
          const hasRealData = actualData.currentStep > 0 || 
                             actualData.selectedPlan || 
                             actualData.quotationId || 
                             actualData.policyId ||
                             (actualData.stepData && Object.keys(actualData.stepData).length > 0);
          
          if (hasRealData) {
            this.logger.log('✅ Sesión válida encontrada con datos reales:', {
              currentStep: actualData.currentStep,
              selectedPlan: actualData.selectedPlan,
              hasQuotation: !!actualData.quotationId,
              hasPolicy: !!actualData.policyId
            });
            
            // Guardar estado para acciones del modal
            this.existingSessionId = existingSessionId;
            this.pendingPlanId = planId;
            
            this.modalCurrentStep = actualData.currentStep || 0;
            this.modalSelectedPlan = actualData.selectedPlan || null;
            this.modalSelectedPlanName = actualData.selectedPlanName || null;
            this.modalQuotationNumber = actualData.quotationNumber || actualData.stepData?.step3?.quotationNumber || null;
            this.modalPolicyNumber = actualData.policyNumber || null;
            
            // Calcular pasos completados basado en los datos reales
            this.modalCompletedSteps = this.calculateCompletedSteps(actualData.stepData || {});
            
            this.logger.log('📊 Datos del modal desde BD:', {
              currentStep: this.modalCurrentStep,
              selectedPlan: this.modalSelectedPlan,
              quotationNumber: this.modalQuotationNumber,
              completedSteps: this.modalCompletedSteps
            });
            
            // Mostrar modal solo si hay datos reales
            this.showContinueModal = true;
            return;
          } else {
            this.logger.log('⚠️ Sesión encontrada pero sin datos reales, limpiando y creando nueva');
            // Limpiar estado local si la sesión no tiene datos reales
            this.wizardStateService.clearState();
            existingSessionId = null; // Continuar con creación de nueva sesión
          }
        }
      } catch (error) {
        const errorStatus = (error as any)?.status;
        
        // Si es 404 o 500, la sesión no existe en el backend, limpiar estado local
        if (errorStatus === 404 || errorStatus === 500) {
          this.logger.log('❌ Sesión no existe en el backend (404/500), limpiando estado local');
          this.wizardStateService.clearState();
          existingSessionId = null; // Continuar con creación de nueva sesión
        } else if (errorStatus === 429) {
          // Si es 429, no mostrar modal (no sabemos si la sesión es válida)
          this.logger.warning('⚠️ Rate limit alcanzado (429), no se puede validar sesión, creando nueva');
          existingSessionId = null; // Continuar con creación de nueva sesión
        } else {
          this.logger.warning('❌ Error validando sesión:', error);
          existingSessionId = null; // Continuar con creación de nueva sesión
        }
      }
    }
    
    // 3) Si no hay sesión válida o no se pudo validar, crear nueva sesión
    if (!existingSessionId) {
      this.logger.log('🆕 No hay sesión existente, creando nueva...');
      // Crear una nueva sesión
      const newSessionId = await this.wizardStateService.createNewSession();
      
      // ✅ OPTIMIZADO: Usar saveAndSync() para cambios críticos (seleccionar plan)
      // Esto guarda localmente Y sincroniza con backend en una sola operación
      try {
        this.logger.log('📡 Actualizando nueva sesión en BD con plan:', { id: planId, name: planName });
        const updatedState = await this.wizardStateService.saveAndSync({
          selectedPlan: planId,
          selectedPlanName: planName,
          currentStep: 0,
          stepData: {
            step0: {
              tipoUsuario: '', // Se establecerá más adelante en el wizard
              timestamp: new Date()
            }
          }
        });
        
        // saveAndSync ya retorna los datos actualizados, sincronizar directamente
        this.syncLocalStateWithBD(updatedState);
        
        this.logger.log('✅ Nueva sesión creada y actualizada en BD con selectedPlan:', planId);
      } catch (error) {
        this.logger.warning('❌ No se pudo actualizar la nueva sesión con el plan:', error);
      }
      
      // Marcar en sessionStorage que se navegó desde la selección de plan
      sessionStorage.setItem('navigatedFromPlan', 'true');
      
      // Usar el id (UUID) si está disponible, sino usar sessionId como fallback
      const sessionIdForUrl = this.wizardStateService.getState().id || newSessionId;
      this.router.navigate(['/cotizador', sessionIdForUrl]);
    }
  }

  async onContinueExisting() {
    if (!this.existingSessionId || !this.pendingPlanId) {
      this.showContinueModal = false;
      return;
    }
    
    // Obtener el nombre del plan
    const selectedPlan = this.plans.find(plan => plan.id === this.pendingPlanId);
    const planName = selectedPlan?.name || 'Plan Desconocido';
    
    this.logger.log('🔄 Iniciando proceso de "Continuar" con sesión existente:', this.existingSessionId);
    
    // Obtener datos completos de la sesión desde el backend para verificar si tiene selectedPlan
    try {
      this.logger.log('📡 Obteniendo datos de sesión existente...');
      // ✅ IMPORTANTE: Solicitar tokens al continuar sesión existente
      const sessionData = await this.wizardSessionService.getSession(this.existingSessionId, true).toPromise();
      if (sessionData) {
        // Manejar tanto respuesta envuelta como directa
        const actualData = (sessionData as any).data || sessionData;
        this.logger.log('📋 Datos de sesión existente:', actualData);
        
        // ✅ IMPORTANTE: Guardar tokens si vienen en la respuesta
        if (actualData.accessToken && actualData.refreshToken) {
          this.logger.log('🔑 Tokens recibidos al continuar sesión, guardándolos...', {
            accessToken: actualData.accessToken.substring(0, 20) + '...',
            refreshToken: actualData.refreshToken.substring(0, 20) + '...'
          });
          if (typeof window !== 'undefined' && window.localStorage) {
            localStorage.setItem('wizard_access_token', actualData.accessToken);
            localStorage.setItem('wizard_refresh_token', actualData.refreshToken);
            this.logger.log('✅ Tokens guardados en localStorage al continuar sesión');
            
            // Verificar que se guardaron correctamente
            const savedToken = localStorage.getItem('wizard_access_token');
            if (savedToken) {
              this.logger.log('✅ Verificación: Token guardado correctamente en localStorage');
            } else {
              this.logger.error('❌ Error: Token no se guardó en localStorage');
            }
          }
        } else {
          this.logger.warning('⚠️ No se recibieron tokens al continuar sesión. Verificar backend.', {
            hasAccessToken: !!actualData.accessToken,
            hasRefreshToken: !!actualData.refreshToken,
            actualDataKeys: Object.keys(actualData)
          });
        }
        
        // Verificar si la sesión ya tiene selectedPlan
        const hasSelectedPlan = actualData.selectedPlan || 
                               actualData.stepData?.step1?.selectedPlan || 
                               actualData.stepData?.step0?.selectedPlan;
        
        this.logger.log('🔍 Verificando selectedPlan en sesión existente:', {
          hasSelectedPlan: !!hasSelectedPlan,
          selectedPlan: hasSelectedPlan,
          pendingPlanId: this.pendingPlanId
        });
        
        // Solo agregar selectedPlan si la sesión NO lo tiene
        if (!hasSelectedPlan) {
          this.logger.log('➕ Agregando selectedPlan a sesión existente:', this.pendingPlanId);
          
          // ✅ OPTIMIZADO: Usar saveAndSync() para cambios críticos (agregar plan a sesión existente)
          try {
            this.logger.log('📡 Actualizando sesión existente en BD con nuevo plan:', this.pendingPlanId);
            const updatedState = await this.wizardStateService.saveAndSync({
              sessionId: this.existingSessionId,
              selectedPlan: this.pendingPlanId,
              selectedPlanName: planName,
              currentStep: actualData.currentStep || 0,
              stepData: {
                ...actualData.stepData,
                step0: {
                  ...actualData.stepData?.step0,
                  tipoUsuario: actualData.stepData?.step0?.tipoUsuario || '',
                  timestamp: new Date()
                }
              }
            });
            
            // saveAndSync ya retorna los datos actualizados, sincronizar directamente
            this.syncLocalStateWithBD(updatedState);
            
            this.logger.log('✅ Sesión existente actualizada en BD con selectedPlan:', this.pendingPlanId);
          } catch (error) {
            this.logger.warning('❌ No se pudo actualizar la sesión existente con el plan:', error);
          }
          
          this.logger.log('✅ selectedPlan agregado a sesión existente');
        } else {
          this.logger.log('ℹ️ Sesión ya tiene selectedPlan, usando el existente');
          // Solo sincronizar sin cambiar el selectedPlan
          this.syncLocalStateWithBD(actualData);
        }
      }
    } catch (error) {
      this.logger.warning('❌ No se pudieron obtener los datos de la sesión para sincronizar:', error);
      // Fallback: solo actualizar el plan
      await this.wizardStateService.saveState({ sessionId: this.existingSessionId, selectedPlan: this.pendingPlanId });
    }
    
    // La actualización del backend ya se hizo en el bloque anterior si era necesario
    // No necesitamos hacer otra consulta aquí
    
    this.logger.log('🎯 Navegando a cotizador con sesión existente:', this.existingSessionId);
    this.showContinueModal = false;
    
    // Marcar en sessionStorage que se navegó desde la selección de plan
    sessionStorage.setItem('navigatedFromPlan', 'true');
    
    this.router.navigate(['/cotizador', this.existingSessionId]);
  }

  async onRestartNew() {
    if (!this.pendingPlanId) {
      this.showContinueModal = false;
      return;
    }
    
    // Obtener el nombre del plan
    const selectedPlan = this.plans.find(plan => plan.id === this.pendingPlanId);
    const planName = selectedPlan?.name || 'Plan Desconocido';
    
    this.logger.log('🔄 Iniciando proceso de "Empezar de nuevo"');
    
    // 1) Obtener el selectedPlan de la sesión existente antes de marcarla como ABANDONED
    let selectedPlanToUse = this.pendingPlanId; // Fallback al plan actual
    
    if (this.existingSessionId) {
      try {
        this.logger.log('📡 Obteniendo selectedPlan de sesión existente antes de reiniciar...');
        const sessionData = await this.wizardSessionService.getSession(this.existingSessionId).toPromise();
        if (sessionData) {
          const actualData = (sessionData as any).data || sessionData;
          const existingSelectedPlan = actualData.selectedPlan || 
                                     actualData.stepData?.step1?.selectedPlan || 
                                     actualData.stepData?.step0?.selectedPlan;
          
          if (existingSelectedPlan) {
            selectedPlanToUse = existingSelectedPlan;
            this.logger.log('✅ Usando selectedPlan de sesión existente:', selectedPlanToUse);
          } else {
            this.logger.log('ℹ️ Sesión existente no tiene selectedPlan, usando plan actual:', selectedPlanToUse);
          }
        }
      } catch (error) {
        this.logger.warning('⚠️ No se pudo obtener selectedPlan de sesión existente:', error);
      }
      
      // 2) Marcar la sesión existente como ABANDONED en la BD
      try {
        this.logger.log('📝 Marcando sesión existente como ABANDONED:', this.existingSessionId);
        await this.wizardStateService.updateSessionStatus('ABANDONED');
        this.logger.log('✅ Sesión anterior marcada como ABANDONED');
      } catch (error) {
        this.logger.warning('⚠️ No se pudo marcar la sesión anterior como ABANDONED:', error);
      }
    }
    
    // 3) Crear nueva sesión
    this.logger.log('🆕 Creando nueva sesión...');
    const newSessionId = await this.wizardStateService.createNewSession();
    
    // 4) Actualizar estado local con el selectedPlan de la sesión previa
    await this.wizardStateService.saveState({ 
      selectedPlan: selectedPlanToUse, 
      selectedPlanName: planName,
      currentStep: 0,
      status: 'ACTIVE'
    });
    
    // 5) ✅ OPTIMIZADO: Usar saveAndSync() para cambios críticos (crear nueva sesión con plan)
    try {
      this.logger.log('📡 Actualizando nueva sesión en BD con selectedPlan de sesión previa:', selectedPlanToUse);
      const updatedState = await this.wizardStateService.saveAndSync({
        selectedPlan: selectedPlanToUse,
        selectedPlanName: planName,
        currentStep: 0,
        stepData: {
          step0: {
            tipoUsuario: '', // Se establecerá más adelante en el wizard
            timestamp: new Date()
          }
        }
      });
      
      // saveAndSync ya retorna los datos actualizados, sincronizar directamente
      this.syncLocalStateWithBD(updatedState);
      
      this.logger.log('✅ Nueva sesión actualizada en BD con selectedPlan:', selectedPlanToUse);
    } catch (error) {
      this.logger.warning('❌ No se pudo actualizar la nueva sesión con el plan:', error);
    }
    
    this.logger.log('🎯 Navegando a cotizador con nueva sesión:', newSessionId);
    this.showContinueModal = false;
    
    // Marcar en sessionStorage que se navegó desde la selección de plan
    sessionStorage.setItem('navigatedFromPlan', 'true');
    
    // Usar el id (UUID) si está disponible, sino usar sessionId como fallback
    const sessionIdForUrl = this.wizardStateService.getState().id || newSessionId;
    this.router.navigate(['/cotizador', sessionIdForUrl]);
  }

  /**
   * Sincroniza el estado local con los datos de la base de datos
   */
  private syncLocalStateWithBD(sessionData: any): void {
    const stepData = sessionData.stepData || {};
    
    // Debug: Ver qué datos están llegando
    this.logger.log('🔍 Debug syncLocalStateWithBD - sessionData completo:', {
      'sessionData.selectedPlan': sessionData.selectedPlan,
      'sessionData.selectedPlanName': sessionData.selectedPlanName,
      'stepData': stepData,
      'sessionData completo': sessionData
    });
    
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
      
      // Campos derivados (para compatibilidad)
      selectedPlan: sessionData.selectedPlan || '',
      selectedPlanName: sessionData.selectedPlanName || '',
      quotationNumber: stepData.step3?.quotationNumber || '',
      userData: stepData.step2?.userData || null,
      paymentData: stepData.step4?.paymentData || null,
      contractData: stepData.step7?.propertyData || stepData.step8?.contractData || null,
      paymentResult: stepData.step5?.validationData || null,
      
      // Campos adicionales para compatibilidad
      policyNumber: stepData.step5?.policyNumber || stepData.step4?.policyNumber || '',
      paymentAmount: stepData.step4?.paymentAmount || stepData.step5?.paymentAmount || 0,
      validationResult: stepData.step5?.validationData || null
    };

    this.logger.log('🔄 Sincronizando estado local con BD (estructura completa):', {
      id: localState.id,
      sessionId: localState.sessionId,
      currentStep: localState.currentStep,
      status: localState.status,
      expiresAt: localState.expiresAt,
      selectedPlan: localState.selectedPlan,
      quotationId: localState.quotationId,
      completedSteps: localState.completedSteps,
      stepDataKeys: Object.keys(localState.stepData),
      metadata: localState.metadata
    });

    // Guardar el estado completo en el servicio local
    this.wizardStateService.saveState(localState);
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
    
    this.logger.log('🔍 [HOME] Calculando pasos completados desde stepData:', JSON.stringify(stepData, null, 2));
    
    // Paso 0: Bienvenida - tipo de usuario
    if (stepData.step0 && stepData.step0.tipoUsuario) {
      completedSteps++;
      this.logger.log('✅ [HOME] Paso 0 completado: tipoUsuario');
    }
    
    // Paso 1: Datos principales - si existe step1, significa que se completó
    if (stepData.step1) {
      completedSteps++;
      this.logger.log('✅ [HOME] Paso 1 completado: step1 existe');
    }
    
    // Paso 2: Pago - si existe step2, significa que se completó
    if (stepData.step2) {
      completedSteps++;
      this.logger.log('✅ [HOME] Paso 2 completado: step2 existe');
    }
    
    // Paso 3: Validación - si existe step3, significa que se completó
    if (stepData.step3) {
      completedSteps++;
      this.logger.log('✅ [HOME] Paso 3 completado: step3 existe');
    }
    
    // Paso 4: Captura de datos - si existe step4, significa que se completó
    if (stepData.step4) {
      completedSteps++;
      this.logger.log('✅ [HOME] Paso 4 completado: step4 existe');
    }
    
    // Paso 5: Contrato - si existe step5, significa que se completó
    if (stepData.step5) {
      completedSteps++;
      this.logger.log('✅ [HOME] Paso 5 completado: step5 existe');
    }
    
    // Paso 6: Final - si existe step6, significa que se completó
    if (stepData.step6) {
      completedSteps++;
      this.logger.log('✅ [HOME] Paso 6 completado: step6 existe');
    }
    
    this.logger.log('📊 [HOME] Total de pasos completados:', completedSteps);
    return completedSteps;
  }

  /**
   * Obtiene el precio mínimo para un plan
   */
  getMinPrice(planName: string): number {
    const priceRanges: Record<string, number> = {
      'Esencial': 3500,
      'Premium': 4950,
      'Diamante': 9950
    };
    
    return priceRanges[planName] || 0;
  }

  /**
   * Verifica si un valor es un array
   */
  isArray(value: any): boolean {
    return Array.isArray(value);
  }
}
