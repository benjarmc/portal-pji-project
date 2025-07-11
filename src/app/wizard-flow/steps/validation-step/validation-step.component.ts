import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface AlternativePlan {
  key: string;
  name: string;
  desc: string;
}

@Component({
  selector: 'app-validation-step',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './validation-step.component.html',
  styleUrls: ['./validation-step.component.scss']
})
export class ValidationStepComponent implements OnInit {
  @Input() validationStatus: 'pending' | 'success' | 'intermediate' | 'failed' = 'pending';
  @Output() next = new EventEmitter<void>();
  @Output() selectPlan = new EventEmitter<string>();
  @Output() goToStart = new EventEmitter<void>();

  alternativePlans: AlternativePlan[] = [
    { key: 'juridica', name: 'Póliza Jurídica Digital', desc: 'Protección esencial para tu arrendamiento.' },
    { key: 'investigacion', name: 'Investigación Digital', desc: 'Cobertura ampliada y negociación de contrato.' },
    { key: 'total', name: 'Protección Total', desc: 'Máxima protección legal y financiera.' }
  ];

  ngOnInit() {
    // La validación se maneja desde el componente padre
  }

  onNext() {
    this.next.emit();
  }

  onSelectPlan(planKey: string) {
    this.selectPlan.emit(planKey);
  }

  onGoToStart() {
    this.goToStart.emit();
  }
} 