#!/usr/bin/env nodejs

// load configuration values
require ("dotenv").config({path: "/etc/dysprobackup.conf"});

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

    // pull the next schedule and start processing
    backupmanager.schedule = schedules.shift ();
    async.series ([
        backupmanager.init,
        backupmanager.checkIfScheduleCurrentlyRunning,
        backupmanager.logBackupStart,
        backupmanager.getBackupFileList,
        backupmanager.createBackupDirectory,
        backupmanager.processFileBackup,
        backupmanager.logBackupComplete,
        backupmanager.processBackupManagement,
        backupmanager.markManagedBackupDeletionsAsDeleted
        ],
        function () {
            ProcessNextSchedule (schedules);
        }
    );

}
