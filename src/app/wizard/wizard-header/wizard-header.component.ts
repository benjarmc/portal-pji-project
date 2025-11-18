import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'wizard-header',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './wizard-header.component.html',
  styleUrls: ['./wizard-header.component.scss']
})
export class WizardHeaderComponent {
  constructor(
    private router: Router
  ) {}

  closeWizard() {
    // Navegar a la página principal usando window.location para asegurar que funcione en todos los ambientes
    window.location.href = '/';
  }
}
