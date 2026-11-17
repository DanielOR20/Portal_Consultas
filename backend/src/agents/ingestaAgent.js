'use strict';

const fs = require('fs');
const path = require('path');
const { getDriveClient, getFolderId } = require('../rag/driveClient');
const { isSupportedMimeType, downloadAndParseDriveFile } = require('../rag/documentParser');
const { chunkDocument } = require('../rag/chunker');
const { generateEmbeddingsBatch } = require('../rag/embeddingService');
const vectorStore = require('../rag/vectorStore');

const SYNC_STATE_FILE = path.join(vectorStore.VECTOR_STORE_DIR, 'sync_state.json');

let syncInProgress = false;

function loadSyncState() {
  vectorStore.loadVectors();
  if (!fs.existsSync(SYNC_STATE_FILE)) {
    return {
      pageToken: null,
      lastSyncAt: null,
      files: {}
    };
  }
  try {
    const raw = fs.readFileSync(SYNC_STATE_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return {
      pageToken: parsed.pageToken || null,
      lastSyncAt: parsed.lastSyncAt || null,
      files: parsed.files && typeof parsed.files === 'object' ? parsed.files : {}
    };
  } catch {
    return {
      pageToken: null,
      lastSyncAt: null,
      files: {}
    };
  }
}

function saveSyncState(state) {
  if (!fs.existsSync(vectorStore.VECTOR_STORE_DIR)) {
    fs.mkdirSync(vectorStore.VECTOR_STORE_DIR, { recursive: true });
  }
  fs.writeFileSync(SYNC_STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
}

async function listActiveSupportedFilesInFolder(drive, folderId) {
  const files = [];
  let pageToken = null;

  do {
    const res = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      fields: 'nextPageToken, files(id, name, mimeType, webViewLink, modifiedTime, md5Checksum, trashed, parents)',
      pageSize: 100,
      pageToken: pageToken || undefined,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true
    });

    const batch = res.data.files || [];
    for (const file of batch) {
      if (isSupportedMimeType(file.mimeType)) {
        files.push(file);
      }
    }
    pageToken = res.data.nextPageToken || null;
  } while (pageToken);

  return files;
}

async function fetchIncrementalChanges(drive, savedPageToken, folderId) {
  if (!savedPageToken) {
    const tokenRes = await drive.changes.getStartPageToken({
      supportsAllDrives: true
    });
    return {
      newPageToken: tokenRes.data.startPageToken,
      changedIds: new Set(),
      removedIds: new Set()
    };
  }

  let pageToken = savedPageToken;
  let newStartPageToken = savedPageToken;
  const changedIds = new Set();
  const removedIds = new Set();

  do {
    const res = await drive.changes.list({
      pageToken,
      includeRemoved: true,
      spaces: 'drive',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
      fields:
        'nextPageToken, newStartPageToken, changes(fileId, removed, file(id, name, mimeType, trashed, parents, modifiedTime, md5Checksum))'
    });

    for (const change of res.data.changes || []) {
      const fileId = change.fileId;
      const file = change.file;
      const inTargetFolder = file?.parents?.includes(folderId);

      if (change.removed || file?.trashed || (file && !inTargetFolder)) {
        removedIds.add(fileId);
      } else if (file && inTargetFolder && isSupportedMimeType(file.mimeType)) {
        changedIds.add(fileId);
      }
    }

    if (res.data.newStartPageToken) {
      newStartPageToken = res.data.newStartPageToken;
    }
    pageToken = res.data.nextPageToken || null;
  } while (pageToken);

  return {
    newPageToken: newStartPageToken,
    changedIds,
    removedIds
  };
}

