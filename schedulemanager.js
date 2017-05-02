// include libraries
var prompt = require ("prompt")
,   sprintf = require ("util").format
,   colors = require ("colors")
,   table = require ("cli-table")
,   database = require ("./database.js")
,   shell = require ("./shell.js")
,   utils = require ("./utils.js");

// Performs all actions related to schedule management
var base = {

    options: {}, // command input options
    schedules: [], // list of schedules to perform an operation against

    // Loads schedules related to a given option.
    loadSchedules: function (callback)
    {

        // load a single schedule if provided
        if (!utils.valueIsEmpty (base.options.id)) {
            database.query.schedules.getByScheduleId (base.options.id, function (data) {
                if (data.error) return utils.outputError (data.error);
                if (!data.numResults) return utils.outputError (sprintf ("Schedule %s does not exist.", base.options.id));

                base.schedules = [data.results];
                callback ();

            });
        }

        // load every schedule associated to a host if provided
        else if (!utils.valueIsEmpty (base.options.hostname)) {
            database.query.schedules.getByServerHostName (base.options.hostname, function (data) {
                if (data.error) return utils.outputError (data.error);
                if (!data.numResults) return utils.outputError (sprintf ("No schedules exist for %s.", base.options.hostname.underline));

                base.schedules = data.results;
                callback ();

            });
        }

        // if no options set, load all schedules
        else {
            database.query.schedules.get (function (data) {
                if (data.error) return utils.outputError (data.error);
                if (!data.numResults) return utils.outputError ("No schedules exist.");

                base.schedules = data.results;
                callback ();

            });
        }

    },

    // Displays all loaded schedules as a table.
    list: function (callback) {

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
        for (var i = 0; i < base.schedules.length; i++) {
            resultsTable.push ([
                base.schedules[i].ScheduleId,
                base.schedules[i].HostName,
                utils.normalizePath (base.schedules[i].PathServerPickup),
                utils.normalizePath (base.schedules[i].PathLocalDropoff),
                (base.schedules[i].DeleteServerPickups) ? "YES" : "NO",
                (base.schedules[i].ManageLocalBackups) ? "YES" : "NO"
            ]);
        }

        // display the table
        utils.output (resultsTable.toString());

        callback ();

    },

    // Validates that required parameters for add operations exists.
    validateInputForAdd: function (callback)
    {

        // check for required fields
        if (utils.valueIsEmpty (base.options.hostname) ||
        utils.valueIsEmpty (base.options.remotepath) ||
        utils.valueIsEmpty (base.options.localpath))
            return utils.outputError ("Missing required options: --hostname, --remotepath, or --localpath");

        callback ();

    },

    // Validates that required parameters for update operations exists.
    validateInputForUpdate: function (callback)
    {

        // check for required fields
        if (utils.valueIsEmpty (base.options.id) ||
            utils.valueIsEmpty (base.options.hostname) ||
            utils.valueIsEmpty (base.options.remotepath) ||
            utils.valueIsEmpty (base.options.localpath))
            return utils.outputError ("Missing required options: --id, --hostname, --remotepath, or --localpath");

        callback ();

    },

    // Validates that required parameters for delete operations exists.
    validateInputForDelete: function (callback)
    {

        // check for required fields
        if (utils.valueIsEmpty (base.options.id))
            return utils.outputError ("Missing required option: --id");

        callback ();

    },

    // Validates that the operation paths exist.
    validatePaths: function (callback) {

        if (utils.valueIsEmpty (base.schedules) || base.schedules.length != 1) return utils.outputError ("Unexpected value for validate paths operation list.");
        var schedule = base.schedules[0];

        // validate the local path
        shell.validateLocalPath (
            schedule.PathLocalDropoff,
            function (response, isError) {
                if (isError) return utils.outputError (response);

                // test the remote path
                shell.validateRemotePath (
                    schedule.PathSSHKeyFile,
                    schedule.HostName,
                    schedule.UserName,
                    schedule.PathServerPickup,
                    function (response, isError) {
                        if (isError) return utils.outputError (response);

                        callback ();

                    }
                );
            }
        );

    },

    // Adds the input fields as a mock schedule so that it can be tested.
    loadInputToTest: function (callback)
    {

        // check that host name exists
        database.query.servers.getByHostName (base.options.hostname, function (hostData) {
            if (hostData.error) return utils.outputError (hostData.error);
            if (!hostData.numResults) return utils.outputError (sprintf ("Host %s is not registered.", base.options.hostname));

            base.schedules = [{
                ScheduleId: "",
                HostName: base.options.hostname,
                PathLocalDropoff: utils.normalizePath (base.options.localpath),
                PathServerPickup: utils.normalizePath (base.options.remotepath),
                ManageLocalBackups: ! utils.valueIsEmpty (base.options.managelocal),
                DeleteServerPickups: ! utils.valueIsEmpty (base.options.deleteremote),
                ServerId: hostData.results.ServerId,
                PathSSHKeyFile: utils.normalizePath (hostData.results.PathSSHKeyFile),
                UserName: hostData.results.UserName
            }];

            callback ();

        });

    },

    // Prompts the user to confirm that they want to use the delete remote files option.
    checkScheduleConfirmDeleteRemote: function (callback)
    {

        prompt.start ();
        prompt.message = "";
        prompt.delimiter = "";
        prompt.colors = false;

        if (!base.options.deleteremote) return callback ();

        prompt.get ({
            properties: {
                confirm: {
                    pattern: /^(yes|no|y|n)$/gi,
                    description: "You have opted to delete remote files as they are downloaded. If the remote " +
                        "path is to a file, it will be deleted after every backup. If the remote path is a " +
                        "directory, all contents will be deleted. Are you sure?",
                    message: "Type yes/no",
                    required: true,
                    default: "no"
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

    },

    // Prompts the user to confirm that they wan to use the manage local files option.
    checkScheduleConfirmManageLocal: function (callback) {

        prompt.start ();
        prompt.message = "";
        prompt.delimiter = "";
        prompt.colors = false;

        if (!base.options.managelocal) return callback ();

        prompt.get ({
            properties: {
                confirm: {
                    pattern: /^(yes|no|y|n)$/gi,
                    description: "You have opted to manage local files. Any backup files stored locally are subject " +
                    "to deletion over time in accordance to your retention schedule defined in the .env file. Are " +
                    "you sure?",
                    message: "Type yes/no",
                    required: true,
                    default: "no"
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

    },

    // Registers a new schedule.
    add: function (callback) {

        if (utils.valueIsEmpty (base.schedules) || base.schedules.length != 1) return utils.outputError ("Unexpected value for add operation list.");
        var schedule = base.schedules[0];

        database.query.schedules.insert (
            schedule.ServerId,
            schedule.PathLocalDropoff,
            schedule.PathServerPickup,
            schedule.ManageLocalBackups,
            schedule.DeleteServerPickups,
            function (data) {
                if (data.error) return utils.outputError (data.error);

                // respond with success message
                utils.outputSuccess (sprintf ("Added schedule %s to the schedule list.", data.insertId.toString().underline));
                callback ();

            }
        );

    },

    // Updates an existing schedule.
    update: function (callback) {

        // validate the currently loaded schedule
        if (utils.valueIsEmpty (base.schedules) || base.schedules.length != 1) return utils.outputError ("Unexpected value for update operation list.");
        var schedule = base.schedules[0];

        database.query.schedules.update (
            base.options.id,
            schedule.ServerId,
            schedule.PathLocalDropoff,
            schedule.PathServerPickup,
            schedule.ManageLocalBackups,
            schedule.DeleteServerPickups,
            function (data) {
                if (data.error) return utils.outputError (data.error);

                // respond with success message
                utils.outputSuccess (sprintf ("Updated schedule %s in the schedule list.", base.options.id.toString().underline));
                callback ();

            }
        );

    },

    // Deletes the currently loaded schedule.
    delete: function (callback) {

        // validate the currently loaded server
        if (utils.valueIsEmpty (base.schedules) || base.schedules.length != 1) return utils.outputError ("Unexpected value for delete operation list.");
        var scheduleId = base.schedules[0].ScheduleId;

        // delete the schedule
        database.query.schedules.delete (scheduleId, function (data) {
            if (data.error) return utils.outputError (data.error);
            if (!data.numDeleted) return utils.outputError (sprintf ("Schedule record not found during delete. Expected at ScheduleId: %s.", scheduleId));

            // respond with success message
            utils.outputSuccess (sprintf (
                "Deleted schedule %s from schedule list.",
                scheduleId.toString().underline
            ));
            callback ();

        });

    },

    // Tests server schedules to validate that the remote and local directories are accessible.
    test: function (callback) {

        var currentSchedule = base.schedules.pop ();
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
                            base.test (callback);

                        }
                    );

                }
            );

        }
        else callback ();

    }

};

module.exports = base;