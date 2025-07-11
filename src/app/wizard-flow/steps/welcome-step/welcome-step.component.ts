import { Component, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-welcome-step',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './welcome-step.component.html',
  styleUrls: ['./welcome-step.component.scss']
})
export class WelcomeStepComponent {
  @Output() next = new EventEmitter<void>();

  onNext() {
    this.next.emit();
  }
} 