// const { OpenAI } = require('openai');
const twilio = require('twilio');
// const axios = require('axios');

const createError = require('http-errors');
const env = require('../../../environment');
// const elevenlabsService = require('../services/elevenlabs');
const { CohereClient } = require('cohere-ai');
const { doctors, availableSlots } = require('../../../data/doctors');
const { getDoctorAvailableSlots, findDoctorAvailability } = require('../../../utils/timeSlots');
const prompts = require('../../../utils/prompts');
const { logUserDetails } = require('../../../utils/logger');

const chatMemory = {}; // Simple in-memory session-based memory

const cohere = new CohereClient({
  token: env.cohere_api_key,
});

const voiceAndLanguage = {
  voice: 'polly.Amy',
  language: 'en-IN'
};

const twilioClient = twilio(env.twilio_account_sid, env.twilio_auth_token);
const userDetails = {};

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

    console.log(`[Initiating call to: ${to}]`);

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
    console.log('Voice webhook triggered...');
    const twiml = new twilio.twiml.VoiceResponse();

     // Instead of speaking anything static, just listen
    twiml.gather({
      input: 'speech',
      action: '/api/v1/process-speech',
      method: 'POST',
      speechTimeout: 2,
      timeout: 10
    });

    // Optionally a fallback in case user doesn’t speak at all
    twiml.say(voiceAndLanguage, 'Hello! This is Ruhi from Rekvi Technologies. Please let me know how can I assist you today.');
    twiml.redirect('/api/v1/voice');

    res.type('text/xml').send(twiml.toString());

    // twiml.say(voiceAndLanguage, 'Hello! I am Ruhi an AI assistant I will help you to book an appointment with doctors, May I know your name?');

    // twiml.gather({
    //   input: 'speech',
    //   action: '/api/v1/process-speech',
    //   // action: '/api/v1/capture-name',
    //   method: 'POST',
    //   speechTimeout: 2,
    //   timeout: 10
    // });

    // res.type('text/xml').send(twiml.toString());
  } catch (error) {
    console.error('Voice error:', error);
    const fallback = new twilio.twiml.VoiceResponse();
    fallback.say(voiceAndLanguage, 'Something went wrong. Please try again later.');
    fallback.hangup();
    res.type('text/xml').send(fallback.toString());
  }
};

exports.captureName = async (req, res) => {
  const name = req.body.SpeechResult || 'Unknown';
  const callSid = req.body.CallSid;

  userDetails[callSid] = { name };
  console.log('[Capture Name: ]', name );

  const twiml = new twilio.twiml.VoiceResponse();

  twiml.say(voiceAndLanguage, `Hi ${name}, could you please confirm me your address.`);

  twiml.gather({
    input: 'speech',
    action: '/api/v1/capture-address',
    method: 'POST',
    speechTimeout: 2,
    timeout: 10
  });

  res.type('text/xml').send(twiml.toString());
};

exports.captureAddress = async (req, res) => {
  const address = req.body.SpeechResult || 'unknown';
  const callSid = req.body.CallSid;

  if (!userDetails[callSid]) userDetails[callSid] = {};

  userDetails[callSid].address = address;

  console.log('[Capture Address: ]', address );
  const twiml = new twilio.twiml.VoiceResponse();
  twiml.say(voiceAndLanguage, 'May I know which doctor do you wants to meet?');
  twiml.gather({
    input: 'speech',
    action: '/api/v1/check-availability',
    method: 'POST',
    speechTimeout: 2,
    timeout: 10
  });

  res.type('text/xml').send(twiml.toString());
};

exports.checkAvailability = async (req, res) => {
  const input = req.body.SpeechResult || '';
  const callSid = req.body.CallSid;

  const specialtyMatch = input.match(/(dentist|pediatrician|cardiologist|orthopedic|ent|dermatologist|general physician|neurologist|gastroenterologist|psychiatrist)/i);
  const timeMatch = input.match(/(\d{1,2}:\d{2})/);

  const specialty = specialtyMatch ? specialtyMatch[0] : null;
  const time = timeMatch ? timeMatch[0] : null;

  const twiml = new twilio.twiml.VoiceResponse();

  if (!specialty || !time) {
    twiml.say(voiceAndLanguage, 'Sorry, I could not understand the specialty or time. Please try again.');
    twiml.redirect('/api/v1/voice');
    return res.type('text/xml').send(twiml.toString());
  }

  const updatedDoctors = getDoctorAvailableSlots(doctors, availableSlots);
  const result = findDoctorAvailability(updatedDoctors, specialty, time);

  if (result.error) {
    twiml.say(voiceAndLanguage, result.error);
    twiml.hangup();
  } else if (result.available) {
    // const user = userDetails[callSid] || { name: 'User', address: 'Unknown' };
    twiml.say(voiceAndLanguage, `Appointment booked with ${result.doctor} at ${result.time}. Thank you.`);
    
    // logUserDetails(callSid, {
    //   name: user.name,
    //   address: user.address,
    //   doctor: result.doctor,
    //   time: result.time
    // });
  
    // delete userDetails[callSid]; // clean memory after log

    twiml.hangup();
  } else {
    twiml.say(voiceAndLanguage, `${result.doctor} is not available at ${time}. Next available slot is ${result.time}.`);
    twiml.hangup();
  }

  res.type('text/xml').send(twiml.toString());
};
 
