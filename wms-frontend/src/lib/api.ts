// ============================================
// BACKWARD COMPATIBILITY LAYER
// ============================================
// Bu dosya geriye uyumluluk için korunuyor.
// Tüm API modülleri artık lib/api/ klasöründe.
// Yeni kod yazarken doğrudan modülleri import edin:
//   import { authApi, productApi } from '../lib/api';
// ============================================

export {
  api as default,
  apiClient,
  reportApi,
  shipmentApi,
  // New modular APIs
  authApi,
  productApi,
  inventoryApi,
  transactionApi,
  locationApi,
  warehouseApi,
  operationModeApi,
  containerApi,
  scanApi,
  serialApi,
  userApi,
} from './api/index';
