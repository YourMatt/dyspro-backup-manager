#!/usr/bin/env nodejs

// load configuration values
require ("dotenv").config();

// include libraries
var program = require ("commander")
,   prompt = require ("prompt")
,   async = require ("async")
,   sprintf = require ("util").format
,   colors = require ("colors")
,   table = require ("cli-table")
,   database = require ("./database.js")
,   shell = require ("./shell.js")
,   utils = require ("./utils.js");


// handle server management requests
program
.command ("servers [action]")
.description ("manage server connections where [action] is one of: list, test, add, update, delete")
.option ("-n, --hostname <hostname>", "server http host name - required for: add, update, delete - optional for: test")
.option ("-u, --username <username>", "server ssh login user name - required for: add, update")
.option ("-k, --sshkey <sshkey>", "path to ssh private key file - required for: add, update")
.action (function (action, options) {
    if (utils.valueIsEmpty (action)) action = "list"; // set default when no action provided

    switch (action) {

        // display all available server connections
        case "list":

            // retrieve all servers from the database
            database.query.servers.get (function (data) {
                if (data.error) return utils.outputError (data);
                if (!data.numResults) return utils.output ("No servers are currently registered.");

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
                for (var i = 0; i < data.results.length; i++) {
                    resultsTable.push ([
                        data.results[i].ServerId,
                        data.results[i].HostName,
                        data.results[i].UserName,
                        data.results[i].PathSSHKeyFile
                    ]);
                }
                utils.output (resultsTable.toString());

            });

            break;

        // test existing server connections
        case "test":

            // test all servers if no hostname set
            if (utils.valueIsEmpty(options.hostname)) {

                utils.output ("Testing all registered servers...");

                database.query.servers.get (function (data) {
                    if (data.error) return utils.outputError (data.error);
                    if (!data.numResults) return utils.output ("No servers are currently registered.");

                    testServerConnection (data.results);

                });

            }

            // test single server if hostname provided
            else {

                database.query.servers.getByHostName (options.hostname, function (data) {
                    if (data.error) return utils.outputError (data.error);
                    if (!data.numResults) return utils.outputError (sprintf ("Host %s is not registered.", options.hostname));

                    testServerConnection ([data.results]);

                });

            }

            break;

        // create new server connection
        case "add":

            // check for required fields
            if (utils.valueIsEmpty (options.hostname) ||
                utils.valueIsEmpty (options.username) ||
                utils.valueIsEmpty (options.sshkey))
                return utils.outputError ("Missing required options: --hostname, --username, or --sshkey");

            // validate that the host name is not already in use
            database.query.servers.getByHostName (options.hostname, function (data) {
                if (data.error) return utils.outputError (data.error);
                if (data.numResults) return utils.outputError ("Host name is already registered.");

                // validate the SSH key
                shell.validateSSHKey (
                    options.sshkey,
                    options.hostname,
                    options.username,
                    function (error) {
                        if (!utils.valueIsEmpty (error)) return utils.outputError (error);

                        // run database insert
                        database.query.servers.insert (
                            options.hostname,
                            options.username,
                            options.sshkey,
                            function (data) {
                                if (data.error) return utils.outputError (data.error);

                                // respond with success message
                                return utils.outputSuccess (sprintf ("Added %s to the server list.", options.hostname.underline));

                            }
                        );
                    }
                );
            });

            break;

        // update an existing server connection
        case "update":

            // check for required fields
            if (utils.valueIsEmpty (options.hostname) ||
            utils.valueIsEmpty (options.username) ||
            utils.valueIsEmpty (options.sshkey))
                return utils.outputError ("Missing required options: --hostname, --username, or --sshkey");

            // validate that the host name already exists
            database.query.servers.getByHostName (options.hostname, function (data) {
                if (data.error) return utils.outputError (data.error);
                if (! data.numResults) return utils.outputError ("Host name not found.");

                // validate the SSH key
                shell.validateSSHKey (
                    options.sshkey,
                    options.hostname,
                    options.username,
                    function (error) {
                        if (!utils.valueIsEmpty (error)) return utils.outputError (error);

                        // run database update
                        database.query.servers.update (
                            data.results.ServerId,
                            options.hostname,
                            options.username,
                            options.sshkey,
                            function (data) {
                                if (data.error) return utils.outputError (data.error);

                                // respond with success message
                                return utils.outputSuccess (sprintf ("Updated %s in the server list.", options.hostname.underline));

                            }
                        );

                    }
                );
            });

            break;

        // delete a server connection
        case "delete":

            // check for required fields
            if (utils.valueIsEmpty (options.hostname))
                return utils.outputError ("Missing required options: --hostname");

            // find the server by host name
            database.query.servers.getByHostName (options.hostname, function (data) {
                if (data.error) return utils.outputError (data.error);
                if (!data.numResults) return utils.outputError ("Host name not found.");

                var serverId = data.results.ServerId;

                // check the number of schedules affected
                database.query.schedules.getByServerId (serverId, function (data) {
                    if (data.error) return utils.outputError (data.error);

                    // TODO: provide confirmation prompt if schedules will be deleted

                    var deletedSchedules = data.numResults;

                    // delete the schedule
                    database.query.servers.delete (serverId, function (data) {
                        if (data.error) return utils.outputError (data.error);
                        if (!data.numDeleted) return utils.outputError (sprintf ("Server record not found during delete. Expected at ServerId: %s.", serverId));

                        // respond with success message
                        utils.outputSuccess (sprintf (
                            "Deleted %s with %s associated schedule%s from server list.",
                            options.hostname.underline,
                            deletedSchedules,
                            (deletedSchedules == 1) ? "" : "s"
                        ));

                    });

                });
            });

            break;

        // notify invalid usage
        default:

            utils.outputError (sprintf ("Invalid option. Check %s for correct usage.", "servers --help".underline));

    }
});


