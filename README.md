# dyspro-backup-manager

## Synopsis
A command line utility for creating offsite backups to a local network from a server environment.

## Installation

### Dependencies

*   NodeJS
*   NPM
*   MySQL
*   SSH

### Database
This requires a MySQL database to manage server connections, backups schedules, and provide a log of backup activity.

1.  Create the database user that this will use.
2.  Run the docs/create-database.sql script.

### Shell Scripts

1.  From your home directory (or any other location), clone this repo.
2.  Move into `./dyspro-backup-manager`.
3.  Run `npm install -g`. The `dysprobackup` and `dysprobackupmanage` commands should now be accessible for command line or CronTab use. _If you plan on editing this code, you may want to use `npm link` so that changes to the source are reflected by any global use of the shell commands._
4.  Copy or move the `.env.sample` file to `.env`.
5.  Adjust the values within `.env` to match your environment.

## Usage
This includes two utilities. The `dysprobackup` command will perform the backup operations, while the `dysprobackupmanage` command will allow management of the backup schedules and logs.

### dysprobackupmanage

`dysprobackupmanage -h`  
View help file for full list of options.

#### Manage Servers

`dysprobackupmanage servers -h`  
View help file for server operations.

`dysprobackupmanage servers list`  
Display all registered servers.

`dysprobackupmanage servers test [-n host_name]`  
Test SSH connectivity to all registered servers. If the host name is provided, only this host will be tested.

`dysprobackupmanage servers add -n host_name -u ssh_user_name -k /path/to/ssh/private/key/file`  
Register a new server. This will also validate the connection and add to known_hosts if necessary.

`dysprobackupmanage servers delete -n host_name`  
Unregisters a server. Any schedules related to the server will be deleted after confirmation.