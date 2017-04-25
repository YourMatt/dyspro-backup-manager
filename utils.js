
// Checks if a variable value should be resolved as empty.
exports.valueIsEmpty = function (value) {

    return (value === undefined || value == "" || value === null);

};

// Prepares a value to be set in a shell command.
exports.escapeShellParameterValue = function (source) {

    return source.replace (/ /g, "\\ ");

};