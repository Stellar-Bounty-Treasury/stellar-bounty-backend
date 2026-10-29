const { getDatabase, closeDatabase } = require('../dist/db/database.js');

console.log('Running SQLite VACUUM and ANALYZE optimization...');
const db = getDatabase();

db.exec('PRAGMA optimize;');
db.exec('VACUUM;');
db.exec('ANALYZE;');

closeDatabase();
console.log('Database optimization completed.');
