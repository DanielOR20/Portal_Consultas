import { Fragment } from 'react';

export function formatShortDate(dateValue) {
  if (!dateValue) return 'N/D';
  const raw = String(dateValue).slice(0, 10);
  const parts = raw.split('-');
  if (parts.length !== 3) return raw;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

export function formatDateTime(dateValue) {
  if (!dateValue) return 'N/D';
  const d = new Date(dateValue);
  if (Number.isNaN(d.getTime())) return String(dateValue);
  return d.toLocaleString('es-CR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export function formatNumber(val, decimals = 0) {
  const num = Number(val);
  if (Number.isNaN(num)) return '0';
  return num.toLocaleString('es-CR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

export function renderFormattedText(text) {
  const lines = String(text || '').split('\n');

  const renderInlineBold = (line) => {
    const parts = line.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, idx) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={idx} className="font-semibold text-[#18181B]">
            {part.slice(2, -2)}
          </strong>
        );
      }
      return <Fragment key={idx}>{part}</Fragment>;
    });
  };

  return lines.map((rawLine, index) => {
    const trimmed = rawLine.trim();
    if (!trimmed) {
      return <div key={index} className="h-2" />;
    }

    if (/^#{1,3}\s+/.test(trimmed)) {
      const heading = trimmed.replace(/^#{1,3}\s+/, '');
      return (
        <p key={index} className="mt-2.5 mb-1 text-sm font-bold text-[#E6004C]">
          {renderInlineBold(heading)}
        </p>
      );
    }

    if (/^[-*•]\s+/.test(trimmed)) {
      const itemText = trimmed.replace(/^[-*•]\s+/, '');
      return (
        <div
          key={index}
          className="flex items-start gap-2 pl-1 text-sm leading-relaxed text-[#18181B]"
        >
          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#E6004C]" />
          <span>{renderInlineBold(itemText)}</span>
        </div>
      );
    }

    if (/^\d+\.\s+/.test(trimmed)) {
      return (
        <p key={index} className="pl-1 text-sm leading-relaxed text-[#18181B]">
          {renderInlineBold(trimmed)}
        </p>
      );
    }

    return (
      <p key={index} className="text-sm leading-relaxed text-[#18181B]">
        {renderInlineBold(rawLine)}
      </p>
    );
  });
}
