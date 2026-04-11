// Help panel component
interface HelpPanelProps {
  show: boolean;
  onClose: () => void;
}

export function HelpPanel({ show, onClose }: HelpPanelProps) {
  if (!show) return null;

  return (
    <div className="mx-4 mb-4 bg-warning-50 border border-warning-300 rounded-xl p-4">
      <h3 className="m-0 mb-3 text-[0.9375rem] text-warning-700">📖 Kullanım Kılavuzu</h3>
      <div className="[&_p]:m-0 [&_p]:mb-2 [&_p]:text-sm [&_p]:text-warning-700 [&_p]:font-semibold [&_ol]:m-0 [&_ol]:mb-3 [&_ol]:pl-6 [&_ol]:text-warning-700 [&_ol]:text-[0.8125rem] [&_ol]:leading-[1.7] [&_ul]:m-0 [&_ul]:mb-3 [&_ul]:pl-6 [&_ul]:text-warning-700 [&_ul]:text-[0.8125rem] [&_ul]:leading-[1.7] [&_li]:mb-1 [&_code]:bg-black/[.08] [&_code]:px-2 [&_code]:py-0.5 [&_code]:rounded-md [&_code]:text-xs [&_code]:font-mono">
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
      <button onClick={onClose} className="mt-2 px-4 py-2 bg-warning-200 text-warning-700 border-none rounded-lg font-semibold text-sm cursor-pointer duration-150 hover:bg-warning-300">
        Kapat
      </button>
    </div>
  );
}
