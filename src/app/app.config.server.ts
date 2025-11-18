import { mergeApplicationConfig, ApplicationConfig } from '@angular/core';
import { provideServerRendering } from '@angular/platform-server';
import { provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { routes } from './app.routes';
import { SeoService } from './services/seo.service';
import { errorInterceptor } from './interceptors/error.interceptor';
import { tokenRefreshInterceptor } from './interceptors/token-refresh.interceptor';

// Configuración del servidor (sin provideClientHydration)
const serverAppConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(withInterceptors([tokenRefreshInterceptor, errorInterceptor])),
    SeoService
  ]
};

const serverConfig: ApplicationConfig = {
  providers: [
    provideServerRendering(),
  ]
};

export const config = mergeApplicationConfig(serverAppConfig, serverConfig);
