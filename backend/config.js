const dotenv = require('dotenv');

// Read environment variables set in .env
dotenv.config();

// All application constants
module.exports = {
    backendPort: process.env.BACKEND_PORT,
    originHost: process.env.ORIGIN_HOST,
    redisHost: process.env.REDIS_HOST, 
    redisPort: process.env.REDIS_PORT,
    postgresHost: process.env.PGHOST,
    postgresPort: process.env.PGPORT,
    postgresUser: process.env.PGUSER,
    postgresPassword: process.env.PGPASSWORD,
    postgresDatabase: process.env.PGDATABASE,
    cooldownTime: process.env.COOLDOWN_TIME,
    canvasWidth: 1000,
    canvasHeight: 1000,
    boardUpdateChannel: 'board-update',
};