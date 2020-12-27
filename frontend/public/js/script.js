// Host that requests will be made to on port 80
const host = 'http://localhost';
// Websocket connection object
var socket;
// How long to wait to connect to backend before showing connection error
const connectionTimeout = 3000;

// Canvas object that displays the board
var canvas;
// Canvas context
var ctx;
// The loading screen overlay
var loadingOverlay;
// Icon that shows when backend is connected
var networkStatusConnectedIcon;
// Icon that shows when backend is disconnected
var networkStatusDisconnectedIcon;
// Div to display cooldown time remaining
var cooldownDisplay;
// Div to display coordindates of mouse in canvas
var coordinates;
// Panzoom object used for panning and zooming on canvas
var panzoom;

// Board width and height
const canvasWidth = 1000;
const canvasHeight = 1000;

// Underlying canvas data array that will be modified upon changes to board
var canvasData;
// ID of requestAnimationFrame call, necessary in the case that we need to cancel the loop
var requestAnimationFrameID;
// Used to indicate if the initial board state has been loaded in
var initialBoardReady = false;
// Array to store websocket updates that need to be applied AFTER initial board data has been processed
const batchedUpdates = [];

// Indicates if currently in cooldown period
var cooldownInEffect = false;
// Timer used to countdown until cooldown period is over
var cooldownTimer;

// Indicates if mouse is down
var mouseDown = false;
// Indicates if user is currently dragging
var dragging = false;
// The starting mouse position globally
var dragStart;

// Current zoom scale
var scale = 5;
// Minimum zoom level
const minScale = 1;
// Maximum zoom level
const maxScale = 9;

// Default color that is selected
var selectedColor = '#222222';

// Error messages
const failedToConnectError = 'Failed to connect to the server';
const lostConnectionError = 'Lost connection with server';
const cooldownError = "Cooldown period still in effect"
const internalServerError = 'Looks like something went wrong on our end';

// Color palette used, index corresponds to its 4 bit binary number
const colors = ['#FFFFFF', '#E4E4E4', '#888888', '#222222', '#FFA7D1', '#E50000', '#E59500', '#A06A42', '#E5D900', '#94E044', '#02BE01', '#00D3DD', '#0083C7', '#0000EA', '#CF6EE4', '#820080']

// 32 bit representation of (r, g, b, a), index corresponds its 4 bit binary number
const colors32Bit = [0xFFFFFFFF, 0xE4E4E4FF, 0x888888FF, 0x222222FF, 0xFFA7D1FF, 0xE50000FF, 0xE59500FF, 0xA06A42FF, 0xE5D900FF, 0x94E044FF, 0x02BE01FF, 0x00D3DDFF, 0x0083C7FF, 0x0000EAFF, 0xCF6EE4FF, 0x820080FF];

// Mapping for each color button to its corresponding color
const divToColorMap = {
    'color-button-FFFFFF' : '#FFFFFF',
    'color-button-E4E4E4' : '#E4E4E4',
    'color-button-888888' : '#888888',
    'color-button-222222' : '#222222',
    'color-button-FFA7D1' : '#FFA7D1',
    'color-button-E50000' : '#E50000',
    'color-button-E59500' : '#E59500',
    'color-button-A06A42' : '#A06A42',
    'color-button-E5D900' : '#E5D900',
    'color-button-94E044' : '#94E044',
    'color-button-02BE01' : '#02BE01',
    'color-button-00D3DD' : '#00D3DD',
    'color-button-0083C7' : '#0083C7',
    'color-button-0000EA' : '#0000EA',
    'color-button-CF6EE4' : '#CF6EE4',
    'color-button-820080' : '#820080'
};

