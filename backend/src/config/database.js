const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '..', '.env') });

const baseConfig = {
  username: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || null,
  database: process.env.DB_NAME || 'portal_rrhh_db',
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT) || 3306,
  dialect: 'mysql',
  timezone: '-06:00',
  logging: false,
  define: {
    charset: 'utf8mb4',
    collate: 'utf8mb4_unicode_ci',
    underscored: true
  }
};

module.exports = {
  development: {
    ...baseConfig
  },
  test: {
    ...baseConfig,
    database: process.env.DB_NAME_TEST || 'portal_rrhh_test_db'
  },
  production: {
    ...baseConfig,
    pool: {
      max: 10,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  }
};

