// include libraries
var prompt = require ("prompt")
,   sprintf = require ("util").format
,   colors = require ("colors")
,   table = require ("cli-table")
,   database = require ("./database.js")
,   shell = require ("./shell.js")
,   utils = require ("./utils.js");

// Performs all actions related to server management
var base = {

    options: {}, // command input options
    servers: [], // list of servers to perform an operation against

    // Loads all registered servers.
    loadServers: function (callback)
    {

        // load a single server if provided
        if (!utils.valueIsEmpty (base.options.hostname)) {
            database.query.servers.getByHostName (base.options.hostname, function (data) {
                if (data.error) return utils.outputError (data);
                if (!data.numResults) return utils.outputError (sprintf ("Host %s is not registered.", base.options.hostname));

                base.servers = [data.results];
                callback ();
            });
        }

        // if no options set, load all servers
        else {
            database.query.servers.get (function (data) {
                if (data.error) return utils.outputError (data);
                if (!data.numResults) return utils.outputError ("No servers are currently registered.");

                base.servers = data.results;
                callback ();
            });
        }

    },

    // Displays all loaded servers as a table.
    list: function () {

        // build the results table
        var resultsTable = new table ({
            head: ["ID", "Host Name", "User", "SSH Key Path"],
            colAligns: ["right"],
            style: {
                head: [process.env.COLOR_TABLE_HEADING],
                border: [process.env.COLOR_TABLE_BORDER],
                compact: true
            }
        });
        for (var i = 0; i < base.servers.length; i++) {
            resultsTable.push ([
                base.servers[i].ServerId,
                base.servers[i].HostName,
                base.servers[i].UserName,
                base.servers[i].PathSSHKeyFile
            ]);
        }

        // display the table
        utils.output (resultsTable.toString());

    },

    // Validates that required parameters for add operations exist.
    validateInputForAdd: function (callback)
    {

        // check for required fields
        if (utils.valueIsEmpty (base.options.hostname) ||
            utils.valueIsEmpty (base.options.username) ||
            utils.valueIsEmpty (base.options.sshkey))
            return utils.outputError ("Missing required options: --hostname, --username, or --sshkey");

        // validate that the host name is not already in use
        database.query.servers.getByHostName (base.options.hostname, function (data) {
            if (data.error) return utils.outputError (data.error);
            if (data.numResults) return utils.outputError ("Host name is already registered.");

            callback ();

        });

    },

    // Validates that required parameters for update operations exist.
    validateInputForUpdate: function (callback)
    {

        // check for required fields
        if (utils.valueIsEmpty (base.options.hostname) ||
            utils.valueIsEmpty (base.options.username) ||
            utils.valueIsEmpty (base.options.sshkey))
            return utils.outputError ("Missing required options: --hostname, --username, or --sshkey");

        callback ();

    },

    // Validates that required parameters for delete operations exist.
    validateInputForDelete: function (callback) {

        if (utils.valueIsEmpty (base.options.hostname))
            return utils.outputError ("Missing required options: --hostname");

        callback ();

    },

    // Validates that the input connection credentials are valid.
    validateCredentials: function (callback) {

        // validate the SSH key
        shell.validateSSHKey (
            base.options.sshkey,
            base.options.hostname,
            base.options.username,
            function (error) {
                if (!utils.valueIsEmpty (error)) return utils.outputError (error);

                callback ();

            }
        );

    },

    // Registers a new server.
    add: function (callback) {

        database.query.servers.insert (
            base.options.hostname,
            base.options.username,
            base.options.sshkey,
            function (data) {
                if (data.error) return utils.outputError (data.error);

                // respond with success message
                utils.outputSuccess (sprintf ("Added %s to the server list.", base.options.hostname.underline));
                callback ();

            }
        );

    },

    // Updates an existing server.
    update: function (callback) {

        // validate the currently loaded server
        if (utils.valueIsEmpty (base.servers) || base.servers.length != 1) return utils.outputError ("Unexpected value for delete operation list.");
        var serverId = base.servers[0].ServerId;

        database.query.servers.update (
            serverId,
            base.options.hostname,
            base.options.username,
            base.options.sshkey,
            function (data) {
                if (data.error) return utils.outputError (data.error);

                // respond with success message
                utils.outputSuccess (sprintf ("Updated %s in the server list.", base.options.hostname.underline));
                callback ();

            }
        );

    },

    // Deletes the currently loaded server.
    delete: function (callback) {

        // validate the currently loaded server
        if (utils.valueIsEmpty (base.servers) || base.servers.length != 1) return utils.outputError ("Unexpected value for delete operation list.");
        var serverId = base.servers[0].ServerId;

        // check the number of schedules affected
        database.query.schedules.getByServerId (serverId, function (data) {
            if (data.error) return utils.outputError (data.error);
            var deletedSchedules = data.numResults;

            // if schedules will be delete, prompt for confirmation
            if (deletedSchedules) {

                prompt.start ();
                prompt.message = "";
                prompt.delimiter = "";
                prompt.colors = false;

                prompt.get ({
                    properties: {
                        confirm: {
                            pattern: /^(yes|no|y|n)$/gi,
                            description: sprintf (
                                "This server is used by %s schedule%s, which will each be deleted as well. Are you sure you want to continue?",
                                deletedSchedules,
                                (deletedSchedules == 1) ? "" : "s"
                            ),
                            message: "Type yes/no",
                            required: true,
                            default: "no"
                        }
                    }

                }, function (error, result) {
                    result = result.confirm.toLowerCase ();
                    if (result != "y" && result != "yes") return;

                    // delete the schedule
                    database.query.servers.delete (serverId, function (data) {
                        if (data.error) return utils.outputError (data.error);
                        if (!data.numDeleted) return utils.outputError (sprintf ("Server record not found during delete. Expected at ServerId: %s.", serverId));

                        // respond with success message
                        utils.outputSuccess (sprintf (
                            "Deleted %s with %s associated schedule%s from server list.",
                            base.options.hostname.underline,
                            deletedSchedules,
                            (deletedSchedules == 1) ? "" : "s"
                        ));

                    });
                    callback ();

                });

            }

            // delete without confirmation if no associated schedules
            else {

                database.query.servers.delete (serverId, function (data) {
                    if (data.error) return utils.outputError (data.error);
                    if (!data.numDeleted) return utils.outputError (sprintf ("Server record not found during delete. Expected at ServerId: %s.", serverId));

                    // respond with success message
                    utils.outputSuccess (sprintf (
                        "Deleted %s from server list.",
                        base.options.hostname.underline
                    ));
                    callback ();

                });

            }

        });

    },

    // Tests servers to validate connections.
    test: function () {

        var currentServer = base.servers.pop ();
        if (! utils.valueIsEmpty (currentServer)) {

            utils.output (sprintf ("Testing %s...", currentServer.HostName.underline));

            shell.validateSSHKey (
                currentServer.PathSSHKeyFile,
                currentServer.HostName,
                currentServer.UserName,
                function (error) {
                    if (error) utils.outputError (error);
                    else utils.outputSuccess ("SUCCESS");

                    // test the next server
                    base.test ();

                }
            );
        }

    }

};

module.exports = base;