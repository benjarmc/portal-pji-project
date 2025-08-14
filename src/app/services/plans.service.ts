import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { ApiService, ApiResponse } from './api.service';
import { Plan, CreatePlanDto, UpdatePlanDto, PlanSearchFilters } from '../models/plan.model';
import { SAMPLE_PLANS } from '../data/sample-plans';

@Injectable({
  providedIn: 'root'
})
export class PlansService {
  private readonly endpoint = '/plans';

  constructor(private apiService: ApiService) {
    console.log('🏗️ PlansService instanciado');
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
    console.log('🔧 PlansService.getPlans() llamado');
    console.log('🌐 Intentando conectar con API en:', this.endpoint);
    
    // Usar la API real ahora que está disponible
    return this.apiService.get<Plan[]>(this.endpoint).pipe(
      // Agrupar planes principales con sus complementos
      map((response: any) => {
        console.log('📡 Respuesta raw de la API:', response);
        
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
            (plan.coverageDetails as any)?.tipo !== 'Complemento'
          );
          
          const complementaryPlans = allPlans.filter(plan => 
            (plan.coverageDetails as any)?.tipo === 'Complemento'
          );
          
          console.log('📋 Planes principales encontrados:', mainPlans);
          console.log('🔗 Complementos encontrados:', complementaryPlans);
          
          // Agregar complementos a cada plan principal
          const plansWithComplements = mainPlans.map(mainPlan => {
            const planComplements = complementaryPlans.filter(complement => 
              (complement.coverageDetails as any)?.planPrincipal === mainPlan.name
            );
            
            return {
              ...mainPlan,
              // Asegurar que features y coverage sean arrays válidos
              features: Array.isArray(mainPlan.features) ? mainPlan.features : [],
              coverage: Array.isArray(mainPlan.coverage) ? mainPlan.coverage : [],
              complementaryPlans: planComplements
            };
          });
          
          console.log('🎯 Planes con complementos:', plansWithComplements);
          
          return {
            success: true,
            data: plansWithComplements,
            message: 'Planes principales con complementos cargados correctamente'
          };
        }
        
        return {
          success: false,
          data: [],
          message: 'No se encontraron planes'
        };
      }),
      // Fallback a planes de ejemplo si la API falla
      catchError((error: any) => {
        console.warn('⚠️ API no disponible, usando planes de ejemplo:', error);
        return of({
          success: true,
          data: SAMPLE_PLANS,
          message: 'Planes cargados desde datos de ejemplo (API no disponible)'
        });
      })
    );
  }

  /**
   * Obtener planes para administradores
   */
  getAdminPlans(): Observable<ApiResponse<Plan[]>> {
    return this.apiService.get<Plan[]>(`${this.endpoint}/admin`);
  }

  /**
   * Obtener plan por ID
   */
  getPlanById(id: string): Observable<ApiResponse<Plan>> {
    return this.apiService.get<Plan>(`${this.endpoint}/${id}`).pipe(
      map((response: any) => {
        console.log('📡 getPlanById respuesta raw:', response);
        
        // El backend devuelve directamente el Plan, no ApiResponse
        if (response && response.id) {
          // Es un Plan directo - asegurar arrays válidos
          const plan = response as Plan;
          return {
            success: true,
            data: {
              ...plan,
              features: Array.isArray(plan.features) ? plan.features : [],
              coverage: Array.isArray(plan.coverage) ? plan.coverage : []
            },
            message: 'Plan cargado correctamente'
          };
        } else if (response && response.success && response.data) {
          // Ya viene en formato ApiResponse
          const plan = response.data as Plan;
          return {
            ...response,
            data: {
              ...plan,
              features: Array.isArray(plan.features) ? plan.features : [],
              coverage: Array.isArray(plan.coverage) ? plan.coverage : []
            }
          } as ApiResponse<Plan>;
        } else {
          // Respuesta inesperada
          return {
            success: false,
            data: undefined,
            message: 'Formato de respuesta inesperado'
          };
        }
      }),
      catchError((error: any) => {
        console.error('❌ Error en getPlanById:', error);
        return of({
          success: false,
          data: undefined,
          message: 'Error al cargar el plan'
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
   * Buscar planes por tipo de cobertura
   */
  searchByCoverage(coverageType: string): Observable<ApiResponse<Plan[]>> {
    return this.apiService.get<Plan[]>(`${this.endpoint}/search/coverage/${coverageType}`);
  }

  /**
   * Obtener estadísticas generales de planes
   */
  getPlansStats(): Observable<ApiResponse<any>> {
    return this.apiService.get<any>(`${this.endpoint}/stats/overview`);
  }

  /**
   * Actualizar plan
   */
  updatePlan(id: string, planData: UpdatePlanDto): Observable<ApiResponse<Plan>> {
    return this.apiService.patch<Plan>(`${this.endpoint}/${id}`, planData);
  }

  /**
   * Activar/Desactivar plan
   */
  activatePlan(id: string): Observable<ApiResponse<Plan>> {
    return this.apiService.patch<Plan>(`${this.endpoint}/${id}/activate`, {});
  }

  /**
   * Eliminar plan
   */
  deletePlan(id: string): Observable<ApiResponse<void>> {
    return this.apiService.delete<void>(`${this.endpoint}/${id}`);
  }

  /**
   * Obtener planes activos
   */
  getActivePlans(): Observable<ApiResponse<Plan[]>> {
    return this.apiService.get<Plan[]>(this.endpoint, 
      this.apiService.createParams({ isActive: true })
    );
  }

  /**
   * Obtener complementos para un plan específico
   */
  getComplementaryPlans(planId: string): Observable<ApiResponse<Plan[]>> {
    console.log('🔧 PlansService.getComplementaryPlans() llamado para plan:', planId);
    
    return this.apiService.get<Plan[]>(this.endpoint).pipe(
      map((response: ApiResponse<Plan[]>) => {
        if (response.success && response.data) {
          // Filtrar solo complementos
          const complementaryPlans = response.data.filter(plan => 
            (plan.coverageDetails as any)?.tipo === 'Complemento'
          );
          console.log('📋 Complementos filtrados:', complementaryPlans);
          return {
            ...response,
            data: complementaryPlans
          };
        }
        return response;
      }),
      catchError((error: any) => {
        console.error('❌ Error al obtener complementos:', error);
        return of({
          success: false,
          data: [],
          message: 'Error al obtener complementos'
        });
      })
    );
  }

  /**
   * Filtrar planes con criterios personalizados
   */
  filterPlans(filters: PlanSearchFilters): Observable<ApiResponse<Plan[]>> {
    const params = this.apiService.createParams(filters);
    return this.apiService.get<Plan[]>(this.endpoint, params);
  }
}
