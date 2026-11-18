'use strict';

const ingestaAgent = require('../agents/ingestaAgent');
const vectorStore = require('../rag/vectorStore');

async function triggerSync(req, res, next) {
  try {
    const result = await ingestaAgent.syncDriveDocuments();
    return res.status(200).json(result);
  } catch (err) {
    if (err.message.includes('en curso')) {
      return res.status(409).json({
        ok: false,
        error: err.message
      });
    }
    return next(err);
  }
}

async function getStatus(req, res, next) {
  try {
    const status = ingestaAgent.getIngestStatus();
    return res.status(200).json(status);
  } catch (err) {
    return next(err);
  }
}

async function getDocuments(req, res, next) {
  try {
    const stats = vectorStore.getStats();
    const documents = (stats.documents || []).map((doc) => ({
      fileId: doc.fileId,
      titulo: doc.titulo || doc.fileName,
      codigo_version: doc.codigo_version || 'Documento Corporativo',
      fileName: doc.fileName,
      mimeType: doc.mimeType,
      webViewLink: doc.webViewLink || null,
      chunksCount: doc.chunksCount ?? doc.chunks ?? 0
    }));

    return res.status(200).json({
      ok: true,
      total: documents.length,
      documents
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  triggerSync,
  getStatus,
  getDocuments
};
