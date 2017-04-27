var colors = require ("colors/safe");

// set color themes
colors.setTheme ({
    error: process.env.COLOR_ERROR,
    success: process.env.COLOR_SUCCESS
});

// Checks if a variable value should be resolved as empty.
exports.valueIsEmpty = function (value) {

    return (value === undefined || value == "" || value === null);

};

// Prepares a value to be set in a shell command.
exports.escapeShellParameterValue = function (source) {

    return source.replace (/ /g, "\\ ");

};

// Ensures file paths are in expected format.
exports.normalizePath = function (path) {

    // trim and remove any trailing slash
    return path.trim().replace(/\/$/, "");

};

// Writes output to console
exports.output = function (message) {

    if (typeof message == "string") message = message.trim ();
    console.log (message);

};
exports.outputSuccess = function (message) {

    exports.output (colors.success (message.toString().trim ()));

};
exports.outputError = function (message) {

    exports.output (colors.error (message.toString().trim ()));

};