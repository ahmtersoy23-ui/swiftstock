// Help panel component
interface HelpPanelProps {
  show: boolean;
  onClose: () => void;
}

export function HelpPanel({ show, onClose }: HelpPanelProps) {
  if (!show) return null;

  return (
    <div className="help-panel">
      <h3>📖 Kullanım Kılavuzu</h3>
      <div className="help-content">
        <p>
          <strong>İş Akışı:</strong>
        </p>
        <ol>
          <li>MOD seçin (buton veya barkod)</li>
          <li>LOKASYON tarayın (raf QR)</li>
          <li>ÜRÜN tarayın (her tarama = 1 adet)</li>
          <li>TAMAMLA (buton veya barkod)</li>
        </ol>

        <p>
          <strong>Barkod Formatları:</strong>
        </p>
        <ul>
          <li>
            <code>MODE-IN-RECEIVING</code> - Mal Kabul
          </li>
          <li>
            <code>MODE-OUT-PICKING</code> - Mal Çıkış
          </li>
          <li>
            <code>LOC-xxx</code> - Lokasyon
          </li>
          <li>
            <code>SKU-XXXXXX</code> - Seri Numaralı Ürün
          </li>
          <li>
            <code>ACTION-COMPLETE</code> - Tamamla
          </li>
          <li>
            <code>ACTION-CANCEL</code> - İptal
          </li>
        </ul>

        <p>
          <strong>İpuçları:</strong>
        </p>
        <ul>
          <li>Her ürün barkodu = 1 adet</li>
          <li>Seri numaralı ürünler benzersizdir</li>
          <li>Koli/Palet tarayınca tüm içerik eklenir</li>
        </ul>
      </div>
      <button onClick={onClose} className="help-close">
        Kapat
      </button>
    </div>
  );
}
