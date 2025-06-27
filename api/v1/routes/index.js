const express = require('express');
const router = express.Router();

/** --- Define controller --- */
const controller = require('../controllers/index');


router.get('/', controller.index);
router.post('/create-call', controller.createCall);
router.post('/voice', controller.voice);
router.post('/transcribe', controller.transcribe);
router.post('/call-status', controller.callStatus);
router.post('/continue', controller.continue);
router.post('/voice-fallback', controller.voiceFallback);
router.post('/process-speech', controller.processSpeech);

module.exports = router;