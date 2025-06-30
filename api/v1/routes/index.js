const express = require('express');
const router = express.Router();

/** --- Define controller --- */
const controller = require('../controllers');

router.get('/', controller.index); // Basic health/info check
router.post('/create-call', controller.createCall); // Starts the call
router.post('/voice', controller.voice); // Twilio hits this at call start
router.post('/process-speech', controller.processSpeech); // Handles speech replies
router.post('/test-speech', controller.testSpeech);

router.post('/call-status', controller.callStatus); // Logs Twilio call status
router.post('/test-elevenlabs', controller.testElevenLabs); // Logs Twilio call status

module.exports = router;