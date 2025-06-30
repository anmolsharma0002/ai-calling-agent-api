# AI Calling Agent For Rekvi Technologies

This project is a Node.js App for an AI-driven calling agent that uses Twilio for telephony, Cohere for AI chat, and ElevenLabs for high-quality text-to-speech. It enables real-time phone conversations, processes user speech, generates smart replies, and responds with natural-sounding audio.

## Features
- **AI-powered phone conversations**
- **Twilio integration** for inbound/outbound calls
- **Cohere AI** for chat and intent handling
- **ElevenLabs** for realistic voice responses
- **Session-based memory** for multi-turn conversations
- **Audio file management** and cleanup

## Project Structure
```
ai-calling-agent-api/
├── api/
│   └── v1/
│       ├── controllers/
│       ├── routes/
│       └── services/
├── models/
├── public/
│   └── audio/
├── utils/
├── app.js
├── environment.js
├── package.json
```

## Setup
1. **Clone the repository**
2. **Install dependencies**
   ```bash
   npm install
   ```
3. **Set up environment variables**
   - Copy `.env.example` to `.env` and fill in your keys:
     ```env
     PORT=8080
     API_VERSION=v1
     OPENAI_API_KEY=your-openai-key
     COHERE_API_KEY=your-cohere-key
     TWILIO_ACCOUNT_SID=your-twilio-sid
     TWILIO_AUTH_TOKEN=your-twilio-auth
     TWILIO_PHONE_NUMBER=your-twilio-number
     ELEVENLABS_API_KEY=your-elevenlabs-key
     ELEVENLABS_VOICE_ID=your-elevenlabs-voice-id
     NGROK_URL=https://your-ngrok-url
     ```
4. **Run the server**
   ```bash
   npm run dev
   ```

## API Endpoints
- `POST /api/v1/voice` — Twilio webhook for call start
- `POST /api/v1/process-speech` — Handles user speech and AI response
- `POST /api/v1/call-status` — Logs call status
- `POST /api/v1/test-elevenlabs` — Test ElevenLabs TTS

## ElevenLabs Integration
- Audio files are generated per session in `public/audio/<callSid>/`
- Files are served at `/audio/<callSid>/<filename>.mp3`
- Uses the ElevenLabs API for high-quality speech

## Twilio Integration
- Handles incoming calls and webhooks
- Plays AI-generated audio or falls back to Twilio TTS
- Uses Gather for speech input

## Audio Cleanup
- After a call ends, session audio files are cleaned up automatically

## License
MIT 