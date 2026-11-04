import { jsPDF } from 'jspdf';
import { Note } from '../types';

export function exportToPDF(note: Note) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageHeight = doc.internal.pageSize.height;
  const pageWidth = doc.internal.pageSize.width;
  const margin = 20;
  const contentWidth = pageWidth - (margin * 2);

  let y = margin;

  const checkPageOverflow = (neededHeight: number) => {
    if (y + neededHeight > pageHeight - margin - 5) {
      doc.addPage();
      y = margin;
      drawHeader();
    }
  };

  const drawHeader = () => {
    doc.setFillColor(124, 58, 237);
    doc.rect(margin, y, contentWidth, 2, 'F');
    y += 5;

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(124, 58, 237);
    doc.text('WIZZI NOTE', margin, y);

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(`Reporte Inteligente IA • ${new Date().toLocaleDateString('es-ES')}`, pageWidth - margin, y, { align: 'right' });

    y += 6;
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, y, pageWidth - margin, y);
    y += 10;
  };

  // Title and metadata
  drawHeader();

  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(30, 41, 59);
  const splitTitle = doc.splitTextToSize(note.title, contentWidth);
  doc.text(splitTitle, margin, y);
  y += (splitTitle.length * 8) + 4;

  doc.setFillColor(248, 250, 252);
  doc.rect(margin, y, contentWidth, 16, 'F');

  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text(`Tipo: ${note.type.toUpperCase()}`, margin + 5, y + 6);
  doc.text(`Fecha: ${new Date(note.createdAt).toLocaleDateString('es-ES')}`, margin + 60, y + 6);
  if (note.duration) {
    doc.text(`Duracion: ${note.duration}`, margin + 120, y + 6);
  }

  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Palabras: ${note.wordsCount || 0} palabras`, margin + 5, y + 12);

  y += 24;

  // Helper: print a titled section with array items
  const addListSection = (
    title: string,
    items: string[],
    accentColor: [number, number, number],
    prefix: (i: number, item: string) => string,
    stripPrefix?: RegExp
  ) => {
    if (items.length === 0) return;
    checkPageOverflow(20);

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(accentColor[0], accentColor[1], accentColor[2]);
    doc.text(title, margin, y);
    y += 5;

    doc.setDrawColor(accentColor[0], accentColor[1], accentColor[2]);
    doc.line(margin, y, margin + 40, y);
    y += 6;

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(51, 65, 85);

    items.forEach((item, idx) => {
      const text = stripPrefix ? item.replace(stripPrefix, '').trim() : item;
      const lineText = `${prefix(idx, text)} ${text}`;
      const splitItem = doc.splitTextToSize(lineText, contentWidth);
      const blockHeight = splitItem.length * 6;
      checkPageOverflow(blockHeight);
      doc.text(splitItem, margin, y);
      y += blockHeight + 2;
    });

    y += 4;
  };

  const addTextSection = (title: string, text: string, accentColor: [number, number, number]) => {
    checkPageOverflow(20);

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(accentColor[0], accentColor[1], accentColor[2]);
    doc.text(title, margin, y);
    y += 5;

    doc.setDrawColor(accentColor[0], accentColor[1], accentColor[2]);
    doc.line(margin, y, margin + 40, y);
    y += 6;

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(51, 65, 85);

    const clean = (text || 'No disponible.').replace(/\*\*/g, '');
    const splitText = doc.splitTextToSize(clean, contentWidth);
    for (const line of splitText) {
      checkPageOverflow(6);
      doc.text(line, margin, y);
      y += 5;
    }
    y += 8;
  };

  // Section 1: Resumen Ejecutivo
  addTextSection('Resumen Ejecutivo', note.summary, [124, 58, 237]);

  // Categorize action items
  const decisions = note.decisions || [];
  const actions = (note.actionItems || []).filter(a => !a.startsWith('⚠️') && !a.startsWith('⏳'));
  const pending = (note.actionItems || []).filter(a => a.startsWith('⏳'));
  const risks = (note.actionItems || []).filter(a => a.startsWith('⚠️'));

  // Section 2: Decisiones Tomadas
  if (decisions.length > 0) {
    addListSection('Decisiones Tomadas', decisions, [79, 70, 229], (i) => `${i + 1}.`);
  }

  // Section 3: Acciones y Responsables
  if (actions.length > 0) {
    addListSection('Acciones y Responsables', actions, [13, 148, 136], () => '→');
  }

  // Section 4: Pendientes
  if (pending.length > 0) {
    addListSection('Pendientes y Puntos Abiertos', pending, [59, 130, 246], () => '⏳', /^⏳\s*(Pendiente:)?\s*/);
  }

  // Section 5: Riesgos
  if (risks.length > 0) {
    addListSection('Riesgos y Consideraciones', risks, [245, 158, 11], () => '⚠️', /^⚠️\s*(Riesgo:)?\s*/);
  }

  // Section 6: Transcripción
  if (note.transcription) {
    checkPageOverflow(25);
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(30, 41, 59);
    doc.text('Transcripcion Completa', margin, y);
    y += 5;

    doc.setDrawColor(30, 41, 59);
    doc.line(margin, y, margin + 45, y);
    y += 8;

    const lines = note.transcription.split('\n');
    lines.forEach((line) => {
      if (!line.trim()) {
        y += 3;
        return;
      }

      const speakerMatch = line.match(/^([^[:\n]+?)(?:\s*\[(\d{1,2}:\d{2}(?::\d{2})?)\])?\s*:(.*)$/);
      if (speakerMatch) {
        const speakerName = speakerMatch[1].trim();
        const timestamp = speakerMatch[2] ? `[${speakerMatch[2]}]` : '';
        const bodyText = speakerMatch[3].trim();

        checkPageOverflow(12);
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(124, 58, 237);
        doc.text(`${speakerName} ${timestamp}`, margin, y);
        y += 4;

        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(9.5);
        doc.setTextColor(71, 85, 105);

        const splitBodyText = doc.splitTextToSize(bodyText, contentWidth - 4);
        for (const lineOfBody of splitBodyText) {
          checkPageOverflow(6);
          doc.text(lineOfBody, margin + 4, y);
          y += 4.5;
        }
        y += 2;
      } else {
        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(9.5);
        doc.setTextColor(71, 85, 105);

        const splitLine = doc.splitTextToSize(line, contentWidth);
        for (const l of splitLine) {
          checkPageOverflow(6);
          doc.text(l, margin, y);
          y += 4.5;
        }
        y += 2;
      }
    });
  }

  // Footer
  const totalPages = doc.internal.pages.length;
  for (let i = 1; i < totalPages; i++) {
    doc.setPage(i);
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(`Pagina ${i} de ${totalPages - 1}`, pageWidth - margin, pageHeight - 10, { align: 'right' });
  }

  const filename = `${note.title.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_wizzi_report.pdf`;
  doc.save(filename);
}
