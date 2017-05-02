#!/usr/bin/env nodejs

// load configuration values
require ("dotenv").config();

// include libraries
var program = require ("commander")
,   async = require ("async")
,   servermanager = require ("./servermanager.js")
,   schedulemanager = require ("./schedulemanager.js")
,   utils = require ("./utils.js")
,   sprintf = require ("util").format;

// handle server management requests
program
.command ("servers [action]")
.description ("manage server connections where [action] is one of: list, test, add, update, delete")
.option ("-n, --hostname <hostname>", "server http host name - required for: add, update, delete - optional for: test")
.option ("-u, --username <username>", "server ssh login user name - required for: add, update")
.option ("-k, --sshkey <sshkey>", "path to ssh private key file - required for: add, update")
.action (function (action, options) {
    if (utils.valueIsEmpty (action)) action = "list"; // set default when no action provided

    servermanager.options = options;
    switch (action) {

        // display all available server connections
        case "list":
            async.series ([
                servermanager.loadServers,
                servermanager.list
            ]);
            break;

        // test existing server connections
        case "test":
            async.series ([
                servermanager.loadServers,
                servermanager.test
            ]);
            break;

        // create new server connection
        case "add":
            async.series ([
                servermanager.validateInputForAdd,
                servermanager.validateCredentials,
                servermanager.add
            ]);
            break;

        // update an existing server connection
        case "update":
            async.series ([
                servermanager.validateInputForUpdate,
                servermanager.loadServers,
                servermanager.validateCredentials,
                servermanager.update
            ]);
            break;

        // delete a server connection
        case "delete":
            async.series ([
                servermanager.validateInputForDelete,
                servermanager.loadServers,
                servermanager.delete
            ]);
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

    schedulemanager.options = options;
    switch (action) {

        // display all available schedules
        case "list":
            async.series ([
                schedulemanager.loadSchedules,
                schedulemanager.list
            ]);
            break;

        // test existing schedules
        case "test":
            async.series ([
                schedulemanager.loadSchedules,
                schedulemanager.test
            ]);
            break;

        // create new schedule
        case "add":
            async.series ([
                schedulemanager.validateInputForAdd,
                schedulemanager.loadInputToTest,
                schedulemanager.validatePaths,
                schedulemanager.checkScheduleConfirmDeleteRemote,
                schedulemanager.checkScheduleConfirmManageLocal,
                schedulemanager.add
            ]);
            break;

        // update an existing schedule
        case "update":
            async.series ([
                schedulemanager.validateInputForUpdate,
                schedulemanager.loadSchedules,
                schedulemanager.loadInputToTest,
                schedulemanager.validatePaths,
                schedulemanager.checkScheduleConfirmDeleteRemote,
                schedulemanager.checkScheduleConfirmManageLocal,
                schedulemanager.update
            ]);

            break;

        // delete an existing schedule
        case "delete":
            async.series ([
                schedulemanager.validateInputForDelete,
                schedulemanager.loadSchedules,
                schedulemanager.delete
            ]);

            break;

        // notify invalid usage
        default:
            utils.outputError (sprintf ("Invalid option. Check %s for correct usage.", "schedules --help".underline));

    }

});

// process arguments
program.parse(process.argv);
