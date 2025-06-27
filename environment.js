const env = {
    port: process.env.PORT || 3000,
    api_version: process.env.API_VERSION || 'v1',

    openai_api_key: process.env.OPENAI_API_KEY,
    twilio_account_sid: process.env.TWILIO_ACCOUNT_SID,
    twilio_secret_key: process.env.TWILIO_SECRET_KEY,
    twilio_phone_number: process.env.TWILIO_PHONE_NUMBER,
    twilio_auth_token: process.env.TWILIO_AUTH_TOKEN,
    elevenlabs_api_key: process.env.ELEVENLABS_API_KEY,
    elevenlabs_voice_id: process.env.ELEVENLABS_VOICE_ID || 'pNInz6obpgDQGcFmaJgB', // Default Indian male voice ID
    ngrok_url: process.env.NGROK_URL
}

module.exports = env;
