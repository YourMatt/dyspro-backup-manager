#!/usr/bin/env nodejs

// load configuration values
require ("dotenv").config();

var shell = require ("./shell.js")
,   utils = require ("./utils.js");

// display temporary output
console.log ("Backup");

shell.writeLog ("Started backup process.");
