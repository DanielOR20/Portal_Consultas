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

async function chatWithTools({
  messages,
  tools,
  temperature = 0,
  toolChoice = 'auto',
  maxTokens = 900
}) {
  if (!process.env.LLM_API_KEY) {
    throw new Error('LLM_API_KEY no está configurada en backend/.env');
  }

  const client = getLLMClient();
  const payload = {
    model: process.env.LLM_MODEL || 'deepseek-chat',
    messages,
    temperature
  };

  if (Array.isArray(tools) && tools.length > 0) {
    payload.tools = tools;
    payload.tool_choice = toolChoice;
  }

  if (maxTokens) {
    payload.max_tokens = maxTokens;
  }

  const response = await client.chat.completions.create(payload);
  return response.choices?.[0]?.message || { role: 'assistant', content: '' };
}

module.exports = {
  getLLMClient,
  chatCompletion,
  chatWithTools
};