// handle schedule management requests
program
.command ("schedules [action]")
.description ("manage backup schedules where [action] is on of: list, test, add, update, delete")
.option ("-n, --hostname <hostname>", "registered server http host name - required for: add, update - optional for list, test")
.option ("-r, --remotepath <remotepath>", "directory where to pick up files from the server - required for: add, update")
.option ("-l, --localpath <localpath>", "directory where to drop off files on the local system - required for: add, update")
.option ("-d, --deleteremote", "set option to delete server files after downloading - optional for: add, update")
.option ("-m, --managelocal", "set option to automatically remove outdated local backups - optional for: add, update")
.option ("-i, --id <scheduleid>", "existing schedule id - required for: update, delete - optional for test")
.action (function (action, options) {
    if (utils.valueIsEmpty (action)) action = "list"; // set default when no action provided

    scheduling.options = options;
    switch (action) {

        // display all available schedules
        case "list":
            async.series ([
                scheduling.loadSchedules,
                scheduling.list
            ]);
            break;

        // test existing schedules
        case "test":
            async.series ([
                scheduling.loadSchedules,
                scheduling.test
            ]);
            break;

        // create new schedule
        case "add":
            async.series ([
                scheduling.validateInputForAdd,
                scheduling.checkScheduleConfirmDeleteRemote,
                scheduling.checkScheduleConfirmManageLocal
            ]);
            break;

        // update an existing schedule
        case "update":


            break;

        // delete an existing schedule
        case "delete":


            break;

        // notify invalid usage
        default:

            utils.outputError (sprintf ("Invalid option. Check %s for correct usage.", "schedules --help".underline));

    }

});

// Test connection to all servers provided in array.
function testServerConnection (allServerData) {

    var currentServer = allServerData.pop ();
    if (! utils.valueIsEmpty (currentServer)) {

        utils.output (sprintf ("Testing %s...", currentServer.HostName.underline));

        shell.validateSSHKey (
            currentServer.SSHKeyFileLocation,
            currentServer.HostName,
            currentServer.UserName,
            function (error) {
                if (error) utils.outputError (error);
                else utils.outputSuccess ("SUCCESS");

                testServerConnection (allServerData);

            }
        );
    }
    else return;

}



