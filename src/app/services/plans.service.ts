import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { ApiService, ApiResponse } from './api.service';
import { Plan, CreatePlanDto, UpdatePlanDto, PlanSearchFilters } from '../models/plan.model';
import { LoggerService } from './logger.service';

@Injectable({
  providedIn: 'root'
})
export class PlansService {
  private readonly endpoint = '/plans';

  constructor(
    private apiService: ApiService,
    private logger: LoggerService
  ) {
    this.logger.log('🏗️ PlansService instanciado');
  }

  /**
   * Crear un nuevo plan
   */
  createPlan(planData: CreatePlanDto): Observable<ApiResponse<Plan>> {
    return this.apiService.post<Plan>(this.endpoint, planData);
  }

  /**
   * Obtener todos los planes
   */
  getPlans(): Observable<ApiResponse<Plan[]>> {
    this.logger.log('🔧 PlansService.getPlans() llamado');
    this.logger.log('🌐 Intentando conectar con API en:', this.endpoint);
    
    // Usar la API real ahora que está disponible
    return this.apiService.get<Plan[]>(this.endpoint).pipe(
      // Procesar planes con nueva estructura
      switchMap((response: any) => {
        this.logger.log('📡 Respuesta raw de la API:', response);
        
        // La API devuelve directamente el array, no ApiResponse
        let allPlans: Plan[] = [];
        if (Array.isArray(response)) {
          allPlans = response;
        } else if (response.data && Array.isArray(response.data)) {
          allPlans = response.data;
        } else if (response.success && response.data && Array.isArray(response.data)) {
          allPlans = response.data;
        }
        
        if (allPlans.length > 0) {
          // Separar planes principales y complementos
          const mainPlans = allPlans.filter(plan => 
            (plan.coverageDetails as any)?.tipo === 'Principal'
          );
          
          // Obtener complementos por separado ya que el endpoint principal no los incluye
          return this.getComplementsFromAPI().pipe(
            map(complementaryPlans => {
              this.logger.log('📋 Planes principales encontrados:', mainPlans);
              this.logger.log('🔗 Complementos encontrados:', complementaryPlans);
              
              // Procesar planes principales (ya no hay duplicados)
              const processedPlans = mainPlans.map(plan => {
                return {
                  ...plan,
                  // Asegurar que features y coverage sean arrays válidos
                  features: Array.isArray(plan.features) ? plan.features : [],
                  coverage: Array.isArray(plan.coverage) ? plan.coverage : [],
                  complementaryPlans: complementaryPlans
                };
              });
              
              this.logger.log('🎯 Planes procesados:', processedPlans);
              
              return {
                success: true,
                data: processedPlans,
                message: 'Planes principales cargados correctamente'
              };
            })
          );
        } else {
          this.logger.log('⚠️ No se encontraron planes en la respuesta');
          return of({
            success: false,
            data: [],
            message: 'No se encontraron planes'
          });
        }
      }),
      catchError((error: any) => {
        this.logger.error('❌ Error en PlansService.getPlans():', error);
        this.logger.error('❌ Detalles del error:', { error: error.error, status: error.status, message: error.message });
        
        // Propagar el error sin fallback
        throw error;
      })
    );
  }

  /**
   * Obtener plan por ID
   */
  getPlanById(id: string): Observable<ApiResponse<Plan>> {
    return this.apiService.get<Plan>(`${this.endpoint}/${id}`).pipe(
      switchMap((response: any) => {
        this.logger.log('📡 getPlanById respuesta raw:', response);
        
        // El backend devuelve directamente el Plan, no ApiResponse
        if (response && response.id) {
          // Es un Plan directo - asegurar arrays válidos y agregar complementos
          const plan = response as Plan;
          
          return this.getComplementsFromAPI().pipe(
            map(complementaryPlans => ({
              success: true,
              data: {
                ...plan,
                features: Array.isArray(plan.features) ? plan.features : [],
                coverage: Array.isArray(plan.coverage) ? plan.coverage : [],
                complementaryPlans: complementaryPlans
              },
              message: 'Plan cargado correctamente'
            }))
          );
        } else if (response && response.success && response.data) {
          // Ya viene en formato ApiResponse
          const plan = response.data as Plan;
          
          return this.getComplementsFromAPI().pipe(
            map(complementaryPlans => ({
              ...response,
              data: {
                ...plan,
                features: Array.isArray(plan.features) ? plan.features : [],
                coverage: Array.isArray(plan.coverage) ? plan.coverage : [],
                complementaryPlans: complementaryPlans
              }
            } as ApiResponse<Plan>))
          );
        } else {
          // Respuesta inesperada
          return of({
            success: false,
            data: undefined,
            message: 'Formato de respuesta inesperado'
          });
        }
      }),
      catchError((error: any) => {
        this.logger.error('❌ Error en getPlanById:', error);
        return of({
          success: false,
          data: undefined,
          message: 'Error cargando plan'
        });
      })
    );
  }

