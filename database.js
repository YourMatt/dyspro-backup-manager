var mysql = require ("mysql")
,   utils = require ("./utils");

// Provides all database queries.
exports.query = {

    // Query against servers.
    servers: {

        // Pulls list of all servers.
        get: function (callback) {

            databaseAccessor.selectMultiple ({
                sql: "SELECT     * " +
                     "FROM       Servers " +
                     "ORDER BY   HostName ASC "
            },
            callback);

        },

        // Pulls a single server.
        getByHostName: function (hostName, callback) {

            databaseAccessor.selectSingle ({
                sql: "SELECT * " +
                     "FROM   Servers " +
                     "WHERE  HostName = ? ",
                values: hostName
            },
            callback);

        },

        // Inserts new server.
        insert: function (hostName, userName, sshKeyFileLocation, callback) {

            databaseAccessor.insert ({
                sql: "INSERT INTO Servers SET ?",
                values: {
                    HostName: hostName,
                    UserName: userName,
                    SSHKeyFileLocation: sshKeyFileLocation
                }
            },
            callback);

        },

        // Updates an existing server.
        update: function (serverId, hostName, userName, sshKeyFileLocation, callback) {

            databaseAccessor.update ({
                sql: "UPDATE Servers SET ? WHERE ServerId = ?",
                values: [{
                    HostName: hostName,
                    UserName: userName,
                    SSHKeyFileLocation: sshKeyFileLocation
                    },
                    serverId
                ]
            },
            callback);

        },

        // Deletes an existing server.
        delete: function (serverId, callback) {

            databaseAccessor.delete ({
                sql:    "DELETE FROM    Servers " +
                        "WHERE          ServerId = ? ",
                values: serverId
            },
            callback);

        }

    },

    // Query against schedules.
    schedules: {

        // Pulls a list of all schedules related to a server.
        getByServerId: function (serverId, callback) {

            databaseAccessor.selectMultiple ({
                sql: "SELECT * " +
                     "FROM   Schedules " +
                     "WHERE  ServerId = ? ",
                values: serverId
            },
            callback);

        }

    }

};

// Provides all database connectivity methods.
var databaseAccessor = {

    db: null,

    init: function (callback) {

        // create the db connection
        this.db = mysql.createConnection ({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME
        });

        // connect to the database
        this.db.connect (function (error) {
            if (error) {
                return databaseAccessor.handleError ("", error, callback);
            }
        });

        return true;

    },

    close: function () {

        // close the database connection
        this.db.end ();

    },

    handleError: function (query, error, callback) {

        callback ({
            numResults: 0,
            results: null,
            error: error.toString()
        });

    },

    selectSingle: function (query, callback) {

        this.selectMultiple (query, callback, true);

    },

    // run a query against the database
    selectMultiple: function (query, callback, returnSingle) {

        if (! this.init (callback)) return;

        // run the query
        this.db.query (query, function (error, rows) {
            databaseAccessor.close ();

            // report error and return if error state
            if (error) return databaseAccessor.handleError (query, error, callback);

            // call the callback with data
            if (returnSingle) {
                if (rows.length) {
                    callback ({
                        numResults: (rows.length > 1) ? rows.length : 1,
                        results: rows[0],
                        error: ""
                    });
                }
                else {
                    callback ({
                        numResults: 0,
                        results: {},
                        error: ""
                    });
                }
            }
            else callback ({
                numResults: rows.length,
                results: rows,
                error: ""
            });

        });

    },

    // run an insert against the database
    insert: function (query, callback) {

        if (! this.init (callback)) return;

        // run the query
        this.db.query (query, function (error, result) {
            databaseAccessor.close ();

            if (! utils.valueIsEmpty(error)) return callback ({
                insertId: 0,
                error: error.toString()
            });

            callback ({
                insertId: result.insertId,
                error: (result.insertId) ? "" : "An unknown error occurred while performing the insert."
            });

        });

    },

    // run an update against the database
    update: function (query, callback) {

        if (! this.init (callback)) return;

        // run the query
        this.db.query (query, function (error, result) {
            databaseAccessor.close ();

            if (! utils.valueIsEmpty(error)) return callback ({
                numUpdated: 0,
                error: error.toString()
            });

            callback ({
                numUpdated: result.affectedRows,
                error: ""
            });

        });

    },

    // run a delete against the database
    delete: function (query, callback) {

        if (! this.init (callback)) return;

        // run the query
        this.db.query (query, function (error, result) {
            databaseAccessor.close ();

            if (! utils.valueIsEmpty(error)) return callback ({
                numDeleted: 0,
                error: error.toString()
            });

            callback ({
                numDeleted: result.affectedRows,
                error: ""
            });

        });

    }

};