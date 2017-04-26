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

// Writes output to console
exports.output = function (message) {

    console.log (message.trim ());

};
exports.outputSuccess = function (message) {

    exports.output (colors.success (message.trim ()));

};
exports.outputError = function (message) {

    exports.output (colors.error (message.trim ()));

};