'use strict';

const OpenAI = require('openai');

let clientInstance = null;

function getLLMClient() {
  if (!clientInstance) {
    clientInstance = new OpenAI({
      baseURL: process.env.LLM_BASE_URL || 'https://api.deepseek.com',
      apiKey: process.env.LLM_API_KEY || 'missing-api-key'
    });
  }
  return clientInstance;
}

async function chatCompletion({
  systemPrompt,
  userPrompt,
  temperature = 0.2,
  jsonMode = false,
  maxTokens = null
}) {
  if (!process.env.LLM_API_KEY) {
    throw new Error('LLM_API_KEY no está configurada en backend/.env');
  }

  const client = getLLMClient();
  const payload = {
    model: process.env.LLM_MODEL || 'deepseek-chat',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    temperature
  };

  if (maxTokens) {
    payload.max_tokens = maxTokens;
  }

  if (jsonMode) {
    payload.response_format = { type: 'json_object' };
  }

  const response = await client.chat.completions.create(payload);
  return response.choices?.[0]?.message?.content || '';
}

module.exports = {
  getLLMClient,
  chatCompletion
};

