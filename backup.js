#!/usr/bin/env nodejs

// load configuration values
require ("dotenv").config();

// include libraries
var async = require ("async")
,   shell = require ("./shell.js")
,   utils = require ("./utils.js")
,   backupmanager = require ("./backupmanager.js")
,   schedulemanager = require ("./schedulemanager.js")
,   sprintf = require ("util").format;

// mark process as started in log file
shell.writeLog ("STARTING BACKUP PROCESS ----------------------------------------------------------------------------"); // header line will total 120 chars including date

// load all schedules and start process
schedulemanager.loadSchedules (function () {
    ProcessNextSchedule (schedulemanager.schedules);
});

// process the next schedule
function ProcessNextSchedule (schedules) {

    // if no remaining schedules, close the log and return
    if (utils.valueIsEmpty (schedules)) {
        shell.writeLog ("Backup process complete.");
        return;
    }

    // TODO: Add method to check that a backup schedule isn't already running, by checking latest finish date in log table

    // pull the next schedule and start processing
    backupmanager.schedule = schedules.shift ();
    async.series ([
        backupmanager.logBackupStart,
        backupmanager.getBackupFileList,
        backupmanager.createBackupDirectory,
        backupmanager.processFileBackup,
        backupmanager.logBackupComplete,
        function () {
            ProcessNextSchedule (schedules);
        }
    ]);

}
