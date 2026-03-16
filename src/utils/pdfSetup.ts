import { formatDate } from '@/types/hakedis';
import formanLogoUrl from '@/assets/forman-logo.png';

const COLORS = {
  primary: [59, 130, 246] as [number, number, number],
  indigo: [99, 102, 241] as [number, number, number],
  green: [34, 197, 94] as [number, number, number],
  amber: [245, 158, 11] as [number, number, number],
  red: [220, 38, 38] as [number, number, number],
  gray: [107, 114, 128] as [number, number, number],
  lightGray: [249, 250, 251] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  dark: [26, 26, 26] as [number, number, number],
};

export { COLORS };

let fontCache: { regular: string; bold: string } | null = null;
let logoCache: { dataUrl: string; width: number; height: number } | null = null;

async function loadFonts(): Promise<{ regular: string; bold: string }> {
  if (fontCache) return fontCache;

  const [regularBuf, boldBuf] = await Promise.all([
    fetch('/fonts/Roboto-Regular.ttf').then(r => r.arrayBuffer()),
    fetch('/fonts/Roboto-Bold.ttf').then(r => r.arrayBuffer()),
  ]);

  const toBase64 = (buf: ArrayBuffer) => {
    const bytes = new Uint8Array(buf);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  };

  fontCache = {
    regular: toBase64(regularBuf),
    bold: toBase64(boldBuf),
  };
  return fontCache;
}

async function loadLogo(): Promise<{ dataUrl: string; width: number; height: number }> {
  if (logoCache) return logoCache;

  const response = await fetch(formanLogoUrl);
  const blob = await response.blob();

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      const img = new Image();
      img.onload = () => {
        logoCache = { dataUrl, width: img.naturalWidth, height: img.naturalHeight };
        resolve(logoCache);
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(blob);
  });
}

export async function loadPdfLibs() {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);
  return { jsPDF, autoTable };
}

export async function setupPdfFont(doc: any) {
  const fonts = await loadFonts();

  doc.addFileToVFS('Roboto-Regular.ttf', fonts.regular);
  doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');
  doc.addFileToVFS('Roboto-Bold.ttf', fonts.bold);
  doc.addFont('Roboto-Bold.ttf', 'Roboto', 'bold');

  doc.setFont('Roboto', 'normal');
}

export async function addCompanyHeader(doc: any, title: string): Promise<number> {
  const pageWidth = doc.internal.pageSize.getWidth();
  const logoDataUrl = await loadLogo();

  // Logo top-left
  try {
    doc.addImage(logoDataUrl, 'PNG', 14, 6, 18, 18);
  } catch {
    // fallback if logo fails
  }

  // Company name
  doc.setFont('Roboto', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...COLORS.dark);
  doc.text('FORMAN INTERNATIONAL LTD.', pageWidth / 2, 12, { align: 'center' });

  // Report title
  doc.setFontSize(14);
  doc.setTextColor(...COLORS.dark);
  doc.text(title, pageWidth / 2, 20, { align: 'center' });

  // Report date
  doc.setFont('Roboto', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.gray);
  doc.text(`Rapor Tarihi: ${formatDate(new Date().toISOString())}`, pageWidth - 14, 12, { align: 'right' });

  // Line under header
  doc.setDrawColor(...COLORS.primary);
  doc.setLineWidth(0.5);
  doc.line(14, 26, pageWidth - 14, 26);

  return 32;
}

export function addSectionTitle(doc: any, title: string, y: number, color: [number, number, number] = COLORS.primary): number {
  doc.setFont('Roboto', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...COLORS.dark);
  doc.text(title, 14, y);
  doc.setDrawColor(...color);
  doc.setLineWidth(0.8);
  doc.line(14, y + 1.5, 80, y + 1.5);
  doc.setFont('Roboto', 'normal');
  return y + 6;
}

export function addSignatureBlock(doc: any, y: number): number {
  const pageWidth = doc.internal.pageSize.getWidth();
  const colWidth = (pageWidth - 28) / 2;

  y += 10;
  doc.setFont('Roboto', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.dark);

  doc.text('Direktor Onayi:', 14 + colWidth / 2, y, { align: 'center' });
  doc.text('Muhasebe Onayi:', 14 + colWidth + colWidth / 2, y, { align: 'center' });

  y += 18;
  doc.setDrawColor(...COLORS.dark);
  doc.line(24, y, 24 + colWidth - 20, y);
  doc.line(14 + colWidth + 10, y, 14 + colWidth + colWidth - 10, y);

  y += 4;
  doc.setFont('Roboto', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...COLORS.gray);
  doc.text('Imza / Tarih', 14 + colWidth / 2, y, { align: 'center' });
  doc.text('Imza / Tarih', 14 + colWidth + colWidth / 2, y, { align: 'center' });

  return y;
}

/** Default autoTable styles that use the Roboto font */
export const defaultTableStyles = {
  styles: { font: 'Roboto', fontSize: 8, cellPadding: 2.5 },
};
