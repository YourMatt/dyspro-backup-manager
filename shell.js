var childProcess = require ("child_process")
,   utils = require ("./utils.js")
,   sprintf = require ("util").format;

// Appends to local file.
exports.writeLog = function (message) {

    childProcess.exec (
        "echo $(date '+%Y-%m-%d %H:%M:%S')' " + message + "' >> " + process.env.LOG_FILE,
        function (error, stdout, stderr) {
            if (! utils.valueIsEmpty (error)) utils.outputError (error.toString());
        }
    )

};

// Finds list of all files that will be copied.
// callback (string: file type [file, directory, unknown], array: [{size, name}], string: error message)
exports.getCopyFileList = function (sshKey, hostName, userName, remotePath, callback) {

    exports.getRemoteFileType (sshKey, hostName, userName, remotePath, function (fileType, error) {
        if (!utils.valueIsEmpty(error)) return callback ("unknown", [], error);
        if (fileType === "unknown") return callback ("unknown", [], sprintf ("File at %s %s is an unknown type.", hostName, remotePath));

        // find list of files in the directory
        childProcess.exec (
            sprintf (
                "%s \"find %s -maxdepth 1 -type f -exec wc -c {} \\;\"",
                GetSSHCommand (sshKey, hostName, userName),
                utils.escapeShellParameterValue (remotePath)
            ),
            {
                maxBuffer: 1024 * 1000
            },
            function (error, stdout, stderr) {
                if (error) return callback (fileType, [], error.toString());

                var fileList = [];
                var rawFiles = stdout.split ("\n");
                for (var i = 0; i < rawFiles.length; i++) {
                    if (!rawFiles[i]) continue;

                    var fileParts = rawFiles[i].split (" ");
                    if (fileParts.length < 2) continue;

                    // add the file to the file list
                    fileList.push ({
                        size: parseInt (fileParts.shift ()), // remove the file size
                        name: fileParts.join (" ") // add any spaces back in for the file name
                    });

                }

                callback (fileType, fileList);

             }
        );

    });

};

// Finds the remote file type.
// callback (string: file type [file, directory, unknown], string: error message)
exports.getRemoteFileType = function (sshKey, hostName, userName, remotePath, callback) {

    // run the file command to check the mime type
    childProcess.exec (
        sprintf (
            "%s \"file -bi %s\"",
            GetSSHCommand (sshKey, hostName, userName),
            utils.escapeShellParameterValue (remotePath)
        ),
        function (error, stdout, stderr) {
            if (error) return callback ("unknown", error.toString());
            if (utils.valueIsEmpty(stdout)) return callback ("unknown", sprintf ("Unknown error while checking the remote file type at %s %s.", hostName, remotePath));

            // check mime type from format of: general/specific; charset
            var mimeType = stdout.split ("; ");
            var mimeParts = mimeType[0].split ("/");

            // exit if not in expected format
            if (mimeParts.length != 2) {
                if (mimeParts[0].indexOf ("No such file") >= 0) return callback ("unknown", sprintf ("File does not exist at %s %s.", hostName, remotePath));
                else return callback ("unknown", sprintf ("Unexpected MIME type of \"%s\" at %s %s. Could not evaluate file type.", mimeType[0].trim(), hostName, remotePath));
            }

            // evaluate general type for directory (including symlinks) or file
            if (mimeParts[0] == "inode") callback ("directory");
            else callback ("file");

        }
    )

};

// Copy a file from a remote server, placing into the local path directory.
// callback (string: error message)
exports.copyFile = function (sshKey, hostName, userName, remotePath, localPath, callback) {

    childProcess.exec (
        sprintf (
            "scp -p -i %s %s@%s:%s %s",
            utils.escapeShellParameterValue (utils.normalizePath (sshKey)),
            userName,
            hostName,
            utils.escapeSCPRemotePath (remotePath),
            utils.escapeShellParameterValue (localPath)
        ),
        function (error, stdout, stderr) {
            if (! utils.valueIsEmpty (error)) return callback (error.toString());

            callback ();

        }
    );

};

// Deletes a file from a remote server.
// callback (string: error message)
exports.deleteRemoteFile = function (sshKey, hostName, userName, remotePath, callback) {

    childProcess.exec (
        sprintf (
            "%s \"rm -f %s\"",
            GetSSHCommand (sshKey, hostName, userName),
            utils.escapeShellParameterValue (remotePath)
        ),
        function (error, stdout, stderr) {
            if (! utils.valueIsEmpty (error)) return callback (error.toString());

            callback ();

        }
    );

};

// Attempts a connection against the host using the SSH key. If any error occurs, an error message will be passed
// to the callback function.
// callback (string: error message)
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
                    if (! utils.valueIsEmpty (error)) return callback ("Error connecting to host: " + stderr);

                    // return success
                    callback ();

                }
            );

        }
    );

};

// Logs into the remote server and checks if the file/directory exists at the remote path. If successful, the message
// sent back on the callback will state the file type.
// callback (string: message, bool: true if error)
exports.validateRemotePath = function (sshKey, hostName, userName, remotePath, callback) {

    sshKey = utils.normalizePath (sshKey);
    remotePath = utils.normalizePath (remotePath);

    childProcess.exec (
        sprintf (
            "%s \"file %s\"",
            GetSSHCommand (sshKey, hostName, userName),
            utils.escapeShellParameterValue (remotePath)
        ),
        function (error, stdout, stderr) {
            if (! utils.valueIsEmpty(error)) return callback (error.toString(), true);
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
// callback (string: message, bool: true if error)
exports.validateLocalPath = function (localPath, callback) {

    localPath = utils.normalizePath (localPath);

    // validate location exists
    childProcess.exec (
        "file " + localPath,
        function (error, stdout, stderr) {
            if (stdout.indexOf ("cannot open") >= 0) return callback (stdout, true); // treat cannot open response as an error
            if (! utils.valueIsEmpty (error)) return callback (error.toString(), true);
            if (stdout.indexOf ("directory") < 0) return callback ("Local path is not a directory.", true);

            // TODO: Validate directory is writeable

            // return success
            callback (stdout);

        }
    );

};

// Formats SSH command.
function GetSSHCommand (sshKey, hostName, userName) {

    return sprintf ("ssh -i %s %s@%s",
        utils.escapeShellParameterValue (sshKey),
        userName,
        hostName
    );

}