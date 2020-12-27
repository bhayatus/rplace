var express = require('express');
var controller = require('../controllers/index'); 

// Create router that will contain all routes on our express server
var router = express.Router();

// Attach routes
router.get('/healthcheck', controller.healthCheck);
router.get('/api/place/board', controller.getBoard);
router.post('/api/place/draw', controller.updateBoard);

module.exports = router;