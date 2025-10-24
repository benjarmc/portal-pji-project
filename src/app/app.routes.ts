import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./landing-page/lp-content/lp-content.component').then(m => m.LpContentComponent),
    title: 'Inicio',
  },
  {
    path: 'cotizador',
    loadComponent: () => import('./wizard/wizard-flow/wizard-flow.component').then(m => m.WizardFlowComponent),
    title: 'Cotizador',
  },
  {
    path: 'cotizador/:sessionId',
    loadComponent: () => import('./wizard/wizard-flow/wizard-flow.component').then(m => m.WizardFlowComponent),
    title: 'Cotizador',
  },
  {
    path: 'validation/complete',
    loadComponent: () => import('./validation-complete/validation-complete.component').then(m => m.ValidationCompleteComponent),
    title: 'Validación Completada',
  },
  {
    path: 'aviso-privacidad',
    loadComponent: () => import('./landing-page/privacy-policy/privacy-policy.component').then(m => m.PrivacyPolicyComponent),
    title: 'Aviso de Privacidad',
  },
];
