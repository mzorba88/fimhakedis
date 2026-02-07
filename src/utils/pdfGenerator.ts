import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { 
  WorkEntry, 
  SubcontractorHakedis, 
  Project,
  formatCurrencyWithType,
  formatDate,
  contractTypeLabels
} from '@/types/hakedis';
import formanLogo from '@/assets/forman-logo.png';

export const generateContractPDF = async (
  entry: WorkEntry, 
  project: Project | undefined,
  subcontractorHakedisler: SubcontractorHakedis[]
) => {
  // Calculate financial data
  const subtotal = entry.totalAmount;
  const vatAmount = entry.vatRate ? subtotal * (entry.vatRate / 100) : 0;
  const totalWithVat = subtotal + vatAmount;
  
  // For götürü bedel - payment tracking
  const paidAmount = subcontractorHakedisler
    .filter(h => h.contractId === entry.id)
    .reduce((sum, h) => sum + h.totalAmount, 0);
  const remainingBalance = entry.totalAmount - paidAmount;

  // Create a temporary container for the PDF content
  const container = document.createElement('div');
  container.style.cssText = 'position: absolute; left: -9999px; top: 0; width: 800px; padding: 40px; background: white; font-family: Arial, sans-serif;';
  
  // Generate work items table rows
  let workItemsHtml = '';
  if (entry.contractType === 'birim_fiyat' && entry.workItemEntries && entry.workItemEntries.length > 0) {
    const rows = entry.workItemEntries.map((item, idx) => `
      <tr style="background: ${idx % 2 === 0 ? '#f9fafb' : 'white'};">
        <td style="padding: 10px; border: 1px solid #ddd; text-align: center;">${idx + 1}</td>
        <td style="padding: 10px; border: 1px solid #ddd;">${item.description || item.workCategory}</td>
        <td style="padding: 10px; border: 1px solid #ddd; text-align: center;">${item.unit}</td>
        <td style="padding: 10px; border: 1px solid #ddd; text-align: right;">${item.quantity}</td>
        <td style="padding: 10px; border: 1px solid #ddd; text-align: right;">${formatCurrencyWithType(item.unitPrice, entry.currency)}</td>
        <td style="padding: 10px; border: 1px solid #ddd; text-align: right;">${formatCurrencyWithType(item.quantity * item.unitPrice, entry.currency)}</td>
      </tr>
    `).join('');
    
    workItemsHtml = `
      <div style="margin-bottom: 25px;">
        <h2 style="font-size: 16px; margin-bottom: 10px; color: #1a1a1a; border-bottom: 2px solid #6366f1; padding-bottom: 5px;">İş Kalemleri</h2>
        <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
          <thead>
            <tr style="background: #6366f1; color: white;">
              <th style="padding: 10px; text-align: center; border: 1px solid #ddd; width: 40px;">#</th>
              <th style="padding: 10px; text-align: left; border: 1px solid #ddd;">Açıklama</th>
              <th style="padding: 10px; text-align: center; border: 1px solid #ddd; width: 60px;">Birim</th>
              <th style="padding: 10px; text-align: right; border: 1px solid #ddd; width: 80px;">Miktar</th>
              <th style="padding: 10px; text-align: right; border: 1px solid #ddd; width: 100px;">Birim Fiyat</th>
              <th style="padding: 10px; text-align: right; border: 1px solid #ddd; width: 100px;">Toplam</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </div>
    `;
  }

  // Generate payment plan table rows
  let paymentPlanHtml = '';
  if (entry.contractType === 'goturu_bedel' && entry.paymentPlan && entry.paymentPlan.length > 0) {
    const rows = entry.paymentPlan.map((p, idx) => `
      <tr style="background: ${idx % 2 === 0 ? '#f9fafb' : 'white'};">
        <td style="padding: 10px; border: 1px solid #ddd; text-align: center;">${idx + 1}</td>
        <td style="padding: 10px; border: 1px solid #ddd;">${p.description || '-'}</td>
        <td style="padding: 10px; border: 1px solid #ddd; text-align: right;">${formatCurrencyWithType(p.amount, entry.currency)}</td>
        <td style="padding: 10px; border: 1px solid #ddd; text-align: center;">${p.isPaid ? '✓ Ödendi' : '○ Ödenmedi'}</td>
      </tr>
    `).join('');
    
    paymentPlanHtml = `
      <div style="margin-bottom: 25px;">
        <h2 style="font-size: 16px; margin-bottom: 10px; color: #1a1a1a; border-bottom: 2px solid #6366f1; padding-bottom: 5px;">Ödeme Planı</h2>
        <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
          <thead>
            <tr style="background: #6366f1; color: white;">
              <th style="padding: 10px; text-align: center; border: 1px solid #ddd; width: 40px;">#</th>
              <th style="padding: 10px; text-align: left; border: 1px solid #ddd;">Açıklama</th>
              <th style="padding: 10px; text-align: right; border: 1px solid #ddd; width: 120px;">Tutar</th>
              <th style="padding: 10px; text-align: center; border: 1px solid #ddd; width: 100px;">Durum</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </div>
    `;
  }

  // Balance section for götürü bedel
  let balanceHtml = '';
  if (entry.contractType === 'goturu_bedel') {
    balanceHtml = `
      <tr style="background: #f9fafb;">
        <td style="padding: 10px; border: 1px solid #ddd;">Ödenen Miktar</td>
        <td style="padding: 10px; border: 1px solid #ddd;">${formatCurrencyWithType(paidAmount, entry.currency)}</td>
      </tr>
      <tr>
        <td style="padding: 10px; border: 1px solid #ddd;">Kalan Bakiye</td>
        <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold; color: ${remainingBalance > 0 ? '#dc2626' : '#22c55e'};">${formatCurrencyWithType(remainingBalance, entry.currency)}</td>
      </tr>
    `;
  }
  
  container.innerHTML = `
    <div style="margin-bottom: 20px;">
      <img src="${formanLogo}" style="height: 50px; margin-bottom: 10px;" />
      <h1 style="text-align: center; font-size: 24px; margin: 10px 0; color: #1a1a1a;">ALTYÜKLENICI SÖZLEŞME RAPORU</h1>
      <p style="text-align: center; font-size: 12px; color: #666;">Rapor Tarihi: ${formatDate(new Date().toISOString())}</p>
    </div>
    
    <div style="margin-bottom: 25px;">
      <h2 style="font-size: 16px; margin-bottom: 10px; color: #1a1a1a; border-bottom: 2px solid #3b82f6; padding-bottom: 5px;">Sözleşme Bilgileri</h2>
      <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
        <thead>
          <tr style="background: #3b82f6; color: white;">
            <th style="padding: 10px; text-align: left; border: 1px solid #ddd;">Açıklama</th>
            <th style="padding: 10px; text-align: left; border: 1px solid #ddd;">Değer</th>
          </tr>
        </thead>
        <tbody>
          <tr style="background: #f9fafb;">
            <td style="padding: 10px; border: 1px solid #ddd;">Sözleşme No</td>
            <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">${entry.contractNo}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #ddd;">Proje</td>
            <td style="padding: 10px; border: 1px solid #ddd;">${project?.projectCode} - ${project?.projectName}</td>
          </tr>
          <tr style="background: #f9fafb;">
            <td style="padding: 10px; border: 1px solid #ddd;">Altyüklenici</td>
            <td style="padding: 10px; border: 1px solid #ddd;">${entry.subcontractor}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #ddd;">İş Kalemi</td>
            <td style="padding: 10px; border: 1px solid #ddd;">${entry.workCategory}</td>
          </tr>
          <tr style="background: #f9fafb;">
            <td style="padding: 10px; border: 1px solid #ddd;">Sözleşme Tipi</td>
            <td style="padding: 10px; border: 1px solid #ddd;">${contractTypeLabels[entry.contractType]}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #ddd;">Tarih</td>
            <td style="padding: 10px; border: 1px solid #ddd;">${formatDate(entry.date)}</td>
          </tr>
        </tbody>
      </table>
    </div>
    
    ${workItemsHtml}
    ${paymentPlanHtml}
    
    <div style="margin-bottom: 25px;">
      <h2 style="font-size: 16px; margin-bottom: 10px; color: #1a1a1a; border-bottom: 2px solid #22c55e; padding-bottom: 5px;">Tutar Bilgileri</h2>
      <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
        <thead>
          <tr style="background: #22c55e; color: white;">
            <th style="padding: 10px; text-align: left; border: 1px solid #ddd;">Açıklama</th>
            <th style="padding: 10px; text-align: left; border: 1px solid #ddd;">Tutar</th>
          </tr>
        </thead>
        <tbody>
          <tr style="background: #f9fafb;">
            <td style="padding: 10px; border: 1px solid #ddd;">Ara Toplam</td>
            <td style="padding: 10px; border: 1px solid #ddd;">${formatCurrencyWithType(subtotal, entry.currency)}</td>
          </tr>
          ${entry.vatRate ? `
          <tr>
            <td style="padding: 10px; border: 1px solid #ddd;">KDV (%${entry.vatRate})</td>
            <td style="padding: 10px; border: 1px solid #ddd;">${formatCurrencyWithType(vatAmount, entry.currency)}</td>
          </tr>
          <tr style="background: #f9fafb;">
            <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">KDV Dahil Toplam</td>
            <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">${formatCurrencyWithType(totalWithVat, entry.currency)}</td>
          </tr>
          ` : ''}
          ${balanceHtml}
        </tbody>
      </table>
    </div>
    
    <div style="display: flex; justify-content: space-between; margin-top: 60px;">
      <div style="text-align: center; width: 45%;">
        <p style="font-size: 12px; margin-bottom: 40px;">Direktör Onayı:</p>
        <div style="border-bottom: 1px solid #333; margin-bottom: 5px;"></div>
        <p style="font-size: 10px; color: #666;">İmza / Tarih</p>
      </div>
      <div style="text-align: center; width: 45%;">
        <p style="font-size: 12px; margin-bottom: 40px;">Muhasebe Onayı:</p>
        <div style="border-bottom: 1px solid #333; margin-bottom: 5px;"></div>
        <p style="font-size: 10px; color: #666;">İmza / Tarih</p>
      </div>
    </div>
  `;
  
  document.body.appendChild(container);
  
  try {
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
    });
    
    const pdf = new jsPDF('p', 'mm', 'a4');
    const imgData = canvas.toDataURL('image/png');
    
    const imgWidth = 190;
    const pageHeight = 297;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    
    let heightLeft = imgHeight;
    let position = 10;
    
    pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;
    
    while (heightLeft > 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }
    
    pdf.save(`sozlesme-raporu-${entry.contractNo}.pdf`);
  } catch (error) {
    console.error('PDF oluşturma hatası:', error);
    throw error;
  } finally {
    document.body.removeChild(container);
  }
};

