var mysql = require ("mysql")
,   utils = require ("./utils");

// Provides all database queries.
exports.query = {

    // Pulls list of all servers.
    getServers: function (callback) {

        databaseAccessor.selectMultiple ({
            sql:    "SELECT     * " +
                    "FROM       Servers " +
                    "ORDER BY   HostName ASC "
        },
        callback);

    },

    // Inserts new server.
    insertServer: function (hostName, userName, sshKeyFileLocation, callback) {

        databaseAccessor.insert ({
            sql:    "INSERT INTO Servers SET ?",
            values: {
                HostName: hostName,
                UserName: userName,
                SSHKeyFileLocation: sshKeyFileLocation
            }
        },
        callback);

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

            // report error and return if error state
            if (error) return databaseAccessor.handleError (query, error, callback);

            // call the callback with data
            if (returnSingle) callback({
                numResults: (rows.length > 1) ? rows.length : 1,
                results: rows[0],
                error: ""
            });
            else callback ({
                numResults: rows.length,
                results: rows,
                error: ""
            });

        });

        this.close ();

    },

    // run an insert against the database
    insert: function (query, callback) {

        if (! this.init(callback)) return;

        // run the query
        this.db.query (query, function (error, result) {

            if (! utils.valueIsEmpty(error)) return callback ({
                insertId: 0,
                error: error.toString()
            });

            callback ({
                insertId: result.insertId,
                error: (result.insertId) ? "" : "An unknown error occurred while performing the insert."
            });

        });

        this.close ();

    }

};