import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { isPlatformBrowser } from '@angular/common';

@Injectable({
  providedIn: 'root'
})
export class SeoService {

  constructor(
    private meta: Meta,
    private title: Title,
    @Inject(PLATFORM_ID) private platformId: Object
  ) { }

  /**
   * Actualiza el título de la página
   */
  updateTitle(title: string): void {
    if (isPlatformBrowser(this.platformId)) {
      this.title.setTitle(title);
    }
  }

  /**
   * Actualiza la descripción de la página
   */
  updateDescription(description: string): void {
    if (isPlatformBrowser(this.platformId)) {
      this.meta.updateTag({ name: 'description', content: description });
    }
  }

  /**
   * Actualiza las palabras clave
   */
  updateKeywords(keywords: string): void {
    if (isPlatformBrowser(this.platformId)) {
      this.meta.updateTag({ name: 'keywords', content: keywords });
    }
  }

  /**
   * Actualiza las meta tags de Open Graph
   */
  updateOpenGraphTags(data: {
    title?: string;
    description?: string;
    image?: string;
    url?: string;
    type?: string;
  }): void {
    if (isPlatformBrowser(this.platformId)) {
      if (data.title) {
        this.meta.updateTag({ property: 'og:title', content: data.title });
      }
      if (data.description) {
        this.meta.updateTag({ property: 'og:description', content: data.description });
      }
      if (data.image) {
        this.meta.updateTag({ property: 'og:image', content: data.image });
      }
      if (data.url) {
        this.meta.updateTag({ property: 'og:url', content: data.url });
      }
      if (data.type) {
        this.meta.updateTag({ property: 'og:type', content: data.type });
      }
    }
  }

  /**
   * Actualiza las meta tags de Twitter Card
   */
  updateTwitterCardTags(data: {
    title?: string;
    description?: string;
    image?: string;
    card?: string;
  }): void {
    if (isPlatformBrowser(this.platformId)) {
      if (data.title) {
        this.meta.updateTag({ name: 'twitter:title', content: data.title });
      }
      if (data.description) {
        this.meta.updateTag({ name: 'twitter:description', content: data.description });
      }
      if (data.image) {
        this.meta.updateTag({ name: 'twitter:image', content: data.image });
      }
      if (data.card) {
        this.meta.updateTag({ name: 'twitter:card', content: data.card });
      }
    }
  }

  /**
   * Actualiza la URL canónica
   */
  updateCanonicalUrl(url: string): void {
    if (isPlatformBrowser(this.platformId)) {
      this.meta.updateTag({ rel: 'canonical', href: url });
    }
  }

  /**
   * Configuración completa de SEO para una página
   */
  setPageSeo(config: {
    title: string;
    description: string;
    keywords?: string;
    image?: string;
    url?: string;
    type?: string;
    twitterCard?: string;
  }): void {
    this.updateTitle(config.title);
    this.updateDescription(config.description);
    
    if (config.keywords) {
      this.updateKeywords(config.keywords);
    }

    this.updateOpenGraphTags({
      title: config.title,
      description: config.description,
      image: config.image,
      url: config.url,
      type: config.type || 'website'
    });

    this.updateTwitterCardTags({
      title: config.title,
      description: config.description,
      image: config.image,
      card: config.twitterCard || 'summary_large_image'
    });

    if (config.url) {
      this.updateCanonicalUrl(config.url);
    }
  }
}