// Wait for DOM to finish loading
document.addEventListener('DOMContentLoaded', (event) => {
    // Set up canvas
    canvas = document.getElementById('canvas');
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    ctx = canvas.getContext('2d');

    // Initialize underlying canvas data array
    canvasData = new Uint8ClampedArray(canvasWidth * canvasHeight * 4);

    // Create the panzoom object which handles all zooming and panning
    panzoom = Panzoom(canvas, {
        animate: true,
        duration: 700,
        cursor: 'pointer',
        maxScale: maxScale,
        minScale: minScale,
        handleStartEvent: () => {},
        canvas: true
    });

    // Zoom to default scale, the middle option
    panzoom.zoom(scale);

    // Add mouse listeners
    canvas.addEventListener('mousedown', onMouseDown, false);
    canvas.addEventListener('mouseup', onMouseUp, false);
    canvas.addEventListener('mousemove', onMouseMove, false);
    document.getElementById("container").addEventListener('wheel', onWheelScroll);

    // Set up listeners for each of the color buttons
    var elements = document.getElementsByClassName('color-button');
    for (var i = 0; i < elements.length; i++) {
        elements[i].addEventListener('click', function (event) {
            // Hide the selected icon for the previous color and display it for the new color selected
            document.getElementById('selected-color-icon-' + selectedColor.substring(1)).style.visibility = 'hidden';
            selectedColor = divToColorMap[this.id];
            document.getElementById('selected-color-icon-' + selectedColor.substring(1)).style.visibility = 'visible';
        }, false);
    }

    // Initialize the loading overlay which is used while awaiting connections to the backend
    loadingOverlay = document.getElementById('loading-overlay');

    // Initialize information display divs
    networkStatusConnectedIcon = document.getElementById('network-status-connected-icon');
    networkStatusDisconnectedIcon = document.getElementById('network-status-disconnected-icon');
    cooldownDisplay = document.getElementById('cooldown-display');
    coordinates = document.getElementById('coordinates');
    
    // Initialize zoom in/zoom out/center buttons and their listeners
    zoomInButton = document.getElementsByClassName('zoom-in-button')[0];
    zoomOutButton = document.getElementsByClassName('zoom-out-button')[0];
    centerButton = document.getElementById('center-button');
    zoomInButton.addEventListener('click', function() { toggleZoom(true) });
    zoomOutButton.addEventListener('click', function() { toggleZoom(false) });
    centerButton.addEventListener('click', function() { panzoom.pan(0,0) });

    // Set default color icon to be visible
    document.getElementById('selected-color-icon-222222').style.visibility = 'visible';

    // Set status icon to show disconnected by default
    networkStatusDisconnectedIcon.style.visibility = 'visible';

    attemptConnection();
});

function attemptConnection() {
    // In case loading overlay is hidden, show it
    loadingOverlay.style.visibility = 'visible';

    // Create the websocket connection
    socket = io(`${host}`, {
        path: '/api/board-updates'
    });

    // In the case that waiting time has exceeded timeout
    socket._connectTimer = setTimeout(() => {
        handleDisconnect(failedToConnectError);
    }, connectionTimeout);

    // On connection to backend websocket
    socket.on('connect', async function() {
        try {
            // Make the initial GET request to get the board state
            let response = await fetch(`${host}/api/place/board`, {
                responseType: 'arraybuffer',
            });
            // Internal server error occurred
            if (response.status != 200) {
                handleDisconnect(internalServerError);
                return;
            }
            // Expected response, extract the response array buffer containing canvas data
            let arrayBuffer = await response.arrayBuffer();
            stopLoading();
            unpackRawData(arrayBuffer)
        } catch(err) {
            // Connection error
            console.error(err);
            handleDisconnect(failedToConnectError);
        }
    });

    // If websocket somehow disconnects
    socket.on('disconnect', () => {
        handleDisconnect(lostConnectionError);
    });

    // Backend is notifying frontend of board update
    socket.on('board-update', (message) => {
        if (!initialBoardReady) {
            // Initial board has not been loaded, can't write to the underlying canvas yet
            // Instead we push updates to an array which will be applied later, when the initial board has loaded
            batchedUpdates.push(message);
        } else {
            // Initial board has been loaded, apply changes to underlying canvas which will be drawn later
            splitUpdateMessage = message.split(",");
            x = parseInt(splitUpdateMessage[0]);
            y = parseInt(splitUpdateMessage[1]);
            color = parseInt(splitUpdateMessage[2]);
            
            updateCanvasDataArray(x, y, color);
        }
    });
}

function handleDisconnect(error) {
    initialBoardReady = false;

    // Show correct network status icon
    networkStatusConnectedIcon.style.visibility = 'hidden';
    networkStatusDisconnectedIcon.style.visibility = 'visible';

    // Close websocket
    socket.close();

    // Cancel draw call loop
    if (requestAnimationFrameID) cancelAnimationFrame(requestAnimationFrameID);
    
    // Stop cooldown timer if it is still running
    stopCooldownTimer();

    // Stop the loading screen from being shown
    stopLoading();
    
    // Display error message with option to reconnect
    showActionMessage(error, 'Retry Connection', (elem) => {
        // Dismiss snackbar
        elem.style.opacity = 0;
        elem.style.top = '-100px';
        elem.style.bottom = '-100px';
        // Re-attempt connection
        attemptConnection();
    });
}

