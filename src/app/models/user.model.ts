export interface User {
  id: string;
  email: string;
  name: string;
  phone?: string;
  dateOfBirth?: Date;
  isVerified: boolean;
  openpayCustomerId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateUserDto {
  email: string;
  name: string;
  phone?: string;
  dateOfBirth?: string;
  password?: string;
}

export interface UpdateUserDto {
  email?: string;
  name?: string;
  phone?: string;
  dateOfBirth?: string;
  isVerified?: boolean;
  openpayCustomerId?: string;
}

export interface UserStats {
  totalPolicies: number;
  activePolicies: number;
  totalClaims: number;
  totalQuotations: number;
}
