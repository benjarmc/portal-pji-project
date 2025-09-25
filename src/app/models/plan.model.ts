export interface Plan {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  coverageDetails?: {
    tipo?: string;
    duracion?: string;
    cobertura?: string;
    renovacion?: string;
    rangoRenta?: string;
    calculoPrecio?: string;
    requiereFiador?: boolean;
    esAdicional?: boolean;
    type?: string; // Para compatibilidad con sample-plans
    planPrincipal?: string; // Para complementos
    maxAmount?: number; // Monto máximo de cobertura
  };
  maxCoverage?: number;
  deductible?: number;
  coverage?: string[]; // Hacer opcional
  features?: string[]; // Hacer opcional
  isActive: boolean;
  imageUrl?: string;
  createdAt: Date;
  updatedAt: Date;
  complementaryPlans?: Plan[]; // Complementos asociados al plan
  priceRanges?: Array<{
    rangoRenta: string;
    price: number;
    calculoPrecio?: string;
    maxCoverage?: number;
  }>; // Rangos de precio por tipo de renta
}

export interface CreatePlanDto {
  name: string;
  description: string;
  price: number;
  coverage?: string[];
  features?: string[];
}

export interface UpdatePlanDto {
  name?: string;
  description?: string;
  price?: number;
  coverage?: string[];
  features?: string[];
  isActive?: boolean;
}

export interface PlanSearchFilters {
  priceRange?: {
    min: number;
    max: number;
  };
  coverageType?: string;
  isActive?: boolean;
}