function stopLoading() {
    // Cancel timeout countdown
    clearTimeout(socket._connectTimer);
    // Hide the loading overlay
    loadingOverlay.style.visibility = 'hidden';
}

function unpackRawData(arrayBuffer) {
    // Store 8 bit binary data into array we can manipulate
    var binary8BitArray = new Uint8Array(arrayBuffer);

    for (let i = 0; i < binary8BitArray.length; i++) {
        // Extract lower bits to get the color
        lower4Bits = binary8BitArray[i] >> 4;
        firstPixelColor = colors32Bit[lower4Bits];
        
        // Store RGBA values of first pixel in underlying canvas data array
        canvasData[i * 8] = (((1 << 8) - 1) & (firstPixelColor >> (25 - 1))) >>> 0;
        canvasData[(i * 8) + 1] = (((1 << 8) - 1) & (firstPixelColor >> (17 - 1))) >>> 0;
        canvasData[(i * 8) + 2] = (((1 << 8) - 1) & (firstPixelColor >> (9 - 1))) >>> 0; 
        canvasData[(i * 8) + 3] = (((1 << 8) - 1) & (firstPixelColor >> (1 - 1))) >>> 0; 

        // // Extract the upper bits to get the color
        upper4Bits = binary8BitArray[i] & 15;
        secondPixelColor = colors32Bit[upper4Bits];

        // Store RGBA values of second pixel in underlying canvas data array
        canvasData[(i * 8) + 4] = (((1 << 8) - 1) & (secondPixelColor >> (25 - 1))) >>> 0;
        canvasData[(i * 8) + 5] = (((1 << 8) - 1) & (secondPixelColor >> (17 - 1))) >>> 0;
        canvasData[(i * 8) + 6] = (((1 << 8) - 1) & (secondPixelColor >> (9 - 1))) >>> 0; 
        canvasData[(i * 8) + 7] = (((1 << 8) - 1) & (secondPixelColor >> (1 - 1))) >>> 0; 
    }

    // Begin canvas rendering loop
    requestAnimationFrameID = requestAnimationFrame(renderUpdatesToCanvas);

    // If websocket received any updates during the time we received and rendered the board, apply them
    while (batchedUpdates.length > 0) {
        splitUpdateMessage = batchedUpdates.shift().split(",");
        x = parseInt(splitUpdateMessage[0]);
        y = parseInt(splitUpdateMessage[1]);
        color = parseInt(splitUpdateMessage[2]);
        updateCanvasDataArray(x, y, color);
    }

    // Future web socket updates can now be drawn to underlying canvas directly
    initialBoardReady = true;
    networkStatusConnectedIcon.style.visibility = 'visible';
    networkStatusDisconnectedIcon.style.visibility = 'hidden';
}

function updateCanvasDataArray(x, y, color) {
    // Get mapped 32 bit color from 4 bit color value
    pixelColor = colors32Bit[color];
    offset = (x + (canvasWidth * y)) * 4;

    // Store RGBA values of new color in underlying canvas data array
    canvasData[offset + 0] = (((1 << 8) - 1) & (pixelColor >> (25 - 1))) >>> 0;
    canvasData[offset + 1] = (((1 << 8) - 1) & (pixelColor >> (17 - 1))) >>> 0;
    canvasData[offset + 2] = (((1 << 8) - 1) & (pixelColor >> (9 - 1))) >>> 0; 
    canvasData[offset + 3] = (((1 << 8) - 1) & (pixelColor >> (1 - 1))) >>> 0;  
}

function renderUpdatesToCanvas() {
    // Draw current state of canvas data which may have received updates since the last call to this function
    var newImageData = ctx.createImageData(canvasWidth, canvasHeight);
    newImageData.data.set(canvasData);
    ctx.putImageData(newImageData, 0, 0);
    requestAnimationFrameID = requestAnimationFrame(renderUpdatesToCanvas);
}

