const fs = require('fs');
const path = require('path');

const logPath = path.join(__dirname, '../BackendTest/app.log');
const logStream = fs.createWriteStream(logPath, { flags: 'a' });

function log(message) {
  const time = new Date().toISOString();
  logStream.write(`[${time}] ${message}\n`);
}

function loggingMiddleware(req, res, next) {
  const startTime = Date.now();
  log(`Request: ${req.method} ${req.originalUrl}`);

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    log(`Response: ${res.statusCode} ${req.method} ${req.originalUrl} [${duration}ms]`);
  });

  next();
}

module.exports = { log, loggingMiddleware };
