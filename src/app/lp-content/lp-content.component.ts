import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { LpHeaderComponent } from '../lp-header/lp-header.component';
import { LpFooterComponent } from '../lp-footer/lp-footer.component';
import { SeoService } from '../services/seo.service';

@Component({
  selector: 'app-lp-content',
  standalone: true,
  imports: [
    CommonModule,
    LpHeaderComponent,
    LpFooterComponent
  ],
  templateUrl: './lp-content.component.html',
  styleUrls: ['./lp-content.component.css']
})
export class LpContentComponent implements OnInit {
  faqOpenIndex: number | null = 0;

  faqs = [
    {
      question: '¿Qué pasa si mi inquilino no paga la renta?',
      answer: 'Iniciamos de inmediato el proceso legal para recuperar rentas y, si es necesario, desocupar el inmueble. Nuestro equipo de abogados se encarga de todo.'
    },
    {
      question: '¿La firma electrónica es legal?',
      answer: 'Sí, la firma electrónica tiene validez legal y es utilizada en todos nuestros procesos.'
    },
    {
      question: '¿Cuánto tarda la contratación?',
      answer: 'El proceso es inmediato y 100% digital. En minutos puedes tener tu póliza.'
    }
  ];

  constructor(
    private router: Router,
    private seoService: SeoService
  ) {}

  ngOnInit() {
    this.seoService.setPageSeo({
      title: 'Protección Jurídica Inmobiliaria - Seguros para Propietarios',
      description: 'Protege tu inversión inmobiliaria con nuestras pólizas jurídicas digitales. Cobertura legal completa para propietarios de inmuebles en renta.',
      keywords: 'seguro inmobiliario, protección jurídica, póliza digital, propietarios, renta, legal',
      type: 'website'
    });
  }

  toggleFaq(index: number) {
    this.faqOpenIndex = this.faqOpenIndex === index ? null : index;
  }

  scrollToPlans() {
    const plansSection = document.getElementById('lp-plans-section');
    if (plansSection) {
      plansSection.scrollIntoView({ behavior: 'smooth' });
    }
  }

  startWizard(plan: string) {
    console.log('Iniciando wizard con plan:', plan);
    this.router.navigate(['/cotizador'], { queryParams: { plan } });
  }
}
