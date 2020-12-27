const config = require('../config');
var redis = require('../core/ioredis');
var postgres = require('../core/pg');
var { validateUpdateBoardRequestParams } = require('../utils/validate');

async function healthCheck (req, res) {
    res.status(200).send('Still alive!');
}

async function getBoard(req, res) {
    try {
        // Get binary buffer stream of board, and return it
        result = await redis.getRedisClient().getBuffer('board');
        res.status(200).send(result);
    } catch (err) {
        console.error(err);
        res.status(500).send();
    }
}

async function updateBoard(req, res) {
    var x = req.body.x;
    var y = req.body.y;
    var color = req.body.color;
    var userIP = req.clientIp;

    // Check input params and make sure they are of valid format
    validationError = validateUpdateBoardRequestParams(x, y, color, userIP);
    if (validationError) {
        console.error(validationError);
        res.status(400).send(validationError);
        return;
    }

    try {
        // Check if user is still in cooldown period
        var timeLeftSeconds = await redis.getRedisClient().ttl(userIP);
        if (timeLeftSeconds != -2) {
            res.status(403).send(`${timeLeftSeconds}`);
            return;
        }
    } catch (err) {
        console.error(err);
        res.status(500).send();
        return;
    }
    
    // Grab a client from the pool
    const db = await postgres.getPostgresPool().connect();

    try {
        // Start of transaction
        await db.query("BEGIN");
        // Call custom postgres function to update latest_changes and full_history tables atomically
        result = await db.query("SELECT update_board($1, $2, $3, $4, NOW()::timestamp);", [userIP, x, y, color]);

        // Updates to database tables have been made at this point, update bitfield in redis and set cooldown timer for this user's ip address
        await redis.getRedisClient().multi([['call', 'BITFIELD', 'board', 'SET', 'u4', `#${(x + (config.canvasWidth * y))}`, `${color}`], ['call', 'SETEX', `${userIP}`, `${config.cooldownTime}`, `${""}`]]).exec();
        
        // Notify all connected clients of new board update
        redis.getRedisPublisher().publish(config.boardUpdateChannel, `${x},${y},${color}`);
        
        // At this point no errors have occurred, commit the transaction in postgres and indicate success along with the cooldown time
        await db.query('COMMIT');
        res.status(200).send(`${config.cooldownTime}`);
        return;

    } catch (err) { 
        console.error(err);
        // Rollback any changes in postgres
        await db.query('ROLLBACK');
        res.status(500).send();
    } finally {
        // Release this client back into pool
        db.release();
    }
    return;
}

module.exports = {
    healthCheck,
    getBoard,
    updateBoard
}