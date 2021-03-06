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
            }, callback);

        },

        // Pulls a single server.
        getByHostName: function (hostName, callback) {

            databaseAccessor.selectSingle ({
                sql: "SELECT * " +
                     "FROM   Servers " +
                     "WHERE  HostName = ? ",
                values: hostName
            }, callback);

        },

        // Inserts new server.
        insert: function (hostName, userName, sshKeyFileLocation, callback) {

            databaseAccessor.insert ({
                sql: "INSERT INTO Servers SET ?",
                values: {
                    HostName: hostName,
                    UserName: userName,
                    PathSSHKeyFile: utils.normalizePath (sshKeyFileLocation)
                }
            }, callback);

        },

        // Updates an existing server.
        update: function (serverId, hostName, userName, sshKeyFileLocation, callback) {

            databaseAccessor.update ({
                sql: "UPDATE Servers SET ? WHERE ServerId = ?",
                values: [{
                    HostName: hostName,
                    UserName: userName,
                    PathSSHKeyFile: utils.normalizePath (sshKeyFileLocation)
                    },
                    serverId
                ]
            }, callback);

        },

        // Deletes an existing server.
        delete: function (serverId, callback) {

            databaseAccessor.delete ({
                sql: "DELETE FROM    Servers " +
                     "WHERE          ServerId = ? ",
                values: serverId
            }, callback);

        }

    },

    // Query against schedules.
    schedules: {

        // Pulls list of all schedules.
        get: function (callback) {

            databaseAccessor.selectMultiple ({
                sql: "SELECT     * " +
                     "FROM       Schedules sc " +
                     "INNER JOIN Servers se ON se.ServerId = sc.ServerId " +
                     "ORDER BY   se.HostName ASC " +
                     ",          sc.PathServerPickup ASC "
            }, callback);

        },

        // Pulls list of all schedules related to a server host name.
        getByServerHostName: function (hostName, callback) {
            if (utils.valueIsEmpty(hostName)) return this.get (callback);

            databaseAccessor.selectMultiple ({
                sql: "SELECT     * " +
                     "FROM       Schedules sc " +
                     "INNER JOIN Servers se ON se.ServerId = sc.ServerId " +
                     "WHERE      se.HostName = ? " +
                     "ORDER BY   sc.PathServerPickup ASC ",
                values: hostName
            }, callback);

        },

        // Pulls a list of all schedules related to a server.
        getByServerId: function (serverId, callback) {

            databaseAccessor.selectMultiple ({
                sql: "SELECT * " +
                     "FROM   Schedules " +
                     "WHERE  ServerId = ? ",
                values: serverId
            }, callback);

        },

        // Pulls a single schedule by ID.
        getByScheduleId: function (scheduleId, callback) {

            databaseAccessor.selectSingle ({
                sql: "SELECT     * " +
                     "FROM       Schedules sc " +
                     "INNER JOIN Servers se ON se.ServerId = sc.ServerId " +
                     "WHERE      sc.ScheduleId = ? ",
                values: scheduleId
            }, callback);

        },

        // Inserts new schedule.
        insert: function (serverId, pathLocalDropoff, pathServerPickup, manageLocalBackups, manageLocalBackupsSchedule, deleteServerPickups, callback) {

            databaseAccessor.insert ({
                sql: "INSERT INTO Schedules SET ?",
                values: {
                    ServerId: serverId,
                    PathLocalDropoff: utils.normalizePath (pathLocalDropoff),
                    PathServerPickup: utils.normalizePath (pathServerPickup),
                    ManageLocalBackups: manageLocalBackups,
                    ManageLocalBackupsSchedule: manageLocalBackupsSchedule,
                    DeleteServerPickups: deleteServerPickups
                }
            }, callback);

        },

        // Updates an existing schedule.
        update: function (scheduleId, serverId, pathLocalDropoff, pathServerPickup, manageLocalBackups, manageLocalBackupsSchedule, deleteServerPickups, callback) {

            databaseAccessor.update ({
                sql: "UPDATE Schedules SET ? WHERE ScheduleId = ?",
                values: [{
                    ServerId: serverId,
                    PathLocalDropoff: utils.normalizePath (pathLocalDropoff),
                    PathServerPickup: utils.normalizePath (pathServerPickup),
                    ManageLocalBackups: manageLocalBackups,
                    ManageLocalBackupsSchedule: manageLocalBackupsSchedule,
                    DeleteServerPickups: deleteServerPickups
                    },
                    scheduleId
                ]
            }, callback);

        },

        // Deletes an existing schedule.
        delete: function (scheduleId, callback) {

            databaseAccessor.delete ({
                sql: "DELETE FROM    Schedules " +
                     "WHERE          ScheduleId = ? ",
                values: scheduleId
            }, callback);

        }

    },

    // Query against the backup log table
    backuplogs: {

        // Pulls all backup logs that have not yet been deleted.
        // callback (object: {int:numResults, array:results, string:error})
        getActiveArchivesByScheduleId: function (scheduleId, callback) {

            databaseAccessor.selectMultiple({
                sql: "SELECT      bl.BackupLogId " +
                     ",           bl.DateStarted " +
                     ",           TIMESTAMPDIFF(DAY, bl.DateStarted, NOW()) AS AgeDays " +
                     ",           COUNT(blf.BackupLogFileId) AS NumFiles " +
                     "FROM        BackupLog bl " +
                     "INNER JOIN  BackupLogFiles blf ON blf.BackupLogId = bl.BackupLogId " +
                     "WHERE       bl.ScheduleId = ? " +
                     "AND         bl.DateDeleted IS NULL " +
                     "AND         bl.DateFinished IS NOT NULL " +
                     "GROUP BY    bl.BackupLogId " +
                     "ORDER BY    bl.DateStarted DESC ",
                values: scheduleId
            }, callback);

        },

        // Pulls the last log entry for a given schedule.
        // callback (object: {int:numResults, object:results, string:error})
        getLastByScheduleId: function (scheduleId, callback) {

            databaseAccessor.selectSingle ({
                sql: "SELECT    * " +
                     "FROM      BackupLog " +
                     "WHERE     ScheduleId = ? " +
                     "ORDER BY  BackupLogId DESC " +
                     "LIMIT     1",
                values: scheduleId
            }, callback);

        },

        // Inserts a new log entry.
        // callback (object: {int:insertId, string:error})
        insert: function (scheduleId, callback) {

            databaseAccessor.insert ({
                sql: "INSERT INTO BackupLog SET DateStarted = NOW(), ?",
                values: {
                    ScheduleId: scheduleId
                }
            }, callback);

        },

        // Updates an existing log entry with completion date.
        // callback (object: {int:numUpdated, string:error})
        updateAsFinished: function (backupLogId, statusMessage, callback) {

            databaseAccessor.update ({
                sql: "UPDATE BackupLog SET DateFinished = NOW(), StatusMessage = ? WHERE BackupLogId = ?",
                values: [
                    statusMessage,
                    backupLogId
                ]
            }, callback);

        },

        // Updates an existing log entry with a deletion date.
        // callback (object: {int:numUpdated, string:error})
        updateAsDeleted: function (backupLogId, callback) {

            databaseAccessor.update ({
                sql: "UPDATE BackupLog SET DateDeleted = NOW() WHERE BackupLogId = ?",
                values: backupLogId
            }, callback);

        }

    },

    // Query against the backup log files table
    backuplogfiles: {

        // Inserts a new log file entry
        // callback (object: {int:insertId, string:error})
        insert: function (backupLogId, fileName, fileSize, callback) {

            databaseAccessor.insert ({
                sql: "INSERT INTO BackupLogFiles SET DateCreated = NOW(), ?",
                values: {
                    BackupLogId: backupLogId,
                    FileName: fileName,
                    FileSize: fileSize
                }
            }, callback);

        }

    }

};