exports.processSpeech = async (req, res) => {
  console.log('🎤 /process-speech webhook hit');

  const twiml = new twilio.twiml.VoiceResponse();
  const speechResult = (req.body.SpeechResult || '').toLowerCase();
  const callSid = req.body.CallSid || 'default';

  const exitPhrases = [
    'see you', 'see you later', 'hang up', 'bye', 
    'talk soon', 'not interested', 'no thank you', 'goodbye', `no i don't want to schedule`
  ];

  const shouldExit = exitPhrases.some(phrase => speechResult.includes(phrase));

  if (!speechResult || shouldExit) {
    twiml.say({
      voice: 'polly.Amy',
      language: 'en-IN'
    }, 'Thank you for calling Rekvi Technologies. If you’d like to know more, feel free to reach out again — I’ll be happy to assist you.');

    twiml.hangup();
    return res.type('text/xml').send(twiml.toString());
  }

  try {
    console.log(`📞 Session [${callSid}] | User: ${speechResult}`);

    if (!chatMemory[callSid]) {
      chatMemory[callSid] = [
        {
          role: 'system',
          message: prompts.appointment(speechResult) // customize your prompt logic here
        }
      ];
    }

    chatMemory[callSid].push({
      role: 'user',
      message: speechResult
    });

    const response = await cohere.chat({
      model: 'command-r-plus',
      chatHistory: chatMemory[callSid],
      message: speechResult,
      temperature: 0.7
    });

    const aiReply = response.text.trim();
    console.log('🤖 AI Response:', aiReply);

    chatMemory[callSid].push({
      role: 'chatbot',
      message: aiReply
    });

    // Check if AI has confirmed appointment or declined it
    const hangupKeywords = ['appointment has been scheduled', 'we’ll remind you', 'no problem at all', 'feel free to ask'];

    const isFinalResponse = hangupKeywords.some(k => aiReply.toLowerCase().includes(k));

    twiml.say({ voice: 'polly.Amy', language: 'en-IN' }, aiReply);

    if (isFinalResponse) {
      twiml.hangup();
    } else {
      twiml.gather({
        input: 'speech',
        action: '/api/v1/process-speech',
        method: 'POST',
        speechTimeout: 2,
        timeout: 10
      });

      twiml.say({ voice: 'polly.Amy', language: 'en-IN' }, 'How else may I help you?');
    }

    res.type('text/xml').send(twiml.toString());

  } catch (error) {
    console.error('❌ AI Processing Error:', error.message || error.response?.data);
    twiml.say("Sorry, I'm having trouble responding. Let's try again.");
    twiml.hangup();
    res.type('text/xml').send(twiml.toString());
  }
};

// exports.processSpeech = async (req, res) => {
//   console.log('🎤 /process-speech webhook hit');
//   const twiml = new twilio.twiml.VoiceResponse();
//   const speechResult = req.body.SpeechResult;
//   // const callSid = req.body.CallSid;

//   if (!speechResult) {
//     twiml.say("I didn't catch that. Please try again.");
//     twiml.redirect('/api/v1/voice');
//     return res.type('text/xml').send(twiml.toString());
//   }

//   try {
//     console.log(`🗣️ User: ${speechResult}`);

//     const prompt = prompts.appointmentPrompt(userDetails)

//     const response = await cohere.generate({
//       model: 'command-r-plus',
//       prompt,
//       max_tokens: 150,
//       temperature: 0.7
//     });

//     const aiResponse = response.generations[0].text.trim();
//     console.log('🤖 AI Response:', aiResponse);

//     twiml.say(voiceAndLanguage, aiResponse);

//     twiml.gather({
//       input: 'speech',
//       action: '/api/v1/process-speech',
//       method: 'POST',
//       speechModel: 'experimental_conversations',
//       enhanced: true,
//       speechTimeout: 2,
//       timeout: 10
//     });

//     twiml.say(voiceAndLanguage, 'What else can I help you with?');

//     twiml.hangup();

