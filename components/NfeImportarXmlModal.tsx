'use client';
import { useState, useRef } from 'react';
import { toast } from 'sonner';
import { UploadCloud, FileCode, CheckCircle, RefreshCw, X } from 'lucide-react';

interface Props {
  empresaId: string;
  empresaNome: string;
  onClose: () => void;
  onConcluido: () => void;
}

export default function NfeImportarXmlModal({ empresaId, empresaNome, onClose, onConcluido }: Props) {
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [importando, setImportando] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleArquivos = (files: FileList | null) => {
    if (!files) return;
    const novos: File[] = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      if (f.name.endsWith('.xml')) {
        novos.push(f);
      }
    }
    if (novos.length === 0) {
      toast.error('Nenhum arquivo .xml selecionado.');
      return;
    }
    setArquivos(prev => [...prev, ...novos]);
  };

  const handleImportar = async () => {
    if (arquivos.length === 0) return;
    setImportando(true);
    try {
      // Lê o conteúdo dos arquivos XML como texto
      const xmls: string[] = [];
      for (const arq of arquivos) {
        const text = await arq.text();
        xmls.push(text);
      }

      const res = await fetch('/api/nfe/destinadas/importar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ empresaId, xmls }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erro ao importar arquivos XML.');
      }

      toast.success(data.mensagem || `${data.total} nota(s) importada(s) com sucesso!`);
      onConcluido();
      onClose();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Falha na importação dos XMLs.');
    } finally {
      setImportando(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && !importando && onClose()}>
      <div className="modal" style={{ maxWidth: 540, width: '95%' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ padding: 8, background: '#eff6ff', color: '#2563eb', borderRadius: 8 }}>
              <UploadCloud size={20} />
            </span>
            <div>
              <h2 className="modal-title" style={{ margin: 0, fontSize: 18 }}>
                Importar XMLs de NF-e
              </h2>
              <span style={{ fontSize: 12.5, color: '#6b7280' }}>
                {empresaNome} • Importe notas emitidas ou recebidas via arquivo XML
              </span>
            </div>
          </div>
          <button className="modal-close" onClick={onClose} disabled={importando}>✕</button>
        </div>

        <div style={{ margin: '16px 0' }}>
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              handleArquivos(e.dataTransfer.files);
            }}
            style={{
              border: '2px dashed #cbd5e1', borderRadius: 10, padding: 24, textAlign: 'center',
              background: '#f8fafc', cursor: 'pointer', transition: 'border-color .15s',
            }}
          >
            <UploadCloud size={36} color="#64748b" style={{ margin: '0 auto 8px' }} />
            <div style={{ fontSize: 14, fontWeight: 500, color: '#1e293b' }}>
              Clique para selecionar ou arraste arquivos .xml aqui
            </div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
              Suporta notas fiscais emitidas (vendas) ou recebidas (compras)
            </div>
            <input
              type="file"
              ref={fileInputRef}
              multiple
              accept=".xml"
              style={{ display: 'none' }}
              onChange={(e) => handleArquivos(e.target.files)}
            />
          </div>

          {arquivos.length > 0 && (
            <div style={{ marginTop: 14, maxHeight: 180, overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: 8, padding: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 6, display: 'flex', justifyContent: 'space-between' }}>
                <span>{arquivos.length} arquivo(s) selecionado(s):</span>
                <button
                  type="button"
                  onClick={() => setArquivos([])}
                  style={{ background: 'transparent', border: 'none', color: '#ef4444', fontSize: 11, cursor: 'pointer' }}
                >
                  Limpar todos
                </button>
              </div>
              {arquivos.map((a, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 6px', fontSize: 12, color: '#475569', borderBottom: '1px solid #f1f5f9' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <FileCode size={13} color="#2563eb" /> {a.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => setArquivos(l => l.filter((_, i) => i !== idx))}
                    style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
                  >
                    <X size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} disabled={importando} className="btn btn-secondary">
            Cancelar
          </button>
          <button
            onClick={handleImportar}
            disabled={importando || arquivos.length === 0}
            className="btn btn-primary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            {importando ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle size={14} />}
            {importando ? 'Importando...' : `Importar ${arquivos.length} XML(s)`}
          </button>
        </div>
      </div>
    </div>
  );
}

