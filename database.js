var mysql = require ("mysql");

exports.query = {

    getServers: function (callback) {

        exports.access.selectMultiple ({
            sql:    "SELECT     * " +
                    "FROM       Servers " +
                    "ORDER BY   ServerName ASC "
        },
        callback);

    }

};

exports.access = {

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
                return exports.access.handleError ("", error, callback);
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

        if (! this.init(callback)) return;

        // run the query
        this.db.query(query, function (error, rows) {

            // report error and return if error state
            if (error) return exports.access.handleError (query, error, callback);

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

        this.close();

    }

};