'use strict';

const ingestaAgent = require('../agents/ingestaAgent');

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

module.exports = {
  triggerSync,
  getStatus
};

