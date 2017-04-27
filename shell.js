var childProcess = require ("child_process")
,   utils = require ("./utils.js");

// Attempts a connection against the host using the SSH key. If any error occurs, an error message will be passed
// to the callback function.
exports.validateSSHKey = function (sshKey, hostName, userName, callback) {

    sshKey = utils.normalizePath (sshKey);

    // check that the key file exists
    childProcess.exec (
        "ls " + utils.escapeShellParameterValue (sshKey),
        function (error, stdout, stderr) {

            if (! utils.valueIsEmpty (error))
                return callback ("SSH Key file not found");

            // run a sample connection against the host - this will give opportunity to add to known_hosts
            childProcess.exec (
                GetSSHCommand (sshKey, hostName, userName) + " \"pwd\"",
                function (error, stdout, stderr) {
                    if (! utils.valueIsEmpty (error))
                        return callback ("Error connecting to host: " + stderr);

                    // return success
                    callback ();

                }
            );

        }
    );

};

// Logs into the remote server and checks if the file/directory exists at the remote path. If successful, the message
// sent back on the callback will state the file type.
exports.validateRemotePath = function (sshKey, hostName, userName, remotePath, callback) {

    sshKey = utils.normalizePath (sshKey);
    remotePath = utils.normalizePath (remotePath);

    childProcess.exec (
        GetSSHCommand (sshKey, hostName, userName) + " file " + utils.escapeShellParameterValue (remotePath),
        function (error, stdout, stderr) {
            if (! utils.valueIsEmpty(error)) return callback (error, true);
            if (stdout.indexOf ("cannot open") >= 0) return callback (stdout, true); // treat cannot open response as an error

            // check for file type in response
            var responseParts = stdout.trim ().split (": ");
            if (responseParts.length >= 2)
                callback (responseParts.pop ());

            // if not expected format, send full stdout back for messaging
            else callback (stdout);

        }
    );

};

// Validates that the local path exists and is writeable.
exports.validateLocalPath = function (localPath, callback) {

    localPath = utils.normalizePath (localPath);

    // validate location exists
    childProcess.exec (
        "file " + localPath,
        function (error, stdout, stderr) {
            if (stdout.indexOf ("cannot open") >= 0) return callback (stdout, true); // treat cannot open response as an error
            if (! utils.valueIsEmpty (error)) return callback (error, true);
            if (stdout.indexOf ("directory") < 0) return callback ("Local path is not a directory.", true);

            // TODO: Validate directory is writeable

            // return success
            callback (stdout);

        }
    );

};

// Formats SSH command.
function GetSSHCommand (sshKey, hostName, userName) {

    return "ssh -i " + utils.escapeShellParameterValue (sshKey) + " " + userName + "@" + hostName;

}