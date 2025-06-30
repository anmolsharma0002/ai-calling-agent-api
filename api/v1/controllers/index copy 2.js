const { OpenAI } = require('openai');
const twilio = require('twilio');
const axios = require('axios');
const createError = require('http-errors');
const env = require('../../../environment');
const elevenlabsService = require('../services/elevenlabs');

const { CohereClient } = require('cohere-ai');


const cohere = new CohereClient({
  token: env.cohere_api_key, // or env.cohere_api_key
});

/** ----- 429 Error Showing ----- Using Deepseek -----  */
// const openai = new OpenAI({
//     apiKey: env.openai_api_key,
// });

/** ---- Twiml ----- */
const voiceAndLanguage = {
    voice: "polly.Amy",
    language: 'en-IN'
}

// const twilioClient = twilio(env.twilio_account_sid, env.twilio_secret_key);
const twilioClient = twilio(env.twilio_account_sid, env.twilio_auth_token);

const callHistory = {}; // Simple in-memory chat memory
  
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
    
    try {
        
        console.log('voice webhook calling...');
        const twiml = new twilio.twiml.VoiceResponse();
        twiml.say(voiceAndLanguage, "Hello! This is your AI assistant. How can I help you today?");
        // 1. Greet and listen for speech input
        twiml.gather({
            input: 'speech',
            action: '/api/v1/process-speech',
            method: 'POST',
            speechTimeout: 10, // Waits up to 10 seconds
            timeout: 10, // Also fallback if no speech
            speechModel: 'experimental_conversations',
            enhanced: true
        });

        twiml.say(voiceAndLanguage, "Please say something");
        // 2. After timeout (no speech), hang up gracefully
        twiml.say(voiceAndLanguage, "No response received. Goodbye.");
        twiml.hangup();

        res.type('text/xml').send(twiml.toString());
  
    } catch (error) {
      console.error('❌ Error in /voice:', error);
      const fallbackTwiml = new twilio.twiml.VoiceResponse()
      fallbackTwiml.say(voiceAndLanguage, "Sorry, we're having technical difficulties. Please try again later.");
      res.type('text/xml').send(fallbackTwiml.toString());
    }
  };
  
 

