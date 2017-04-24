# dyspro-backup-manager

## Synopsis
A command line utility for creating offsite backups to a local network from a server environment.

## Installation

### Database

This requires a MySQL database to manage server connections, backups schedules, and provide a log of backup activity.

1.  Create the database user that this will use.
2.  Run the docs/create-database.sql script.