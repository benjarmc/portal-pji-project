import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./lp-content/lp-content.component').then(m => m.LpContentComponent),
    title: 'Inicio',
  },
  {
    path: 'cotizador',
    loadComponent: () => import('./wizard-flow/wizard-flow.component').then(m => m.WizardFlowComponent),
    title: 'Cotizador',
  },
];
