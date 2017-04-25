
CREATE DATABASE DysproBackupManager;
USE DysproBackupManager;

CREATE TABLE Servers
(            ServerId INT AUTO_INCREMENT PRIMARY KEY
,            HostName VARCHAR(100) NOT NULL
,            UserName VARCHAR(100) NOT NULL
,            SSHKeyFileLocation VARCHAR(500) NOT NULL
,            UNIQUE (HostName));

CREATE TABLE Schedules
(            ScheduleId INT AUTO_INCREMENT PRIMARY KEY
,            ServerId INT NOT NULL
,            ServerPickupDirectoryLocation VARCHAR(500) NOT NULL
,            LocalDropoffDirectoryLocation VARCHAR(500) NOT NULL
,            CleanupLocalBackups BIT NOT NULL DEFAULT 0
,            DeleteServerPickupFiles BIT NOT NULL DEFAULT 0
,            FOREIGN KEY (ServerId) REFERENCES Servers(ServerId));

CREATE TABLE BackupLog
(            BackupLogId INT AUTO_INCREMENT PRIMARY KEY
,            ScheduleId INT NOT NULL
,            DateStart DATETIME NOT NULL
,            DateFinish DATETIME
,            FOREIGN KEY (ScheduleId) REFERENCES Schedules(ScheduleId));

CREATE TABLE BackupLogFiles
(            BackupLogFileId INT AUTO_INCREMENT PRIMARY KEY
,            BackupLogId INT NOT NULL
,            FileName VARCHAR(250) NOT NULL
,            FileSize BIGINT UNSIGNED NOT NULL
,            DateCreated DATETIME NOT NULL
,            DateDeleted DATETIME
,            FOREIGN KEY (BackupLogId) REFERENCES BackupLog(BackupLogId));

SHOW TABLES;