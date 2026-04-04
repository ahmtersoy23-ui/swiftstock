# SwiftStock

Depo yonetim sistemi (WMS). Express TS + Vite + React 19 + PWA.

## Komutlar
```bash
cd backend && npm run dev     # nodemon (port 3001 lokal, 3006 sunucu!)
cd frontend && npm run dev    # vite
cd backend && npm test        # jest (6 test)
```

## Kurallar
- Custom CSS (Tailwind YOK)
- PWA: Workbox + Capacitor
- Serial zorunlu (FACTORY+IN), kategori = zone
- `re-export` sorunu: `export { X } from './module'` CI'da TS2614 firlatabilir → dogrudan import kullan
- Lokal port (3001) ≠ sunucu port (3006)
- Migration: tablolar postgres owned → `sudo -u postgres psql -d swiftstock_db`
