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
    backupLogsToMarkAsDeleted: [], // set in processBackupManagement
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
        base.backupLogsToMarkAsDeleted = [];
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
            if (utils.valueIsEmpty (data.results.DateFinished)) {
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
                (base.numFilesDownloaded === 1) ? "" : "s",
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

    // Cleans out backup archives for the current schedule.
    // callback (no params)
    processBackupManagement: function (callback) {

        // return if not set to manage local backups
        if (! base.schedule.ManageLocalBackups) return callback ();

        base.logAndDisplayMessage (sprintf ("Starting backup management for schedule %s.", base.schedule.ScheduleId));

        // check for a retention schedule
        var retentionSchedule = base.schedule.ManageLocalBackupsSchedule;
        if (! retentionSchedule) retentionSchedule = process.env.DEFAULT_RETENTION;

        if (!retentionSchedule) {
            base.logAndDisplayError (sprintf ("Could not delete backups for schedule %s because no retention schedule is defined.", base.schedule.ScheduleId));
            return callback ();
        }

        // validate retention schedule format
        var retentionScheduleParts = retentionSchedule.split (",");
        if (retentionScheduleParts.length !== 4 ||
            retentionScheduleParts[0][0] !== "y" ||
            retentionScheduleParts[1][0] !== "m" ||
            retentionScheduleParts[2][0] !== "w" ||
            retentionScheduleParts[3][0] !== "d") {
            base.logAndDisplayError (sprintf ("Could not delete backups for schedule %s because the retention schedule is not in the correct format.", base.schedule.ScheduleId));
            return callback ();
        }

        var retainYears = parseInt (retentionScheduleParts[0].replace ("y", ""));
        var retainMonths = parseInt (retentionScheduleParts[1].replace ("m", ""));
        var retainWeeks = parseInt (retentionScheduleParts[2].replace ("w", ""));
        var retainDays = parseInt (retentionScheduleParts[3].replace ("d", ""));

        // load all active backups
        database.query.backuplogs.getActiveArchivesByScheduleId (base.schedule.ScheduleId, function (data) {
            if (data.error) {
                base.logAndDisplayError (sprintf ("Could not delete backups for schedule %s because of an error querying backup logs: %s", base.schedule.ScheduleId, data.error));
                return callback ();
            }

            // loop through all daily backups, finding the backups to keep
            var backupsToKeep = []
            ,   backupsToKeepAges = [] // holds day age of each backup to keep to ensure that the same day isn't counted twice
            ,   numKeptDays = 0
            ,   numKeptWeeks = 0
            ,   numKeptMonths = 0
            ,   numKeptYears = 0
            ,   foundUpcomingWeeklyBackup = false
            ,   foundUpcomingMonthlyBackup = false
            ,   foundUpcomingYearlyBackup = false;

            for (var i = 0; i < data.numResults; i++) {

                // keep first x number of days
                if (numKeptDays < retainDays &&
                    backupsToKeepAges.indexOf (data.results[i].AgeDays) < 0) {
                    backupsToKeep.push (data.results[i].BackupLogId);
                    backupsToKeepAges.push (data.results[i].AgeDays);
                    numKeptDays++;
                }

                // keep first x number of weeks
                if (numKeptWeeks < retainWeeks &&
                    numKeptWeeks < Math.floor (data.results[i].AgeDays / 7)) {
                    backupsToKeep.push (data.results[i].BackupLogId);
                    backupsToKeepAges.push (data.results[i].AgeDays);
                    numKeptWeeks++;
                }

                // keep first x number of months
                if (numKeptMonths < retainMonths &&
                    numKeptMonths < Math.floor (data.results[i].AgeDays / 30)) {
                    backupsToKeep.push (data.results[i].BackupLogId);
                    backupsToKeepAges.push (data.results[i].AgeDays);
                    numKeptMonths++;
                }

                // keep first x number of years
                if (numKeptYears < retainYears &&
                    numKeptYears < Math.floor (data.results[i].AgeDays / 365)) {
                    backupsToKeep.push (data.results[i].BackupLogId);
                    backupsToKeepAges.push (data.results[i].AgeDays);
                    numKeptYears++;
                }

                // check for previous backup to use for weekly, monthly, or yearly backup, only if index is past the first element
                if (i) {
                    var previousIndex = i - 1;

                    // keep last day before the week rollover to use as the weekly backup
                    if (retainWeeks &&
                        ! foundUpcomingWeeklyBackup &&
                        data.results[i].AgeDays >= 7) {
                        backupsToKeep.push (data.results[previousIndex].BackupLogId);
                        backupsToKeepAges.push (data.results[previousIndex].AgeDays);
                        foundUpcomingWeeklyBackup = true;
                    }

                    // keep last day before the month rollover to use as the monthly backup
                    if (retainMonths &&
                        ! foundUpcomingMonthlyBackup &&
                        data.results[i].AgeDays >= 30) {
                        backupsToKeep.push (data.results[previousIndex].BackupLogId);
                        backupsToKeepAges.push (data.results[previousIndex].AgeDays);
                        foundUpcomingMonthlyBackup = true;
                    }

                    // keep last day before the year rollover to use as the yearly backup
                    if (retainYears &&
                        ! foundUpcomingYearlyBackup &&
                        data.results[i].AgeDays >= 365) {
                        backupsToKeep.push (data.results[previousIndex].BackupLogId);
                        backupsToKeepAges.push (data.results[previousIndex].AgeDays);
                        foundUpcomingYearlyBackup = true;
                    }

                }

                // set the final backup if needed
                if (i === data.numResults - 1) {

                    if (retainWeeks &&
                    ! foundUpcomingWeeklyBackup) {
                        backupsToKeep.push (data.results[i].BackupLogId);
                        backupsToKeepAges.push (data.results[i].AgeDays);
                        foundUpcomingWeeklyBackup = true;
                    }

                    if (retainMonths &&
                        ! foundUpcomingMonthlyBackup) {
                        backupsToKeep.push (data.results[i].BackupLogId);
                        backupsToKeepAges.push (data.results[i].AgeDays);
                        foundUpcomingMonthlyBackup = true;
                    }

                    if (retainYears &&
                        ! foundUpcomingYearlyBackup) {
                        backupsToKeep.push (data.results[i].BackupLogId);
                        backupsToKeepAges.push (data.results[i].AgeDays);
                        foundUpcomingYearlyBackup = true;
                    }

                }

            }

            // find the list of backups to remove
            var backupsToDelete = [];
            for (var i = 0; i < data.numResults; i++) {
                if (backupsToKeep.indexOf(data.results[i].BackupLogId) < 0)
                    backupsToDelete.push (data.results[i].BackupLogId);
            }

            // log expected activity
            base.logAndDisplayMessage (sprintf ("Keeping backup schedules: %s with respective daily ages of: %s.",
                backupsToKeep.join (", "),
                backupsToKeepAges.join (", ")));
            base.logAndDisplayMessage (sprintf ("Removing backup schedules: %s.",
                backupsToDelete.join (", ")));

            // loop through delete candidates to perform deletion
            for (var i = 0; i < backupsToDelete.length; i++) {

                // validate required data to be absolutely sure will not delete root
                if (! base.schedule.PathLocalDropoff || ! base.schedule.HostName || ! backupsToDelete[i]) {
                    base.logAndDisplayError (sprintf ("Could not remove backup because required path data is missing for either local path [%s], host name [%s], or backup log [%s].",
                        base.schedule.PathLocalDropoff,
                        base.schedule.HostName,
                        backupsToDelete[i]));
                }

                var backupDirectory = sprintf ("%s/%s/%s", base.schedule.PathLocalDropoff, base.schedule.HostName, backupsToDelete[i]);

                // check that the base backup directory exists and create if doesn't
                if (! fs.existsSync (backupDirectory)) {
                    base.logAndDisplayError (sprintf ("Could not remove backup %s at %s because the directory does not exist.", backupsToDelete[i], backupDirectory));
                    //database.query.backuplogs.updateAsDeleted(backupsToDelete[i], function (data) {});
                    base.backupLogsToMarkAsDeleted.push (backupsToDelete[i]);
                    continue;
                }

                // delete the directory
                utils.deleteDirectoryRecursive (backupDirectory);

                // check that the directory was deleted
                if (fs.existsSync (backupDirectory)) {
                    base.logAndDisplayError (sprintf ("Could not remove backup %s at %s due to an unknown file system error.", backupsToDelete[i], backupDirectory));
                    continue;
                }

                base.backupLogsToMarkAsDeleted.push (backupsToDelete[i]);
                base.logAndDisplayMessage (sprintf ("Successfully removed backup from %s.", backupDirectory));

            }

            base.logAndDisplayMessage (sprintf ("Completing backup management for schedule %s.", base.schedule.ScheduleId));

            callback ();

        });

    },

    // Sets deleted status on all backups that were removed from the file system.
    // callback (no params)
    markManagedBackupDeletionsAsDeleted: function (callback) {

        if (! base.backupLogsToMarkAsDeleted.length) return callback ();

        var backupLogId = base.backupLogsToMarkAsDeleted.shift ();
        database.query.backuplogs.updateAsDeleted(backupLogId, function (data) {
            if (data.error) base.logAndDisplayError (sprintf ("Could not set deleted status on backup log %s. The related files have already been removed from the file system.", backupLogId));
            base.markManagedBackupDeletionsAsDeleted (callback);
        });

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
