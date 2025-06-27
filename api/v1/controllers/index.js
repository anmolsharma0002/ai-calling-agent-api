const { OpenAI } = require('openai');
const twilio = require('twilio');
const axios = require('axios');
const createError = require('http-errors');
const env = require('../../../environment');
const elevenlabsService = require('../services/elevenlabs');

const openai = new OpenAI({
    apiKey: env.openai_api_key,
});

// const twilioClient = twilio(env.twilio_account_sid, env.twilio_secret_key);
const twilioClient = twilio(env.twilio_account_sid, env.twilio_auth_token);

const callHistory = {}; // Simple in-memory chat memory


// const elevenlabsService = {
//     textToSpeech: async (text) => {
//     //   const voiceId = process.env.ELEVENLABS_VOICE_ID;
//     //   const apiKey = process.env.ELEVENLABS_API_KEY;
  
//       const response = await axios.post(
//         `https://api.elevenlabs.io/v1/text-to-speech/${env.elevenlabs_voice_id}/stream`,
//         { text },
//         {
//           headers: {
//             'xi-api-key': env.elevenlabs_api_key,
//             'Content-Type': 'application/json',
//           },
//           responseType: 'arraybuffer',
//         }
//       );
  
//       return Buffer.from(response.data);
//     },
//   };

  
exports.index = (req, res) => {
    res.status(200).json({
        success: true,
        message: 'Welcome to the AI Calling Agent',
        version: process.env.API_VERSION
    });
};

exports.createCall = async (req, res, next) => {
    try {
        const { to } = req.body;

        if (!to) throw createError.BadRequest('Phone number is required');

        console.log(`[You have a Free account we are creating a call to: ${to} stay tuned...`)
        const call = await twilioClient.calls.create({
            to,
            from: env.twilio_phone_number,
            url: `${env.ngrok_url}/api/v1/voice`,
            statusCallback: `${env.ngrok_url}/api/v1/call-status`,
            statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
            statusCallbackMethod: 'POST'
        });

        res.status(200).json({
            success: true,
            message: 'Call initiated successfully',
            data: {
                callSid: call.sid,
                status: call.status
            }
        });
    } catch (error) {
        console.error('Create Call Error:', error);
        next(error);
    }
};

exports.voice = async (req, res) => {
    console.log('📞 /voice webhook hit');
  
    try {
      const twiml = new twilio.twiml.VoiceResponse();
  
      // 1. Use built-in TTS for initial greeting (more reliable for demo)
      twiml.say({
        voice: "polly.Amy", //'alice', // Try different voices: alice, polly.Amy, etc.
        language: 'en-US'
      }, "Hello! This is your AI assistant. How can I help you today?");
  
      console.log(`Speech Rendering...`);
      // 2. Use Gather for speech input instead of Record
      const gather = twiml.gather({
        input: 'speech',
        action: '/api/v1/process-speech', // New endpoint to handle speech
        method: 'POST',
        speechTimeout: 10, // Wait 3 seconds for speech
        speechModel: 'experimental_conversations', // Better for dialog
        enhanced: true
      });
      
      console.log('Gather: ', gather);
      console.log(`Timeout...`);
      // 3. Add timeout instructions
      gather.say('I didn\'t hear anything. Please try again.');
      twiml.redirect('/api/v1/voice');
  
      res.type('text/xml').send(twiml.toString());
  
    } catch (error) {
      console.error('❌ Error in /voice:', error);
      const fallbackTwiml = new twilio.twiml.VoiceResponse()
      fallbackTwiml.say("Sorry, we're having technical difficulties. Please try again later.");
      res.type('text/xml').send(fallbackTwiml.toString());
    }
  };
  
  // Add this new endpoint to handle speech processing
  exports.processSpeech = async (req, res) => {
    console.log('🎤 /process-speech webhook hit');
    const twiml = new twilio.twiml.VoiceResponse()
    const speechResult = req.body.SpeechResult;
  
    try {
      if (!speechResult) {
        twiml.say("I didn't catch that. Please try again.");
        twiml.redirect('/api/v1/voice');
        return res.type('text/xml').send(twiml.toString());
      }
  
      console.log('🗣️ User said:', speechResult);
  
      // 4. Process with OpenAI
      const completion = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{
          role: 'user',
          content: speechResult
        }],
        max_tokens: 100
      });
  
      const aiResponse = completion.choices[0].message.content;
      console.log('🤖 AI Response:', aiResponse);
  
      // 5. Use ElevenLabs only for AI response
      const audioBuffer = await elevenlabsService.textToSpeech(aiResponse);
      
      // 6. Host audio temporarily (simplified for demo)
      // In production, use cloud storage like S3
      const audioUrl = `${env.ngrok_url}/temp-audio.mp3`;
      // Here you would save the buffer to a public URL
      
      twiml.play(audioUrl);
  
      // 7. Continue conversation
      const gather = twiml.gather({
        input: 'speech',
        action: '/api/v1/process-speech',
        method: 'POST',
        speechTimeout: 5
      });
      gather.say('What else can I help you with?');
  
      res.type('text/xml').send(twiml.toString());
  
    } catch (error) {
      console.error('❌ Error in processSpeech:', error);
      twiml.say("Sorry, I had trouble processing that. Let's try again.");
      twiml.redirect('/api/v1/voice');
      res.type('text/xml').send(twiml.toString());
    }
  };


