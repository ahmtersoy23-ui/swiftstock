console.log('🔍 Testing imports...');

try {
  console.log('1. Loading express...');
  const express = require('express');
  
  console.log('2. Loading pg...');
  const { Pool } = require('pg');
  
  console.log('3. Creating pool...');
  const pool = new Pool({
    host: 'localhost',
    port: 5432,
    database: 'wms_db',
    user: 'ahmetersoy',
    password: ''
  });
  
  console.log('4. Testing connection...');
  pool.query('SELECT NOW()', (err, res) => {
    if (err) {
      console.error('❌ DB Error:', err);
      process.exit(1);
    }
    console.log('✅ DB Connected:', res.rows[0]);
    
    console.log('5. Starting Express...');
    const app = express();
    app.get('/', (req, res) => res.json({ ok: true }));
    
    app.listen(3001, () => {
      console.log('🚀 Server started on http://localhost:3001');
    });
  });
  
} catch (error) {
  console.error('❌ Fatal error:', error);
}
