const minimist = require("minimist")

const args = minimist(process.argv.slice(2))

args["port"]
args["debug"]
args["log"]

// See what is stored in the object produced by minimist
console.log(args)
// Store help text 
const help = (`
server.js [options]

--port	Set the port number for the server to listen on. Must be an integer
            between 1 and 65535.

--debug	If set to true, creates endlpoints /app/log/access/ which returns
            a JSON access log from the database and /app/error which throws 
            an error with the message "Error test successful." Defaults to 
            false.

--log		If set to false, no log files are written. Defaults to true.
            Logs are always written to database.

--help	Return this message and exit.
`)
// If --help or -h, echo help text to STDOUT and exit
if (args.help || args.h) {
    console.log(help)
    process.exit(0)
}

const database = require('better-sqlite3');
const logdb = new database('log.db');

const debug = args.debug || false;
const log = args.log || true;
const port = args.port || 5555;

// Require Express.js
const express = require('express');
const { symlinkSync } = require("fs");
const { exit } = require("process");
const app = express();
const fs = require('fs');
const morgan = require('morgan');

const stmt = logdb.prepare(`SELECT name FROM sqlite_master WHERE type='table' and name='accesslog';`);
let row = stmt.get();
if (row === undefined) {
    console.log('Log database appears to be empty. Creating log database...')

    const sqlInit = `
        CREATE TABLE accesslog (  
            remoteaddr VARCHAR, 
            remoteuser VARCHAR, 
            time VARCHAR, 
            method VARCHAR, 
            url VARCHAR, 
            protocol VARCHAR,
            httpversion NUMERIC, 
            secure VARCHAR,
            status INTEGER, 
            content_length NUMERIC,
            referer VARCHAR,
            useragent VARCHAR
        );
    `

    logdb.exec(sqlInit)
} else {
    console.log('Log database exists.')
}

// Start an app server
const server = app.listen(port, () => {
    console.log('App listening on port %PORT%'.replace('%PORT%', port))
});

app.use( (req, res, next) => {
    let logdata = {
        remoteaddr: req.ip,
        remoteuser: req.user,
        time: Date.now(),
        method: req.method,
        url: req.url,
        protocol: req.protocol,
        httpversion: req.httpVersion,
        secure: req.secure,
        status: res.statusCode,
        content_length: req.content_length,
        referer: req.headers['referer'],
        useragent: req.headers['user-agent']
    }
    const stmt = logdb.prepare('INSERT INTO accesslog VALUES (?, ?, ?, ? ,? ,?, ?, ?, ?, ? ,? ,?)');
    stmt.run(logdata.remoteaddr, logdata.remoteuser, logdata.time, logdata.method, logdata.url, logdata.protocol, logdata.httpversion, logdata.secure + "", logdata.status, logdata.content_length, logdata.referer, logdata.useragent);
    next(logdata);
})

if (debug === 'true') {
    // Returns all records in the 'accesslog' table
    app.get('/app/logs/access', (req, res) => {
        try {
            const stmt = logdb.prepare('SELECT * FROM accesslog').all();
            res.status(200).json(stmt);
        } catch (e) {
            console.error(e)
        }
    });
    // Returns an error
    app.get('/app/error', (req, res) => {
      throw new Error('Error Test Successful')
    });
}


if (log === 'true') {
  // Use morgan for logging to files
  // Create a write stream to append (flags: 'a') to a file
  const WRITESTREAM = fs.createWriteStream('access.log', { flags: 'a' })
  // Set up the access logging middleware
  app.use(morgan('combined', { stream: WRITESTREAM }))
}