//     res.type('text/xml').send(twiml.toString());

//   } catch (error) {
//     console.error('❌ processSpeech Error:', error.message || error.response?.data);
//     twiml.say("Sorry, I'm having trouble responding. Let's try again.");
//     twiml.hangup();
//     res.type('text/xml').send(twiml.toString());
//   }
// };



exports.testSpeech = async (req, res) => {
  const { text, sessionId = 'default' } = req.body;

  if (!text) return res.status(400).json({ success: false, message: 'Text input required' });

  try {
    console.log(`🧪 Session [${sessionId}] | User: ${text}`);

    // console.log( prompts.appointment);

    // Initialize chat history if not present
    if (!chatMemory[sessionId]) {
      chatMemory[sessionId] = [
        {
          role: 'system',
          message: prompts.appointment(text)
        }
      ];
    }

    // Append user message to history
    chatMemory[sessionId].push({
      role: 'user',
      message: text
    });

    // Call Cohere Chat API with memory
    const response = await cohere.chat({
      model: 'command-r-plus',
      chatHistory: chatMemory[sessionId],
      message: text,
      temperature: 0.7,
    });

    const aiReply = response.text.trim();

    // Append AI response to history
    chatMemory[sessionId].push({
      role: 'chatbot',
      message: aiReply
    });

    console.log('🤖 AI Response:', aiReply);

    return res.status(200).json({
      success: true,
      sessionId,
      user: text,
      response: aiReply
    });

  } catch (error) {
    console.error('❌ Chat Error:', error.message || error.response?.data);
    return res.status(500).json({
      success: false,
      message: 'Something went wrong',
      error: error.message || 'Unknown error'
    });
  }
};


exports.callStatus = (req, res) => {
    const { CallSid, CallStatus, From, To,  Timestamp } = req.body;

    console.log(`[📞 Status] Time: ${Timestamp}, CallSid: ${CallSid}, From: ${From}, To: ${To}, Status: ${CallStatus}`);

    // Optionally save to DB or log file
    // fs.appendFileSync(`logs/status_${CallSid}.txt`, `Status: ${CallStatus} | From: ${From} | To: ${To}\n`);

    res.status(200).send('OK');
};

// exports.transcribe = async (req, res) => {
//   try {
//     console.log('✅ Transcribe Endpoint Hit');
//     console.log('[Headers]', JSON.stringify(req.headers, null, 2));
//     console.log('[Body]', JSON.stringify(req.body, null, 2));

//     const userText = req.body.TranscriptionText;
//     const callSid = req.body.CallSid;
      
//     console.log(`[UserText]`, userText);
//     console.log(`[CallSid]`, callSid);

//     if (!userText) {
//       console.warn('⚠️ No TranscriptionText received.');
//       return res.status(200).send('No speech input.');
//     }

//     console.log(`[User]: (${callSid}):`, userText);
    
//     // Setup conversation history
//     if (!callHistory[callSid]) {
//       callHistory[callSid] = [
//         { role: 'system', content: 'You are a helpful AI assistant for a clinic. Keep replies human-like and short.' },
//       ];
//     }

//     callHistory[callSid].push({ role: 'user', content: userText });

//     const response = await openai.chat.completions.create({
//               model: 'gpt-4o',
//               messages: callHistory[callSid],
//               max_tokens: 150,
//             });

//     const aiResponse = response.choices[0].message.content;

//     console.log(`[🤖 AI]:`, aiResponse);

//     // 🎙️ Convert AI response to speech
//     const audioBuffer = await elevenlabsService.textToSpeech(aiResponse);

//     // 🌀 Build TwiML to respond with audio and record again
//     const twiml = new twilio.twiml.VoiceResponse();
//     twiml.play({}, `data:audio/mpeg;base64,${audioBuffer.toString('base64')}`);
//     twiml.record({
//       maxLength: 30,
//       transcribe: true,
//       transcribeCallback: `${env.ngrok_url}/api/v1/transcribe`,
//       playBeep: false,
//       timeout: 5
//     });

//     // 📝 Log
//   //   fs.appendFileSync(`logs/${callSid}.txt`, `User: ${userText}\nAI: ${aiResponse}\n`);

//     res.type('text/xml');
//     res.send(twiml.toString());

//   } catch (error) {
//     console.error('❌ Transcribe Error:', error.response?.data || error.message);
//     const fallbackTwiml = new twilio.twiml.VoiceResponse();
//     fallbackTwiml.say('Sorry, I had trouble responding. Let\'s try again.');
//     fallbackTwiml.hangup();
//     res.type('text/xml');
//     res.send(fallbackTwiml.toString());
//   }
// };



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