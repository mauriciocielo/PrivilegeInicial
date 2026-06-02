import mysql from 'mysql2/promise';

// Configurações via variáveis de ambiente (recomenda-se criar um arquivo .env)
const pool = mysql.createPool({
    host: process.env.MYSQL_HOST || 'localhost',
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE || 'cashflow_system',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    dateStrings: true // Mantém datas como strings YYYY-MM-DD
});

export default pool;