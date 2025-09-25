import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { LpHeaderComponent } from '../lp-header/lp-header.component';
import { LpFooterComponent } from '../lp-footer/lp-footer.component';
import { SeoService } from '../services/seo.service';
import { PlansService } from '../services/plans.service';
import { Plan } from '../models/plan.model';

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
  plans: Plan[] = [];
  loadingPlans = true;

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
    private seoService: SeoService,
    private plansService: PlansService
  ) {}

  ngOnInit() {
    this.seoService.setPageSeo({
      title: 'Protección Jurídica Inmobiliaria - Seguros para Propietarios',
      description: 'Protege tu inversión inmobiliaria con nuestras pólizas jurídicas digitales. Cobertura legal completa para propietarios de inmuebles en renta.',
      keywords: 'seguro inmobiliario, protección jurídica, póliza digital, propietarios, renta, legal',
      type: 'website'
    });
    
    this.loadPlans();
  }

  /**
   * Carga los planes desde la base de datos
   */
  loadPlans() {
    console.log('🔍 loadPlans() llamado');
    this.loadingPlans = true;
    
    this.plansService.getPlans().subscribe({
      next: (response) => {
        console.log('📡 Respuesta del servicio:', response);
        if (response.success && response.data && response.data.length > 0) {
          this.plans = response.data;
          console.log('✅ Planes cargados en landing page:', this.plans);
          console.log('📊 Cantidad de planes:', this.plans.length);
        } else {
          console.log('⚠️ Respuesta sin datos o vacía:', response);
          this.plans = [];
        }
        this.loadingPlans = false;
      },
      error: (error) => {
        console.error('❌ Error al cargar planes:', error);
        this.loadingPlans = false;
        this.plans = [];
      }
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

  startWizard(planId: string) {
    console.log('Iniciando wizard con plan ID:', planId);
    this.router.navigate(['/cotizador'], { queryParams: { plan: planId } });
  }

  /**
   * Obtiene el precio mínimo para un plan
   */
  getMinPrice(planName: string): number {
    const priceRanges: Record<string, number> = {
      'Esencial': 3500,
      'Premium': 4950,
      'Diamante': 9950
    };
    
    return priceRanges[planName] || 0;
  }

  /**
   * Verifica si un valor es un array
   */
  isArray(value: any): boolean {
    return Array.isArray(value);
  }
}
