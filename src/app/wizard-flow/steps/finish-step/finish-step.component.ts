import { Component, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-finish-step',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './finish-step.component.html',
  styleUrls: ['./finish-step.component.scss']
})
export class FinishStepComponent {
  @Output() goToStart = new EventEmitter<void>();

  onGoToStart() {
    this.goToStart.emit();
  }
} 