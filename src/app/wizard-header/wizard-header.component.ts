import { Component } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'wizard-header',
  standalone: true,
  templateUrl: './wizard-header.component.html',
  styleUrls: ['./wizard-header.component.scss']
})
export class WizardHeaderComponent {
  constructor(private router: Router) {}

  closeWizard() {
    this.router.navigate(['/']);
  }
}
