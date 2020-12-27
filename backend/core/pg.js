const config = require('../config');
var { Pool } = require('pg');

var postgresPool;

async function connectToPostgres() {
    // Create the postgres pool connection, which contains clients used to read and write to the postgres server
    postgresPool = new Pool({
        host: config.postgresHost,
        port: config.postgresPort,
        user: config.postgresUser, 
        password: config.postgresPassword,
        database: config.postgresDatabase,
        max: 100
    });
}

function getPostgresPool() {
    return postgresPool;
}

module.exports = {
    connectToPostgres,
    getPostgresPool
};