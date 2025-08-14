export interface Quotation {
  id: string;
  planId: string;
  userId?: string;
  userData: {
    name: string;
    email: string;
    phone: string;
    postalCode: string;
  };
  propertyData: {
    address: string;
    type: string;
    value: number;
    constructionYear?: number;
    surface?: number;
  };
  plan?: {
    id: string;
    name: string;
    price: number;
  };
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED';
  totalPrice: number;
  notes?: string;
  additionalData?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateQuotationDto {
  planId: string;
  userData: {
    name: string;
    email: string;
    phone: string;
    postalCode: string;
  };
  propertyData: {
    address: string;
    type: string;
    value: number;
    constructionYear?: number;
    surface?: number;
  };
  notes?: string;
  additionalData?: Record<string, any>;
}

export interface QuotationStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  expired: number;
  totalValue: number;
}
