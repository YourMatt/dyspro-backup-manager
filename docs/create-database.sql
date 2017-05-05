
CREATE DATABASE DysproBackupManager;
USE DysproBackupManager;

CREATE TABLE Servers
(            ServerId INT AUTO_INCREMENT PRIMARY KEY
,            HostName VARCHAR(100) NOT NULL
,            UserName VARCHAR(100) NOT NULL
,            PathSSHKeyFile VARCHAR(500) NOT NULL
,            UNIQUE (HostName));

CREATE TABLE Schedules
(            ScheduleId INT AUTO_INCREMENT PRIMARY KEY
,            ServerId INT NOT NULL
,            Name VARCHAR(100)
,            PathLocalDropoff VARCHAR(500) NOT NULL
,            PathServerPickup VARCHAR(500) NOT NULL
,            ManageLocalBackups BIT NOT NULL DEFAULT 0
,            DeleteServerPickups BIT NOT NULL DEFAULT 0
,            FOREIGN KEY (ServerId) REFERENCES Servers(ServerId) ON DELETE CASCADE);

CREATE TABLE BackupLog
(            BackupLogId INT AUTO_INCREMENT PRIMARY KEY
,            ScheduleId INT NOT NULL
,            DateStart DATETIME NOT NULL
,            DateFinish DATETIME
,            StatusMessage VARCHAR(2000)
,            FOREIGN KEY (ScheduleId) REFERENCES Schedules(ScheduleId) ON DELETE CASCADE);

CREATE TABLE BackupLogFiles
(            BackupLogFileId INT AUTO_INCREMENT PRIMARY KEY
,            BackupLogId INT NOT NULL
,            FileName VARCHAR(250) NOT NULL
,            FileSize BIGINT UNSIGNED NOT NULL
,            DateCreated DATETIME NOT NULL
,            DateDeleted DATETIME
,            FOREIGN KEY (BackupLogId) REFERENCES BackupLog(BackupLogId) ON DELETE CASCADE);

SHOW TABLES;