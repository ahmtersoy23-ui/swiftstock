const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'wms_db',
  user: 'ahmetersoy',
  password: ''
});

pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('❌ Error:', err);
  } else {
    console.log('✅ Database connected:', res.rows[0]);
  }
  pool.end();
});
