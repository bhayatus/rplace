const config = require('../config');
var ioredis = require('ioredis');

var redisClient;
var redisPublisher;
var redisSubscriber;

async function connectToRedis() {
    // Create the primary client that will be used to read and write to redis
    redisClient = new ioredis(config.redisHost, config.redisPort);

    // Create the publisher that will send messages to channels
    redisPublisher = new ioredis(config.redisHost, config.redisPort);
    
    // Create subscriber that will listen on channels
    redisSubscriber = new ioredis(config.redisHost, config.redisPort);
    redisSubscriber.subscribe(config.boardUpdateChannel);
}

function getRedisClient() {
    return redisClient;
}

function getRedisPublisher() {
    return redisPublisher;
}

function getRedisSubscriber() {
    return redisSubscriber;
}

module.exports = {
    connectToRedis,
    getRedisClient,
    getRedisPublisher,
    getRedisSubscriber
};
