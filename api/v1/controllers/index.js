const twilio = require('twilio');
const createError = require('http-errors');
const env = require('../../../environment');
const { CohereClient } = require('cohere-ai');
const elevenlabsService = require('../services/elevenlabs');
const prompts = require('../../../utils/prompts');
const cleanupSessionAudio = require('../../../utils/cleanupSessionAudio');

const chatMemory = {}; // Simple in-memory session-based memory

const cohere = new CohereClient({
  token: env.cohere_api_key,
});

const voiceAndLanguage = {
  voice: 'polly.Amy',
  language: 'en-IN'
};

const twilioClient = twilio(env.twilio_account_sid, env.twilio_auth_token);

// Function to play audio on call using ElevenLabs
async function playOnCall(text, callSid) {
  try {
    // console.log(`🎵 Generating speech for: "${text}"`);
    const audioUrl = await elevenlabsService.generateSpeech(text, callSid);
    console.log(`✅ Audio generated: ${audioUrl}`);
    return audioUrl;
  } catch (error) {
    console.error('❌ playOnCall error:', error);
    // Fallback to Twilio's built-in speech
    throw error
  }
}

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

// exports.voice = async (req, res) => {
//   try {
//     console.log('Voice webhook triggered...', req.body);
//     const callSid = req.body.CallSid || 'default';
//     const twiml = new twilio.twiml.VoiceResponse();

//     // Instead of speaking anything static, just listen
//     twiml.gather({
//       input: 'speech',
//       action: '/api/v1/process-speech',
//       method: 'POST',
//       speechTimeout: 2,
//       timeout: 10,
//       speechModel: 'experimental_conversations',
//     });

//     // Optionally a fallback in case user doesn't speak at all
//     let twilioGreetings = "Hello! This is Roy from Rekvi Technologies. Please let me know how can I assist you today.";
    
//     // Try to use ElevenLabs for better voice quality
//     const audioUrl = await playOnCall(twilioGreetings, callSid);
//     if (audioUrl) {
//       twiml.play(audioUrl);
//     } else {
//       // Fallback to Twilio's built-in speech
//       twiml.say(voiceAndLanguage, twilioGreetings);
//     }

//     // twiml.redirect('/api/v1/voice');
//     // twiml.hangup();
//     res.type('text/xml').send(twiml.toString());
//   } catch (error) {
//     console.error('Voice error:', error);
//     const fallback = new twilio.twiml.VoiceResponse();
//     fallback.say(voiceAndLanguage, 'Something went wrong. Please try again later.');
//     fallback.hangup();
//     res.type('text/xml').send(fallback.toString());
//   }
// };

exports.voice = async (req, res) => {
  const callSid = req.body.CallSid || 'default';
  const twiml = new twilio.twiml.VoiceResponse();
  try {
    console.log('Voice webhook triggered...', req.body);

    let twilioGreetings = "Hello! This is Roy from Rekvi Technologies. Please let me know how can I assist you today.";

    // Try to generate high-quality speech using ElevenLabs
    let audioUrl = await playOnCall(twilioGreetings, callSid);
    twiml.play(audioUrl);

    // After greeting, listen for user input
    twiml.gather({
      input: 'speech',
      action: '/api/v1/process-speech',
      method: 'POST',
      speechTimeout: 2,
      timeout: 10,
      speechModel: 'experimental_conversations',
    });

    res.type('text/xml').send(twiml.toString());

  } catch (error) {
    console.error('Voice error:', error);
    let audioUrl = await playOnCall('Something went wrong. Please try call us later.', callSid);
    twiml.play(audioUrl);
    twiml.hangup();
    cleanupSessionAudio(callSid)
    res.type('text/xml').send(twiml.toString());
  }
};


exports.processSpeech = async (req, res) => {
  console.log('🎤 /process-speech webhook hit');

  const twiml = new twilio.twiml.VoiceResponse();
  
  console.log(req.body);

  const speechResult = (req.body.SpeechResult || '').toLowerCase();
  const callSid = req.body.CallSid || 'default';

  const exitPhrases = [
    'see you', 'see you later', 'hang up', 'bye', 
    'talk soon', 'not interested', 'no thank you', 'goodbye', `no i don't want to schedule`
  ];

  const shouldExit = exitPhrases.some(phrase => speechResult.includes(phrase));

  if (!speechResult || shouldExit) {
    let closingMessage = `Thank you for calling Rekvi Technologies. If you'd like to know more, feel free to reach out again — I'll be happy to assist you.`
    let getClosingMessageAudio = await playOnCall(closingMessage, callSid);
    twiml.play(getClosingMessageAudio);

    twiml.hangup();
    cleanupSessionAudio(callSid)
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
    const hangupKeywords = ['appointment has been scheduled', `we'll remind you`, 'no problem at all', 'feel free to ask'];

    const isFinalResponse = hangupKeywords.some(k => aiReply.toLowerCase().includes(k));

    // Try to use ElevenLabs for better voice quality
    const aiReplyAudio = await playOnCall(aiReply, callSid);
    twiml.play(aiReplyAudio);

    if (isFinalResponse) {
      twiml.hangup();
      cleanupSessionAudio(callSid)
    } else {
      twiml.gather({
        input: 'speech',
        action: '/api/v1/process-speech',
        method: 'POST',
        speechTimeout: 2,
        timeout: 10,
        speechModel: 'experimental_conversations',
      });

      let systemAsk = 'How else may I help you?'
      let getSystemAudioURL = await playOnCall(systemAsk, callSid);
      twiml.play(getSystemAudioURL);
    }

    res.type('text/xml').send(twiml.toString());

  } catch (error) {
    console.error('❌ AI Processing Error:', error.message || error.response?.data);
    // twiml.say("");
    let getErrorAudio = await playOnCall(`Sorry, I'm having trouble responding. Let's try again.`, callSid);
    twiml.play(getErrorAudio);

    twiml.hangup();
    cleanupSessionAudio(callSid)
    res.type('text/xml').send(twiml.toString());
  } 
};

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

exports.testElevenLabs = async (req, res) => {
  try {
    const { text = 'Hello from ElevenLabs', sessionId = 'test' } = req.body;
    const audioUrl = await elevenlabsService.generateSpeech(text, sessionId);
    res.status(200).json({ success: true, audioUrl });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.callStatus = (req, res) => {
    const { CallSid, CallStatus, From, To,  Timestamp } = req.body;

    console.log(`[📞 Status] Time: ${Timestamp}, CallSid: ${CallSid}, From: ${From}, To: ${To}, Status: ${CallStatus}`);

    // Optionally save to DB or log file
    // fs.appendFileSync(`logs/status_${CallSid}.txt`, `Status: ${CallStatus} | From: ${From} | To: ${To}\n`);

    res.status(200).send('OK');
};