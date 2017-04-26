# dyspro-backup-manager

_NOTICE: THIS IS CURRENTLY IN DEVELOPMENT. DO NOT USE._ 

## Synopsis
This is a command-line utility for creating offsite backups which pull from external servers and place on a local
network.

## Motivation
I wanted to automate backups from my server environment to be stored offsite onto my own home network. At the same time,
I wanted a single solution that would also manage the backups themselves so that recent backups were kept in close
intervals while only milestone backups (weekly, monthly, yearly) would be kept as time moves on. With additional
notification enhancements in mind, I decided that a robust custom program would be better than using standard shell
commands with cron.

For me, this is intended to run on a Raspberry Pi hardwired to my router, which pulls files from several servers, and
passes the backups to my NAS over an SMB mount. This could be used in a variety of other configurations. View the Usage
instructions below for limitations.

## Installation

### Dependencies

#### Client
*   NodeJS
*   NPM
*   MySQL (Client-only if database resides elsewhere)
*   SSH Client

#### Server
*   SSH using Key-Based Authentication

### Database
This requires a MySQL database to manage server connections, backups schedules, and provide a log of backup activity.

1.  Create the database user that this will use.
2.  Run the docs/create-database.sql script.

### Shell Scripts

1.  From your home directory (or any other location), clone this repo.
2.  Move into `./dyspro-backup-manager`.
3.  Run `npm install -g`. The `dysprobackup` and `dysprobackupmanage` commands should now be accessible for command line
or CronTab use. _If you plan on editing this code, you may want to use `npm link` so that changes to the source are 
reflected by any global use of the shell commands._
4.  Copy or move the `.env.sample` file to `.env`.
5.  Adjust the values within `.env` to match your environment.

## Usage
This includes two utilities. The `dysprobackup` command will perform the backup operations, while the 
`dysprobackupmanage` command will allow management of the backup schedules and logs.

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

`dysprobackupmanage servers update -n host_name -u ssh_user_name -k /path/to/ssh/private/key/file`
Updates an existing server matching the host name.

`dysprobackupmanage servers delete -n host_name`  
Unregisters a server. Any schedules related to the server will be deleted after confirmation.

## License
This project is licensed under the MIT License - see the LICENSE file for details.