  /**
   * Obtener complementos directamente de la API
   */
  private getComplementsFromAPI(): Observable<Plan[]> {
    // Obtener el complemento Protecdominio directamente por su ID
    return this.apiService.get<Plan>(`${this.endpoint}/4abe6a7c-4d5c-439b-b080-e76166165ce4`).pipe(
      map((response: any) => {
        if (response && response.id) {
          return [response as Plan];
        }
        return [];
      }),
      catchError((error) => {
        this.logger.error('❌ Error obteniendo complementos de la API:', error);
        return of([]);
      })
    );
  }

  /**
   * Calcular precio dinámico basado en renta mensual
   */
  calculateDynamicPrice(planName: string, monthlyRent: number): number {
    const priceRanges: Record<string, Record<string, number>> = {
      'Esencial': {
        'De $1.0 a $10,000 mensuales': 3500,
        'De $10,001 a $30,000 mensuales': 4200,
        'Mayor a $30,000 mensuales': monthlyRent * 0.14
      },
      'Premium': {
        'De $1.0 a $10,000 mensuales': 4950,
        'De $10,001 a $30,000 mensuales': 5950,
        'Mayor a $30,000 mensuales': monthlyRent * 0.20
      },
      'Diamante': {
        'De $1.0 a $10,000 mensuales': 9950,
        'De $10,001 a $30,000 mensuales': 11700,
        'Mayor a $30,000 mensuales': monthlyRent * 0.39
      }
    };

    if (monthlyRent <= 10000) {
      return priceRanges[planName]?.['De $1.0 a $10,000 mensuales'] || 0;
    } else if (monthlyRent <= 30000) {
      return priceRanges[planName]?.['De $10,001 a $30,000 mensuales'] || 0;
    } else {
      return priceRanges[planName]?.['Mayor a $30,000 mensuales'] || 0;
    }
  }

  /**
   * Obtener complementos disponibles
   */
  getAvailableComplements(): Observable<ApiResponse<Plan[]>> {
    return this.getComplementsFromAPI().pipe(
      map((complements) => {
        return {
          success: true,
          data: complements,
          message: 'Complementos cargados correctamente'
        };
      }),
      catchError((error: any) => {
        this.logger.error('❌ Error al obtener complementos:', error);
        return of({
          success: false,
          data: [],
          message: 'Error al obtener complementos'
        });
      })
    );
  }

  /**
   * Buscar planes por rango de precio
   */
  searchByPriceRange(minPrice: number, maxPrice: number): Observable<ApiResponse<Plan[]>> {
    return this.apiService.get<Plan[]>(`${this.endpoint}/search/price-range`, 
      this.apiService.createParams({ minPrice, maxPrice })
    );
  }

  /**
   * Buscar planes por filtros
   */
  searchPlans(filters: PlanSearchFilters): Observable<ApiResponse<Plan[]>> {
    return this.apiService.get<Plan[]>(`${this.endpoint}/search`, 
      this.apiService.createParams(filters)
    );
  }

  /**
   * Actualizar un plan existente
   */
  updatePlan(id: string, planData: UpdatePlanDto): Observable<ApiResponse<Plan>> {
    return this.apiService.put<Plan>(`${this.endpoint}/${id}`, planData);
  }

  /**
   * Eliminar un plan
   */
  deletePlan(id: string): Observable<ApiResponse<void>> {
    return this.apiService.delete<void>(`${this.endpoint}/${id}`);
  }

  /**
   * Obtener planes para administración
   */
  getAdminPlans(): Observable<ApiResponse<Plan[]>> {
    return this.apiService.get<Plan[]>(`${this.endpoint}/admin`);
  }
}