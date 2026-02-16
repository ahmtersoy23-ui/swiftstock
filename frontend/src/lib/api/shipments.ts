import api from './client';
import type { ApiResponse } from '../../types';

export const shipmentApi = {
  // Get all shipments
  getAll: async (params?: { status?: string; warehouse_id?: number }) => {
    const response = await api.get<ApiResponse>('/shipments', { params });
    return response.data;
  },

  // Get shipment by ID
  getById: async (shipment_id: number) => {
    const response = await api.get<ApiResponse>(`/shipments/${shipment_id}`);
    return response.data;
  },

  // Create new shipment
  create: async (data: {
    prefix: string;
    name: string;
    source_warehouse_id: number;
    default_destination?: 'USA' | 'FBA';
    notes?: string;
    created_by: string;
  }) => {
    const response = await api.post<ApiResponse>('/shipments', data);
    return response.data;
  },

  // Get shipment boxes
  getBoxes: async (shipment_id: number, destination?: 'USA' | 'FBA') => {
    const response = await api.get<ApiResponse>(`/shipments/${shipment_id}/boxes`, {
      params: destination ? { destination } : undefined,
    });
    return response.data;
  },

  // Create box in shipment
  createBox: async (shipment_id: number, data: {
    destination?: 'USA' | 'FBA';
    notes?: string;
    created_by: string;
  }) => {
    const response = await api.post<ApiResponse>(`/shipments/${shipment_id}/boxes`, data);
    return response.data;
  },

  // Close shipment
  close: async (shipment_id: number) => {
    const response = await api.post<ApiResponse>(`/shipments/${shipment_id}/close`);
    return response.data;
  },

  // Ship shipment
  ship: async (shipment_id: number) => {
    const response = await api.post<ApiResponse>(`/shipments/${shipment_id}/ship`);
    return response.data;
  },

  // Get box by barcode
  getBoxByBarcode: async (barcode: string) => {
    const response = await api.get<ApiResponse>(`/boxes/${barcode}`);
    return response.data;
  },

  // Add item to box
  addItemToBox: async (box_id: number, data: {
    sku_code: string;
    quantity: number;
    added_by: string;
  }) => {
    const response = await api.post<ApiResponse>(`/boxes/${box_id}/items`, data);
    return response.data;
  },

  // Remove item from box
  removeItemFromBox: async (content_id: number) => {
    const response = await api.delete<ApiResponse>(`/boxes/contents/${content_id}`);
    return response.data;
  },

  // Close box
  closeBox: async (box_id: number, weight_kg?: number) => {
    const response = await api.post<ApiResponse>(`/boxes/${box_id}/close`, { weight_kg });
    return response.data;
  },

  // Update box destination
  updateBoxDestination: async (box_id: number, destination: 'USA' | 'FBA') => {
    const response = await api.put<ApiResponse>(`/boxes/${box_id}/destination`, { destination });
    return response.data;
  },
};
