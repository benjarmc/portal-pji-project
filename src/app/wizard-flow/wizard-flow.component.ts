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
  selectedPlan: string | null = null;
  currentStep = 0;
  mainDataFormData: FormGroup | null = null;
  showContinueModal = false;

  steps = [
    { key: 'welcome', label: 'Bienvenida' },
    { key: 'main-data', label: 'Datos principales' },
    { key: 'payment', label: 'Pago' },
    { key: 'validation', label: 'Validación' },
    { key: 'contract', label: 'Contrato' },
    { key: 'finish', label: 'Final' }
  ];

  validationStatus: 'pending' | 'success' | 'intermediate' | 'failed' = 'pending';

  constructor(
    private route: ActivatedRoute,
    private seoService: SeoService,
    private wizardStateService: WizardStateService
  ) {}

  ngOnInit() {
    console.log('Wizard iniciado');
    
    this.seoService.setPageSeo({
      title: 'Cotizador - Protección Jurídica Inmobiliaria',
      description: 'Cotiza y contrata tu póliza de protección jurídica inmobiliaria de forma rápida y segura.',
      keywords: 'cotizador, póliza jurídica, protección inmobiliaria, contrato digital',
      type: 'website'
    });
    
    // Restaurar estado del wizard si existe
    this.restoreWizardState();
    
    this.route.queryParamMap.subscribe(params => {
      this.selectedPlan = params.get('plan');
      console.log('Plan seleccionado:', this.selectedPlan);
      
      // Guardar plan seleccionado en el estado
      if (this.selectedPlan) {
        this.wizardStateService.saveState({ selectedPlan: this.selectedPlan });
      }
    });
  }

  setCurrentStep(index: number) {
    this.currentStep = index;
    
    // Guardar estado actual
    this.wizardStateService.saveState({ currentStep: index });
    
    if (this.steps[this.currentStep].key === 'validation') {
      console.log('Entrando al paso de validación');
      this.validationStatus = 'pending';
      // this.simulateValidation(); // Comentado para probar VDID
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
    if (this.currentStep > 0) {
      this.setCurrentStep(this.currentStep - 1);
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
    this.nextStep();
  }

  onValidationSelectPlan(planKey: string) {
    this.selectedPlan = planKey;
    this.validationStatus = 'success';
    this.nextStep();
  }

  onValidationGoToStart() {
    this.goToStep(0);
    this.validationStatus = 'pending';
  }

  onFinishGoToStart() {
    this.goToStep(0);
    this.validationStatus = 'pending';
    this.mainDataFormData = null;
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
  }
}

