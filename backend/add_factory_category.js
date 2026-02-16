#!/usr/bin/env node

const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'wms_db',
  user: 'ahmetersoy',
  password: ''
});

async function addFactoryCategory(categoryName, description) {
  try {
    // Get factory warehouse ID
    const warehouseResult = await pool.query(
      "SELECT warehouse_id FROM warehouses WHERE code = 'FAB'"
    );

    if (warehouseResult.rows.length === 0) {
      throw new Error('Factory warehouse not found');
    }

    const warehouse_id = warehouseResult.rows[0].warehouse_id;

    // Generate location code (convert Turkish characters and uppercase)
    const locationCode = 'LOC-FAB-' + categoryName
      .toUpperCase()
      .replace(/Ğ/g, 'G')
      .replace(/Ü/g, 'U')
      .replace(/Ş/g, 'S')
      .replace(/İ/g, 'I')
      .replace(/Ö/g, 'O')
      .replace(/Ç/g, 'C')
      .replace(/ğ/g, 'g')
      .replace(/ü/g, 'u')
      .replace(/ş/g, 's')
      .replace(/ı/g, 'i')
      .replace(/ö/g, 'o')
      .replace(/ç/g, 'c')
      .replace(/\s+/g, '-');

    // Check if location already exists
    const existingCheck = await pool.query(
      'SELECT location_code FROM locations WHERE location_code = $1',
      [locationCode]
    );

    if (existingCheck.rows.length > 0) {
      console.log(`⚠️  Location already exists: ${locationCode}`);
      pool.end();
      return;
    }

    // Insert new category location
    const result = await pool.query(
      `INSERT INTO locations (
        warehouse_id, location_code, qr_code, description, zone, location_type, is_active
      ) VALUES ($1, $2, $3, $4, 'CATEGORY', 'FLOOR', true)
      RETURNING *`,
      [warehouse_id, locationCode, locationCode, description || `${categoryName} Depolama Alanı`]
    );

    console.log('✅ Factory category location created successfully!');
    console.log('');
    console.log('   Location Code:', result.rows[0].location_code);
    console.log('   QR Code:', result.rows[0].qr_code);
    console.log('   Description:', result.rows[0].description);
    console.log('   Zone:', result.rows[0].zone);
    console.log('');
    console.log('💡 You can now print a barcode for this location and place it in the factory.');

    pool.end();
  } catch (error) {
    console.error('❌ Error:', error.message);
    pool.end();
    process.exit(1);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);

if (args.length === 0) {
  console.log('Usage: node add_factory_category.js <category_name> [description]');
  console.log('');
  console.log('Examples:');
  console.log('  node add_factory_category.js "Elektrik"');
  console.log('  node add_factory_category.js "Elektrik" "Elektrik Malzemeleri Deposu"');
  console.log('  node add_factory_category.js "Boya"');
  console.log('  node add_factory_category.js "Tekstil" "Kumaş ve Tekstil Ürünleri"');
  console.log('');
  console.log('Current factory categories:');

  pool.query("SELECT location_code, description FROM locations WHERE zone = 'CATEGORY' ORDER BY location_code")
    .then(result => {
      result.rows.forEach(row => {
        console.log(`  ${row.location_code}: ${row.description}`);
      });
      pool.end();
    })
    .catch(err => {
      console.error('Error:', err.message);
      pool.end();
    });

  process.exit(0);
}

const categoryName = args[0];
const description = args[1];

addFactoryCategory(categoryName, description);