async function syncDriveDocuments() {
  if (syncInProgress) {
    throw new Error('Ya existe una sincronización con Google Drive en curso.');
  }

  syncInProgress = true;
  const startedAt = new Date().toISOString();

  try {
    const drive = getDriveClient();
    const folderId = getFolderId();
    const syncState = loadSyncState();
    const currentVectors = vectorStore.loadVectors();
    const indexedFileIds = new Set(
      currentVectors.map((v) => v.metadata?.fileId).filter(Boolean)
    );

    const { newPageToken, changedIds, removedIds } = await fetchIncrementalChanges(
      drive,
      syncState.pageToken,
      folderId
    );

    const activeFiles = await listActiveSupportedFilesInFolder(drive, folderId);
    const activeById = new Map(activeFiles.map((f) => [f.id, f]));

    let removedCount = 0;
    const allKnownIds = new Set([
      ...Object.keys(syncState.files),
      ...indexedFileIds,
      ...removedIds
    ]);

    for (const knownId of allKnownIds) {
      if (!activeById.has(knownId)) {
        const deletedChunks = vectorStore.removeByFileId(knownId);
        if (deletedChunks > 0 || syncState.files[knownId]) {
          removedCount += 1;
        }
      }
    }

    let addedCount = 0;
    let updatedCount = 0;
    let unchangedCount = 0;
    const processedFiles = [];
    const nextFilesMap = {};

    for (const fileMeta of activeFiles) {
      const prevMeta = syncState.files[fileMeta.id];
      const hasChunks = indexedFileIds.has(fileMeta.id);

      const isNew = !prevMeta || !hasChunks;
      const metadataChanged =
        prevMeta &&
        (prevMeta.modifiedTime !== fileMeta.modifiedTime ||
          (fileMeta.md5Checksum && prevMeta.md5Checksum !== fileMeta.md5Checksum));
      const flaggedByChangesApi = changedIds.has(fileMeta.id);

      if (!isNew && !metadataChanged && !flaggedByChangesApi) {
        unchangedCount += 1;
        nextFilesMap[fileMeta.id] = prevMeta;
        processedFiles.push({
          fileId: fileMeta.id,
          fileName: fileMeta.name,
          mimeType: fileMeta.mimeType,
          status: 'unchanged',
          chunks: prevMeta.chunks || 0
        });
        continue;
      }

      const parsedDoc = await downloadAndParseDriveFile(fileMeta);
      const chunks = chunkDocument(parsedDoc);
      const embeddings = await generateEmbeddingsBatch(chunks.map((c) => c.text));

      const records = chunks.map((chunk, idx) => ({
        id: chunk.id,
        text: chunk.text,
        embedding: embeddings[idx],
        metadata: chunk.metadata
      }));

      vectorStore.upsertFileChunks(fileMeta.id, records);

      if (isNew) {
        addedCount += 1;
      } else {
        updatedCount += 1;
      }

      nextFilesMap[fileMeta.id] = {
        fileId: fileMeta.id,
        fileName: fileMeta.name,
        mimeType: fileMeta.mimeType,
        modifiedTime: fileMeta.modifiedTime || null,
        md5Checksum: fileMeta.md5Checksum || null,
        titulo: parsedDoc.titulo,
        codigo_version: parsedDoc.codigo_version,
        fecha_vigencia: parsedDoc.fecha_vigencia,
        responsable: parsedDoc.responsable,
        chunks: records.length,
        lastIndexedAt: new Date().toISOString()
      };

      processedFiles.push({
        fileId: fileMeta.id,
        fileName: fileMeta.name,
        mimeType: fileMeta.mimeType,
        titulo: parsedDoc.titulo,
        codigo_version: parsedDoc.codigo_version,
        status: isNew ? 'added' : 'updated',
        chunks: records.length
      });
    }

    const finishedAt = new Date().toISOString();
    saveSyncState({
      pageToken: newPageToken,
      lastSyncAt: finishedAt,
      files: nextFilesMap
    });

    const stats = vectorStore.getStats();

    return {
      ok: true,
      startedAt,
      lastSyncAt: finishedAt,
      summary: {
        totalActiveInFolder: activeFiles.length,
        added: addedCount,
        updated: updatedCount,
        removed: removedCount,
        unchanged: unchangedCount,
        totalChunks: stats.totalChunks
      },
      files: processedFiles
    };
  } finally {
    syncInProgress = false;
  }
}

function getIngestStatus() {
  const syncState = loadSyncState();
  const stats = vectorStore.getStats();

  return {
    ok: true,
    syncInProgress,
    lastSyncAt: syncState.lastSyncAt,
    hasPageToken: Boolean(syncState.pageToken),
    totalDocuments: stats.totalDocuments,
    totalChunks: stats.totalChunks,
    documents: stats.documents
  };
}

module.exports = {
  syncDriveDocuments,
  getIngestStatus
};

