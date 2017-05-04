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
    numFilesDownloaded: 0, // set in logBackupStart (for reset) and processFileBackups (to increment)

    // Writes log stating that backup has begun for a schedule.
    // callback (no params)
    logBackupStart: function (callback) {
        if (utils.valueIsEmpty (base.schedule)) return utils.outputError ("No schedule loaded for backup. Aborting backup.");

        database.query.backuplogs.insert (base.schedule.ScheduleId, function (data) {
            if (data.error) { // intentionally not returning after error
                base.logAndDisplayError (sprintf ("Could not insert database log record for schedule %s. Backup proceeding.", base.schedule.ScheduleId));
            }

            base.backupLogId = data.insertId;
            base.numFilesDownloaded = 0;
            base.logAndDisplayMessage (sprintf ("Starting schedule %s with log %s.", base.schedule.ScheduleId, base.backupLogId));
            callback ();

        });

    },

    // Writes to log stating that the backup process has finished.
    // callback (no params)
    logBackupComplete: function (callback) {
        if (! base.backupLogId) return callback ();

        database.query.backuplogs.updateAsFinished (base.backupLogId, function (data) {
            if (data.error) { // intentionally not returning after error
                base.logAndDisplayError (sprintf ("Could not close database backup log %s. Backup proceeding, but schedule %s will not be able to run again until this record is marked with a finish date.", base.backupLogId, base.schedule.ScheduleId));
            }

            base.logAndDisplayMessage (sprintf ("Closing schedule %s with log %s.", base.schedule.ScheduleId, base.backupLogId ));
            callback ();

        });

    },

    // Loads all files to be transferred locally.
    // callback (no params)
    getBackupFileList: function (callback) {

        shell.getCopyFileList (
            base.schedule.PathSSHKeyFile,
            base.schedule.HostName,
            base.schedule.UserName,
            base.schedule.PathServerPickup,
            function (fileType, fileList, error) {
                if (!utils.valueIsEmpty(error)) {
                    return base.logAndDisplayMessage (sprintf ("Error retrieving file list for schedule %s: %s", base.schedule.ScheduleId, error), true);
                }
                if (!fileList.length) {
                    return base.logAndDisplayMessage (sprintf ("No files to retrieve for schedule %s.", base.schedule.ScheduleId));
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

        var backupDirectory = base.schedule.PathLocalDropoff;

        // check that the base backup directory exists and create if doesn't
        if (! fs.existsSync (backupDirectory)) {
            fs.mkdirSync (backupDirectory);
            if (! fs.existsSync (backupDirectory)) {
                return base.logAndDisplayError (sprintf ("Error creating backup folder at %s. Schedule %s is aborting.", backupDirectory, base.schedule.ScheduleId));
            }
        }

        // check that the host name directory exists and create if doesn't
        backupDirectory += "/" + base.schedule.HostName;
        if (! fs.existsSync (backupDirectory)) {
            fs.mkdirSync (backupDirectory);
            if (! fs.existsSync (backupDirectory)) {
                return base.logAndDisplayError (sprintf ("Error creating backup folder at %s. Schedule %s is aborting.", backupDirectory, base.schedule.ScheduleId));
            }
        }

        // check that the schedule ID backup directory exists
        backupDirectory += "/" + base.backupLogId.toString();
        if (! fs.existsSync (backupDirectory)) {
            fs.mkdirSync (backupDirectory);
            if (! fs.existsSync (backupDirectory)) {
                return base.logAndDisplayError (sprintf ("Error creating backup folder at %s. Schedule %s is aborting.", backupDirectory, base.schedule.ScheduleId));
            }
        }

        base.backupDirectory = backupDirectory;
        callback ();

    },

    // Downloads all backup files.
    // callback (no params)
    processFileBackup: function (callback) {

        // continue if completed processing all files
        if (utils.valueIsEmpty (base.backupFiles)) {

            base.logAndDisplayMessage (sprintf (
                "Completing backup, %s %s file%s from %s%s to %s.",
                (base.schedule.DeleteServerPickups) ? "moving" : "copying",
                base.numFilesDownloaded,
                (base.numFilesDownloaded == 1) ? "" : "s",
                base.schedule.HostName,
                base.schedule.PathServerPickup,
                base.backupDirectory
            ));

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
                    base.logAndDisplayError (sprintf ("Could not insert database log files record for backup log %s's file %s. Backup was allowed to continue.", base.backupLogId, backupFile.name));
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
                            base.logAndDisplayError (sprintf ("Error downloading %s from %s for backup log %s. Backup was allowed to continue.", backupFile.name, base.schedule.HostName, base.backupLogId));
                        }
                        else {
                            base.numFilesDownloaded++;
                        }

                        // if schedule set to delete remote files, remove the file from the server
                        if (base.schedule.DeleteServerPickups) {
                            // TODO: Delete file from server

                            // process the next file
                            base.processFileBackup (callback);

                        }

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
        shell.writeLog (message);
        utils.outputError (message);
    }

};

module.exports = base;
