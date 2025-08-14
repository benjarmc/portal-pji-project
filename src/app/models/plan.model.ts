export interface Plan {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  coverageDetails?: object;
  maxCoverage?: number;
  deductible?: number;
  coverage?: string[]; // Hacer opcional
  features?: string[]; // Hacer opcional
  isActive: boolean;
  imageUrl?: string;
  createdAt: Date;
  updatedAt: Date;
  complementaryPlans?: Plan[]; // Complementos asociados al plan
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
