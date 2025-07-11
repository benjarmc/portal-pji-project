import { Component, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, FormArray } from '@angular/forms';

@Component({
  selector: 'app-contract-step',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './contract-step.component.html',
  styleUrls: ['./contract-step.component.scss']
})
export class ContractStepComponent {
  @Output() next = new EventEmitter<void>();
  @Output() previous = new EventEmitter<void>();

  contractForm: FormGroup;
  clausulas = [
    'Cláusula adicional 1',
    'Cláusula adicional 2',
    'Cláusula adicional 3',
    'Cláusula adicional 4'
  ];

  constructor(private fb: FormBuilder) {
    this.contractForm = this.fb.group({
      clausulas: this.fb.array([]),
      requerimientos: [''],
      aceptarContrato: [false]
    });
  }

  onClausulaChange(event: any, clausula: string) {
    const clausulasArray = this.contractForm.get('clausulas') as FormArray;
    if (event.target.checked) {
      clausulasArray.push(this.fb.control(clausula));
    } else {
      const index = clausulasArray.controls.findIndex(control => control.value === clausula);
      if (index >= 0) {
        clausulasArray.removeAt(index);
      }
    }
  }

  onFirmarYFinalizar() {
    if (this.contractForm.get('aceptarContrato')?.value) {
      this.next.emit();
    }
  }

  downloadContract() {
    // Simular descarga del contrato
    console.log('Descargando contrato...');
    // Aquí se implementaría la lógica real de descarga
  }

  onPrevious() {
    this.previous.emit();
  }
} 