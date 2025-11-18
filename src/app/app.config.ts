import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';

import { routes } from './app.routes';
import { provideClientHydration } from '@angular/platform-browser';
import { SeoService } from './services/seo.service';
import { errorInterceptor } from './interceptors/error.interceptor';
import { tokenRefreshInterceptor } from './interceptors/token-refresh.interceptor';

// Configuración base compartida (sin hidratación del cliente)
const baseConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(withInterceptors([tokenRefreshInterceptor, errorInterceptor])),
    SeoService
  ]
};

// Configuración del cliente (con hidratación)
export const appConfig: ApplicationConfig = {
  providers: [
    ...baseConfig.providers,
    provideClientHydration(),
  ]
};
