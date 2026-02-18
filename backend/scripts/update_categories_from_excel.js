const { Pool } = require('pg');
const XLSX = require('xlsx');
const fs = require('fs');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'wms_db',
  user: 'ahmetersoy',
  password: ''
});

async function updateCategoriesFromExcel(excelFilePath) {
  try {
    console.log('📖 Reading Excel file:', excelFilePath);

    // Read Excel file
    const workbook = XLSX.readFile(excelFilePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    console.log(`📊 Found ${jsonData.length} rows in Excel\n`);

    // Skip header row if present
    const startIndex = jsonData[0]?.some(cell =>
      String(cell).toLowerCase().includes('iwasku') ||
      String(cell).toLowerCase().includes('sku')
    ) ? 1 : 0;

    let updatedCount = 0;
    let notFoundCount = 0;
    let errorCount = 0;

    // Process each row
    for (let i = startIndex; i < jsonData.length; i++) {
      const row = jsonData[i];
      if (!row || row.length === 0) continue;

      const sku_code = String(row[0] || '').trim();
      const product_name = String(row[1] || '').trim();
      const category = row[2] ? String(row[2]).trim() : null;

      if (!sku_code) continue;

      try {
        // Update category for this SKU
        const result = await pool.query(
          'UPDATE products SET category = $1 WHERE sku_code = $2 RETURNING sku_code',
          [category, sku_code]
        );

        if (result.rowCount > 0) {
          updatedCount++;
          if (updatedCount % 100 === 0) {
            console.log(`✅ Updated ${updatedCount} products...`);
          }
        } else {
          notFoundCount++;
          console.log(`⚠️  SKU not found: ${sku_code}`);
        }
      } catch (err) {
        errorCount++;
        console.error(`❌ Error updating ${sku_code}:`, err.message);
      }
    }

    console.log('\n📈 Summary:');
    console.log(`   ✅ Updated: ${updatedCount}`);
    console.log(`   ⚠️  Not found: ${notFoundCount}`);
    console.log(`   ❌ Errors: ${errorCount}`);

    pool.end();
  } catch (error) {
    console.error('❌ Fatal error:', error);
    pool.end();
    process.exit(1);
  }
}

// Usage
const excelFilePath = process.argv[2];

if (!excelFilePath) {
  console.log('Usage: node update_categories_from_excel.js <path-to-excel-file>');
  console.log('');
  console.log('Excel format: Column A = IWASKU, Column B = Product Name, Column C = Category');
  process.exit(1);
}

if (!fs.existsSync(excelFilePath)) {
  console.error(`❌ File not found: ${excelFilePath}`);
  process.exit(1);
}

updateCategoriesFromExcel(excelFilePath);
