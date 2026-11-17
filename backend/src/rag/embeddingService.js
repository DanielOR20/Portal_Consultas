'use strict';

const MODEL_NAME = 'Xenova/paraphrase-multilingual-MiniLM-L12-v2';
const SUBWINDOW_CHARS = 450;
const SUBWINDOW_OVERLAP = 100;

let pipelinePromise = null;

async function getEmbeddingPipeline() {
  if (!pipelinePromise) {
    pipelinePromise = (async () => {
      const { pipeline } = await import('@xenova/transformers');
      return pipeline('feature-extraction', MODEL_NAME);
    })();
  }
  return pipelinePromise;
}

function splitIntoSubWindows(text) {
  const clean = String(text || '').trim();
  if (clean.length <= SUBWINDOW_CHARS) {
    return [clean];
  }

  const windows = [];
  let start = 0;
  while (start < clean.length) {
    let end = Math.min(start + SUBWINDOW_CHARS, clean.length);
    if (end < clean.length) {
      const lastSpace = clean.lastIndexOf(' ', end);
      if (lastSpace > start + SUBWINDOW_CHARS * 0.6) {
        end = lastSpace;
      }
    }
    const piece = clean.slice(start, end).trim();
    if (piece) windows.push(piece);
    if (end >= clean.length) break;
    start = Math.max(0, end - SUBWINDOW_OVERLAP);
  }
  return windows;
}

function normalizeVector(vec) {
  let norm = 0;
  for (let i = 0; i < vec.length; i += 1) {
    norm += vec[i] * vec[i];
  }
  const denom = Math.sqrt(norm) || 1;
  return vec.map((v) => v / denom);
}

async function generateEmbedding(text) {
  const extractor = await getEmbeddingPipeline();
  const normalizedInput = String(text || '').trim();
  if (!normalizedInput) {
    return [];
  }

  const windows = splitIntoSubWindows(normalizedInput);
  if (windows.length === 1) {
    const output = await extractor(windows[0], {
      pooling: 'mean',
      normalize: true
    });
    return Array.from(output.data);
  }

  let acc = null;
  for (const win of windows) {
    const output = await extractor(win, {
      pooling: 'mean',
      normalize: true
    });
    const arr = Array.from(output.data);
    if (!acc) {
      acc = new Array(arr.length).fill(0);
    }
    for (let i = 0; i < arr.length; i += 1) {
      acc[i] += arr[i];
    }
  }

  const mean = acc.map((v) => v / windows.length);
  return normalizeVector(mean);
}

async function generateEmbeddingsBatch(texts) {
  const embeddings = [];
  for (const text of texts) {
    const vector = await generateEmbedding(text);
    embeddings.push(vector);
  }
  return embeddings;
}

module.exports = {
  MODEL_NAME,
  getEmbeddingPipeline,
  generateEmbedding,
  generateEmbeddingsBatch
};
