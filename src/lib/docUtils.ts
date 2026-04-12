import {
  Document, Packer, Paragraph, TextRun,
  AlignmentType, BorderStyle,
} from "docx";
import { saveAs } from "file-saver";

const FONT = "Times New Roman";
const SIZE_NORMAL = 28; // 14pt
const SIZE_SMALL = 24;  // 12pt
const SIZE_HEADER = 32; // 16pt
const LINE_SPACING = 360; // 1.5 интервал

const spacer = (pt = 80) => new Paragraph({ text: "", spacing: { after: pt } });

const hrLine = (color = "2C3E6B") => new Paragraph({
  spacing: { before: 60, after: 60 },
  border: { bottom: { style: BorderStyle.SINGLE, size: 6, color } },
  children: [],
});

const rightPara = (text: string, size = SIZE_SMALL) => new Paragraph({
  alignment: AlignmentType.RIGHT,
  spacing: { after: 60, line: LINE_SPACING },
  children: [new TextRun({ text: text.trim(), size, font: FONT })],
});

const centerPara = (text: string, bold = false, size = SIZE_NORMAL) => new Paragraph({
  alignment: AlignmentType.CENTER,
  spacing: { before: 120, after: 120, line: LINE_SPACING },
  children: [new TextRun({ text: text.trim(), bold, size, font: FONT, allCaps: bold })],
});

const bodyPara = (text: string, opts?: { bold?: boolean; indent?: boolean; size?: number }) => new Paragraph({
  alignment: AlignmentType.BOTH,
  indent: opts?.indent !== false ? { firstLine: 720 } : undefined,
  spacing: { after: 100, line: LINE_SPACING },
  children: [new TextRun({
    text: text.trim(),
    bold: opts?.bold,
    size: opts?.size ?? SIZE_NORMAL,
    font: FONT,
  })],
});

const sectionHeader = (text: string) => new Paragraph({
  alignment: AlignmentType.LEFT,
  spacing: { before: 240, after: 120, line: LINE_SPACING },
  children: [new TextRun({ text: text.trim(), bold: true, size: SIZE_NORMAL, font: FONT, allCaps: true })],
});

const numberedItem = (num: string, text: string) => new Paragraph({
  alignment: AlignmentType.BOTH,
  indent: { left: 720, hanging: 360 },
  spacing: { after: 80, line: LINE_SPACING },
  children: [
    new TextRun({ text: `${num}  `, bold: true, size: SIZE_NORMAL, font: FONT }),
    new TextRun({ text: text.trim(), size: SIZE_NORMAL, font: FONT }),
  ],
});

