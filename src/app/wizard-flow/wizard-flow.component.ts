import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FormBuilder, FormGroup, Validators, FormArray } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { WizardHeaderComponent } from '../wizard-header/wizard-header.component';
import { WizardFooterComponent } from '../wizard-footer/wizard-footer.component';
// import { SafeUrlPipe } from '../safe-url.pipe';

@Component({
  selector: 'app-wizard-flow',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    WizardHeaderComponent,
    WizardFooterComponent
  ],
  templateUrl: './wizard-flow.component.html',
  styleUrls: ['./wizard-flow.component.scss']
})
export class WizardFlowComponent implements OnInit {
  selectedPlan: string | null = null;
  currentStep = 0;

  steps = [
    { key: 'welcome', label: 'Bienvenida' },
    { key: 'main-data', label: 'Datos principales' },
    { key: 'payment', label: 'Pago' },
    { key: 'validation', label: 'Validación' },
    { key: 'contract', label: 'Contrato' },
    { key: 'sign', label: 'Firma/Espera' },
    { key: 'finish', label: 'Final' }
  ];

  mainDataForm: FormGroup;
  complementos = [
    'Complemento 1',
    'Complemento 2',
    'Complemento 3',
    'Complemento 4',
    'Complemento 5',
    'Complemento 6'
  ];

  validationStatus: 'pending' | 'success' | 'intermediate' | 'failed' = 'pending';

  contractForm: FormGroup;
  clausulas = [
    'Cláusula adicional 1',
    'Cláusula adicional 2',
    'Cláusula adicional 3',
    'Cláusula adicional 4'
  ];

  pdfSrc = 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf'; // PDF de ejemplo

  // Planes alternativos para el flujo intermedio
  alternativePlans = [
    { key: 'juridica', name: 'Póliza Jurídica Digital', desc: 'Protección esencial para tu arrendamiento.' },
    { key: 'investigacion', name: 'Investigación Digital', desc: 'Cobertura ampliada y negociación de contrato.' },
    { key: 'total', name: 'Protección Total', desc: 'Máxima protección legal y financiera.' }
  ];

  constructor(private route: ActivatedRoute, private fb: FormBuilder) {
    this.mainDataForm = this.fb.group({
      nombre: ['', Validators.required],
      telefono: ['', [Validators.required, Validators.pattern(/^\+?\d{10,15}$/)]],
      correo: ['', [Validators.required, Validators.email]],
      codigoPostal: ['', [Validators.required, Validators.pattern(/^\d{5}$/)]],
      plan: [''],
      complementos: this.fb.array([])
    });
    this.contractForm = this.fb.group({
      clausulas: this.fb.array([]),
      requerimientos: ['']
    });
  }

  ngOnInit() {
    console.log('Wizard iniciado');
    this.route.queryParamMap.subscribe(params => {
      this.selectedPlan = params.get('plan');
      console.log('Plan seleccionado:', this.selectedPlan);
      this.mainDataForm.patchValue({ plan: this.selectedPlan });
    });
  }

  onComplementoChange(event: any, complemento: string) {
    const complementosArray = this.mainDataForm.get('complementos') as FormArray;
    if (event.target.checked) {
      complementosArray.push(this.fb.control(complemento));
    } else {
      const idx = complementosArray.value.indexOf(complemento);
      if (idx > -1) {
        complementosArray.removeAt(idx);
      }
    }
  }

  onClausulaChange(event: any, clausula: string) {
    const clausulasArray = this.contractForm.get('clausulas') as FormArray;
    if (event.target.checked) {
      clausulasArray.push(this.fb.control(clausula));
    } else {
      const idx = clausulasArray.value.indexOf(clausula);
      if (idx > -1) {
        clausulasArray.removeAt(idx);
      }
    }
  }

  simulateValidation() {
    console.log('Iniciando validación...');
    this.validationStatus = 'pending';
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
    }, 3000); // Aumentado a 3 segundos para que sea más visible
  }

  setCurrentStep(index: number) {
    this.currentStep = index;
    if (this.steps[this.currentStep].key === 'validation') {
      console.log('Entrando al paso de validación');
      this.simulateValidation();
    }
  }

  nextStep() {
    // if (this.currentStep === 1 && this.mainDataForm.invalid) {
    //   this.mainDataForm.markAllAsTouched();
    //   return;
    // }
    if (this.currentStep < this.steps.length - 1) {
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

  selectAlternativePlan(planKey: string) {
    this.selectedPlan = planKey;
    this.mainDataForm.patchValue({ plan: planKey });
    this.validationStatus = 'success';
    this.nextStep();
  }

  goToStart() {
    this.currentStep = 0;
    this.validationStatus = 'pending';
  }
}