export const generateHakedisPDF = async (
  hakedis: SubcontractorHakedis,
  project: Project | undefined,
  contract: WorkEntry | undefined,
  subcontractorHakedisler: SubcontractorHakedis[]
) => {
  // Calculate financial data
  const subtotal = hakedis.totalAmount;
  const vatAmount = hakedis.vatRate ? subtotal * (hakedis.vatRate / 100) : 0;
  const totalWithVat = subtotal + vatAmount;
  
  // Contract summary
  const contractTotal = contract?.totalAmount || 0;
  const allHakedisler = subcontractorHakedisler.filter(h => h.contractId === hakedis.contractId);
  const totalPaidAmount = allHakedisler.reduce((sum, h) => sum + h.totalAmount, 0);
  const remainingBalance = contractTotal - totalPaidAmount;

  // Create a temporary container for the PDF content
  const container = document.createElement('div');
  container.style.cssText = 'position: absolute; left: -9999px; top: 0; width: 800px; padding: 40px; background: white; font-family: Arial, sans-serif;';
  
  // Generate hakediş items table rows
  let hakedisItemsHtml = '';
  if (hakedis.contractType === 'birim_fiyat' && hakedis.hakedisItems && hakedis.hakedisItems.length > 0) {
    const rows = hakedis.hakedisItems.map((item, idx) => `
      <tr style="background: ${idx % 2 === 0 ? '#f9fafb' : 'white'};">
        <td style="padding: 10px; border: 1px solid #ddd; text-align: center;">${idx + 1}</td>
        <td style="padding: 10px; border: 1px solid #ddd;">${item.description || item.workCategory}</td>
        <td style="padding: 10px; border: 1px solid #ddd; text-align: center;">${item.unit}</td>
        <td style="padding: 10px; border: 1px solid #ddd; text-align: right;">${item.quantity}</td>
        <td style="padding: 10px; border: 1px solid #ddd; text-align: right;">${formatCurrencyWithType(item.unitPrice, hakedis.currency)}</td>
        <td style="padding: 10px; border: 1px solid #ddd; text-align: right;">${formatCurrencyWithType(item.amount, hakedis.currency)}</td>
      </tr>
    `).join('');
    
    hakedisItemsHtml = `
      <div style="margin-bottom: 25px;">
        <h2 style="font-size: 16px; margin-bottom: 10px; color: #1a1a1a; border-bottom: 2px solid #6366f1; padding-bottom: 5px;">Hakediş Kalemleri</h2>
        <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
          <thead>
            <tr style="background: #6366f1; color: white;">
              <th style="padding: 10px; text-align: center; border: 1px solid #ddd; width: 40px;">#</th>
              <th style="padding: 10px; text-align: left; border: 1px solid #ddd;">Açıklama</th>
              <th style="padding: 10px; text-align: center; border: 1px solid #ddd; width: 60px;">Birim</th>
              <th style="padding: 10px; text-align: right; border: 1px solid #ddd; width: 80px;">Miktar</th>
              <th style="padding: 10px; text-align: right; border: 1px solid #ddd; width: 100px;">Birim Fiyat</th>
              <th style="padding: 10px; text-align: right; border: 1px solid #ddd; width: 100px;">Tutar</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </div>
    `;
  }

  // Contract summary section
  let contractSummaryHtml = '';
  if (contract) {
    contractSummaryHtml = `
      <div style="margin-bottom: 25px;">
        <h2 style="font-size: 16px; margin-bottom: 10px; color: #1a1a1a; border-bottom: 2px solid #f59e0b; padding-bottom: 5px;">Sözleşme Özeti</h2>
        <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
          <thead>
            <tr style="background: #f59e0b; color: white;">
              <th style="padding: 10px; text-align: left; border: 1px solid #ddd;">Açıklama</th>
              <th style="padding: 10px; text-align: left; border: 1px solid #ddd;">Tutar</th>
            </tr>
          </thead>
          <tbody>
            <tr style="background: #f9fafb;">
              <td style="padding: 10px; border: 1px solid #ddd;">Sözleşme Toplam</td>
              <td style="padding: 10px; border: 1px solid #ddd;">${formatCurrencyWithType(contractTotal, contract.currency)}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border: 1px solid #ddd;">Toplam Hakediş</td>
              <td style="padding: 10px; border: 1px solid #ddd;">${formatCurrencyWithType(totalPaidAmount, contract.currency)}</td>
            </tr>
            ${contract.contractType === 'goturu_bedel' ? `
            <tr style="background: #f9fafb;">
              <td style="padding: 10px; border: 1px solid #ddd;">Kalan Bakiye</td>
              <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold; color: ${remainingBalance > 0 ? '#dc2626' : '#22c55e'};">${formatCurrencyWithType(remainingBalance, contract.currency)}</td>
            </tr>
            ` : ''}
          </tbody>
        </table>
      </div>
    `;
  }
  
  container.innerHTML = `
    <div style="margin-bottom: 20px;">
      <img src="${formanLogo}" style="height: 50px; margin-bottom: 10px;" />
      <h1 style="text-align: center; font-size: 24px; margin: 10px 0; color: #1a1a1a;">ALTYÜKLENICI HAKEDİŞ RAPORU</h1>
      <p style="text-align: center; font-size: 12px; color: #666;">Rapor Tarihi: ${formatDate(new Date().toISOString())}</p>
    </div>
    
    <div style="margin-bottom: 25px;">
      <h2 style="font-size: 16px; margin-bottom: 10px; color: #1a1a1a; border-bottom: 2px solid #3b82f6; padding-bottom: 5px;">Hakediş Bilgileri</h2>
      <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
        <thead>
          <tr style="background: #3b82f6; color: white;">
            <th style="padding: 10px; text-align: left; border: 1px solid #ddd;">Açıklama</th>
            <th style="padding: 10px; text-align: left; border: 1px solid #ddd;">Değer</th>
          </tr>
        </thead>
        <tbody>
          <tr style="background: #f9fafb;">
            <td style="padding: 10px; border: 1px solid #ddd;">Hakediş No</td>
            <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">${hakedis.hakedisNo}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #ddd;">Sözleşme No</td>
            <td style="padding: 10px; border: 1px solid #ddd;">${hakedis.contractNo}</td>
          </tr>
          <tr style="background: #f9fafb;">
            <td style="padding: 10px; border: 1px solid #ddd;">Altyüklenici</td>
            <td style="padding: 10px; border: 1px solid #ddd;">${hakedis.subcontractor}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #ddd;">Proje</td>
            <td style="padding: 10px; border: 1px solid #ddd;">${project?.projectCode} - ${project?.projectName}</td>
          </tr>
          <tr style="background: #f9fafb;">
            <td style="padding: 10px; border: 1px solid #ddd;">Sözleşme Tipi</td>
            <td style="padding: 10px; border: 1px solid #ddd;">${contractTypeLabels[hakedis.contractType]}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #ddd;">Tarih</td>
            <td style="padding: 10px; border: 1px solid #ddd;">${formatDate(hakedis.date)}</td>
          </tr>
        </tbody>
      </table>
    </div>
    
    ${hakedisItemsHtml}
    
    <div style="margin-bottom: 25px;">
      <h2 style="font-size: 16px; margin-bottom: 10px; color: #1a1a1a; border-bottom: 2px solid #22c55e; padding-bottom: 5px;">Tutar Bilgileri</h2>
      <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
        <thead>
          <tr style="background: #22c55e; color: white;">
            <th style="padding: 10px; text-align: left; border: 1px solid #ddd;">Açıklama</th>
            <th style="padding: 10px; text-align: left; border: 1px solid #ddd;">Tutar</th>
          </tr>
        </thead>
        <tbody>
          <tr style="background: #f9fafb;">
            <td style="padding: 10px; border: 1px solid #ddd;">Hakediş Tutarı</td>
            <td style="padding: 10px; border: 1px solid #ddd;">${formatCurrencyWithType(subtotal, hakedis.currency)}</td>
          </tr>
          ${hakedis.vatRate ? `
          <tr>
            <td style="padding: 10px; border: 1px solid #ddd;">KDV (%${hakedis.vatRate})</td>
            <td style="padding: 10px; border: 1px solid #ddd;">${formatCurrencyWithType(vatAmount, hakedis.currency)}</td>
          </tr>
          <tr style="background: #f9fafb;">
            <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">KDV Dahil Toplam</td>
            <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">${formatCurrencyWithType(totalWithVat, hakedis.currency)}</td>
          </tr>
          ` : ''}
          <tr>
            <td style="padding: 10px; border: 1px solid #ddd;">Ödeme Durumu</td>
            <td style="padding: 10px; border: 1px solid #ddd;">${hakedis.paymentStatus === 'odendi' ? '✓ Ödendi' : '○ Ödenmedi'}</td>
          </tr>
          ${hakedis.paidDate ? `
          <tr style="background: #f9fafb;">
            <td style="padding: 10px; border: 1px solid #ddd;">Ödeme Tarihi</td>
            <td style="padding: 10px; border: 1px solid #ddd;">${formatDate(hakedis.paidDate)}</td>
          </tr>
          ` : ''}
        </tbody>
      </table>
    </div>
    
    ${hakedis.contractExceededNote ? `
    <div style="margin-bottom: 25px; padding: 15px; background: #fef2f2; border: 2px solid #dc2626; border-radius: 8px;">
      <h2 style="font-size: 16px; margin-bottom: 10px; color: #dc2626; display: flex; align-items: center; gap: 8px;">
        ⚠️ UYARI
      </h2>
      <p style="font-size: 13px; color: #991b1b; margin: 0; font-weight: bold;">
        ${hakedis.contractExceededNote}
      </p>
    </div>
    ` : ''}
    
    ${contractSummaryHtml}
    
    <div style="display: flex; justify-content: space-between; margin-top: 60px;">
      <div style="text-align: center; width: 45%;">
        <p style="font-size: 12px; margin-bottom: 40px;">Direktör Onayı:</p>
        <div style="border-bottom: 1px solid #333; margin-bottom: 5px;"></div>
        <p style="font-size: 10px; color: #666;">İmza / Tarih</p>
      </div>
      <div style="text-align: center; width: 45%;">
        <p style="font-size: 12px; margin-bottom: 40px;">Muhasebe Onayı:</p>
        <div style="border-bottom: 1px solid #333; margin-bottom: 5px;"></div>
        <p style="font-size: 10px; color: #666;">İmza / Tarih</p>
      </div>
    </div>
  `;
  
  document.body.appendChild(container);
  
  try {
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
    });
    
    const pdf = new jsPDF('p', 'mm', 'a4');
    const imgData = canvas.toDataURL('image/png');
    
    const imgWidth = 190;
    const pageHeight = 297;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    
    let heightLeft = imgHeight;
    let position = 10;
    
    pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;
    
    while (heightLeft > 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }
    
    pdf.save(`hakedis-raporu-${hakedis.hakedisNo}.pdf`);
  } catch (error) {
    console.error('PDF oluşturma hatası:', error);
    throw error;
  } finally {
    document.body.removeChild(container);
  }
};
