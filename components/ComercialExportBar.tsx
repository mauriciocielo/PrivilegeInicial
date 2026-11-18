'use client';

import React, { useState } from 'react';
import { FileText, FileSpreadsheet, Printer, MessageSquare, Mail } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { store } from '@/lib/store';
import { redirectToWhatsAppShare } from '@/lib/whatsapp-share';
import { PDF_BRAND_NAME } from '@/lib/pdf-branding';

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
    };
  };

  async function buildPdfDoc() {
    const { jsPDF } = await import('jspdf');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const emp = getEmpresaInfo();
    const pageW = pdf.internal.pageSize.getWidth();
    let y = 14;

    // Cabeçalho institucional Vinho
    pdf.setFillColor(96, 0, 0);
    pdf.rect(0, 0, pageW, 24, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(13);
    pdf.setFont('helvetica', 'bold');
    pdf.text(PDF_BRAND_NAME, 12, 10);
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`${title} · ${emp.nome}`, 12, 17);
    pdf.setFontSize(8.5);
    pdf.text(new Date().toLocaleDateString('pt-BR'), pageW - 12, 17, { align: 'right' });

    y = 32;
    pdf.setTextColor(23, 23, 23);

    // KPIs
    if (kpis.length > 0) {
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Resumo Executivo:', 12, y);
      y += 5;
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9);
      for (const k of kpis) {
        pdf.text(`• ${k.label}: ${k.value}`, 14, y);
        y += 5;
      }
      y += 3;
    }

    // Tabela
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'bold');
    const usableW = pageW - 24;
    const colW = usableW / Math.max(1, columns.length);

    pdf.setFillColor(245, 245, 246);
    pdf.rect(12, y - 4, usableW, 7, 'F');
    columns.forEach((col, i) => {
      pdf.text(String(col.header).slice(0, 18), 13 + i * colW, y);
    });
    y += 6;

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    for (const row of rows) {
      if (y > 278) {
        pdf.addPage();
        y = 16;
      }
      columns.forEach((col, i) => {
        const val = row[col.key] ?? '';
        pdf.text(String(val).slice(0, 22), 13 + i * colW, y);
      });
      pdf.setDrawColor(230, 230, 230);
      pdf.line(12, y + 1.5, pageW - 12, y + 1.5);
      y += 6;
    }

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
        <button type="button" onClick={() => window.print()} className="btn btn-secondary" style={{ padding: '6px 11px', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
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
