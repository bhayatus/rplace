const config = require('./config');
var redis = require('./core/ioredis');
var postgres = require('./core/pg');
var socketio = require('./core/socketio');

async function startApp() {
    var app = require('./core/express');
    var server = require('http').createServer(app);
    
    // Wait for connections to redis and postgres to be established
    await redis.connectToRedis();
    await postgres.connectToPostgres();

    // Create websocket
    await socketio.createSocket(server);
    
    // Run server
    server.listen(config.backendPort, () => {
        console.log(`Server running on port ${config.backendPort}`);
    });
}

startApp();