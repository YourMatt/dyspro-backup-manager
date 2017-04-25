#!/usr/bin/env nodejs

// load configuration values
require ("dotenv").config();

// include libraries
var program = require ("commander")
,   database = require ("./database.js")
,   shell = require ("./shell.js")
,   utils = require ("./utils.js");

// handle server management requests
program
.command ("servers [action]")
.description ("manage server connections where [action] is one of: list, add, update, delete")
.option ("-n, --hostname <hostname>", "server http host name - required for: add, update, delete")
.option ("-u, --username <username>", "server ssh login user name - required for: add, update")
.option ("-k, --sshkey <sshkey>", "path to ssh private key file - required for: add, update")
.action (function (action, options) {
    if (utils.valueIsEmpty (action)) action = "list"; // set default when no action provided

    switch (action) {

        // display all available server connections
        case "list":
            console.log ("list");

            // retrieve all servers from the database
            database.query.servers.get (function (data) {

                // TODO: Format results as table
                console.log (data);

            });

            break;

        // create new server connection
        case "add":

            // check for required fields
            if (utils.valueIsEmpty (options.hostname) ||
                utils.valueIsEmpty (options.username) ||
                utils.valueIsEmpty (options.sshkey))
                return console.log ("Missing required options: --hostname, --username, or --sshkey");

            // validate that the host name is not already in use
            database.query.servers.getByHostName (options.hostname, function (data) {
                if (data.numResults) return console.log ("Host name is already registered.");

                // validate the SSH key
                shell.validateSSHKey (
                    options.sshkey,
                    options.hostname,
                    options.username,
                    function (error) {
                        if (!utils.valueIsEmpty (error)) return console.log(error);

                        // run database insert
                        database.query.servers.insert (
                            options.hostname,
                            options.username,
                            options.sshkey,
                            function (data) {
                                if (data.error) return console.log(data.error);

                                // respond with success message
                                console.log("Added %s to server list.", options.hostname);

                            }
                        );
                    }
                );
            });

            break;

        // update an existing server connection
        case "update":

            console.log ("update");

            break;

        // delete a server connection
        case "delete":

            // check for required fields
            if (utils.valueIsEmpty (options.hostname))
                return console.log ("Missing required options: --hostname");

            // find the server by host name
            database.query.servers.getByHostName (options.hostname, function (data) {
                if (data.error) return console.log (data.error);
                if (!data.numResults) return console.log ("Host name not found.");

                var serverId = data.results.ServerId;

                // check the number of schedules affected
                database.query.schedules.getByServerId (serverId, function (data) {
                    if (data.error) return console.log (data.error);

                    // TODO: provide confirmation prompt if schedules will be deleted

                    var deletedSchedules = data.numResults;

                    // delete the schedule
                    database.query.servers.delete (serverId, function (data) {
                        if (data.error) return console.log (data.error);
                        if (!data.numDeleted) return console.log ("Server record not found during delete. Expected at ServerId: %s.", serverId);

                        // respond with success message
                        console.log (
                            "Deleted %s with %s associated schedule%s from server list.",
                            options.hostname,
                            deletedSchedules,
                            (deletedSchedules == 1) ? "" : "s"
                        );

                    });

                });
            });

            break;

        // notify invalid usage
        default:

            console.log ("Invalid option. Check --help for correct usage.");

    }
});

// process arguments
program.parse(process.argv);