exports.processSpeech = async (req, res) => {
    console.log('🎤 /process-speech webhook hit');
    const twiml = new twilio.twiml.VoiceResponse();
    const speechResult = req.body.SpeechResult;
  
    if (!speechResult) {
    twiml.say("I didn't catch that. Please try again.");
    twiml.redirect('/api/v1/voice');
    return res.type('text/xml').send(twiml.toString());
  }

  try {
    console.log(`🗣️ User: ${speechResult}`);

    const prompt = `You are an AI assistant for Arogya Clinic. Help users with:
        - Booking appointments
        - Doctor timings and availability
        - Clinic address

        Do not provide medical advice.

        User: ${speechResult}
        Assistant:`;

    const response = await cohere.generate({
      model: 'command-r-plus',
      prompt,
      max_tokens: 150,
      temperature: 0.7
    });

    const aiResponse = response.generations[0].text.trim();
    console.log('🤖 AI Response:', aiResponse);

    twiml.say(voiceAndLanguage, aiResponse);

    twiml.gather({
      input: 'speech',
      action: '/api/v1/process-speech',
      method: 'POST',
      speechTimeout: 10, // Waits up to 10 seconds
      timeout: 10, // Also fallback if no speech
      speechModel: 'experimental_conversations',
      enhanced: true
  });

    twiml.say(voiceAndLanguage, 'What else can I help you with?');

    res.type('text/xml').send(twiml.toString());

  } catch (error) {
    console.error('❌ processSpeech Error:', error.message || error.response?.data);
    twiml.say("Sorry, I'm having trouble responding. Let's try again.");
    twiml.hangup();
    res.type('text/xml').send(twiml.toString());
  }
  };

  exports.transcribe = async (req, res) => {
    try {
      console.log('✅ Transcribe Endpoint Hit');
      console.log('[Headers]', JSON.stringify(req.headers, null, 2));
      console.log('[Body]', JSON.stringify(req.body, null, 2));
  
      const userText = req.body.TranscriptionText;
      const callSid = req.body.CallSid;
        
      console.log(`[UserText]`, userText);
      console.log(`[CallSid]`, callSid);

      if (!userText) {
        console.warn('⚠️ No TranscriptionText received.');
        return res.status(200).send('No speech input.');
      }
  
      console.log(`[User]: (${callSid}):`, userText);
      
      // Setup conversation history
      if (!callHistory[callSid]) {
        callHistory[callSid] = [
          { role: 'system', content: 'You are a helpful AI assistant for a clinic. Keep replies human-like and short.' },
        ];
      }
  
      callHistory[callSid].push({ role: 'user', content: userText });
  
      // // 🌟 Use DeepSeek API here instead of OpenAI
      // const deepSeekResponse = await axios.post(
      //   'https://api.deepseek.com/v1/chat/completions',
      //   {
      //     model: 'deepseek-chat', // Or any other available DeepSeek model
      //     messages: callHistory[callSid],
      //     temperature: 0.7,
      //     max_tokens: 150
      //   },
      //   {
      //     headers: {
      //       'Authorization': `Bearer ${env.deepseek_api_key}`,
      //       'Content-Type': 'application/json'
      //     }
      //   }
      // );
      // const aiResponse = await deepSeekResponse.data.choices[0].message.content;
      // callHistory[callSid].push({ role: 'assistant', content: aiResponse });

      const response = await openai.chat.completions.create({
                model: 'gpt-4o',
                messages: callHistory[callSid],
                max_tokens: 150,
              });

      const aiResponse = response.choices[0].message.content;
  
      console.log(`[🤖 AI]:`, aiResponse);
  
      // 🎙️ Convert AI response to speech
      const audioBuffer = await elevenlabsService.textToSpeech(aiResponse);
  
      // 🌀 Build TwiML to respond with audio and record again
      const twiml = new twilio.twiml.VoiceResponse();
      twiml.play({}, `data:audio/mpeg;base64,${audioBuffer.toString('base64')}`);
      twiml.record({
        maxLength: 30,
        transcribe: true,
        transcribeCallback: `${env.ngrok_url}/api/v1/transcribe`,
        playBeep: false,
        timeout: 5
      });
  
      // 📝 Log
    //   fs.appendFileSync(`logs/${callSid}.txt`, `User: ${userText}\nAI: ${aiResponse}\n`);
  
      res.type('text/xml');
      res.send(twiml.toString());
  
    } catch (error) {
      console.error('❌ Transcribe Error:', error.response?.data || error.message);
      const fallbackTwiml = new twilio.twiml.VoiceResponse();
      fallbackTwiml.say('Sorry, I had trouble responding. Let\'s try again.');
      fallbackTwiml.hangup();
      res.type('text/xml');
      res.send(fallbackTwiml.toString());
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




//   exports.transcribe = async (req, res, next) => {
//     try {
//       console.log('✅ Transcribe Endpoint Hit');
//       console.log('[Headers]', JSON.stringify(req.headers, null, 2));
//       console.log('[Body]', JSON.stringify(req.body, null, 2));
  
//       const userText = req.body.TranscriptionText;
//       const callSid = req.body.CallSid;
        
//       if (!userText) {
//         console.warn('⚠️ No TranscriptionText received.');
//         return res.status(200).send('No speech input.');
//       }
  
//       console.log(`[🗣️ User]: (${callSid}):`, userText);
  
//       // Setup call memory
//       if (!callHistory[callSid]) {
//         callHistory[callSid] = [
//           { role: 'system', content: 'You are a helpful AI agent for a company. Keep answers short and human-like.' },
//         ];
//       }
      
//       callHistory[callSid].push({ role: 'user', content: userText });
//       const twiml = new twilio.twiml.VoiceResponse();

//       const response = await openai.chat.completions.create({
//         model: 'gpt-4o',
//         messages: callHistory[callSid],
//         max_tokens: 150,
//       });
      
//       const aiResponse = response.choices[0].message.content;
//       callHistory[callSid].push({ role: 'assistant', content: aiResponse });
  
//       console.log(`[🤖 AI]:`, aiResponse);
  
//       const audioBuffer = await elevenlabsService.textToSpeech(aiResponse);
//         if (audioBuffer) {
//             twiml.play({}, `data:audio/mpeg;base64,${audioBuffer.toString('base64')}`);
//         } else {
//             twiml.say({ voice: 'polly.Amy' }, aiResponse); // Fallback to Polly voice
//         }
     
//     //   twiml.play({}, `data:audio/mpeg;base64,${audioBuffer.toString('base64')}`);
//       twiml.record({
//         maxLength: 30,
//         transcribe: true,
//         transcribeCallback: `${env.ngrok_url}/api/v1/transcribe`,
//         playBeep: false,
//       });
  
//     //   // Optionally log conversation
//     //   const fs = require('fs');
//     //   fs.appendFileSync(`logs/${callSid}.txt`, `User: ${userText}\nAI: ${aiResponse}\n`);
  
//       res.type('text/xml');
//       res.send(twiml.toString());
//     } catch (error) {
//     //   console.error('❌ Transcribe Error:', error);
//     //   res.status(500).send('Internal Error');
//       console.error('Fallback error:', error);
//       twiml.say('Sorry, I am facing a technical issue. Please try again later.');
//       twiml.hangup();
//       return res.type('text/xml').send(twiml.toString());
//     }
//   };



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

// exports.voiceFallback = (req, res) => {
//     console.log('[Webhook Body]', JSON.stringify(req.body, null, 2));
//     console.log('[Voice Fallback In-progress]')
//     const twiml = new twilio.twiml.VoiceResponse();
//     console.log('No Response from the user')
//     twiml.say("We didn't receive any input. Goodbye!");
//     console.log('hangup call');
//     twiml.hangup();
//     res.type('text/xml');
//     res.send(twiml.toString());
//   };



 // Add this new endpoint to handle speech processing
//   exports.processSpeech = async (req, res) => {
//     console.log('🎤 /process-speech webhook hit');
//     const twiml = new twilio.twiml.VoiceResponse()
//     const speechResult = req.body.SpeechResult;
  
//     try {
//       if (!speechResult) {
//         twiml.say("I didn't catch that. Please try again.");
//         twiml.redirect('/api/v1/voice');
//         return res.type('text/xml').send(twiml.toString());
//       }
  
//       console.log('🗣️ User said:', speechResult);
  
//       // 4. Process with OpenAI
//       const completion = await openai.chat.completions.create({
//         model: 'gpt-3.5-turbo',
//         messages: [{
//           role: 'user',
//           content: speechResult
//         }],
//         max_tokens: 100
//       });
  
//       const aiResponse = completion.choices[0].message.content;
//       console.log('🤖 AI Response:', aiResponse);
  
//       // 5. Use ElevenLabs only for AI response
//       const audioBuffer = await elevenlabsService.textToSpeech(aiResponse);
      
//       // 6. Host audio temporarily (simplified for demo)
//       // In production, use cloud storage like S3
//       const audioUrl = `${env.ngrok_url}/temp-audio.mp3`;
//       // Here you would save the buffer to a public URL
      
//       twiml.play(audioUrl);
  
//       // 7. Continue conversation
//       const gather = twiml.gather({
//         input: 'speech',
//         action: '/api/v1/process-speech',
//         method: 'POST',
//         speechTimeout: 5
//       });
//       gather.say('What else can I help you with?');
  
//       res.type('text/xml').send(twiml.toString());
  
//     } catch (error) {
//       console.error('❌ Error in processSpeech:', error);
//       twiml.say("Sorry, I had trouble processing that. Let's try again.");
//       twiml.redirect('/api/v1/voice');
//       res.type('text/xml').send(twiml.toString());
//     }
//   };