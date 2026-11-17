'use strict';

// ~600-800 tokens ≈ 2,400-3,000 caracteres; solapamiento ~120 tokens ≈ 450 caracteres
const DEFAULT_MAX_CHARS = 2600;
const DEFAULT_OVERLAP_CHARS = 450;

function detectHeading(line) {
  const trimmed = line.trim();
  if (!trimmed) return null;

  const mdMatch = trimmed.match(/^#{1,3}\s+(.+)$/);
  if (mdMatch) {
    return mdMatch[1].trim();
  }

  const numberedMatch = trimmed.match(/^(\d+(?:\.\d+)*)\.\s+([A-ZÁÉÍÓÚÑ][^.!?\n]{3,90})$/);
  if (numberedMatch) {
    return `${numberedMatch[1]}. ${numberedMatch[2].trim()}`;
  }

  return null;
}

function splitLongBlock(text, maxChars, overlapChars) {
  const pieces = [];
  let start = 0;

  while (start < text.length) {
    let end = Math.min(start + maxChars, text.length);

    if (end < text.length) {
      const slice = text.slice(start, end);
      const lastBreak = Math.max(
        slice.lastIndexOf('\n'),
        slice.lastIndexOf('. '),
        slice.lastIndexOf(' ')
      );
      if (lastBreak > maxChars * 0.5) {
        end = start + lastBreak + 1;
      }
    }

    const chunk = text.slice(start, end).trim();
    if (chunk) {
      pieces.push(chunk);
    }

    if (end >= text.length) break;
    let nextStart = Math.max(0, end - overlapChars);
    // Avanzar al inicio de palabra siguiente para evitar cortar palabras
    while (nextStart > 0 && nextStart < text.length && !/\s/.test(text[nextStart - 1])) {
      nextStart += 1;
    }
    start = nextStart < end ? nextStart : end;
  }

  return pieces;
}

function splitIntoLogicalBlocks(rawText) {
  const lines = String(rawText || '').split('\n');
  const blocks = [];
  let current = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      if (current.length > 0) {
        blocks.push(current.join('\n'));
        current = [];
      }
      continue;
    }

    if (detectHeading(trimmed) && current.length > 0) {
      blocks.push(current.join('\n'));
      current = [trimmed];
    } else {
      current.push(trimmed);
    }
  }

  if (current.length > 0) {
    blocks.push(current.join('\n'));
  }

  return blocks;
}

function chunkDocument(doc, options = {}) {
  const maxChars = options.maxChars || DEFAULT_MAX_CHARS;
  const overlapChars = options.overlapChars || DEFAULT_OVERLAP_CHARS;

  const paragraphs = splitIntoLogicalBlocks(doc.text);

  const rawChunks = [];
  let currentSection = 'Información General';
  let currentBuffer = '';
  let chunkStartSection = currentSection;

  for (const paragraph of paragraphs) {
    const lines = paragraph.split('\n');
    const firstHeading = detectHeading(lines[0] || '');
    for (const line of lines) {
      const heading = detectHeading(line);
      if (heading) {
        currentSection = heading;
      }
    }

    if (!currentBuffer) {
      chunkStartSection = currentSection;
    }

    const candidate = currentBuffer ? `${currentBuffer}\n\n${paragraph}` : paragraph;

    if (candidate.length <= maxChars) {
      currentBuffer = candidate;
      if (firstHeading && chunkStartSection === 'Información General') {
        chunkStartSection = firstHeading;
      }
      continue;
    }

    if (currentBuffer) {
      rawChunks.push({
        text: currentBuffer.trim(),
        seccion: chunkStartSection
      });

      const overlapSlice = currentBuffer.slice(-overlapChars);
      const firstSpace = overlapSlice.indexOf(' ');
      const overlapText = (firstSpace > 0 ? overlapSlice.slice(firstSpace + 1) : overlapSlice).trim();

      chunkStartSection = firstHeading || currentSection;
      const nextCandidate = overlapText ? `${overlapText}\n\n${paragraph}` : paragraph;

      if (nextCandidate.length <= maxChars) {
        currentBuffer = nextCandidate;
      } else {
        const subChunks = splitLongBlock(nextCandidate, maxChars, overlapChars);
        for (let i = 0; i < subChunks.length - 1; i += 1) {
          rawChunks.push({
            text: subChunks[i],
            seccion: currentSection
          });
        }
        currentBuffer = subChunks[subChunks.length - 1] || '';
      }
    } else {
      const subChunks = splitLongBlock(paragraph, maxChars, overlapChars);
      for (let i = 0; i < subChunks.length - 1; i += 1) {
        rawChunks.push({
          text: subChunks[i],
          seccion: currentSection
        });
      }
      currentBuffer = subChunks[subChunks.length - 1] || '';
    }
  }

  if (currentBuffer.trim()) {
    rawChunks.push({
      text: currentBuffer.trim(),
      seccion: chunkStartSection
    });
  }

  const totalChunks = rawChunks.length;
  return rawChunks.map((chunk, index) => ({
    id: `${doc.fileId}::chunk_${index}`,
    text: chunk.text,
    metadata: {
      fileId: doc.fileId,
      fileName: doc.fileName,
      mimeType: doc.mimeType,
      webViewLink: doc.webViewLink,
      modifiedTime: doc.modifiedTime,
      titulo: doc.titulo,
      codigo_version: doc.codigo_version,
      fecha_vigencia: doc.fecha_vigencia,
      responsable: doc.responsable,
      seccion: chunk.seccion,
      chunkIndex: index,
      totalChunks
    }
  }));
}

module.exports = {
  chunkDocument,
  detectHeading
};
