// Scanned items list component
import type { ScannedItem } from '../types';

interface ItemsListProps {
  items: ScannedItem[];
  onRemoveItem: (index: number) => void;
  translations: {
    scannedProducts: string;
    items: string;
    scanCompleteOrCancel: string;
  };
}

export function ItemsList({ items, onRemoveItem, translations }: ItemsListProps) {
  if (items.length === 0) return null;

  const totalItems = items.length;

  return (
    <div className="mx-4 mb-4 bg-slate-100 rounded-xl border border-slate-200 overflow-hidden">
      <div className="flex justify-between items-center px-4 py-3 bg-slate-100 border-b border-slate-200 font-semibold text-slate-600">
        <span>{translations.scannedProducts}</span>
        <span className="bg-primary-500 text-white px-3 py-1 rounded-full text-[0.8125rem]">
          {totalItems} {translations.items}
        </span>
      </div>
      {items.map((item, index) => (
        <div
          key={index}
          className={`flex items-center px-4 py-3 border-b border-slate-200 last:border-b-0 ${item.fromContainer ? 'bg-warning-50' : 'bg-white'}`}
        >
          <div className="flex-1 min-w-0">
            <span className="flex items-center gap-2 font-medium text-slate-800 text-[0.9375rem] mb-1">
              {item.product.product_name}
              {item.serial && <span className="font-mono text-[0.6875rem] bg-primary-100 text-primary-700 px-2 py-0.5 rounded-md font-semibold">{item.serial.serial_no}</span>}
              {item.fromContainer && <span className="text-[0.8125rem]">📦</span>}
            </span>
            <span className="font-mono text-xs text-slate-500">{item.product.sku_code}</span>
          </div>
          <button onClick={() => onRemoveItem(index)} className="bg-transparent border-none text-slate-300 text-base cursor-pointer p-2 -mr-2 duration-150 hover:text-error-500">
            ✕
          </button>
        </div>
      ))}
      <div className="px-4 py-3 text-center text-[0.8125rem] text-slate-500 bg-slate-100 italic">{translations.scanCompleteOrCancel}</div>
    </div>
  );
}
