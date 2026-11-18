'use strict';

const fs = require('fs');
const path = require('path');

const VECTOR_STORE_DIR = path.resolve(__dirname, '..', '..', 'vector_store');
const VECTORS_FILE = path.join(VECTOR_STORE_DIR, 'vectors.json');

let memoryCache = null;

function normalizeForLexical(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function extractQueryTerms(queryText, extraBoostTerms = []) {
  const normalized = normalizeForLexical(queryText);
  const rawTokens = normalized.split(/[^a-z0-9]+/).filter((t) => t.length >= 4);
  const terms = new Set(rawTokens);

  for (const extra of extraBoostTerms) {
    const cleanExtra = normalizeForLexical(extra).trim();
    if (cleanExtra.length >= 3) {
      terms.add(cleanExtra);
    }
  }

  return Array.from(terms);
}

function ensureStoreDir() {
  if (!fs.existsSync(VECTOR_STORE_DIR)) {
    fs.mkdirSync(VECTOR_STORE_DIR, { recursive: true });
  }
}

function loadVectors() {
  if (memoryCache) {
    return memoryCache;
  }
  ensureStoreDir();
  if (!fs.existsSync(VECTORS_FILE)) {
    memoryCache = [];
    return memoryCache;
  }
  const raw = fs.readFileSync(VECTORS_FILE, 'utf8');
  const parsed = JSON.parse(raw || '[]');
  memoryCache = Array.isArray(parsed) ? parsed : [];
  return memoryCache;
}

function saveVectors(vectors) {
  ensureStoreDir();
  memoryCache = vectors;
  fs.writeFileSync(VECTORS_FILE, JSON.stringify(vectors, null, 2), 'utf8');
}

function removeByFileId(fileId) {
  const current = loadVectors();
  const filtered = current.filter((item) => item.metadata?.fileId !== fileId);
  if (filtered.length !== current.length) {
    saveVectors(filtered);
  }
  return current.length - filtered.length;
}

function upsertFileChunks(fileId, chunkRecords) {
  const current = loadVectors();
  const withoutFile = current.filter((item) => item.metadata?.fileId !== fileId);
  const updated = [...withoutFile, ...chunkRecords];
  saveVectors(updated);
  return chunkRecords.length;
}

function cosineSimilarity(vecA, vecB) {
  if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i += 1) {
    const a = vecA[i];
    const b = vecB[i];
    dot += a * b;
    normA += a * a;
    normB += b * b;
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

function searchSimilar(
  queryEmbedding,
  topK = 5,
  minScore = 0.25,
  queryText = '',
  extraBoostTerms = []
) {
  const vectors = loadVectors();
  const queryTerms = queryText ? extractQueryTerms(queryText, extraBoostTerms) : [];
  const scored = [];

  for (const item of vectors) {
    const cosine = cosineSimilarity(queryEmbedding, item.embedding);
    let lexicalBoost = 0;

    if (queryTerms.length > 0) {
      const searchable = normalizeForLexical(
        `${item.metadata?.titulo || ''} ${item.metadata?.seccion || ''} ${item.text || ''}`
      );
      let matched = 0;
      for (const term of queryTerms) {
        if (searchable.includes(term)) {
          matched += 1;
        }
      }
      const ratio = matched / queryTerms.length;
      lexicalBoost = Math.min(0.24, ratio * 0.28);
    }

    const hybridScore = cosine + lexicalBoost;
    if (hybridScore >= minScore) {
      scored.push({
        id: item.id,
        score: Number(hybridScore.toFixed(4)),
        cosineScore: Number(cosine.toFixed(4)),
        text: item.text,
        metadata: item.metadata
      });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK);
}

function getStats() {
  const vectors = loadVectors();
  const docsMap = new Map();

  for (const item of vectors) {
    const meta = item.metadata || {};
    if (!meta.fileId) continue;
    if (!docsMap.has(meta.fileId)) {
      docsMap.set(meta.fileId, {
        fileId: meta.fileId,
        fileName: meta.fileName,
        mimeType: meta.mimeType,
        titulo: meta.titulo,
        codigo_version: meta.codigo_version,
        fecha_vigencia: meta.fecha_vigencia,
        responsable: meta.responsable,
        webViewLink: meta.webViewLink || null,
        chunks: 0,
        chunksCount: 0
      });
    }
    const entry = docsMap.get(meta.fileId);
    entry.chunks += 1;
    entry.chunksCount += 1;
  }

  return {
    totalChunks: vectors.length,
    totalDocuments: docsMap.size,
    documents: Array.from(docsMap.values()),
    vectorsFilePath: VECTORS_FILE
  };
}

module.exports = {
  VECTOR_STORE_DIR,
  VECTORS_FILE,
  loadVectors,
  saveVectors,
  removeByFileId,
  upsertFileChunks,
  cosineSimilarity,
  searchSimilar,
  getStats
};
