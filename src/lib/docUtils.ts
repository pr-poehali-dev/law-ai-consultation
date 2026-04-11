import {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  AlignmentType, BorderStyle,
} from "docx";
import { saveAs } from "file-saver";

export async function downloadDoc(name: string, content: string): Promise<void> {
  const blocks: Record<string, string> = {};
  const blockOrder: string[] = [];
  let currentBlock = "INTRO";
  blocks[currentBlock] = "";
  for (const line of content.split("\n")) {
    const match = line.match(/^\[([А-ЯA-Z_]+)\]$/);
    if (match) {
      currentBlock = match[1];
      blocks[currentBlock] = "";
      blockOrder.push(currentBlock);
    } else {
      blocks[currentBlock] = (blocks[currentBlock] || "") + line + "\n";
    }
  }

  const FONT = "Times New Roman";
  const children: Paragraph[] = [];

  const spacer = () => new Paragraph({ text: "", spacing: { after: 80 } });

  const textPara = (text: string, opts?: {
    bold?: boolean; italic?: boolean; center?: boolean; size?: number; indent?: number; spaceBefore?: number; spaceAfter?: number;
  }) => new Paragraph({
    alignment: opts?.center ? AlignmentType.CENTER : AlignmentType.BOTH,
    indent: opts?.indent ? { left: opts.indent } : undefined,
    spacing: { before: opts?.spaceBefore ?? 0, after: opts?.spaceAfter ?? 120, line: 360 },
    children: [new TextRun({
      text,
      bold: opts?.bold,
      italics: opts?.italic,
      size: opts?.size ?? 24,
      font: FONT,
    })],
  });

  const hrLine = () => new Paragraph({
    spacing: { before: 80, after: 80 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "2C3E6B" } },
    children: [],
  });

  // Шапка (правый угол)
  if (blocks["ШАПКА"]) {
    for (const line of blocks["ШАПКА"].split("\n").filter(Boolean)) {
      children.push(new Paragraph({
        alignment: AlignmentType.RIGHT,
        spacing: { after: 60, line: 320 },
        children: [new TextRun({ text: line.trim(), size: 22, font: FONT })],
      }));
    }
    children.push(spacer());
  }

  // Заголовок
  if (blocks["ЗАГОЛОВОК"]) {
    const title = blocks["ЗАГОЛОВОК"].trim();
    children.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 200, after: 200 },
      children: [new TextRun({ text: title, bold: true, size: 28, font: FONT, allCaps: true })],
    }));
    children.push(hrLine());
    children.push(spacer());
  } else {
    children.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 200, after: 200 },
      children: [new TextRun({ text: name.toUpperCase(), bold: true, size: 28, font: FONT, allCaps: true })],
    }));
    children.push(hrLine());
  }

  // Тело
  if (blocks["ТЕЛО"]) {
    for (const line of blocks["ТЕЛО"].split("\n")) {
      if (line.trim() === "") { children.push(spacer()); continue; }
      children.push(textPara(line.trim(), { indent: 720, spaceAfter: 100 }));
    }
    children.push(spacer());
  }

  // Требования
  if (blocks["ТРЕБОВАНИЯ"]) {
    children.push(textPara("ПРОСИМ СУД:", { bold: true, spaceAfter: 60 }));
    for (const line of blocks["ТРЕБОВАНИЯ"].split("\n").filter(Boolean)) {
      children.push(new Paragraph({
        alignment: AlignmentType.BOTH,
        indent: { left: 720, hanging: 360 },
        spacing: { after: 80, line: 340 },
        children: [new TextRun({ text: line.trim(), size: 24, font: FONT })],
      }));
    }
    children.push(spacer());
  }

  // Приложения
  if (blocks["ПРИЛОЖЕНИЯ"]) {
    children.push(hrLine());
    children.push(textPara("ПРИЛОЖЕНИЯ:", { bold: true, spaceAfter: 60 }));
    for (const line of blocks["ПРИЛОЖЕНИЯ"].split("\n").filter(Boolean)) {
      children.push(new Paragraph({
        alignment: AlignmentType.LEFT,
        indent: { left: 360 },
        spacing: { after: 60, line: 320 },
        children: [new TextRun({ text: line.trim(), size: 22, font: FONT })],
      }));
    }
    children.push(spacer());
  }

  // Подпись
  if (blocks["ПОДПИСЬ"]) {
    children.push(hrLine());
    for (const line of blocks["ПОДПИСЬ"].split("\n").filter(Boolean)) {
      children.push(new Paragraph({
        alignment: AlignmentType.RIGHT,
        spacing: { after: 80, line: 320 },
        children: [new TextRun({ text: line.trim(), size: 22, font: FONT })],
      }));
    }
    children.push(spacer());
  }

  // Обоснование
  if (blocks["ОБОСНОВАНИЕ"]) {
    children.push(new Paragraph({
      alignment: AlignmentType.LEFT,
      spacing: { before: 300, after: 100 },
      children: [new TextRun({ text: "ПРАВОВОЕ ОБОСНОВАНИЕ", bold: true, size: 22, font: FONT, color: "2C3E6B" })],
    }));
    children.push(hrLine());
    for (const line of blocks["ОБОСНОВАНИЕ"].split("\n").filter(Boolean)) {
      children.push(new Paragraph({
        alignment: AlignmentType.BOTH,
        spacing: { after: 60, line: 320 },
        children: [new TextRun({ text: line.trim(), size: 20, font: FONT, color: "444444" })],
      }));
    }
    children.push(spacer());
  }

  // Примечания
  if (blocks["ПРИМЕЧАНИЯ"]) {
    children.push(new Paragraph({
      alignment: AlignmentType.LEFT,
      spacing: { before: 200, after: 100 },
      children: [new TextRun({ text: "ПРИМЕЧАНИЯ", bold: true, size: 22, font: FONT, color: "7B6B3A" })],
    }));
    children.push(hrLine());
    for (const line of blocks["ПРИМЕЧАНИЯ"].split("\n").filter(Boolean)) {
      children.push(new Paragraph({
        alignment: AlignmentType.BOTH,
        spacing: { after: 60, line: 320 },
        children: [new TextRun({ text: line.trim(), size: 20, font: FONT, color: "555555", italics: true })],
      }));
    }
  }

  // Если маркеров нет — красивый fallback построчно
  if (blockOrder.length === 0) {
    for (const line of content.split("\n")) {
      if (line.trim() === "") { children.push(spacer()); continue; }
      const isSectionHeader = /^[-─═]{3,}/.test(line) || /^[А-Я\s]{5,}:?\s*$/.test(line.trim());
      if (isSectionHeader) {
        children.push(new Paragraph({
          alignment: AlignmentType.LEFT,
          spacing: { before: 200, after: 100 },
          children: [new TextRun({ text: line.trim(), bold: true, size: 22, font: FONT, color: "2C3E6B" })],
        }));
      } else {
        children.push(new Paragraph({
          alignment: AlignmentType.BOTH,
          indent: { left: 360 },
          spacing: { after: 80, line: 340 },
          children: [new TextRun({ text: line.trim(), size: 24, font: FONT })],
        }));
      }
    }
  }

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: FONT, size: 24 },
        },
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
