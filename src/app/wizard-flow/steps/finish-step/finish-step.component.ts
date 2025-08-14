import { Component, Output, EventEmitter, Input } from '@angular/core';
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
  @Input() quotationSentByEmail: boolean = false;
  @Input() quotationNumber: string = '';

  onGoToStart() {
    this.goToStart.emit();
  }
} 