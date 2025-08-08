import { Injectable, Inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { DOCUMENT } from '@angular/common';

export interface SEOConfig {
  title: string;
  description: string;
  keywords?: string;
  author?: string;
  image?: string;
  url?: string;
  type?: string;
  structuredData?: any;
}

@Injectable({
  providedIn: 'root'
})
export class SeoService {
  private defaultConfig: SEOConfig = {
    title: 'Protección Jurídica Inmobiliaria - Seguros para Propietarios',
    description: 'Protege tu patrimonio inmobiliario con nuestras pólizas jurídicas digitales. Cobertura legal completa para propietarios de inmuebles en renta.',
    keywords: 'seguro inmobiliario, protección jurídica, póliza legal, propietarios, inquilinos, renta',
    author: 'Protección Jurídica Inmobiliaria',
    type: 'website',
    image: '/assets/hero-bg.jpg'
  };

  constructor(
    private meta: Meta,
    private title: Title,
    @Inject(DOCUMENT) private document: Document
  ) {}

  /**
   * Actualiza los metadatos SEO de la página
   */
  updateSEO(config: Partial<SEOConfig>): void {
    const seoConfig = { ...this.defaultConfig, ...config };
    
    // Título de la página
    this.title.setTitle(seoConfig.title);
    
    // Meta tags básicos
    this.meta.updateTag({ name: 'description', content: seoConfig.description });
    this.meta.updateTag({ name: 'keywords', content: seoConfig.keywords || '' });
    this.meta.updateTag({ name: 'author', content: seoConfig.author || '' });
    
    // Open Graph tags
    this.meta.updateTag({ property: 'og:title', content: seoConfig.title });
    this.meta.updateTag({ property: 'og:description', content: seoConfig.description });
    this.meta.updateTag({ property: 'og:type', content: seoConfig.type || 'website' });
    this.meta.updateTag({ property: 'og:image', content: seoConfig.image || '' });
    this.meta.updateTag({ property: 'og:url', content: seoConfig.url || (typeof window !== 'undefined' ? window.location.href : 'https://proteccionjuridicainmobiliaria.com') });
    this.meta.updateTag({ property: 'og:site_name', content: 'Protección Jurídica Inmobiliaria' });
    
    // Twitter Card tags
    this.meta.updateTag({ name: 'twitter:card', content: 'summary_large_image' });
    this.meta.updateTag({ name: 'twitter:title', content: seoConfig.title });
    this.meta.updateTag({ name: 'twitter:description', content: seoConfig.description });
    this.meta.updateTag({ name: 'twitter:image', content: seoConfig.image || '' });
    
    // Meta tags adicionales
    this.meta.updateTag({ name: 'robots', content: 'index, follow' });
    this.meta.updateTag({ name: 'viewport', content: 'width=device-width, initial-scale=1' });
    this.meta.updateTag({ 'http-equiv': 'Content-Type', content: 'text/html; charset=utf-8' });
    
    // Structured Data si se proporciona
    if (seoConfig.structuredData) {
      this.addStructuredData(seoConfig.structuredData);
    }
  }

  /**
   * Agrega structured data (JSON-LD) al head
   */
  private addStructuredData(data: any): void {
    // Remover structured data existente
    const existingScript = this.document.querySelector('script[type="application/ld+json"]');
    if (existingScript) {
      existingScript.remove();
    }

    // Crear nuevo script con structured data
    const script = this.document.createElement('script');
    script.type = 'application/ld+json';
    script.text = JSON.stringify(data);
    this.document.head.appendChild(script);
  }

  /**
   * Configuración SEO para la página de inicio
   */
  setHomePageSEO(): void {
    this.updateSEO({
      title: 'Protección Jurídica Inmobiliaria - Seguros para Propietarios',
      description: 'Protege tu patrimonio inmobiliario con nuestras pólizas jurídicas digitales. Cobertura legal completa para propietarios de inmuebles en renta.',
      keywords: 'seguro inmobiliario, protección jurídica, póliza legal, propietarios, inquilinos, renta, desalojo',
      structuredData: {
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: 'Protección Jurídica Inmobiliaria',
        description: 'Seguros jurídicos para propietarios de inmuebles',
        url: 'https://proteccionjuridicainmobiliaria.com',
        logo: 'https://proteccionjuridicainmobiliaria.com/assets/logo.png',
        contactPoint: {
          '@type': 'ContactPoint',
          telephone: '+52-55-1234-5678',
          contactType: 'customer service'
        },
        sameAs: [
          'https://facebook.com/proteccionjuridicainmobiliaria',
          'https://twitter.com/pji_mexico'
        ]
      }
    });
  }

  /**
   * Configuración SEO para el cotizador
   */
  setCotizadorSEO(): void {
    this.updateSEO({
      title: 'Cotizar Seguro Inmobiliario - Protección Jurídica Inmobiliaria',
      description: 'Cotiza tu seguro inmobiliario en línea. Pólizas jurídicas digitales para propietarios. Proceso 100% digital y seguro.',
      keywords: 'cotizar seguro, póliza inmobiliaria, seguro en línea, cotización digital',
      structuredData: {
        '@context': 'https://schema.org',
        '@type': 'WebApplication',
        name: 'Cotizador de Seguros Inmobiliarios',
        description: 'Cotiza tu seguro inmobiliario en línea',
        url: 'https://proteccionjuridicainmobiliaria.com/cotizador',
        applicationCategory: 'BusinessApplication',
        operatingSystem: 'Web Browser',
        offers: {
          '@type': 'Offer',
          price: '0',
          priceCurrency: 'MXN',
          description: 'Cotización gratuita'
        }
      }
    });
  }

  /**
   * Configuración SEO para pólizas específicas
   */
  setPolicySEO(policyType: 'juridica' | 'investigacion' | 'proteccion'): void {
    const policies = {
      juridica: {
        title: 'Póliza Jurídica Digital - Protección Legal para Propietarios',
        description: 'Póliza jurídica digital que cubre desalojos, cobro de rentas y asesoría legal. Protección completa para propietarios.',
        keywords: 'póliza jurídica, desalojo, cobro rentas, asesoría legal, propietarios'
      },
      investigacion: {
        title: 'Investigación Digital - Verificación de Inquilinos',
        description: 'Servicio de investigación digital para verificar antecedentes de inquilinos. Protege tu patrimonio con información confiable.',
        keywords: 'investigación digital, verificación inquilinos, antecedentes, patrimonio'
      },
      proteccion: {
        title: 'Protección Total - Cobertura Integral Inmobiliaria',
        description: 'Protección total que combina cobertura jurídica, investigación digital y asistencia integral para propietarios.',
        keywords: 'protección total, cobertura integral, asistencia inmobiliaria'
      }
    };

    const config = policies[policyType];
    this.updateSEO({
      ...config,
      structuredData: {
        '@context': 'https://schema.org',
        '@type': 'Service',
        name: config.title,
        description: config.description,
        provider: {
          '@type': 'Organization',
          name: 'Protección Jurídica Inmobiliaria'
        },
        areaServed: 'MX',
        serviceType: 'Seguro Inmobiliario'
      }
    });
  }

  /**
   * Limpia todos los metadatos SEO
   */
  clearSEO(): void {
    this.meta.removeTag('name="description"');
    this.meta.removeTag('name="keywords"');
    this.meta.removeTag('name="author"');
    this.meta.removeTag('property="og:title"');
    this.meta.removeTag('property="og:description"');
    this.meta.removeTag('property="og:type"');
    this.meta.removeTag('property="og:image"');
    this.meta.removeTag('property="og:url"');
    this.meta.removeTag('name="twitter:card"');
    this.meta.removeTag('name="twitter:title"');
    this.meta.removeTag('name="twitter:description"');
    this.meta.removeTag('name="twitter:image"');
    
    // Remover structured data
    const script = this.document.querySelector('script[type="application/ld+json"]');
    if (script) {
      script.remove();
    }
  }
}
