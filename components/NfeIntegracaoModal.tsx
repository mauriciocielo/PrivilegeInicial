'use client';
import { useState } from 'react';
import { toast } from 'sonner';
import { Code, Copy, Check, Globe, Download, FileText, FileCode } from 'lucide-react';

interface Props {
  empresaId: string;
  empresaNome: string;
  cnpj: string;
  onClose: () => void;
}

export default function NfeIntegracaoModal({ empresaId, empresaNome, cnpj, onClose }: Props) {
  const [copiado, setCopiado] = useState<string | null>(null);
  const cnpjLimpo = (cnpj || '').replace(/\D/g, '');
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';

  const copiar = (texto: string, label: string) => {
    navigator.clipboard.writeText(texto);
    setCopiado(label);
    toast.success(`Copiado: ${label}!`);
    setTimeout(() => setCopiado(null), 2500);
  };

  const urlConsultaJson = `${baseUrl}/api/nfe/integracao?cnpj=${cnpjLimpo}&papel=todas`;
  const urlDownloadZip = `${baseUrl}/api/nfe/integracao?cnpj=${cnpjLimpo}&download=zip`;
  const urlDownloadXml = `${baseUrl}/api/nfe/integracao?chave=[CHAVE_44_DIGITOS]&download=xml`;
  const urlDownloadPdf = `${baseUrl}/api/nfe/integracao?chave=[CHAVE_44_DIGITOS]&download=pdf`;

  const curlExemplo = `curl -X GET "${urlConsultaJson}" \\
  -H "Authorization: Bearer seu_token_ou_chave"`;

  const curlZipExemplo = `curl -X GET "${urlDownloadZip}" \\
  -H "Authorization: Bearer seu_token_ou_chave" \\
  --output "notas_${cnpjLimpo}.zip"`;

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 740, width: '95%', maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="modal-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ padding: 8, background: '#f5f3ff', color: '#7c3aed', borderRadius: 8 }}>
              <Globe size={20} />
            </span>
            <div>
              <h2 className="modal-title" style={{ margin: 0, fontSize: 18 }}>
                API de Integração de NF-e
              </h2>
              <span style={{ fontSize: 12.5, color: '#6b7280' }}>
                {empresaNome} • Compartilhamento de notas (consulta e download de XMLs/PDFs) com outros sistemas
              </span>
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div style={{ margin: '16px 0', fontSize: 13, color: '#4b5563', lineHeight: 1.5 }}>
          Esta API permite que qualquer sistema externo (ERP, sistema contábil, PowerBI ou script de automação) consulte e faça o download automático dos XMLs e DANFEs das notas fiscais destinadas e emitidas.
        </div>

        {/* Card 1: Consulta em JSON */}
        <div style={{ background: '#f9fafb', borderRadius: 8, padding: 14, border: '1px solid #e5e7eb', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, fontSize: 13, color: '#111827' }}>
              <FileText size={15} color="#2563eb" /> 1. Consulta de Notas (JSON)
            </div>
            <button
              onClick={() => copiar(urlConsultaJson, 'URL de Consulta')}
              className="btn btn-secondary btn-sm"
              style={{ fontSize: 11, padding: '4px 8px', display: 'inline-flex', alignItems: 'center', gap: 4 }}
            >
              {copiado === 'URL de Consulta' ? <Check size={12} color="#16a34a" /> : <Copy size={12} />}
              Copiar URL
            </button>
          </div>
          <div style={{ background: '#1e293b', color: '#f8fafc', padding: '8px 12px', borderRadius: 6, fontSize: 11.5, fontFamily: 'monospace', overflowX: 'auto' }}>
            GET {urlConsultaJson}
          </div>
          <div style={{ fontSize: 11.5, color: '#6b7280', marginTop: 6 }}>
            Parâmetros opcionais: <code>papel=recebidas|emitidas|todas</code>, <code>mes=AAAA-MM</code>, <code>de=AAAA-MM-DD</code>, <code>ate=AAAA-MM-DD</code>, <code>situacao=autorizada|cancelada</code>.
          </div>
        </div>

        {/* Card 2: Download em Lote (ZIP) */}
        <div style={{ background: '#f9fafb', borderRadius: 8, padding: 14, border: '1px solid #e5e7eb', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, fontSize: 13, color: '#111827' }}>
              <Download size={15} color="#16a34a" /> 2. Download do Pacote Completo (ZIP com XMLs e PDFs)
            </div>
            <button
              onClick={() => copiar(urlDownloadZip, 'URL do Pacote ZIP')}
              className="btn btn-secondary btn-sm"
              style={{ fontSize: 11, padding: '4px 8px', display: 'inline-flex', alignItems: 'center', gap: 4 }}
            >
              {copiado === 'URL do Pacote ZIP' ? <Check size={12} color="#16a34a" /> : <Copy size={12} />}
              Copiar URL
            </button>
          </div>
          <div style={{ background: '#1e293b', color: '#f8fafc', padding: '8px 12px', borderRadius: 6, fontSize: 11.5, fontFamily: 'monospace', overflowX: 'auto' }}>
            GET {urlDownloadZip}
          </div>
        </div>

        {/* Card 3: Download de Nota Específica (XML ou PDF) */}
        <div style={{ background: '#f9fafb', borderRadius: 8, padding: 14, border: '1px solid #e5e7eb', marginBottom: 14 }}>
          <div style={{ fontWeight: 600, fontSize: 13, color: '#111827', marginBottom: 6 }}>
            3. Download Direto por Chave de Acesso (XML e PDF)
          </div>
          <div style={{ display: 'grid', gap: 8 }}>
            <div style={{ background: '#1e293b', color: '#f8fafc', padding: '8px 12px', borderRadius: 6, fontSize: 11.5, fontFamily: 'monospace', overflowX: 'auto' }}>
              XML: GET {urlDownloadXml}
            </div>
            <div style={{ background: '#1e293b', color: '#f8fafc', padding: '8px 12px', borderRadius: 6, fontSize: 11.5, fontFamily: 'monospace', overflowX: 'auto' }}>
              PDF: GET {urlDownloadPdf}
            </div>
          </div>
        </div>

        {/* Exemplo cURL */}
        <div style={{ background: '#0f172a', borderRadius: 8, padding: 14, border: '1px solid #1e293b', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8' }}>Exemplo em cURL (Terminal ou Postman)</span>
            <button
              onClick={() => copiar(curlExemplo, 'cURL')}
              className="btn btn-secondary btn-sm"
              style={{ fontSize: 11, padding: '4px 8px', background: '#334155', color: '#f8fafc', border: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}
            >
              {copiado === 'cURL' ? <Check size={12} color="#4ade80" /> : <Copy size={12} />}
              Copiar cURL
            </button>
          </div>
          <pre style={{ margin: 0, fontSize: 12, color: '#38bdf8', overflowX: 'auto' }}>
            {curlExemplo}
          </pre>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={onClose} className="btn btn-secondary">
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}

