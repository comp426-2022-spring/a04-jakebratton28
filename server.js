const minimist = require("minimist")

const args = minimist(process.argv.slice(2))

args["port"]
args["help"]
args["debug"]
args["log"]

const help = args.help;

if (help !== undefined) {
    console.log(help);
    process.exit(0);
}

const database = require("better-sqlite3");
const logdb = new database("logdb");

const debug = args.debug;
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
        referer: req.headers['referer'],
        useragent: req.headers['user-agent']
    }
    const stmt = logdb.prepare(`SELECT name FROM sqlite_master WHERE type='table' and name='accesslog';`);
    const log = stmt.run(logdata);
    next();
})

if (debug === 'true') {
    // Returns all records in the 'accesslog' table
    app.get('/app/logs/access', (req, res) => {
        try {
            const stmt = logdb.prepare('SELECT * FROM accesslog');
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