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
    <div className="items-list">
      <div className="items-header">
        <span>{translations.scannedProducts}</span>
        <span className="items-total">
          {totalItems} {translations.items}
        </span>
      </div>
      {items.map((item, index) => (
        <div
          key={index}
          className={`item-row ${item.fromContainer ? 'container-item' : ''}`}
        >
          <div className="item-info">
            <span className="item-name">
              {item.product.product_name}
              {item.serial && <span className="serial-badge">{item.serial.serial_no}</span>}
              {item.fromContainer && <span className="container-badge">📦</span>}
            </span>
            <span className="item-sku">{item.product.sku_code}</span>
          </div>
          <button onClick={() => onRemoveItem(index)} className="item-remove">
            ✕
          </button>
        </div>
      ))}
      <div className="scan-action-hint">{translations.scanCompleteOrCancel}</div>
    </div>
  );
}
