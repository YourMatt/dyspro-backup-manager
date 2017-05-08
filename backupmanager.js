// include libraries
var shell = require ("./shell.js")
,   utils = require ("./utils.js")
,   database = require ("./database.js")
,   fs = require ("fs")
,   sprintf = require ("util").format;

// Performs all backup operations.
var base = {

    schedule: {}, // set externally
    backupLogId: 0, // set in logBackupStart
    backupLocationType: "", // will be file, directory, or unknown - set in logBackupFileList
    backupFiles: [], // set in getBackupFileList
    backupDirectory: "", // set in createBackupDirectory
    numFilesDownloaded: 0, // set in processFileBackups (incremented)
    completionStatusMessage: "", // set in processFileBackup and logAndDisplayError
    halted: false, // set whenever an error condition causes the schedule to stop being processed - needed to ensure that the series loop is not broken from the controller

    // Resets properties to prepare for next schedule run.
    // callback (no params)
    init: function (callback) {

        // do not reset the schedule
        base.backupLogId = 0;
        base.backupLocationType = "";
        base.backupFiles = [];
        base.backupDirectory = "";
        base.numFilesDownloaded = 0;
        base.completionStatusMessage = "";
        base.halted = false;

        callback ();

    },

    // Writes log stating that backup has begun for a schedule.
    // callback (no params)
    logBackupStart: function (callback) {
        if (base.halted) return callback ();
        if (utils.valueIsEmpty (base.schedule)) {
            base.halted = true;
            utils.outputError ("No schedule loaded for backup. Aborting backup.");
            return callback ();
        }

        database.query.backuplogs.insert (base.schedule.ScheduleId, function (data) {
            if (data.error) { // intentionally not returning after error
                base.logAndDisplayError (sprintf ("Could not insert database log record for schedule %s. Backup proceeding.", base.schedule.ScheduleId));
            }

            base.backupLogId = data.insertId;
            base.logAndDisplayMessage (sprintf ("Starting schedule %s with log %s.", base.schedule.ScheduleId, base.backupLogId));
            callback ();

        });

    },

    // Writes to log stating that the backup process has finished.
    // callback (no params)
    logBackupComplete: function (callback) {
        // if halted still allow the backup log entry to be closed out
        if (! base.backupLogId) return callback ();

        database.query.backuplogs.updateAsFinished (base.backupLogId, base.completionStatusMessage, function (data) {
            if (data.error) { // intentionally not returning after error
                base.logAndDisplayError (sprintf ("Could not close database backup log %s. Backup proceeding, but schedule %s will not be able to run again until this record is marked with a finish date.", base.backupLogId, base.schedule.ScheduleId));
            }

            base.logAndDisplayMessage (sprintf ("Closing schedule %s with log %s.", base.schedule.ScheduleId, base.backupLogId ));
            callback ();

        });

    },

    // Validates that the schedule is not already running. If it is, then it will not be run again.
    // callback (no params)
    checkIfScheduleCurrentlyRunning: function (callback) {

        database.query.backuplogs.getLastByScheduleId (base.schedule.ScheduleId, function (data) {
            if (data.error) { // intentionally not returning after error
                base.logAndDisplayError (sprintf ("Could not find latest backup log entry for schedule %s. Error message: %s", base.schedule.ScheduleId, data.error));
            }

            // not running if never ran
            if (! data.numResults) return callback ();

            // if no finish date, don't allow to continue
            if (utils.valueIsEmpty (data.results.DateFinish)) {
                base.logAndDisplayError (sprintf ("Could not run schedule %s because it is already running. If this is in error, delete log entry %s.", base.schedule.ScheduleId, data.results.BackupLogId));
                base.halted = true;
            }

            callback ();

        });

    },

    // Loads all files to be transferred locally.
    // callback (no params)
    getBackupFileList: function (callback) {
        if (base.halted) return callback ();

        shell.getCopyFileList (
            base.schedule.PathSSHKeyFile,
            base.schedule.HostName,
            base.schedule.UserName,
            base.schedule.PathServerPickup,
            function (fileType, fileList, error) {
                if (!utils.valueIsEmpty(error)) {
                    base.halted = true;
                    base.logAndDisplayError (sprintf ("Error retrieving file list for schedule %s: %s", base.schedule.ScheduleId, error), true);
                    return callback ();
                }
                if (!fileList.length) {
                    base.halted = true;
                    base.logAndDisplayError (sprintf ("No files to retrieve for schedule %s.", base.schedule.ScheduleId));
                    return callback ();
                }

                base.backupLocationType = fileType;
                base.backupFiles = fileList;
                callback ();

            }
        );

    },

    // Creates the local directory to place backup files into.
    // callback (no params)
    createBackupDirectory: function (callback) {
        if (base.halted) return callback ();

        var backupDirectory = base.schedule.PathLocalDropoff;

        // check that the base backup directory exists and create if doesn't
        if (! fs.existsSync (backupDirectory)) {
            fs.mkdirSync (backupDirectory);
            if (! fs.existsSync (backupDirectory)) {
                base.halted = true;
                base.logAndDisplayError (sprintf ("Error creating backup folder at %s. Schedule %s is aborting.", backupDirectory, base.schedule.ScheduleId));
                return callback ();
            }
        }

        // check that the host name directory exists and create if doesn't
        backupDirectory += "/" + base.schedule.HostName;
        if (! fs.existsSync (backupDirectory)) {
            fs.mkdirSync (backupDirectory);
            if (! fs.existsSync (backupDirectory)) {
                base.halted = true;
                base.logAndDisplayError (sprintf ("Error creating backup folder at %s. Schedule %s is aborting.", backupDirectory, base.schedule.ScheduleId));
                return callback ();
            }
        }

        // check that the schedule ID backup directory exists
        backupDirectory += "/" + base.backupLogId.toString();
        if (! fs.existsSync (backupDirectory)) {
            fs.mkdirSync (backupDirectory);
            if (! fs.existsSync (backupDirectory)) {
                base.halted = true;
                base.logAndDisplayError (sprintf ("Error creating backup folder at %s. Schedule %s is aborting.", backupDirectory, base.schedule.ScheduleId));
                return callback ();
            }
        }

        base.backupDirectory = backupDirectory;
        callback ();

    },

    // Downloads all backup files.
    // callback (no params)
    processFileBackup: function (callback) {
        if (base.halted) return callback ();

        // continue if completed processing all files
        if (utils.valueIsEmpty (base.backupFiles)) {

            base.completionStatusMessage = sprintf (
                "Completing backup, %s %s file%s from %s%s to %s.",
                (base.schedule.DeleteServerPickups) ? "moving" : "copying",
                base.numFilesDownloaded,
                (base.numFilesDownloaded == 1) ? "" : "s",
                base.schedule.HostName,
                base.schedule.PathServerPickup,
                base.backupDirectory
            );

            base.logAndDisplayMessage (base.completionStatusMessage);

            return callback ();
        }

        // pull the next file to process
        var backupFile = base.backupFiles.shift ();

        // insert the file information into the database
        database.query.backuplogfiles.insert (
            base.backupLogId,
            backupFile.name,
            backupFile.size,
            function (data) {
                if (data.error) { // intentionally not returning after error
                    base.logAndDisplayError (sprintf ("Could not insert database log files record for backup log %s's file %s. Backup was allowed to continue. Error message: %s", base.backupLogId, backupFile.name, data.error));
                }

                // copy the file from remote to local
                shell.copyFile (
                    base.schedule.PathSSHKeyFile,
                    base.schedule.HostName,
                    base.schedule.UserName,
                    backupFile.name,
                    base.backupDirectory,
                    function (error) {
                        if (! utils.valueIsEmpty(error)) {
                            base.logAndDisplayError (sprintf ("Error downloading %s from %s for backup log %s. Backup was allowed to continue. Error message: %s", backupFile.name, base.schedule.HostName, base.backupLogId, error));
                        }
                        else {
                            base.numFilesDownloaded++;
                        }

                        // if schedule set to delete remote files, remove the file from the server
                        if (base.schedule.DeleteServerPickups) {
                            shell.deleteRemoteFile (
                                base.schedule.PathSSHKeyFile,
                                base.schedule.HostName,
                                base.schedule.UserName,
                                backupFile.name,
                                function (error) {
                                    if (error) base.logAndDisplayError (sprintf ("Error deleting %s from %s for backup log %s. Backup was allowed to continue. Error message: %s", backupFile.name, base.schedule.HostName, base.backupLogId, error));

                                    // process the next file
                                    base.processFileBackup (callback);

                                }
                            );
                        }

                        // continue if don't need to delete the remote file
                        else {

                            // process the next file
                            base.processFileBackup (callback);

                        }

                    }
                );

            }
        );

    },

    // Sends a general message to the log and to screen.
    logAndDisplayMessage: function (message) {
        shell.writeLog (message);
        utils.output (message);
    },

    // Sends an error message to the log and to screen.
    logAndDisplayError: function (message) {
        base.completionStatusMessage = message; // allow the last error message to be recorded in the log table
        shell.writeLog (message);
        utils.outputError (message);
    }

};

module.exports = base;
