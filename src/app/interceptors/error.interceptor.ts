import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      // Log del error para debugging
      console.error('HTTP Error Interceptor:', {
        url: req.url,
        method: req.method,
        status: error.status,
        message: error.message,
        error: error.error
      });

      // Aquí podrías agregar lógica adicional como:
      // - Mostrar notificaciones de error
      // - Redirigir en caso de 401/403
      // - Logging a servicios externos
      // - Retry automático para ciertos errores

      return throwError(() => error);
    })
  );
};
