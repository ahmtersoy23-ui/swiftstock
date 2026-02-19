// ============================================
// SWAGGER CONFIGURATION

// ============================================

import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'WMS Backend API',
      version: '1.0.0',
      description: `
## Warehouse Management System API

Bu API, depo yönetim sistemi için tüm backend işlemlerini sağlar.

### Özellikler
- **Kimlik Doğrulama**: JWT tabanlı authentication ve role-based access control
- **Ürün Yönetimi**: SKU, barkod, stok takibi
- **Envanter Yönetimi**: Çoklu depo, lokasyon bazlı stok
- **İşlem Takibi**: Giriş/Çıkış işlemleri, transfer, sayım
- **Konteyner Yönetimi**: Koli ve palet işlemleri
- **Sipariş Yönetimi**: Picking, packing işlemleri
- **Seri Numarası Takibi**: Ürün bazlı seri numara yönetimi

### Kimlik Doğrulama
API, JWT (JSON Web Token) tabanlı kimlik doğrulama kullanır.
Token almak için \`/api/auth/login\` endpoint'ini kullanın.
      `,
      contact: {
        name: 'SwiftStock Support',
        email: 'support@swiftstock.io',
      },
      license: {
        name: 'Private',
      },
    },
    servers: [
      {
        url: 'http://localhost:3001/api/v1',
        description: 'Development Server (v1)',
      },
      {
        url: 'http://localhost:3001/api',
        description: 'Development Server (legacy)',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT token - Login yaparak alınır',
        },
      },
      schemas: {
        // Common Schemas
        ApiResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            data: { type: 'object' },
            error: { type: 'string' },
          },
        },
        PaginatedResponse: {
          allOf: [
            { $ref: '#/components/schemas/ApiResponse' },
            {
              type: 'object',
              properties: {
                pagination: {
                  type: 'object',
                  properties: {
                    page: { type: 'integer' },
                    limit: { type: 'integer' },
                    total: { type: 'integer' },
                    totalPages: { type: 'integer' },
                  },
                },
              },
            },
          ],
        },
        ValidationError: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            error: { type: 'string' },
            details: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  field: { type: 'string' },
                  message: { type: 'string' },
                },
              },
            },
          },
        },

        // Auth Schemas
        LoginRequest: {
          type: 'object',
          required: ['username', 'password'],
          properties: {
            username: { type: 'string', example: 'admin' },
            password: { type: 'string', example: 'password123' },
            device_uuid: { type: 'string' },
            device_name: { type: 'string' },
          },
        },
        LoginResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: {
              type: 'object',
              properties: {
                user: { $ref: '#/components/schemas/User' },
                accessToken: { type: 'string' },
                refreshToken: { type: 'string' },
              },
            },
          },
        },
        ChangePasswordRequest: {
          type: 'object',
          required: ['currentPassword', 'newPassword'],
          properties: {
            currentPassword: { type: 'string' },
            newPassword: { type: 'string', minLength: 6 },
          },
        },

        // User Schema
        User: {
          type: 'object',
          properties: {
            user_id: { type: 'integer' },
            username: { type: 'string' },
            email: { type: 'string', format: 'email' },
            full_name: { type: 'string' },
            role: { type: 'string', enum: ['ADMIN', 'MANAGER', 'OPERATOR', 'VIEWER'] },
            warehouse_code: { type: 'string' },
            is_active: { type: 'boolean' },
            created_at: { type: 'string', format: 'date-time' },
            last_login: { type: 'string', format: 'date-time' },
          },
        },
        CreateUserRequest: {
          type: 'object',
          required: ['username', 'password', 'email', 'role'],
          properties: {
            username: { type: 'string', minLength: 3, maxLength: 50 },
            password: { type: 'string', minLength: 6 },
            email: { type: 'string', format: 'email' },
            full_name: { type: 'string' },
            role: { type: 'string', enum: ['ADMIN', 'MANAGER', 'OPERATOR', 'VIEWER'] },
            warehouse_code: { type: 'string' },
          },
        },

        // Product Schemas
        Product: {
          type: 'object',
          properties: {
            product_id: { type: 'integer' },
            sku_code: { type: 'string' },
            name: { type: 'string' },
            description: { type: 'string' },
            barcode: { type: 'string' },
            category: { type: 'string' },
            brand: { type: 'string' },
            unit_of_measure: { type: 'string' },
            weight_kg: { type: 'number' },
            dimensions_cm: { type: 'string' },
            min_stock_level: { type: 'integer' },
            is_active: { type: 'boolean' },
            is_serialized: { type: 'boolean' },
            created_at: { type: 'string', format: 'date-time' },
          },
        },
        CreateProductRequest: {
          type: 'object',
          required: ['sku_code', 'name'],
          properties: {
            sku_code: { type: 'string' },
            name: { type: 'string' },
            description: { type: 'string' },
            barcode: { type: 'string' },
            category: { type: 'string' },
            brand: { type: 'string' },
            unit_of_measure: { type: 'string', default: 'EACH' },
            weight_kg: { type: 'number' },
            min_stock_level: { type: 'integer', default: 0 },
            is_serialized: { type: 'boolean', default: false },
          },
        },

        // Transaction Schemas
        Transaction: {
          type: 'object',
          properties: {
            transaction_id: { type: 'integer' },
            transaction_uuid: { type: 'string', format: 'uuid' },
            transaction_type: { type: 'string', enum: ['RECEIVE', 'SHIP', 'ADJUST', 'TRANSFER', 'RETURN', 'COUNT'] },
            sku_code: { type: 'string' },
            warehouse_code: { type: 'string' },
            quantity: { type: 'integer' },
            created_by: { type: 'string' },
            created_at: { type: 'string', format: 'date-time' },
          },
        },
        CreateTransactionRequest: {
          type: 'object',
          required: ['transaction_type', 'sku_code', 'warehouse_code', 'quantity'],
          properties: {
            transaction_type: { type: 'string', enum: ['RECEIVE', 'SHIP', 'ADJUST', 'TRANSFER', 'RETURN', 'COUNT'] },
            sku_code: { type: 'string' },
            warehouse_code: { type: 'string' },
            location_id: { type: 'integer' },
            quantity: { type: 'integer', minimum: 1 },
            unit_type: { type: 'string', enum: ['EACH', 'BOX', 'PALLET'], default: 'EACH' },
            reference_number: { type: 'string' },
            notes: { type: 'string' },
          },
        },

        // Location Schemas
        Location: {
          type: 'object',
          properties: {
            location_id: { type: 'integer' },
            warehouse_code: { type: 'string' },
            location_code: { type: 'string' },
            qr_code: { type: 'string' },
            description: { type: 'string' },
            zone: { type: 'string' },
            location_type: { type: 'string', enum: ['SHELF', 'FLOOR', 'RACK', 'BIN', 'PALLET_LOCATION', 'DOCK', 'STAGING'] },
            is_active: { type: 'boolean' },
            created_at: { type: 'string', format: 'date-time' },
          },
        },

        // Container Schemas
        Container: {
          type: 'object',
          properties: {
            container_id: { type: 'integer' },
            barcode: { type: 'string' },
            container_type: { type: 'string', enum: ['BOX', 'PALLET'] },
            warehouse_code: { type: 'string' },
            status: { type: 'string', enum: ['OPEN', 'CLOSED', 'SHIPPED', 'ARCHIVED'] },
            created_by: { type: 'string' },
            created_at: { type: 'string', format: 'date-time' },
          },
        },

        // Warehouse Schema
        Warehouse: {
          type: 'object',
          properties: {
            warehouse_id: { type: 'integer' },
            warehouse_code: { type: 'string' },
            name: { type: 'string' },
            address: { type: 'string' },
            country: { type: 'string' },
            is_active: { type: 'boolean' },
            created_at: { type: 'string', format: 'date-time' },
          },
        },

        // Inventory Schema
        Inventory: {
          type: 'object',
          properties: {
            inventory_id: { type: 'integer' },
            sku_code: { type: 'string' },
            warehouse_code: { type: 'string' },
            location_id: { type: 'integer' },
            quantity: { type: 'integer' },
            reserved_quantity: { type: 'integer' },
            available_quantity: { type: 'integer' },
            last_updated: { type: 'string', format: 'date-time' },
          },
        },

        // Scan Request/Response
        ScanRequest: {
          type: 'object',
          required: ['barcode'],
          properties: {
            barcode: { type: 'string' },
            scan_type: { type: 'string', enum: ['PRODUCT', 'LOCATION', 'CONTAINER', 'AUTO'], default: 'AUTO' },
            warehouse_code: { type: 'string' },
          },
        },
        ScanResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                type: { type: 'string', enum: ['PRODUCT', 'LOCATION', 'CONTAINER'] },
                product: { $ref: '#/components/schemas/Product' },
                location: { $ref: '#/components/schemas/Location' },
                container: { $ref: '#/components/schemas/Container' },
                inventory: { $ref: '#/components/schemas/Inventory' },
              },
            },
          },
        },
      },
      responses: {
        Unauthorized: {
          description: 'Kimlik doğrulama gerekli',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: false },
                  error: { type: 'string', example: 'Token bulunamadı. Lütfen giriş yapın.' },
                },
              },
            },
          },
        },
        Forbidden: {
          description: 'Yetki yetersiz',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: false },
                  error: { type: 'string', example: 'Bu işlem için yetkiniz bulunmuyor.' },
                },
              },
            },
          },
        },
        NotFound: {
          description: 'Kaynak bulunamadı',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: false },
                  error: { type: 'string', example: 'Kayıt bulunamadı' },
                },
              },
            },
          },
        },
        ValidationError: {
          description: 'Doğrulama hatası',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ValidationError' },
            },
          },
        },
      },
    },
    tags: [
      { name: 'Auth', description: 'Kimlik doğrulama işlemleri' },
      { name: 'Users', description: 'Kullanıcı yönetimi' },
      { name: 'Products', description: 'Ürün yönetimi' },
      { name: 'Inventory', description: 'Envanter işlemleri' },
      { name: 'Transactions', description: 'Stok hareketleri' },
      { name: 'Locations', description: 'Lokasyon yönetimi' },
      { name: 'Containers', description: 'Konteyner (Koli/Palet) işlemleri' },
      { name: 'Warehouses', description: 'Depo bilgileri' },
      { name: 'Scan', description: 'Barkod tarama işlemleri' },
      { name: 'Orders', description: 'Sipariş yönetimi' },
      { name: 'Cycle Counts', description: 'Sayım işlemleri' },
      { name: 'RMA', description: 'İade yönetimi' },
      { name: 'Serials', description: 'Seri numarası takibi' },
      { name: 'Health', description: 'API sağlık kontrolü' },
    ],
  },
  apis: ['./src/routes/*.ts', './src/controllers/*.ts'],
};

export const swaggerSpec = swaggerJsdoc(options);
