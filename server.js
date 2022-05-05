const minimist = require("minimist")

const args = minimist(process.argv.slice(2))

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

const logdb = require('./database.js');

const debug = args.debug || false;
const log = args.log || true;
const port = args.port || 5555;

// Require Express.js
const express = require('express');
const app = express();
const fs = require('fs');
const morgan = require('morgan');

app.use(express.json());
app.use(express.urlencoded({extended: true}));

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
        status: res.statusCode,
        referer: req.headers['referer'],
        useragent: req.headers['user-agent']
    }
    console.log(logdata);
    const stmt = logdb.prepare('INSERT INTO accesslog (remoteaddr, remoteuser, time, method, url, protocol, httpversion, status, referer, useragent) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    const x = stmt.run(logdata.remoteaddr, logdata.remoteuser, logdata.time, logdata.method, logdata.url, logdata.protocol, logdata.httpversion, logdata.status, logdata.referer, logdata.useragent);
    next();
})

if (debug) {
    // Returns all records in the 'accesslog' table
    app.get('/app/log/access', (req, res, next) => {
        const stmt = logdb.prepare('SELECT * FROM accesslog').all();
        res.status(200).json(stmt);
    });
    // Returns an error
    app.get('/app/error', (req, res, next) => {
      throw new Error('Error Test Successful');
    });
}


if (log !== 'false') {
  // Use morgan for logging to files
  // Create a write stream to append (flags: 'a') to a file
  const accesslog = fs.createWriteStream('access.log', { flags: 'a' })
  // Set up the access logging middleware
  app.use(morgan('combined', { stream: accesslog }))


}

app.get('/app/',(req,res, next) => {
   
    res.json({"message":"your API works! (200)"});
    res.status(200).end('200 OK')
})
