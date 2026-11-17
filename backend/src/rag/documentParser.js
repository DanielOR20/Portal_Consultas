'use strict';

const pdfParse = require('pdf-parse');
const { getDriveClient } = require('./driveClient');

const SUPPORTED_MIME_TYPES = {
  GOOGLE_DOC: 'application/vnd.google-apps.document',
  GOOGLE_SHEET: 'application/vnd.google-apps.spreadsheet',
  PDF: 'application/pdf'
};

function isSupportedMimeType(mimeType) {
  return Object.values(SUPPORTED_MIME_TYPES).includes(mimeType);
}

function cleanText(rawText) {
  return String(rawText || '')
    .replace(/\uFEFF/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function parseCsvLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function formatCsvToReadableText(csvText) {
  const lines = cleanText(csvText).split('\n');
  const formatted = [];

  for (const line of lines) {
    if (!line.trim()) continue;
    const cells = parseCsvLine(line).filter((cell) => cell.length > 0);
    if (cells.length === 0) continue;
    const joined = cells.join(' | ');
    // Insertar salto doble antes de encabezados numerados o secciones para chunking limpio
    if (/^(?:#{1,3}\s+|\d+(?:\.\d+)*\.\s+)/.test(joined)) {
      formatted.push(`\n${joined}`);
    } else {
      formatted.push(joined);
    }
  }

  return cleanText(formatted.join('\n\n'));
}

function normalizeHeaderText(text) {
  return text
    .slice(0, 2500)
    .replace(/T[íi]tulo\s+del\s*\n\s*documento/gi, 'Título del documento')
    .replace(/C[óo]digo\s*\/\s*\n\s*Versi[óo]n/gi, 'Código / Versión')
    .replace(/Fecha\s+de\s*\n\s*vigencia/gi, 'Fecha de vigencia');
}

function extractFieldFromLines(lines, labels) {
  for (let i = 0; i < Math.min(lines.length, 55); i += 1) {
    const line = lines[i].trim();
    if (!line) continue;

    for (const label of labels) {
      const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

      // Formato tabla pipe/markdown o CSV convertido: "Título del documento | Valor"
      const pipeRegex = new RegExp(`(?:\\|\\s*)?\\*?\\*?${escaped}\\*?\\*?\\s*\\|\\s*([^|\\n]+)`, 'i');
      const pipeMatch = line.match(pipeRegex);
      if (pipeMatch && pipeMatch[1]) {
        const val = pipeMatch[1].replace(/[`*]/g, '').trim();
        if (val && !/^detalle$/i.test(val) && !/^[-:]+$/.test(val)) {
          return val;
        }
      }

      // Formato "Etiqueta: Valor"
      const colonRegex = new RegExp(`^\\*?\\*?${escaped}\\*?\\*?\\s*[:\\-]\\s*(.+)$`, 'i');
      const colonMatch = line.match(colonRegex);
      if (colonMatch && colonMatch[1]) {
        return colonMatch[1].replace(/[`*]/g, '').trim();
      }

      // Formato texto plano exportado de Google Docs / PDF (etiqueta en una línea, valor en la siguiente)
      const exactRegex = new RegExp(`^\\*?\\*?${escaped}\\*?\\*?$`, 'i');
      if (exactRegex.test(line) && i + 1 < lines.length) {
        const nextVal = lines[i + 1].replace(/[`*|]/g, '').trim();
        if (nextVal && !/^detalle$/i.test(nextVal)) {
          return nextVal;
        }
      }

      // Formato PDF en misma línea ("Título del documento Política...")
      const inlinePdfRegex = new RegExp(`^${escaped}\\s+(.+)$`, 'i');
      const inlineMatch = line.match(inlinePdfRegex);
      if (inlineMatch && inlineMatch[1] && !/^detalle$/i.test(inlineMatch[1].trim())) {
        return inlineMatch[1].replace(/[`*]/g, '').trim();
      }
    }
  }
  return null;
}

function extractHeaderMetadata(text, fileName) {
  const normalizedHeader = normalizeHeaderText(text);
  const lines = normalizedHeader.split('\n').map((l) => l.trim());
  const baseNameTitle = fileName
    .replace(/\.(pdf|md|txt|csv|xlsx|docx)$/i, '')
    .replace(/^\d+_/, '')
    .replace(/_/g, ' ')
    .trim();

  let titulo = extractFieldFromLines(lines, ['Título del documento', 'Titulo del documento']);
  if (!titulo || titulo.length < 5) {
    titulo = baseNameTitle;
  }

  // Buscar primero patrón explícito de código corporativo (POL-RRHH-01 · v2.1, COD-RRHH-09 · v2.1, etc.)
  let codigoVersion = null;
  const codeMatch = normalizedHeader.match(/\b([A-Z]{3}-RRHH-\d{2}\s*[·\-]\s*v\d+\.\d+)\b/i);
  if (codeMatch) {
    codigoVersion = codeMatch[1].replace(/\s+/g, ' ').trim();
  } else {
    codigoVersion = extractFieldFromLines(lines, ['Código / Versión', 'Codigo / Version']);
  }

  let fechaVigencia = extractFieldFromLines(lines, ['Fecha de vigencia', 'Fecha de emisión']);
  if (!fechaVigencia) {
    const dateMatch = normalizedHeader.match(/\b(\d{1,2}\s+de\s+[a-záéíóú]+\s+de\s+\d{4})\b/i);
    if (dateMatch) fechaVigencia = dateMatch[1];
  }

  const responsable =
    extractFieldFromLines(lines, ['Responsable']) ||
    'Dirección de Talento Humano - NovaCore Technologies Costa Rica S.A.';

  return {
    titulo,
    codigo_version: codigoVersion || 'N/D',
    fecha_vigencia: fechaVigencia || '01 de enero de 2026',
    responsable
  };
}

async function downloadAndParseDriveFile(fileMeta) {
  const drive = getDriveClient();
  const { id: fileId, name: fileName, mimeType, webViewLink, modifiedTime, md5Checksum } = fileMeta;

  let extractedText = '';

  if (mimeType === SUPPORTED_MIME_TYPES.GOOGLE_DOC) {
    const res = await drive.files.export(
      { fileId, mimeType: 'text/plain' },
      { responseType: 'arraybuffer' }
    );
    extractedText = cleanText(Buffer.from(res.data).toString('utf8'));
  } else if (mimeType === SUPPORTED_MIME_TYPES.GOOGLE_SHEET) {
    const res = await drive.files.export(
      { fileId, mimeType: 'text/csv' },
      { responseType: 'arraybuffer' }
    );
    extractedText = formatCsvToReadableText(Buffer.from(res.data).toString('utf8'));
  } else if (mimeType === SUPPORTED_MIME_TYPES.PDF) {
    const res = await drive.files.get(
      { fileId, alt: 'media' },
      { responseType: 'arraybuffer' }
    );
    const pdfData = await pdfParse(Buffer.from(res.data));
    extractedText = cleanText(pdfData.text);
  } else {
    throw new Error(`Formato no soportado para el archivo ${fileName} (${mimeType}).`);
  }

  const headerMeta = extractHeaderMetadata(extractedText, fileName);

  return {
    fileId,
    fileName,
    mimeType,
    webViewLink: webViewLink || `https://drive.google.com/file/d/${fileId}/view`,
    modifiedTime: modifiedTime || null,
    md5Checksum: md5Checksum || null,
    ...headerMeta,
    text: extractedText
  };
}

module.exports = {
  SUPPORTED_MIME_TYPES,
  isSupportedMimeType,
  extractHeaderMetadata,
  downloadAndParseDriveFile
};
