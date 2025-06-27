const axios = require('axios');
const env = require('../../../environment');

class ElevenLabsService {
    constructor() {
        this.apiKey = env.elevenlabs_api_key;
        this.voiceId = env.elevenlabs_voice_id;
        this.baseUrl = 'https://api.elevenlabs.io/v1';
    }

    // async textToSpeech(text) {
    //     try {
    //         const response = await axios({
    //             method: 'POST',
    //             url: `${this.baseUrl}/text-to-speech/${this.voiceId}`,
    //             headers: {
    //                 'Accept': 'audio/mpeg',
    //                 'Content-Type': 'application/json',
    //                 'xi-api-key': this.apiKey
    //             },
    //             data: {
    //                 text,
    //                 model_id: 'eleven_monolingual_v1',
    //                 voice_settings: {
    //                     stability: 0.5,
    //                     similarity_boost: 0.5
    //                 }
    //             },
    //             responseType: 'arraybuffer'
    //         });

    //         return response.data;
    //     } catch (error) {
    //         console.error('ElevenLabs TTS Error:', error.response?.data || error.message);
    //         throw error;
    //     }
    // }
        async textToSpeech(text){
            try {
                const response = await axios.post(
                  'https://api.elevenlabs.io/v1/text-to-speech/vO7hjeAjmsdlGgUdvPpe/stream',
                  { text },
                  {
                    headers: {
                      'xi-api-key': this.apiKey, // or directly put your key for testing
                      'Content-Type': 'application/json',
                      'Accept': 'audio/mpeg'
                    },
                    responseType: 'arraybuffer'
                  }
                );
            
                return Buffer.from(response.data);
              } catch (error) {
                console.error('[ElevenLabs TTS Error]', error?.response?.data || error.message);
                throw error;
              }
        };
}

module.exports = new ElevenLabsService(); 