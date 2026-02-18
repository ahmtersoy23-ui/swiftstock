const pool = require('./dist/config/database').default;

async function check() {
  try {
    const result = await pool.query('SELECT warehouse_id, code, name FROM warehouses;');
    console.log('Warehouses:');
    result.rows.forEach(row => {
      console.log(`  ${row.code} - ${row.name}`);
    });
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

check();
