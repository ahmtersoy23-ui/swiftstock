// ============================================
// SHARED TYPES — Common interfaces across all modules
// ============================================

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface Product {
  id: string;
  sku_code: string;
  product_name: string;
  category?: string;
  base_cost?: number;
  created_at?: Date;
  updated_at?: Date;
}

export interface Warehouse {
  warehouse_id: number;
  code: string;
  name: string;
  country?: string;
  city?: string;
  is_active: boolean;
  created_at?: Date;
}

export interface UserProfile {
  user_id: number;
  username: string;
  email: string;
  full_name: string;
  role: 'ADMIN' | 'MANAGER' | 'OPERATOR' | 'VIEWER';
  warehouse_code: string | null;
}
