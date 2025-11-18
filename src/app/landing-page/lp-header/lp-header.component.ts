import { CommonModule } from '@angular/common';
import {
  Component,
  HostListener,
  OnInit,
} from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { LoggerService } from '../../services/logger.service';

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
    private router: Router,
    private logger: LoggerService
  ) { }

  ngOnInit(): void {
    this.navbarScroll();
    
    // Detectar la ruta actual al inicializar
    this.checkCurrentRoute();
    
    // Detectar cambios de ruta
    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe((event: NavigationEnd) => {
        this.isPrivacyPage = event.url.includes('/aviso-privacidad');
        this.logger.log('Ruta detectada:', event.url, 'Es página de privacidad:', this.isPrivacyPage);
      });
  }

  private checkCurrentRoute(): void {
    this.isPrivacyPage = this.router.url.includes('/aviso-privacidad');
    this.logger.log('Ruta actual:', this.router.url, 'Es página de privacidad:', this.isPrivacyPage);
  }

  @HostListener('window:scroll', [])
  onWindowScroll() {
    this.navbarScroll();
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
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'start' 
      });
    }
  }
}
