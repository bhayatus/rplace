const config = require('../config');
var validate = require("validate.js");

// Validation rules
const constraints = {
    x: {
        presence: true,
        numericality: {
            onlyInteger: true,
            greaterThanOrEqualTo: 0,
            lessThanOrEqualTo: config.canvasWidth
        }
    },
    y: {
        presence: true,
        numericality: {
            onlyInteger: true,
            greaterThanOrEqualTo: 0,
            lessThanOrEqualTo: config.canvasHeight
        }
    },
    color: {
        presence: true,
        numericality: {
            onlyInteger: true,
            greaterThanOrEqualTo: 0,
            lessThanOrEqualTo: 15
        }
    },
    userIP: {
        presence: true,
        type: "string"
    }
}

function validateUpdateBoardRequestParams(x, y, color, userIP) {
    // Returns undefined if there are no validation issues, otherwise an error
    return validate({x: x, y: y, color: color, userIP: userIP}, constraints);
}

module.exports = { validateUpdateBoardRequestParams };