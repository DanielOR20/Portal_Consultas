'use strict';

const path = require('path');
const fs = require('fs');
const { google } = require('googleapis');

let cachedDrive = null;

function resolveCredentialsPath() {
  const configuredPath =
    process.env.GOOGLE_APPLICATION_CREDENTIALS || './credentials/service-account.json';
  if (path.isAbsolute(configuredPath)) {
    return configuredPath;
  }
  return path.resolve(__dirname, '..', '..', configuredPath);
}

function getFolderId() {
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (!folderId) {
    throw new Error('GOOGLE_DRIVE_FOLDER_ID no está configurado en backend/.env');
  }
  return folderId.trim();
}

function getDriveClient() {
  if (cachedDrive) {
    return cachedDrive;
  }

  const keyFile = resolveCredentialsPath();
  if (!fs.existsSync(keyFile)) {
    throw new Error('Archivo de credenciales de Google Service Account no encontrado.');
  }

  const auth = new google.auth.GoogleAuth({
    keyFile,
    scopes: ['https://www.googleapis.com/auth/drive.readonly']
  });

  cachedDrive = google.drive({ version: 'v3', auth });
  return cachedDrive;
}

module.exports = {
  getDriveClient,
  getFolderId
};