/** ------- Working ( MP3) ------- */
// exports.voice = async (req, res) => {
//     try {
//       console.log(`[Voice Test] Incoming call...`);
  
//       const twiml = new twilio.twiml.VoiceResponse();
  
//       // OPTION A: Test with known public MP3 URL
//       // Confirm Twilio audio works
//       twiml.play({}, 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3');
  
//       // OPTION B: Use local MP3 file (for base64 testing)
//       // const fs = require('fs');
//       // const audioBuffer = fs.readFileSync('./test-greeting.mp3');
//       // twiml.play({}, `data:audio/mpeg;base64,${audioBuffer.toString('base64')}`);
  
//       res.type('text/xml');
//       res.send(twiml.toString());
  
//     } catch (error) {
//       console.error('[Voice Test Error]', error);
//       res.status(500).send('Internal Error');
//     }
//   };

exports.continue = async (req, res, next) => {
    try {
        console.log('[Webhook Body]', JSON.stringify(req.body, null, 2));
        const twiml = new twilio.twiml.VoiceResponse();
        // Now start the AI conversation as before:
        const greeting = "How can I help you today?";
        const audioBuffer = await elevenlabsService.textToSpeech(greeting);
        twiml.play({}, `data:audio/mpeg;base64,${audioBuffer.toString('base64')}`);
        twiml.record({
            maxLength: 30,
            transcribe: true,
            transcribeCallback: `${env.ngrok_url}/api/v1/transcribe`,
            playBeep: false
        });
        res.type('text/xml');
        res.send(twiml.toString());
    } catch (error) {
        next(error);
    }
};

exports.voiceFallback = (req, res) => {
    console.log('[Webhook Body]', JSON.stringify(req.body, null, 2));
    console.log('[Voice Fallback In-progress]')
    const twiml = new twilio.twiml.VoiceResponse();
    console.log('No Response from the user')
    twiml.say("We didn't receive any input. Goodbye!");
    console.log('hangup call');
    twiml.hangup();
    res.type('text/xml');
    res.send(twiml.toString());
  };


  exports.transcribe = async (req, res, next) => {
    try {
      console.log('✅ Transcribe Endpoint Hit');
      console.log('[Headers]', JSON.stringify(req.headers, null, 2));
      console.log('[Body]', JSON.stringify(req.body, null, 2));
  
      const userText = req.body.TranscriptionText;
      const callSid = req.body.CallSid;
  
      if (!userText) {
        console.warn('⚠️ No TranscriptionText received.');
        return res.status(200).send('No speech input.');
      }
  
      console.log(`[🗣️ User]: (${callSid}):`, userText);
  
      // Setup call memory
      if (!callHistory[callSid]) {
        callHistory[callSid] = [
          { role: 'system', content: 'You are a helpful AI agent for a company. Keep answers short and human-like.' },
        ];
      }
  
      callHistory[callSid].push({ role: 'user', content: userText });
  
      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: callHistory[callSid],
        max_tokens: 150,
      });
  
      const aiResponse = response.choices[0].message.content;
      callHistory[callSid].push({ role: 'assistant', content: aiResponse });
  
      console.log(`[🤖 AI]:`, aiResponse);
  
      const audioBuffer = await elevenlabsService.textToSpeech(aiResponse);
  
      const twiml = new twilio.twiml.VoiceResponse();
      twiml.play({}, `data:audio/mpeg;base64,${audioBuffer.toString('base64')}`);
      twiml.record({
        maxLength: 30,
        transcribe: true,
        transcribeCallback: `${env.ngrok_url}/api/v1/transcribe`,
        playBeep: false,
      });
  
      // Optionally log conversation
      const fs = require('fs');
      fs.appendFileSync(`logs/${callSid}.txt`, `User: ${userText}\nAI: ${aiResponse}\n`);
  
      res.type('text/xml');
      res.send(twiml.toString());
    } catch (error) {
      console.error('❌ Transcribe Error:', error);
      res.status(500).send('Internal Error');
    }
  };

exports.callStatus = (req, res) => {
    // const { CallSid, CallStatus } = req.body;
    // console.log(`Call ${CallSid} status: ${CallStatus}`);
    // res.status(200).send('OK');

    const { CallSid, CallStatus, From, To,  Timestamp } = req.body;

    console.log(`[📞 Status] Time: ${Timestamp}, CallSid: ${CallSid}, From: ${From}, To: ${To}, Status: ${CallStatus}`);

    // Optionally save to DB or log file
    // fs.appendFileSync(`logs/status_${CallSid}.txt`, `Status: ${CallStatus} | From: ${From} | To: ${To}\n`);

    res.status(200).send('OK');
};