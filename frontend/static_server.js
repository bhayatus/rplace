var express = require('express');
var staticServer = express();

// Serve static files from public folder
staticServer.use(express.static(__dirname + '/public'));

// Run static server
staticServer.listen(process.env.STATIC_SERVER_PORT, () => {
    console.log(`Static server running on port ${process.env.STATIC_SERVER_PORT}`);
});