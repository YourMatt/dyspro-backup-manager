#!/usr/bin/env nodejs

// load configuration values
require ("dotenv").config();

var shell = require ("./shell.js")
,   utils = require ("./utils.js")
,   schedulemanager = require ("./schedulemanager.js")
,   sprintf = require ("util").format;

shell.writeLog ("Started backup process.");

schedulemanager.loadSchedules (function () {

    while (schedulemanager.schedules.length) {
        var schedule = schedulemanager.schedules.shift ();

        shell.getCopyFileList (
            schedule.PathSSHKeyFile,
            schedule.HostName,
            schedule.UserName,
            schedule.PathServerPickup,
            function (fileType, fileList, error) {
                if (!utils.valueIsEmpty(error)) {
                    var errorMessage = sprintf ("Error retrieving file list for schedule %s: %s", schedule.ScheduleId, error);
                    shell.writeLog (errorMessage);
                    return utils.outputError (errorMessage);
                }

                utils.outputSuccess ("start");
                utils.output (fileType);
                utils.output (fileList);
                utils.outputSuccess("fin");

            }
        );

        continue;

        shell.copyFiles (
            schedule.PathSSHKeyFile,
            schedule.HostName,
            schedule.UserName,
            schedule.PathServerPickup + "/*", // TODO: Include /* only if a directory
            schedule.PathLocalDropoff + "/" + schedule.HostName, // TODO: Create directory if doesn't exist
            function (message) {

                console.log (message);

                var numFiles = 5;

                shell.writeLog (sprintf (
                "Completed backup using schedule %s, %s %s file%s from %s%s to local %s.",
                schedule.ScheduleId,
                (schedule.DeleteServerPickups) ? "moving" : "copying",
                numFiles,
                (numFiles == 1) ? "" : "s",
                schedule.HostName,
                schedule.PathServerPickup,
                schedule.PathLocalDropoff
                ));

            }
        )
    }

});