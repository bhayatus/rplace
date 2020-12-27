const config = require('../config');
var express = require('express');
var bodyParser = require('body-parser');
const requestIp = require('request-ip');
var router = require('../routes/index');

var app = express();

// Middleware for parsing json encoded bodies
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Middleware to get client ip address
app.use(requestIp.mw());

// Middleware to set headers on response
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', config.originHost);
    res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With, content-type');
    res.setHeader( 'Cache-Control', 'no-store');
    next();
});

// Tell app to use router which contains all routes
app.use('/', router);

module.exports = app;