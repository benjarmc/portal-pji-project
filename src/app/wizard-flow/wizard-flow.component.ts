import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FormGroup } from '@angular/forms';
import { CommonModule } from '@angular/common';

import { WizardFooterComponent } from '../wizard-footer/wizard-footer.component';
import { WelcomeStepComponent } from './steps/welcome-step/welcome-step.component';
import { MainDataStepComponent } from './steps/main-data-step/main-data-step.component';
import { PaymentStepComponent } from './steps/payment-step/payment-step.component';
import { ValidationStepComponent } from './steps/validation-step/validation-step.component';
import { ContractStepComponent } from './steps/contract-step/contract-step.component';
import { FinishStepComponent } from './steps/finish-step/finish-step.component';
import { SeoService } from '../services/seo.service';
import { WizardStateService, WizardState } from '../services/wizard-state.service';
import { ContinueWizardModalComponent } from '../components/continue-wizard-modal/continue-wizard-modal.component';

@Component({
  selector: 'app-wizard-flow',
  standalone: true,
  imports: [
    CommonModule,
    WizardFooterComponent,
    WelcomeStepComponent,
    MainDataStepComponent,
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
  currentStep = 0;
  selectedPlan: string | null = null;
  mainDataFormData: FormGroup | null = null;
  showContinueModal = false;

  // Datos de la cotización
  currentQuotation: any = null;
  quotationId: string | null = null;
  userId: string | null = null; // Nuevo campo para almacenar userId

  steps = [
    { key: 'welcome', label: 'Bienvenida' },
    { key: 'main-data', label: 'Datos principales' },
    { key: 'payment', label: 'Pago' },
    { key: 'validation', label: 'Validación' },
    { key: 'contract', label: 'Contrato' },
    { key: 'finish', label: 'Final' }
  ];

  validationStatus: 'pending' | 'success' | 'intermediate' | 'failed' = 'pending';
  quotationSentByEmail: boolean = false;
  quotationNumber: string = '';
  isFromQuotationUrl: boolean = false;
  canGoBack: boolean = true; // Nueva propiedad para controlar navegación

  constructor(
    private route: ActivatedRoute,
    private seoService: SeoService,
    private wizardStateService: WizardStateService
  ) {}

  ngOnInit() {
    // Cargar estado guardado
    const savedState = this.wizardStateService.getState();
    this.currentStep = savedState.currentStep || 0;
    this.selectedPlan = savedState.selectedPlan;
    
    // Verificar si llegamos desde URL del cotizador
    this.handleUrlParameters();
  }

  /**
   * Manejar parámetros de la URL del cotizador
   */
  private handleUrlParameters(): void {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const planId = urlParams.get('plan');
      const quotationNumber = urlParams.get('quotation');
      
      if (planId && quotationNumber) {
        console.log('🎯 Parámetros de URL detectados (desde email):', { planId, quotationNumber });
        
        // Establecer el plan seleccionado
        this.selectedPlan = planId;
        this.wizardStateService.saveState({ selectedPlan: planId });
        
        // Ir directamente al paso 3 (validación) sin permitir retroceder
        this.currentStep = 3;
        this.canGoBack = false; // No permitir retroceder desde email
        this.wizardStateService.saveState({ currentStep: 3 });
        
        // Marcar pasos anteriores como completados
        this.wizardStateService.completeStep(0);
        this.wizardStateService.completeStep(1);
        this.wizardStateService.completeStep(2);
        
        console.log('✅ Navegación desde email configurada');
      } else if (planId) {
        console.log('🎯 Plan seleccionado desde landing page:', planId);
        
        // Establecer el plan seleccionado
        this.selectedPlan = planId;
        this.wizardStateService.saveState({ selectedPlan: planId });
        
        // Ir al paso 0 (bienvenida) normalmente
        this.currentStep = 0;
        this.canGoBack = true;
        this.wizardStateService.saveState({ currentStep: 0 });
        
        console.log('✅ Plan configurado para nuevo wizard');
      }
    }
  }

  setCurrentStep(step: number) {
    console.log(`🔄 setCurrentStep llamado: ${this.currentStep} -> ${step}`);
    this.currentStep = step;
    this.wizardStateService.saveState({ currentStep: step });
    console.log(`✅ Paso actualizado a: ${this.currentStep}`);
  }

  // Nuevo método para cuando se envía la cotización por correo
  onQuotationSentByEmail(quotationNumber: string) {
    this.quotationSentByEmail = true;
    this.quotationNumber = quotationNumber;
    this.setCurrentStep(5); // Ir al paso de finalización
  }

  // Nuevo método para cuando se hace clic en "Siguiente y Pagar"
  onNextAndPay(quotationData: any) {
    console.log('💰 onNextAndPay llamado con datos:', quotationData);
    this.currentQuotation = quotationData;
    this.quotationId = quotationData.id || quotationData.quotationId;
    this.quotationNumber = quotationData.quotationNumber;
    this.userId = quotationData.userId; // Almacenar userId del usuario creado
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
    this.setCurrentStep(2); // Ir al paso 2 (PAGO) con la cotización creada
    console.log('✅ Cotización creada, navegando al paso 2 (PAGO)');
  }

  // Nuevo método para cuando se completa el pago
  onPaymentCompleted(paymentResult: any) {
    console.log('💰 onPaymentCompleted llamado con resultado:', paymentResult);
    
    if (paymentResult) {
      // Guardar información del pago en el estado del wizard
      this.wizardStateService.saveState({
        paymentResult: paymentResult
      });
      console.log('✅ Información del pago guardada en el estado del wizard');
    }
    
    // Avanzar al siguiente paso (validación)
    this.setCurrentStep(3);
    console.log('✅ Pago completado, navegando al paso 3 (VALIDACIÓN)');
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
    
    this.mainDataFormData = formData;
    
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
    this.mainDataFormData = null;
    this.currentQuotation = null;
    this.quotationId = null;
    
    // Limpiar estado del wizard
    this.wizardStateService.clearState();
  }

  getCurrentStepKey(): string {
    return this.steps[this.currentStep].key;
  }

  closeWizard() {
    // Limpiar estado al cerrar el wizard
    this.wizardStateService.clearState();
    window.history.back();
  }

  /**
   * Restaura el estado del wizard desde el almacenamiento
   */
  private restoreWizardState(): void {
    if (this.wizardStateService.hasSavedState()) {
      const savedState = this.wizardStateService.restoreWizard();
      
      // Restaurar datos del estado
      this.currentStep = savedState.currentStep;
      this.selectedPlan = savedState.selectedPlan;
      this.quotationId = savedState.quotationId;
      
      console.log('Estado del wizard restaurado:', savedState);
      
      // Mostrar mensaje de continuar (opcional)
      this.showContinueMessage();
    }
  }

  /**
   * Muestra mensaje para continuar el wizard
   */
  private showContinueMessage(): void {
    this.showContinueModal = true;
  }

  /**
   * Maneja la decisión de continuar el wizard
   */
  onContinueWizard(): void {
    this.showContinueModal = false;
    // El estado ya está restaurado en restoreWizardState()
  }

  /**
   * Maneja la decisión de reiniciar el wizard
   */
  onRestartWizard(): void {
    this.showContinueModal = false;
    this.wizardStateService.clearState();
    this.currentStep = 0;
    this.selectedPlan = null;
    this.currentQuotation = null;
    this.quotationId = null;
  }
}

