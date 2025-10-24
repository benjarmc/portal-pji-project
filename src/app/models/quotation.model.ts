export interface Quotation {
  id: string;
  planId: string;
  userId?: string;
  sessionId?: string;
  quotationNumber?: string;
  basePrice?: string;
  riskMultiplier?: string;
  finalPrice?: string;
  userData: {
    name: string;
    email: string;
    phone: string;
    rentaMensual: number;
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
    price: string;
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
  sessionId?: string; // Session ID (pji_session_ format)
  wizardSessionId?: string; // Session UUID
  monthlyRent?: number; // Monthly rent amount from user
  rentPercentage?: number; // Percentage of rent charged
  complementAmount?: number; // Amount of selected complements
  userData?: {
    name: string;
    email: string;
    phone: string;
    postalCode: string;
  };
}

export interface QuotationStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  expired: number;
  totalValue: number;
}
