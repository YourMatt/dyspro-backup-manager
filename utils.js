var colors = require ("colors/safe")
,   fs = require ("fs");

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

// prepares a file name to be set in an SCP command
exports.escapeSCPRemotePath = function (source) {

    return source.replace (/ /g, "\\\\\\ ");

};

// Ensures file paths are in expected format.
exports.normalizePath = function (path) {

    // trim and remove any trailing slash
    return path.trim().replace(/\/$/, "");

};

// Deletes a folder and all contents.
exports.deleteDirectoryRecursive = function (path) {

    // disallow removal of root
    if (! path || path === "/") return;

    // perform delete if directory exists
    if (fs.existsSync (path)) {

        // find all files within the directory
        fs.readdirSync (path).forEach (function (file, index) {
            var curPath = path + "/" + file;

            // remove subdirectories
            if (fs.lstatSync(curPath).isDirectory ()) {
                exports.deleteDirectoryRecursive (curPath);
            }

            // remove file
            else {
                fs.unlinkSync (curPath);
            }

        });

        // remove directory
        fs.rmdirSync (path);

    }

};

// Writes output to console.
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