// Performs all actions related to schedule management
var scheduling = {

    options: {}, // command input options
    schedules: [], // list of schedules to perform an operation against

    // Loads schedules related to a given option.
    loadSchedules: function (callback)
    {

        // test a single schedule if provided
        if (!utils.valueIsEmpty (scheduling.options.id)) {
            database.query.schedules.getByScheduleId (scheduling.options.id, function (data) {
                if (data.error) return utils.outputError (data.error);
                if (!data.numResults) return utils.outputError (sprintf ("Schedule %s does not exist.", scheduling.options.id));

                scheduling.schedules = [data.results];
                callback ();

            });
        }

        // test every schedule associated to a host if provided
        else if (!utils.valueIsEmpty (scheduling.options.hostname)) {
            database.query.schedules.getByServerHostName (scheduling.options.hostname, function (data) {
                if (data.error) return utils.outputError (data.error);
                if (!data.numResults) return utils.outputError (sprintf ("No schedules exist for %s.", scheduling.options.hostname.underline));

                scheduling.schedules = data.results;
                callback ();

            });
        }

        // if no options set, test all schedules
        else {
            database.query.schedules.get (function (data) {
                if (data.error) return utils.outputError (data.error);
                if (!data.numResults) return utils.outputError ("No schedules exist.");

                scheduling.schedules = data.results;
                callback ();

            });
        }

    },

    // Displays all loaded schedules as a table.
    list: function () {

        // build the results table
        var resultsTable = new table ({
            head: ["ID", "Host Name", "Remote Path", "Local Path", "Delete Remote", "Manage Local"],
            colAligns: ["right"],
            style: {
                head: [process.env.COLOR_TABLE_HEADING],
                border: [process.env.COLOR_TABLE_BORDER],
                compact: true
            }
        });
        for (var i = 0; i < scheduling.schedules.length; i++) {
            resultsTable.push ([
                scheduling.schedules[i].ScheduleId,
                scheduling.schedules[i].HostName,
                utils.normalizePath (scheduling.schedules[i].PathServerPickup),
                utils.normalizePath (scheduling.schedules[i].PathLocalDropoff),
                (scheduling.schedules[i].DeleteServerPickups) ? "YES" : "NO",
                (scheduling.schedules[i].ManageLocalBackups) ? "YES" : "NO"
            ]);
        }

        // display the table
        utils.output (resultsTable.toString());

    },

    validateInputForAdd: function (callback)
    {

        // check for required fields
        if (utils.valueIsEmpty (scheduling.options.hostname) ||
            utils.valueIsEmpty (scheduling.options.remotepath) ||
            utils.valueIsEmpty (scheduling.options.localpath))
            return utils.outputError ("Missing required options: --hostname, --remotepath, or --localpath");

        callback ();

    },

    checkScheduleConfirmDeleteRemote: function (callback)
    {

        prompt.start ();
        prompt.message = "";
        prompt.delimiter = "";
        prompt.colors = false;

        if (scheduling.options.deleteremote) {
            prompt.get ({
                properties: {
                    confirm: {
                        pattern: /^(yes|no|y|n)$/gi,
                        description: "You have opted to delete remote files as they are downloaded. If the remote " +
                        "path is to a file, it will be deleted after every backup. If the remote path is a " +
                        "directory, all contents will be deleted. Are you sure?",
                        message: 'Type yes/no',
                        required: true,
                        default: 'no'
                    }
                }

            }, function (error, result) {
                result = result.confirm.toLowerCase ();
                if (result != "y" && result != "yes") {
                    return utils.outputError ("Aborted add schedule option. Run again without the --deleteremote option.");
                }

                // continue
                callback ();

            });
        }

    },

    checkScheduleConfirmManageLocal: function (callback) {

        prompt.start ();
        prompt.message = "";
        prompt.delimiter = "";
        prompt.colors = false;

        if (scheduling.options.managelocal) {
            prompt.get ({
                properties: {
                    confirm: {
                        pattern: /^(yes|no|y|n)$/gi,
                        description: "You have opted to manage local files. Any backup files stored locally are subject " +
                        "to deletion over time in accordance to your retention schedule defined in the .env file. Are " +
                        "you sure?",
                        message: 'Type yes/no',
                        required: true,
                        default: 'no'
                    }
                }

            }, function (error, result) {
                result = result.confirm.toLowerCase ();
                if (result != "y" && result != "yes") {
                    return utils.outputError ("Aborted add schedule option. Run again without the --managelocal option.");
                }

                // continue
                callback ();

            });
        }

    },

    // Test operations required of server schedule.
    test: function () {

        var currentSchedule = scheduling.schedules.pop ();
        if (! utils.valueIsEmpty (currentSchedule)) {

            utils.output (sprintf (
                "Testing schedule %s against %s...",
                currentSchedule.ScheduleId.toString().underline,
                currentSchedule.HostName.underline
            ));

            // test the local path
            utils.output (sprintf (
                "Testing local path of %s...",
                currentSchedule.PathLocalDropoff.underline
            ));

            shell.validateLocalPath (
                currentSchedule.PathLocalDropoff,
                function (response, isError) {
                    if (isError) utils.outputError (response);
                    else utils.outputSuccess ("SUCCESS");

                    // test the remote path
                    utils.output (sprintf (
                        "Testing remote path of %s...",
                        currentSchedule.PathServerPickup.underline
                    ));

                    shell.validateRemotePath (
                        currentSchedule.PathSSHKeyFile,
                        currentSchedule.HostName,
                        currentSchedule.UserName,
                        currentSchedule.PathServerPickup,
                        function (response, isError) {
                            if (isError) utils.outputError (response);
                            else utils.outputSuccess (sprintf ("SUCCESS - Type is %s", response));

                            // test the next schedule
                            scheduling.test ();

                        }
                    );

                }
            );

        }

    }

};

// process arguments
program.parse(process.argv);
