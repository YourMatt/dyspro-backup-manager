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
.option ("-s, --sshkey <sshkey>", "path to ssh private key file - required for: add, update")
.action (function (action, options) {
    if (utils.valueIsEmpty (action)) action = "list"; // set default when no action provided

    switch (action) {

        // display all available server connections
        case "list":
            console.log ("list");

            // retrieve all servers from the database
            database.query.getServers(function (data) {

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

            shell.validateSSHKey (
                options.sshkey,
                options.hostname,
                options.username,
                function (error) {
                    if (! utils.valueIsEmpty(error)) return console.log (error);

                    // TODO: Run inset against the database

                    console.log ("Added %s to server list.", options.hostname);

                }
            );

            break;

        // update an existing server connection
        case "update":

            console.log ("update");

            break;

        // delete a server connection
        case "delete":

            console.log ("delete");

            break;
        default:
            console.log ("Invalid option. Check --help for correct usage.");
    }
});

program.parse(process.argv);