export async function downloadDoc(name: string, content: string): Promise<void> {
  // Разбиваем по блокам [БЛОК]
  const blocks: Record<string, string[]> = {};
  const blockOrder: string[] = [];
  let currentBlock = "INTRO";
  blocks[currentBlock] = [];

  for (const line of content.split("\n")) {
    const match = line.match(/^\[([А-ЯA-Z_]+)\]$/);
    if (match) {
      currentBlock = match[1];
      if (!blocks[currentBlock]) {
        blocks[currentBlock] = [];
        blockOrder.push(currentBlock);
      }
    } else {
      blocks[currentBlock] = blocks[currentBlock] || [];
      blocks[currentBlock].push(line);
    }
  }

  const children: Paragraph[] = [];
  const hasBlocks = blockOrder.length > 0;

  if (hasBlocks) {
    // ── ШАПКА (правый угол) ──────────────────────────
    if (blocks["ШАПКА"]) {
      for (const line of blocks["ШАПКА"].filter(l => l.trim())) {
        const isLabel = /^(ИСТЕЦ|ОТВЕТЧИК|ЗАЯВИТЕЛЬ|ОТ КОГО|КОМУ|Кому|От кого|Истец|Ответчик)/i.test(line.trim());
        children.push(rightPara(line, isLabel ? SIZE_SMALL : SIZE_SMALL));
      }
      children.push(spacer(160));
    }

    // ── ЗАГОЛОВОК (по центру) ─────────────────────────
    if (blocks["ЗАГОЛОВОК"]) {
      const title = blocks["ЗАГОЛОВОК"].filter(l => l.trim()).join("\n").trim();
      children.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 200, after: 80, line: LINE_SPACING },
        children: [new TextRun({ text: title, bold: true, size: SIZE_HEADER, font: FONT, allCaps: true })],
      }));
      children.push(hrLine());
      children.push(spacer(160));
    } else {
      children.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 200, after: 80, line: LINE_SPACING },
        children: [new TextRun({ text: name.toUpperCase(), bold: true, size: SIZE_HEADER, font: FONT, allCaps: true })],
      }));
      children.push(hrLine());
      children.push(spacer(120));
    }

    // ── ТЕЛО ─────────────────────────────────────────
    if (blocks["ТЕЛО"]) {
      for (const line of blocks["ТЕЛО"]) {
        if (!line.trim()) { children.push(spacer(80)); continue; }

        // Раздел с нумерацией "1. ПРЕДМЕТ ДОГОВОРА"
        const sectionMatch = line.trim().match(/^(\d+)\.\s+([А-ЯA-ZЁ][А-ЯA-ZЁ\s,/]{3,})$/);
        if (sectionMatch) {
          children.push(new Paragraph({
            alignment: AlignmentType.LEFT,
            spacing: { before: 240, after: 100, line: LINE_SPACING },
            children: [new TextRun({ text: line.trim(), bold: true, size: SIZE_NORMAL, font: FONT })],
          }));
          continue;
        }

        // Подпункт "1.1. текст"
        const subMatch = line.trim().match(/^(\d+\.\d+\.?)\s+(.+)/);
        if (subMatch) {
          children.push(new Paragraph({
            alignment: AlignmentType.BOTH,
            indent: { left: 360 },
            spacing: { after: 80, line: LINE_SPACING },
            children: [
              new TextRun({ text: subMatch[1] + " ", bold: true, size: SIZE_NORMAL, font: FONT }),
              new TextRun({ text: subMatch[2], size: SIZE_NORMAL, font: FONT }),
            ],
          }));
          continue;
        }

        // Обычный абзац с первой строки
        children.push(bodyPara(line));
      }
      children.push(spacer(120));
    }

    // ── ТРЕБОВАНИЯ (нумерованный список) ──────────────
    if (blocks["ТРЕБОВАНИЯ"]) {
      const lines = blocks["ТРЕБОВАНИЯ"].filter(l => l.trim());
      for (const line of lines) {
        // Заголовок ПРОШУ / ТРЕБУЮ
        if (/^(ПРОШУ|ТРЕБУЮ|НА ОСНОВАНИИ|На основании)/i.test(line.trim())) {
          children.push(new Paragraph({
            alignment: AlignmentType.LEFT,
            spacing: { before: 200, after: 100, line: LINE_SPACING },
            children: [new TextRun({ text: line.trim().toUpperCase(), bold: true, size: SIZE_NORMAL, font: FONT })],
          }));
          continue;
        }
        // Нумерованный пункт
        const numMatch = line.trim().match(/^(\d+)\.\s+(.+)/);
        if (numMatch) {
          children.push(numberedItem(numMatch[1] + ".", numMatch[2]));
        } else {
          children.push(bodyPara(line));
        }
      }
      children.push(spacer(120));
    }

    // ── ПРИЛОЖЕНИЯ ────────────────────────────────────
    if (blocks["ПРИЛОЖЕНИЯ"]) {
      children.push(hrLine("AAAAAA"));
      children.push(new Paragraph({
        alignment: AlignmentType.LEFT,
        spacing: { before: 120, after: 80, line: LINE_SPACING },
        children: [new TextRun({ text: "ПРИЛОЖЕНИЯ:", bold: true, size: SIZE_SMALL, font: FONT })],
      }));
      for (const line of blocks["ПРИЛОЖЕНИЯ"].filter(l => l.trim())) {
        children.push(new Paragraph({
          alignment: AlignmentType.LEFT,
          indent: { left: 360 },
          spacing: { after: 60, line: 300 },
          children: [new TextRun({ text: line.trim(), size: SIZE_SMALL, font: FONT })],
        }));
      }
      children.push(spacer(120));
    }

    // ── ПОДПИСЬ (правая сторона) ──────────────────────
    if (blocks["ПОДПИСЬ"]) {
      children.push(hrLine());
      children.push(spacer(80));
      for (const line of blocks["ПОДПИСЬ"].filter(l => l.trim())) {
        // Строки с двумя колонками (подписи сторон через пробелы)
        if (/\s{5,}/.test(line)) {
          const parts = line.split(/\s{5,}/);
          children.push(new Paragraph({
            alignment: AlignmentType.BOTH,
            spacing: { after: 80, line: LINE_SPACING },
            children: parts.flatMap((p, i) => [
              new TextRun({ text: p.trim(), size: SIZE_SMALL, font: FONT }),
              ...(i < parts.length - 1 ? [new TextRun({ text: "          ", size: SIZE_SMALL, font: FONT })] : []),
            ]),
          }));
        } else {
          children.push(rightPara(line, SIZE_SMALL));
        }
      }
      children.push(spacer(80));
    }

    // ── ОБОСНОВАНИЕ ───────────────────────────────────
    if (blocks["ОБОСНОВАНИЕ"]) {
      children.push(spacer(120));
      children.push(new Paragraph({
        alignment: AlignmentType.LEFT,
        spacing: { before: 200, after: 80 },
        children: [new TextRun({ text: "ПРАВОВОЕ ОБОСНОВАНИЕ", bold: true, size: SIZE_SMALL, font: FONT, color: "2C3E6B" })],
      }));
      children.push(hrLine("2C3E6B"));
      for (const line of blocks["ОБОСНОВАНИЕ"].filter(l => l.trim())) {
        children.push(new Paragraph({
          alignment: AlignmentType.BOTH,
          spacing: { after: 60, line: 300 },
          children: [new TextRun({ text: line.trim(), size: SIZE_SMALL - 2, font: FONT, color: "444444" })],
        }));
      }
    }

    // ── ПРИМЕЧАНИЯ ────────────────────────────────────
    if (blocks["ПРИМЕЧАНИЯ"]) {
      children.push(spacer(120));
      children.push(new Paragraph({
        alignment: AlignmentType.LEFT,
        spacing: { before: 160, after: 80 },
        children: [new TextRun({ text: "ПРИМЕЧАНИЯ", bold: true, size: SIZE_SMALL, font: FONT, color: "7B6B3A" })],
      }));
      children.push(hrLine("7B6B3A"));
      for (const line of blocks["ПРИМЕЧАНИЯ"].filter(l => l.trim())) {
        children.push(new Paragraph({
          alignment: AlignmentType.BOTH,
          spacing: { after: 60, line: 300 },
          children: [new TextRun({ text: line.trim(), size: SIZE_SMALL - 2, font: FONT, color: "555555", italics: true })],
        }));
      }
    }

  } else {
    // ── Fallback: нет блоков — форматируем по смыслу строк ─────────
    // Заголовок документа
    children.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 240, after: 120, line: LINE_SPACING },
      children: [new TextRun({ text: name.toUpperCase(), bold: true, size: SIZE_HEADER, font: FONT, allCaps: true })],
    }));
    children.push(hrLine());
    children.push(spacer(160));

    for (const line of content.split("\n")) {
      if (!line.trim()) { children.push(spacer(80)); continue; }

      // Заголовки разделов CAPS
      const isSectionCaps = /^[А-ЯA-ZЁ\s]{6,}[:.]?$/.test(line.trim()) && line.trim().length < 60;
      if (isSectionCaps) {
        children.push(sectionHeader(line));
        continue;
      }
      // Нумерованные пункты 1. / 1.1.
      const numMatch = line.trim().match(/^(\d+\.(?:\d+\.)?)\s+(.+)/);
      if (numMatch) {
        const isBoldSection = /^[А-ЯA-ZЁ\s]{4,}/.test(numMatch[2]);
        children.push(new Paragraph({
          alignment: AlignmentType.BOTH,
          indent: isBoldSection ? undefined : { left: 360 },
          spacing: { after: 80, line: LINE_SPACING },
          children: [
            new TextRun({ text: numMatch[1] + " ", bold: true, size: SIZE_NORMAL, font: FONT }),
            new TextRun({ text: numMatch[2], bold: isBoldSection, size: SIZE_NORMAL, font: FONT }),
          ],
        }));
        continue;
      }
      // Шапочные строки (В суд / От кого и т.п.) — справа
      const isRightAligned = /^(В\s+|Истец:|Ответчик:|Заявитель:|Кому:|От кого:)/i.test(line.trim());
      if (isRightAligned) {
        children.push(rightPara(line));
        continue;
      }
      children.push(bodyPara(line));
    }
  }

  const doc = new Document({
    styles: {
      default: {
        document: { run: { font: FONT, size: SIZE_NORMAL } },
      },
    },
    sections: [{
      properties: {
        page: {
          margin: { top: 1134, bottom: 1134, left: 1701, right: 850 },
        },
      },
      children,
    }],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `${name}.docx`);
}