function requestUpdateBoard(x, y) {
    // Can't make updates if board hasn't loaded
    if (!initialBoardReady) {
        return;
    }
    // Can't make updates if cooldown is still in effect
    if (cooldownInEffect) {
        showMessage(cooldownError)
        return;
    }
    color4Bit = colors.indexOf(selectedColor);

    // Enter into cooldown period
    cooldownInEffect = true;

    fetch(`${host}/api/place/draw`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ x: x, y: y, color: color4Bit })
        }
    ).then(async (response) => {
        // Internal server error
        if (response.status == 500) {
            cooldownInEffect = false;
            showMessage(internalServerError);
            return;
        }
        // On 200 or 403, we get back the seconds left to wait, before the next update is allowed
        if (response.status == 200) {
            secondsLeft = await response.text();
            startCooldownTimer(parseInt(secondsLeft));
            return;
        } else if (response.status == 403) {
            secondsLeft = await response.text();
            showMessage(cooldownError);
            startCooldownTimer(parseInt(secondsLeft));
            return;
        } else {
            handleDisconnect(failedToConnectError);
        }
    }).catch((err) => {
        console.error(err);
        handleDisconnect(failedToConnectError);
    });
}

function startCooldownTimer(secondsLeft) {
    // Show cooldown display
    cooldownDisplay.style.visibility = 'visible';
    cooldownDisplay.innerHTML = `Cooldown time left: ${new Date(secondsLeft * 1000).toISOString().substr(15, 4)}`;
    
    // Calculate the finish time
    finishTimeSeconds = Math.ceil(Date.now() / 1000) + secondsLeft;
    
    // Create and start timer which ticks every second
    cooldownTimer = setInterval(function() {
        secondsLeft = finishTimeSeconds - Math.ceil(Date.now() / 1000);
        // If user has waited enough, stop the timer
        if (secondsLeft <= 0) {
            stopCooldownTimer(cooldownTimer);
            return;
        }
        // Still time left, update display to show new time left
        cooldownDisplay.innerHTML = `Cooldown time left: ${new Date(secondsLeft * 1000).toISOString().substr(15, 4)}`;
    }, 1000);
}

function stopCooldownTimer(timer) {
    // Cooldown is over or has been cancelled, hide cooldown display as well
    cooldownInEffect = false;
    cooldownDisplay.style.visibility = 'hidden';
    clearInterval(timer);
}

function onMouseDown(e) {
    mouseDown = true;
    // Calculate starting x and y which will be used later when dragging
    dragStart = {x: e.pageX, y: e.pageY};
}

function onMouseUp(e) {
    if (!dragging) {
        // If user wasn't dragging, that means they were attemping to draw a pixel
        requestUpdateBoard(e.offsetX, e.offsetY);
    } else {
        canvas.style.cursor = 'pointer';
        dragging = false;
    }
    mouseDown = false;
}

function onMouseMove(e) {
    // Update coordinates to display new x and y of mouse
    coordinates.innerHTML = `${e.offsetX}, ${e.offsetY}`;
    if (mouseDown) {
        if (!dragging) {
            // If user has moved mouse more than 1 pixel from their starting mouse down position, they are dragging the canvas
            if(Math.abs(dragStart.x - e.pageX) > 0 || Math.abs(dragStart.y - e.pageY) > 0) {
                canvas.style.cursor = 'move';
                dragging = true;
            }
        }
    }
}

function onWheelScroll(e) {
    // Figure out if user was scrolling up/down and toggle zoom appropriately
    isZoomingIn = e.deltaY < 0 ? true : false;
    toggleZoom(isZoomingIn);
}

function toggleZoom(isZoomingIn) {
    if (isZoomingIn && scale < maxScale) {
        scale += 4;
    }
    if (!isZoomingIn && scale > minScale) {
        scale -= 4;
    }

    // Apply new level of zoom
    panzoom.zoom(scale);
}

function showMessage(message) {
    // Display a standard message that dismisses itself
    Snackbar.show({
        text: message,
        pos: 'bottom-center',
        showAction: false,
        textColor: '#FFFFFF',
        backgroundColor: '#333333',
        customClass: 'snackbar',
        duration: 3000
    });
}

function showActionMessage(message, actionText, callback) {
    // Display an action message that does not dismiss by itself
    Snackbar.show({
        text: message,
        pos: 'bottom-center',
        showAction: true,
        actionText: actionText,
        textColor: '#FFFFFF',
        actionTextColor: '#FE4080',
        backgroundColor: '#333333',
        customClass: 'snackbar',
        duration: -1,
        onActionClick: callback
    });
}