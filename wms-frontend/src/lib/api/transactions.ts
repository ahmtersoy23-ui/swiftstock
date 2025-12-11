import api from './client';
import type { ApiResponse, Transaction, TransactionCreateRequest } from '../../types';

export const transactionApi = {
  create: async (data: TransactionCreateRequest) => {
    const response = await api.post<ApiResponse<Transaction>>('/transactions', data);
    return response.data;
  },

  getRecent: async (limit = 20) => {
    const response = await api.get<ApiResponse<Transaction[]>>('/transactions', {
      params: { limit },
    });
    return response.data;
  },

  getDetails: async (transaction_id: number) => {
    const response = await api.get<ApiResponse>(`/transactions/${transaction_id}`);
    return response.data;
  },

  undo: async (transaction_id: number) => {
    const response = await api.post<ApiResponse>(`/transactions/${transaction_id}/undo`);
    return response.data;
  },
};
