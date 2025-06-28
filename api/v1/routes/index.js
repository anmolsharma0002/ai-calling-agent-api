const express = require('express');
const router = express.Router();

/** --- Define controller --- */
const controller = require('../controllers');


// router.get('/', controller.index); // Basic health/info check
router.post('/create-call', controller.createCall); // Starts the call
router.post('/voice', controller.voice); // Twilio hits this at call start
router.post('/process-speech', controller.processSpeech); // Handles speech replies
router.post('/capture-name', controller.captureName);
router.post('/capture-address', controller.captureAddress);
router.post('/check-availability', controller.checkAvailability);
router.post('/call-status', controller.callStatus); // Logs Twilio call status
// router.post('/transcribe', controller.transcribe); // ❌ Not needed (you're not recording)
// router.post('/continue', controller.continue); // ❌ Not used in new flow
// router.post('/voice-fallback', controller.voiceFallback); // ❌ Not triggered in gather flow

module.exports = router;