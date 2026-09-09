// src/lib/clipboard.ts
import { normalizeMathSymbols } from '../services/geminiService';

// Check if a line is one of the designated bold headers or conclusion lines
export function isDesignatedBoldLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;

  // Stripped of existing markdown asterisks
  const clean = trimmed.replace(/^\*\*|\*\*$/g, '').trim();

  // English bold headers
  if (/^Given Information:?$/i.test(clean)) return true;
  if (/^Calculation:?$/i.test(clean)) return true;
  if (/^Taking approximate values:?$/i.test(clean)) return true;
  if (/^Approximate Calculation:?$/i.test(clean)) return true;
  if (/^Pattern:?$/i.test(clean)) return true;
  if (/^Logic behind Pattern:?$/i.test(clean)) return true;

  // English conclusion lines
  if (/^Hence,?\s*options?\s*(?:\([A-Za-z0-9]+\)|[A-Za-z0-9]+)?\s*is\s*correct\.?$/i.test(clean)) return true;
  if (/^Therefore,?\s*(?:the\s*)?required\s*answer\s*is/i.test(clean)) return true;

  // Hindi bold headers
  if (/^दिए गए तथ्य:?$/i.test(clean)) return true;
  if (/^गणना:?$/i.test(clean)) return true;
  if (/^लगभग मान लेने पर:?$/i.test(clean)) return true;
  if (/^लगभग गणना:?$/i.test(clean)) return true;
  if (/^पैटर्न:?$/i.test(clean)) return true;
  if (/^पैटर्न के पीछे का तर्क:?$/i.test(clean)) return true;

  // Hindi conclusion lines
  if (/^अतः,?\s*विकल्प\s*(?:\([A-Za-z0-9क-ङ]+\)|[A-Za-z0-9क-ङ]+)?\s*सही\s*है\.?$/i.test(clean)) return true;
  if (/^अतः,?\s*अभीष्ट\s*उत्तर/i.test(clean)) return true;

  // If the line was explicitly wrapped in **...**
  if (trimmed.startsWith('**') && trimmed.endsWith('**') && trimmed.length > 4) {
    return true;
  }

  return false;
}

export function stripAllMarkdownAsterisks(text: string): string {
  if (!text) return "";
  return text.replace(/\*\*/g, '').trim();
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Converts text into both rich HTML (with bold headers) and clean plain text (without any ** asterisks).
 */
export function solutionToHtmlAndPlainText(rawText: string): { html: string; plainText: string } {
  if (!rawText) return { html: "", plainText: "" };

  const lines = rawText.split('\n');
  const cleanLines: string[] = [];
  const htmlParagraphs: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      // Skip empty lines so all lines are contiguous without blank line gaps
      continue;
    }

    const cleanLine = normalizeMathSymbols(trimmed.replace(/\*\*/g, '').trim());
    cleanLines.push(cleanLine);

    if (isDesignatedBoldLine(trimmed)) {
      htmlParagraphs.push(
        `<p style="margin: 2px 0 1px 0; font-family: Arial, sans-serif; font-size: 11pt; font-weight: bold; color: #111827;"><b>${escapeHtml(cleanLine)}</b></p>`
      );
    } else {
      htmlParagraphs.push(
        `<p style="margin: 1px 0; font-family: Arial, sans-serif; font-size: 10.5pt; font-weight: normal; color: #1f2937;">${escapeHtml(cleanLine)}</p>`
      );
    }
  }

  const html = `<div style="font-family: Arial, sans-serif; line-height: 1.5; color: #111827;">\n${htmlParagraphs.join('\n')}\n</div>`;
  const plainText = cleanLines.join('\n');

  return { html, plainText };
}

/**
 * Copies formatted solution text to the system clipboard.
 * Supports:
 * 1. Rich Text / HTML (for MS Word, Google Docs, Gmail, CMS editors, etc.) with real BOLD formatting.
 * 2. Plain Text without any ** asterisks for plain text editors.
 */
export async function copyFormattedText(text: string): Promise<boolean> {
  const { html, plainText } = solutionToHtmlAndPlainText(text);

  try {
    if (typeof window !== 'undefined' && navigator.clipboard && window.ClipboardItem) {
      const blobHtml = new Blob([html], { type: 'text/html' });
      const blobText = new Blob([plainText], { type: 'text/plain' });
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': blobHtml,
          'text/plain': blobText,
        }),
      ]);
      return true;
    }
  } catch (err) {
    console.warn("ClipboardItem write failed, fallback to plain text:", err);
  }

  // Fallback to writeText with clean text (no **)
  try {
    await navigator.clipboard.writeText(plainText);
    return true;
  } catch (err) {
    console.error("Clipboard writeText failed:", err);
    return false;
  }
}
