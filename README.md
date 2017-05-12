# dyspro-backup-manager

_NOTICE: THIS IS CURRENTLY IN DEVELOPMENT. DO NOT USE._ 

## Synopsis
This is a command line utility for creating offsite backups which pull from external servers and place on a local
network.

## Motivation
I wanted to automate backups from my server environment to be stored offsite onto my own home network. At the same time,
I wanted a single solution that would also manage the backups themselves so that recent backups were kept in close
intervals while only milestone backups (weekly, monthly, etc) would be kept as time moves on. With additional
notification enhancements in mind, I decided that a robust custom program would be better than using standard shell
commands with cron.

For me, this is intended to run on a Raspberry Pi hardwired to my router, which pulls files from several servers, and
passes the backups to my NAS over an SMB mount. This could be used in a variety of other configurations. View the
[Usage](#usage) instructions below for limitations.

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
2.  Run the [docs/create-database.sql](./docs/create-database.sql) script.

### Shell Scripts

1.  From your home directory (or any other location), clone this repo.
2.  Move into `./dyspro-backup-manager`.
3.  Run `npm install -g`. The `dysprobackup` and `dysprobackupmanage` commands should now be accessible for command line
use. _If you plan on editing this code, you may want to use `npm link` so that changes to the source are reflected by 
any global use of the shell commands._
4.  Move the `dysprobackup.conf.sample` file to `/etc/dysprobackup.conf`.
5.  Adjust the values within `/etc/dysprobackup.conf` to match your environment.

### Configuration File
Set the following options in `/etc/dysprobackup.conf`:

| Option | Description |
|---|---|
| DB_HOST | Database server host by dns or direct IP |
| DB_USER | User name for connecting to the database |
| DB_PASSWORD | User password to database |
| DB_NAME | Name of database |
| LOG_FILE | Absolute path to the log file |
| DEFAULT_RETENTION | For managed backups, that don't have a retention schedule defined, this default will be used - For details, see the [Retention Policy](#retention-policy) section |
| COLOR_ERROR | Console text color when any error is encountered |
| COLOR_SUCCESS | Conole text color when success status is displayed |
| COLOR_TABLE_BORDER | Console color for table borders |
| COLOR_TABLE_HEADING | Console text color for table headings |

## Usage
This includes two utilities. The `dysprobackup` command will perform the backup operations, while the 
`dysprobackupmanage` command will allow management of the backup schedules and logs.

### dysprobackupmanage
Manage all backup operations. None of this is necessary for the `dysprobackup` command to work as long as all data are 
available within the database. This does include some niceties by validating that connections can be made and that all 
paths exist.

`dysprobackupmanage -h`  
View help file for full list of options.

#### Manage Servers
Manage server connections that backup operations can be assigned against.

`dysprobackup manage servers`

| Option | Description |
|---|---|
| -h --help | View help |
| -n --hostname | Host name in format of _sub.primary.tld_ |
| -u --username | SSH user name |
| -k --sshkey | Local absolute path to SSH private key file |

`dysprobackupmanage servers -h`  
View help file for server operations.

`dysprobackupmanage servers list`  
Display all registered servers.

`dysprobackupmanage servers test [-n host_name]`  
Test SSH connectivity to all registered servers. If the host name is provided, only this host will be tested.

`dysprobackupmanage servers add -n host_name -u ssh_user_name -k /path/to/ssh/private/key/file`  
Register a new server. This will also validate the connection and add to known_hosts if necessary.

`dysprobackupmanage servers update -n host_name -u ssh_user_name -k /path/to/ssh/private/key/file`  
Update an existing server matching the host name.

`dysprobackupmanage servers delete -n host_name`  
Unregister a server. Any schedules related to the server will be deleted after confirmation.

#### Manage Schedules
Manages the backup operations to be executed whenever the `dysprobackup` command is run.

`dysprobackup manage schedules`

| Option | Description |
|---|---|
| -h --help | View help |
| -n --hostname | Host name in format of _sub.primary.tld_ - host name must already be a registered server when used against a schedule |
| -r --remotepath | Remote absolute path to directory or file to pick up when running the backup schedule - If a directory, only real files in the directory will be picked up, non-recursive |
| -l --localpath | Local absolute path to the directory to place the backup file(s) after downloading |
| -d --deleteremote | If provided for add or update operations, will cause the schedule to remove any remote files after downloading |
| -m --managelocal | If provided for add or update operations, will cause the downloaded files to be cleaned out in accordance of the retention policy - This will use the default from dysprobackup.conf if retention schedule is not provided - See the [Retention Schedule](#retention-schedule) section for format |
| -i --id | The schedule ID to reference in update, delete, test, and list operations |

`dysprobackupmanage schedules -h`  
View help file for the schedule operations.

`dysprobackupmanage schedules list [-n host_name] [-i schedule_id]`  
Display all backup schedule operations. If the host name is provided, only operations related to this host will be
displayed.

`dysprobackupmanage schedules test [-n host_name] [-i schedule_id]`  
Test that remote and local paths are accessible for all backup schedules. If the host name is provided, only operations
related to this host will be tested. If the schedule ID is provided, only this specific backup operation will be tested.

`dysprobackupmanage schedules add -n host_name -r /remote/pickup/path -l /local/dropoff/path [-d] [-m [y0,m0,w0,d0]]`  
Register a new backup operation. This will also validate that paths are accessible. If using the delete remote files
option (-d) or the manage local files option (-m), you will be prompted to confirm, as these are potentially destructive
options.

`dysprobackupmanage schedules update -i schedule_id -n host_name -r /remote/pickup/path -l /local/dropoff/path [-d] [-m [y0,m0,w0,d0]]`  
Update an existing backup operation. If not known, first use the list action to find the schedule ID.  

`dysprobackupmanage schedules delete -i schedule_id`  
Unregister a backup operation.

### dysprobackup
Runs all schedules. This is meant to be assigned to a cron job, but can also be run directly. All ouput is sent to
screen if running directly, and only sent to the log file if automated.

Backup files will be placed in [local folder base]/[host name]/[log id]/

#### Running Under Cron
The registered command of `dysprobackup` does not properly run under cron. To schedule backups, should instead use node
to run the script.

`0 0 * * * nodejs /home/user/scripts/dyspro-backup-manager/backup.js`

## Retention Policy
Schedules can be set to manage the backups, ensuring that disk space isn't wasted on backups that no longer have any
value. Each time the `dysprobackup` command runs, schedules marked with `--managelocal` will be subject to cleanup.

### Format
Both the default in `dysprobackup.conf` and any schedules should follow the following format:

`y0,m0,w0,d0`

Each numeral represents the number of backups to retain for the most recent number of years, months, weeks, and days,
respectively.

## License
This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.