import { isPlatformBrowser, CommonModule } from '@angular/common';
import {
  Component,
  HostListener,
  Inject,
  OnInit,
  PLATFORM_ID,
} from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-lp-header',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './lp-header.component.html',
  styleUrl: './lp-header.component.scss',
})
export class LpHeaderComponent implements OnInit {
  isOpen: boolean = false;
  isNavbarShrunk: boolean = false;
  isPrivacyPage: boolean = false;

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private router: Router
  ) { }

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.navbarScroll();
    }
    
    // Detectar la ruta actual al inicializar
    this.checkCurrentRoute();
    
    // Detectar cambios de ruta
    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe((event: NavigationEnd) => {
        this.isPrivacyPage = event.url.includes('/aviso-privacidad');
        console.log('Ruta detectada:', event.url, 'Es página de privacidad:', this.isPrivacyPage);
      });
  }

  private checkCurrentRoute(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.isPrivacyPage = this.router.url.includes('/aviso-privacidad');
      console.log('Ruta actual:', this.router.url, 'Es página de privacidad:', this.isPrivacyPage);
    }
  }

  @HostListener('window:scroll', [])
  onWindowScroll() {
    if (isPlatformBrowser(this.platformId)) {
      this.navbarScroll();
    }
  }

  private navbarScroll() {
    const navbar = document.querySelector('.navbar');
    if (!navbar) {
      return;
    }

    const scrollThreshold = 100;

    if (window.scrollY > scrollThreshold) {
      this.isNavbarShrunk = true;
    } else {
      this.isNavbarShrunk = false;
    }
  }

  toggleMenu(): void {
    this.isOpen = !this.isOpen;
  }

  scrollToSection(sectionId: string): void {
    if (isPlatformBrowser(this.platformId)) {
      const element = document.getElementById(sectionId);
      if (element) {
        element.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'start' 
        });
      }
    }
  }
}
