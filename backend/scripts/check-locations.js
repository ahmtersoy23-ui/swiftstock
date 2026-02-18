const pool = require('./dist/config/database').default;

async function check() {
  try {
    const result = await pool.query('SELECT location_id, qr_code, warehouse_id, description FROM locations LIMIT 10;');
    console.log('Locations:');
    result.rows.forEach(row => {
      console.log('  ' + row.qr_code + ' (Warehouse: ' + row.warehouse_id + ')');
    });
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

check();
