const config = require('../config');
var redis = require('./ioredis');

async function createSocket(server) {
    redisPublisher = redis.getRedisPublisher();
    redisSubscriber = redis.getRedisSubscriber();

    // Create the socket and attach it to the existing server on the specified path, only allowing connections from specific origin host
    // Also set the ping interval and ping timeout to 1 min and 4 mins respectively
    var socket = require('socket.io')(server, {
        path: '/api/board-updates',
        cors: {
            origins: config.originHost,
        },
        pingInterval: 60000,
        pingTimeout: 240000
    });
    
    // When a user connects to the websocket
    socket.on('connection', (socketUser) => {    
        // Create a channel listener which will receive messages on specific channels, and send them to the client
        var channelListener = (channel, message) => {
            socketUser.emit(channel, message);
        }
        // Attach the listener
        redisSubscriber.on('message', channelListener);
    
        // When user disconnects
        socketUser.on('disconnect', () => {
            // Remove the channel listener for this user to avoid memory leaks
            redisSubscriber.removeListener('message', channelListener);
        });
    
    });
}

module.exports = {
    createSocket
}


