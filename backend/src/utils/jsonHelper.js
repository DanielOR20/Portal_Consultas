'use strict';

function safeParseJson(rawText, fallback = null) {
  if (!rawText || typeof rawText !== 'string') {
    return fallback;
  }

  const cleaned = rawText
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    const startIdx = cleaned.indexOf('{');
    const endIdx = cleaned.lastIndexOf('}');
    if (startIdx !== -1 && endIdx > startIdx) {
      try {
        return JSON.parse(cleaned.slice(startIdx, endIdx + 1));
      } catch {
        return fallback;
      }
    }
    return fallback;
  }
}

module.exports = {
  safeParseJson
};

