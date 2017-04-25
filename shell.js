var childprocess = require ("child_process")
,   utils = require ("./utils.js");

// Attempts a connection against the host using the SSH key. If any error occurs, an error message will be passed
// to the callback function.
exports.validateSSHKey = function (sshKey, hostName, userName, callback) {

    // check that the key file exists
    childprocess.exec (
        "ls " + utils.escapeShellParameterValue (sshKey),
        function (error, stdout, stderr) {

            if (! utils.valueIsEmpty (error))
                return callback ("SSH Key file not found");

            // run a sample connection against the host - this will give opportunity to add to known_hosts
            childprocess.exec (
                "ssh -i " + utils.escapeShellParameterValue (sshKey) + " " + userName + "@" + hostName + " \"pwd\"",
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

