const fs = require('fs');
const path = require('path');
const { ElevenLabsClient } = require('@elevenlabs/elevenlabs-js');
const { Readable } = require('stream');
const env = require('../../../environment');

class ElevenLabsService {
  constructor() {
    this.apiKey = env.elevenlabs_api_key;
    this.voiceId = env.elevenlabs_voice_id;
    this.client = new ElevenLabsClient({ apiKey: this.apiKey });
  
    // // Ensure audio directory exists
    // this.audioDir = path.resolve(__dirname, '../../../public/audio');
    // if (!fs.existsSync(this.audioDir)) {
    //   fs.mkdirSync(this.audioDir, { recursive: true });
    // }
  }

  async generateSpeech(text, sessionId) {
    try {

      const sessionDir = path.resolve(__dirname, `../../../public/audio/${sessionId}`);

      if (!fs.existsSync(sessionDir)) {
        fs.mkdirSync(sessionDir, { recursive: true });
      }

      const fileName = `${Date.now()}.mp3`;
      const outputPath = path.join(sessionDir, fileName);

      // const fileName = `${sessionId}_${Date.now()}.mp3`;
      // const outputPath = path.join(this.audioDir, fileName);

      const audioStream = await this.client.textToSpeech.stream(this.voiceId, {
        text,
        modelId: 'eleven_multilingual_v2', // works across multiple languages
        voiceSettings: {
          stability: 0.5,
          similarityBoost: 0.5
        }
      });

      const writeStream = fs.createWriteStream(outputPath);
      Readable.from(audioStream).pipe(writeStream);

      return new Promise((resolve, reject) => {
        writeStream.on('finish', () => {
          const publicUrl = `${env.ngrok_url}/audio/${sessionId}/${fileName}`;
          // console.log(`✅ Audio saved to: ${outputPath}`);
          // console.log(`🌐 Public URL: ${publicUrl}`);
          resolve(publicUrl);
        });
        writeStream.on('error', (error) => {
          console.error('❌ Write stream error:', error);
          reject(error);
        });
      });

    } catch (error) {
      console.error('🛑 ElevenLabs Error:', error.message || error);
      throw new Error('Failed to generate speech from ElevenLabs');
    }
  }
}

module.exports = new ElevenLabsService();
