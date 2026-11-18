'use client';

import React, { useState } from 'react';
import { FileText, FileSpreadsheet, Printer, MessageSquare, Mail } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { store } from '@/lib/store';
import { redirectToWhatsAppShare } from '@/lib/whatsapp-share';
import {
  PDF_ACCENT,
  PDF_BORDER,
  PDF_BRAND_NAME,
  PDF_DARK,
  PDF_GRAY,
  PDF_LIGHT,
  drawPdfFooter,
  drawPdfHeaderBand,
  getOfficeLogoBase64,
} from '@/lib/pdf-branding';

export interface ExportColumn {
  header: string;
  key: string;
}

export interface ComercialExportBarProps {
  title: string;
  fileNameBase: string;
  kpis: Array<{ label: string; value: string }>;
  columns: ExportColumn[];
  rows: Array<Record<string, any>>;
}

export default function ComercialExportBar({
  title,
  fileNameBase,
  kpis,
  columns,
  rows,
}: ComercialExportBarProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailTo, setEmailTo] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);

  const getEmpresaInfo = () => {
    const empId = store.getSafeEmpresaId();
    const emp = store.getEmpresas().find(e => e.id === empId);
    return {
      nome: emp?.nomeFantasia || emp?.razaoSocial || 'Empresa Selecionada',
      email: emp?.email || '',
      telefone: emp?.telefone || '',
      logoData: emp?.logoData || null,
    };
  };

  async function buildPdfDoc() {
    const { jsPDF } = await import('jspdf');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const emp = getEmpresaInfo();
    const officeLogoBase64 = await getOfficeLogoBase64();
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const M = 12;
    const headerH = 28;
    const usableW = pageW - M * 2;

    const { textX } = drawPdfHeaderBand(pdf, {
      pageWidth: pageW,
      margin: M,
      headerHeight: headerH,
      officeLogoBase64,
      empresaLogoData: emp.logoData,
    });

    const maxTextW = emp.logoData ? pageW - M - 36 - textX : pageW - M - textX;
    pdf.setTextColor(255, 255, 255);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(12.5);
    const titleLines = pdf.splitTextToSize(title, Math.max(60, maxTextW));
    pdf.text(titleLines[0] || title, textX, 11.5);

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.text(`${PDF_BRAND_NAME} · ${emp.nome}`, textX, 18.5);
    pdf.setFontSize(8);
    pdf.text(`Emitido em ${new Date().toLocaleDateString('pt-BR')}`, textX, 23.5);

    let y = headerH + 8;

    // KPI Cards em grade
    if (kpis.length > 0) {
      const colsPerRow = Math.min(4, kpis.length);
      const gap = 3;
      const cardW = (usableW - gap * (colsPerRow - 1)) / colsPerRow;
      const cardH = 16;

      kpis.forEach((k, idx) => {
        const colIdx = idx % colsPerRow;
        const rowIdx = Math.floor(idx / colsPerRow);
        const cx = M + colIdx * (cardW + gap);
        const cy = y + rowIdx * (cardH + gap);

        pdf.setFillColor(...PDF_LIGHT);
        pdf.setDrawColor(...PDF_BORDER);
        pdf.roundedRect(cx, cy, cardW, cardH, 2, 2, 'FD');

        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(7);
        pdf.setTextColor(...PDF_GRAY);
        pdf.text(String(k.label).toUpperCase().slice(0, 26), cx + 3, cy + 5.5);

        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(10.5);
        pdf.setTextColor(...PDF_ACCENT);
        pdf.text(String(k.value).slice(0, 26), cx + 3, cy + 12.2);
      });

      const totalRows = Math.ceil(kpis.length / colsPerRow);
      y += totalRows * (cardH + gap) + 4;
    }

    // Tabela com quebra automática de texto e cabeçalho repetido
    const colW = usableW / Math.max(1, columns.length);
    const drawTableHeader = (startY: number) => {
      pdf.setFillColor(...PDF_ACCENT);
      pdf.rect(M, startY, usableW, 8, 'F');
      pdf.setTextColor(255, 255, 255);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(8);
      columns.forEach((col, i) => {
        const hLines = pdf.splitTextToSize(String(col.header), colW - 3);
        pdf.text(hLines[0] || '', M + i * colW + 1.5, startY + 5.4);
      });
      return startY + 9;
    };

    y = drawTableHeader(y);

    rows.forEach((row, rIdx) => {
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(7.8);
      const cellLines = columns.map((col) =>
        pdf.splitTextToSize(String(row[col.key] ?? ''), Math.max(12, colW - 3))
      );
      const maxLines = Math.max(1, ...cellLines.map((l) => l.length));
      const rowH = Math.max(6.5, maxLines * 3.8 + 2.5);

      if (y + rowH > pageH - 18) {
        pdf.addPage();
        y = 14;
        y = drawTableHeader(y);
      }

      if (rIdx % 2 === 1) {
        pdf.setFillColor(248, 250, 252);
        pdf.rect(M, y - 0.5, usableW, rowH, 'F');
      }

      pdf.setTextColor(...PDF_DARK);
      cellLines.forEach((lines, i) => {
        pdf.text(lines, M + i * colW + 1.5, y + 3.5);
      });

      pdf.setDrawColor(...PDF_BORDER);
      pdf.setLineWidth(0.15);
      pdf.line(M, y + rowH - 0.5, pageW - M, y + rowH - 0.5);
      y += rowH;
    });

    drawPdfFooter(pdf, { pageWidth: pageW, pageHeight: pageH, margin: M });
    return pdf;
  }

  async function handleExportPdf() {
    setBusy(true);
    try {
      const pdf = await buildPdfDoc();
      pdf.save(`${fileNameBase}_${new Date().toISOString().slice(0, 10)}.pdf`);
      toast.success('PDF gerado com sucesso!');
    } catch {
      toast.error('Erro ao gerar PDF.');
    } finally {
      setBusy(false);
    }
  }

  async function handleExportExcel() {
    setBusy(true);
    try {
      const XLSX = await import('xlsx');
      const formattedRows = rows.map(r => {
        const obj: Record<string, any> = {};
        for (const col of columns) {
          obj[col.header] = r[col.key] ?? '';
        }
        return obj;
      });
      const ws = XLSX.utils.json_to_sheet(formattedRows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Comercial');
      XLSX.writeFile(wb, `${fileNameBase}_${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast.success('Planilha Excel (.xlsx) exportada!');
    } catch {
      toast.error('Erro ao gerar Excel.');
    } finally {
      setBusy(false);
    }
  }

  async function handleSendWhatsApp() {
    setBusy(true);
    try {
      const emp = getEmpresaInfo();
      const pdf = await buildPdfDoc();
      const dataUrl = pdf.output('datauristring');
      const kpiText = kpis.map(k => `• *${k.label}:* ${k.value}`).join('\n');
      const text = `📊 *${title}* — ${emp.nome}\n\n${kpiText}\n\nSegue em anexo o relatório completo em PDF.`;

      redirectToWhatsAppShare(
        {
          phone: emp.telefone,
          name: emp.nome,
          text,
          attachment: {
            dataUrl,
            mediaType: 'document',
            fileName: `${fileNameBase}.pdf`,
            mimeType: 'application/pdf',
          },
        },
        url => router.push(url)
      );
    } catch {
      toast.error('Erro ao preparar envio no WhatsApp.');
    } finally {
      setBusy(false);
    }
  }

  async function handleSendEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!emailTo.trim() || sendingEmail) return;
    setSendingEmail(true);
    try {
      const emp = getEmpresaInfo();
      const pdf = await buildPdfDoc();
      const base64Pdf = pdf.output('datauristring').split('base64,')[1];
      const kpiHtml = kpis.map(k => `<li><strong>${k.label}:</strong> ${k.value}</li>`).join('');
      const html = `
        <div style="font-family: Arial, sans-serif; color: #171717;">
          <h2 style="color: #600000; margin-bottom: 4px;">${PDF_BRAND_NAME}</h2>
          <p style="margin-top: 0; color: #666;">${title} — <strong>${emp.nome}</strong></p>
          <ul>${kpiHtml}</ul>
          <p>O relatório completo segue anexado em PDF.</p>
        </div>
      `;

      const res = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: emailTo.trim(),
          subject: `${title} — ${emp.nome}`,
          html,
          attachments: [
            {
              filename: `${fileNameBase}.pdf`,
              content: base64Pdf,
              encoding: 'base64',
            },
          ],
        }),
      });
      const d = await res.json();
      if (res.ok && d.success !== false) {
        toast.success(`E-mail enviado para ${emailTo.trim()}!`);
        setShowEmailModal(false);
      } else {
        toast.error(d.error || 'Erro ao enviar e-mail.');
      }
    } catch {
      toast.error('Falha ao enviar e-mail.');
    } finally {
      setSendingEmail(false);
    }
  }

  function handlePrintReport() {
    const emp = getEmpresaInfo();
    const esc = (s: any) =>
      String(s ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    const win = window.open('', '_blank', 'width=1024,height=768');
    if (!win) {
      window.print();
      return;
    }
    const kpiHtml = kpis
      .map(
        (k) =>
          `<div style="flex:1 1 160px;border:1px solid #e2e8f0;border-radius:8px;padding:10px 12px;background:#f8fafc;">
            <div style="font-size:11px;color:#64748b;text-transform:uppercase;font-weight:700;">${esc(k.label)}</div>
            <div style="font-size:16px;font-weight:800;color:#0f172a;margin-top:4px;">${esc(k.value)}</div>
          </div>`
      )
      .join('');
    const thHtml = columns.map((c) => `<th style="text-align:left;padding:8px 10px;border-bottom:2px solid #cbd5e1;font-size:12px;background:#f1f5f9;">${esc(c.header)}</th>`).join('');
    const trHtml = rows
      .map(
        (r) =>
          `<tr>${columns
            .map((c) => `<td style="padding:7px 10px;border-bottom:1px solid #e2e8f0;font-size:12px;vertical-align:top;">${esc(r[c.key] ?? '')}</td>`)
            .join('')}</tr>`
      )
      .join('');
    win.document.write(`<!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>${esc(title)}</title>
          <style>
            body { font-family: Arial, Helvetica, sans-serif; color: #0f172a; margin: 24px; }
            @media print { body { margin: 12mm; } }
          </style>
        </head>
        <body>
          <div style="background:#600000;color:#fff;padding:16px 20px;border-radius:8px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:center;gap:16px;">
            <div style="display:flex;align-items:center;gap:14px;">
              <div style="background:#fff;padding:6px 10px;border-radius:6px;display:flex;align-items:center;">
                <img src="${window.location.origin}/logo.png" alt="Logo" style="height:34px;width:auto;object-fit:contain;" />
              </div>
              <div>
                <div style="font-size:11px;font-weight:700;opacity:0.85;text-transform:uppercase;">${esc(PDF_BRAND_NAME)}</div>
                <h1 style="margin:2px 0 0;font-size:18px;color:#fff;">${esc(title)}</h1>
              </div>
            </div>
            <div style="text-align:right;font-size:11.5px;">
              <div><strong>${esc(emp.nome)}</strong></div>
              <div style="opacity:0.85;">Emissão: ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div>
            </div>
          </div>
          ${kpis.length > 0 ? `<div style="display:flex;flex-wrap:wrap;gap:10px;margin-bottom:16px;">${kpiHtml}</div>` : ''}
          <table style="width:100%;border-collapse:collapse;">
            <thead><tr>${thHtml}</tr></thead>
            <tbody>${trHtml}</tbody>
          </table>
        </body>
      </html>`);
    win.document.close();
    win.focus();
    setTimeout(() => {
      win.print();
      win.close();
    }, 250);
  }

  return (
    <>
      <div
        className="no-print"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 8,
          alignItems: 'center',
          padding: '10px 14px',
          marginBottom: 16,
          borderRadius: 12,
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
        }}
      >
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginRight: 4 }}>
          Exportar &amp; Compartilhar:
        </span>
        <button type="button" disabled={busy} onClick={handleExportPdf} className="btn btn-secondary" style={{ padding: '6px 11px', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <FileText size={14} color="#b91c1c" /> PDF
        </button>
        <button type="button" disabled={busy} onClick={handleExportExcel} className="btn btn-secondary" style={{ padding: '6px 11px', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <FileSpreadsheet size={14} color="#15803d" /> Excel
        </button>
        <button type="button" onClick={handlePrintReport} className="btn btn-secondary" style={{ padding: '6px 11px', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <Printer size={14} /> Imprimir
        </button>
        <button type="button" disabled={busy} onClick={handleSendWhatsApp} className="btn btn-secondary" style={{ padding: '6px 11px', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 5, color: '#15803d' }}>
          <MessageSquare size={14} /> Enviar no Whats
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            const emp = getEmpresaInfo();
            setEmailTo(emp.email || '');
            setShowEmailModal(true);
          }}
          className="btn btn-secondary"
          style={{ padding: '6px 11px', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 5 }}
        >
          <Mail size={14} color="var(--accent)" /> Enviar E-mail
        </button>
      </div>

      {showEmailModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 999,
            padding: 16,
          }}
        >
          <form
            onSubmit={handleSendEmailSubmit}
            className="card"
            style={{ width: '100%', maxWidth: 420, padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}
          >
            <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>Enviar Relatório por E-mail</h3>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
              O resumo executivo e o PDF completo de <strong>{title}</strong> serão enviados em anexo.
            </p>
            <div>
              <label className="form-label">E-mail de destino</label>
              <input
                type="email"
                className="form-control"
                placeholder="cliente@empresa.com.br"
                value={emailTo}
                onChange={e => setEmailTo(e.target.value)}
                required
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button type="button" onClick={() => setShowEmailModal(false)} className="btn btn-secondary">Cancelar</button>
              <button type="submit" disabled={sendingEmail} className="btn btn-primary">
                {sendingEmail ? 'Enviando...' : 'Enviar E-mail'}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
