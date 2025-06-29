const fs = require('fs');
const path = require('path');

function cleanupSessionAudio(callSid) {
  // const sessionPath = path.resolve(__dirname, `../public/audio/${callSid}`);
  // fs.rm(sessionPath, { recursive: true, force: true }, (err) => {
  //   if (err) {
  //     console.error(`❌ Failed to delete audio folder for session ${callSid}:`, err);
  //   } else {
  //     console.log(`✅ Cleaned up audio folder for session ${callSid}`);
  //   }
  // });
  return ;
}

module.exports = cleanupSessionAudio;
