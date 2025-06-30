// utils/logger.js
const fs = require('fs');
const path = require('path');

const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir);
}

function logUserDetails(callSid, data) {
  const logFilePath = path.join(logsDir, 'appointments.txt');
  const logData = {
    callSid,
    timestamp: new Date().toISOString(),
    ...data
  };

  fs.appendFileSync(logFilePath, JSON.stringify(logData) + '\n');
  console.log(`[📄 Logged] ${callSid}`);
}

module.exports = { logUserDetails };