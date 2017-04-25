
CREATE DATABASE DysproBackupManager;
USE DysproBackupManager;

CREATE TABLE Servers
(            ServerId INT AUTO_INCREMENT PRIMARY KEY
,            ServerName VARCHAR(100) NOT NULL
,            UserName VARCHAR(100) NOT NULL
,            SSHKeyFileLocation VARCHAR(500) NOT NULL);

CREATE TABLE Schedules
(            ScheduleId INT AUTO_INCREMENT PRIMARY KEY
,            ServerId INT NOT NULL
,            PickupDirectoryLocation VARCHAR(500) NOT NULL
,            DropoffDirectoryLocation VARCHAR(500) NOT NULL
,            CleanupBackups BIT NOT NULL DEFAULT 0
,            DeletePickupFiles BIT NOT NULL DEFAULT 0
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