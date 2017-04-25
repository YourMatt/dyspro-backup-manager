#!/usr/bin/env nodejs

// load configuration values
require ("dotenv").config();

// include libraries
var database = require ("./database.js");

// display temporary output
console.log ("Manage");

// make sample call to database
database.query.getServers(function (data) {
    console.log (data);
});