// Provides all database connectivity methods.
var databaseAccessor = {

    db: null,

    // Creates connection to the database. Returns boolean, and only makes a call to the callback if an error has
    // occurred.
    // callback (object: {int:numResults, int:insertId, int:numUpdated, int:numDeleted, object:results, string:error}
    init: function (callback) {

        // create the database connection
        this.db = mysql.createConnection ({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
            typeCast: function castField (field, useDefaultTypeCasting) {

                // set bit fields to act as booleans
                if ((field.type === "BIT") && (field.length === 1)) {
                    var bytes = field.buffer();
                    return (bytes[0] === 1);
                }

                return (useDefaultTypeCasting ());

            }
        });

        // connect to the database
        this.db.connect (function (error) {
            if (error) {
                return databaseAccessor.handleError ("", error, callback);
            }
        });

        return true;

    },

    // Closes the connection to the database.
    close: function () {

        this.db.end ();

    },

    // Makes callback for all error states.
    // callback (object: {int:numResults, int:insertId, int:numUpdated, int:numDeleted, object:results, string:error}
    handleError: function (query, error, callback) {

        callback ({
            numResults: 0,
            insertId: 0,
            numUpdated: 0,
            numDeleted: 0,
            results: null,
            error: error.toString()
        });

    },

    // Run a select query against the database, returning only a single row.
    // callback (object: {int:numResults, object:results, string:error})
    selectSingle: function (query, callback) {

        this.selectMultiple (query, callback, true);

    },

    // Run a select query against the database.
    // callback (object: {int:numResults, array:results (or object if returnSingle is set), string:error})
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

    // Run an insert query against the database.
    // callback (object: {int:insertId, string:error})
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

    // Run an update query against the database.
    // callback (object: {int:numUpdated, string:error})
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

    // Run a delete query against the database.
    // callback (object: {int:numDeleted, string:error})
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