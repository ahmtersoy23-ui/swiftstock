import * as XLSX from 'xlsx';

/**
 * Export data as XLSX file.
 * @param data - Array of objects to export
 * @param filename - Filename without extension
 * @param sheetName - Sheet name (default: 'Data')
 */
export function exportToXlsx(
  data: Record<string, unknown>[],
  filename: string,
  sheetName = 'Data',
) {
  if (data.length === 0) return;

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  // Auto-size columns
  const colWidths = Object.keys(data[0]).map(key => {
    const maxLen = Math.max(
      key.length,
      ...data.map(row => String(row[key] ?? '').length),
    );
    return { wch: Math.min(maxLen + 2, 40) };
  });
  ws['!cols'] = colWidths;

  XLSX.writeFile(wb, `${filename}.xlsx`);
}
