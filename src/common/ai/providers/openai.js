const OpenAI = require('openai');
const WebSocket = require('ws');

/**
 * Creates an OpenAI STT session
 * @param {object} opts - Configuration options
 * @param {string} opts.apiKey - OpenAI API key
 * @param {string} [opts.language='en'] - Language code
 * @param {object} [opts.callbacks] - Event callbacks
 * @returns {Promise<object>} STT session
 */
async function createSTT({ apiKey, language = 'en', callbacks = {}, ...config }) {
  const wsUrl = 'wss://api.openai.com/v1/realtime?intent=transcription';

  const headers = {
    'Authorization': `Bearer ${apiKey}`,
    'OpenAI-Beta': 'realtime=v1',
  };

  const ws = new WebSocket(wsUrl, { headers });

  return new Promise((resolve, reject) => {
    ws.onopen = () => {
      console.log("WebSocket session opened.");

      const sessionConfig = {
        type: 'transcription_session.update',
        session: {
          input_audio_format: 'pcm16',
          input_audio_transcription: {
            model: 'gpt-4o-mini-transcribe',
            prompt: config.prompt || '',
            language: language || 'en'
          },
          turn_detection: {
            type: 'server_vad',
            threshold: 0.5,
            prefix_padding_ms: 50,
            silence_duration_ms: 25,
          },
          input_audio_noise_reduction: {
            type: 'near_field'
          }
        }
      };
      
      ws.send(JSON.stringify(sessionConfig));
      
      resolve({
        sendRealtimeInput: (audioData) => {
          if (ws.readyState === WebSocket.OPEN) {
            const message = {
              type: 'input_audio_buffer.append',
              audio: audioData
            };
            ws.send(JSON.stringify(message));
          }
        },
        close: () => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'session.close' }));
            ws.close(1000, 'Client initiated close.');
          }
        }
      });
    };

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (callbacks && callbacks.onmessage) {
        callbacks.onmessage(message);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error.message);
      if (callbacks && callbacks.onerror) {
        callbacks.onerror(error);
      }
      reject(error);
    };

    ws.onclose = (event) => {
      console.log(`WebSocket closed: ${event.code} ${event.reason}`);
      if (callbacks && callbacks.onclose) {
        callbacks.onclose(event);
      }
    };
  });
}

/**
 * Creates an OpenAI LLM instance
 * @param {object} opts - Configuration options
 * @param {string} opts.apiKey - OpenAI API key
 * @param {string} [opts.model='gpt-4.1'] - Model name
 * @param {number} [opts.temperature=0.7] - Temperature
 * @param {number} [opts.maxTokens=2048] - Max tokens
 * @returns {object} LLM instance
 */
function createLLM({ apiKey, model = 'gpt-4.1', temperature = 0.7, maxTokens = 2048, ...config }) {
  const client = new OpenAI({ apiKey });
  
  const callApi = async (messages) => {
    const response = await client.chat.completions.create({
      model: model,
      messages: messages,
      temperature: temperature,
      max_tokens: maxTokens
    });
    return {
      content: response.choices[0].message.content.trim(),
      raw: response
    };
  };

  return {
    generateContent: async (parts) => {
      const messages = [];
      let systemPrompt = '';
      let userContent = [];
      
      for (const part of parts) {
        if (typeof part === 'string') {
          if (systemPrompt === '' && part.includes('You are')) {
            systemPrompt = part;
          } else {
            userContent.push({ type: 'text', text: part });
          }
        } else if (part.inlineData) {
          userContent.push({
            type: 'image_url',
            image_url: { url: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}` }
          });
        }
      }
      
      if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
      if (userContent.length > 0) messages.push({ role: 'user', content: userContent });
      
      const result = await callApi(messages);

      return {
        response: {
          text: () => result.content
        },
        raw: result.raw
      };
    },
    
    // For compatibility with chat-style interfaces
    chat: async (messages) => {
      return await callApi(messages);
    }
  };
}

/**
 * Creates an OpenAI streaming LLM instance
 * @param {object} opts - Configuration options
 * @param {string} opts.apiKey - OpenAI API key
 * @param {string} [opts.model='gpt-4.1'] - Model name
 * @param {number} [opts.temperature=0.7] - Temperature
 * @param {number} [opts.maxTokens=2048] - Max tokens
 * @returns {object} Streaming LLM instance
 */
function createStreamingLLM({ apiKey, model = 'gpt-4.1', temperature = 0.7, maxTokens = 2048, ...config }) {
  return {
    streamChat: async (messages) => {
      const fetchUrl = 'https://api.openai.com/v1/chat/completions';
      
      const headers = {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      };

      const response = await fetch(fetchUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: model,
          messages,
          temperature,
          max_tokens: maxTokens,
          stream: true,
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
      }

      return response;
    }
  };
}

module.exports = {
  createSTT,
  createLLM,
  createStreamingLLM
}; 