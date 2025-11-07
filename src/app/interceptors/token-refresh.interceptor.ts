import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { LoggerService } from '../services/logger.service';
import { WizardSessionService } from '../services/wizard-session.service';

/**
 * Interceptor para manejar refresh automático de tokens cuando expiran
 */
export const tokenRefreshInterceptor: HttpInterceptorFn = (req, next) => {
  const logger = inject(LoggerService);
  const wizardSessionService = inject(WizardSessionService);
  let isRefreshing = false;

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      // Si es un error 401 y tenemos refresh token, intentar refrescar
      if (error.status === 401 && wizardSessionService.getRefreshToken() && !isRefreshing) {
        isRefreshing = true;
        
        logger.log('🔄 Token expirado, intentando refrescar...');
        
        return wizardSessionService.refreshAccessToken().pipe(
          switchMap((response) => {
            isRefreshing = false;
            logger.log('✅ Token refrescado exitosamente');
            
            // Reintentar la petición original con el nuevo token
            const clonedRequest = req.clone({
              setHeaders: {
                Authorization: `Bearer ${response.data?.accessToken || wizardSessionService.getAccessToken()}`
              }
            });
            
            return next(clonedRequest);
          }),
          catchError((refreshError) => {
            isRefreshing = false;
            logger.error('❌ Error refrescando token:', refreshError);
            
            // Si el refresh falla, limpiar tokens y propagar error
            wizardSessionService.clearTokens();
            return throwError(() => refreshError);
          })
        );
      }
      
      // Para otros errores, propagar normalmente
      return throwError(() => error);
    })
  );
};

