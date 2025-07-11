import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, FormArray } from '@angular/forms';

@Component({
  selector: 'app-main-data-step',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './main-data-step.component.html',
  styleUrls: ['./main-data-step.component.scss']
})
export class MainDataStepComponent implements OnInit {
  @Input() selectedPlan: string | null = null;
  @Output() next = new EventEmitter<FormGroup>();
  @Output() previous = new EventEmitter<void>();

  mainDataForm: FormGroup;
  complementos = [
    'Complemento 1',
    'Complemento 2',
    'Complemento 3',
    'Complemento 4',
    'Complemento 5',
    'Complemento 6'
  ];

  constructor(private fb: FormBuilder) {
    this.mainDataForm = this.fb.group({
      nombre: [''],
      telefono: [''],
      correo: [''],
      codigoPostal: [''],
      plan: [''],
      complementos: this.fb.array([])
    });
  }

  ngOnInit() {
    if (this.selectedPlan) {
      this.mainDataForm.patchValue({ plan: this.selectedPlan });
    }
  }

  onComplementoChange(event: any, complemento: string) {
    const complementosArray = this.mainDataForm.get('complementos') as FormArray;
    if (event.target.checked) {
      complementosArray.push(this.fb.control(complemento));
    } else {
      const index = complementosArray.controls.findIndex(control => control.value === complemento);
      if (index >= 0) {
        complementosArray.removeAt(index);
      }
    }
  }

  onNext() {
    console.log('onNext llamado en MainDataStepComponent');
    console.log('Form value:', this.mainDataForm.value);
    console.log('Emitiendo evento next con form data');
    this.next.emit(this.mainDataForm);
  }

  onPrevious() {
    this.previous.emit();
  }
} 