import { Component, Input, computed } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'wizard-footer',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './wizard-footer.component.html',
  styleUrls: ['./wizard-footer.component.scss']
})
export class WizardFooterComponent {
  @Input() currentStep: number = 0;
  @Input() totalSteps: number = 6;

  steps = [
    { key: 'welcome', label: 'Bienvenida' },
    { key: 'main-data', label: 'Datos principales' },
    { key: 'payment', label: 'Pago' },
    { key: 'validation', label: 'Validación' },
    { key: 'contract', label: 'Contrato' },
    { key: 'finish', label: 'Final' }
  ];

  progressPercentage = computed(() => {
    return ((this.currentStep + 1) / this.totalSteps) * 100;
  });
}
