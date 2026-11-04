'use client';
import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import RelatorioPerfil from '../../../../components/perfil-disc/RelatorioPerfil';
import { baixarPdfPerfil } from '../../../../lib/perfil-disc/relatorio-pdf';
import type { ResultadoPerfil } from '../../../../lib/perfil-disc/pontuacao';

interface AvaliacaoDetalhe {
  id: string;
  tipoRespondente: string;
  nomeRespondente: string | null;
  cargoRespondente: string | null;
  status: string;
  concluidoEm: string | null;
  consentimentoEm: string | null;
  tempoRespostaSeg: number | null;
  resultado: ResultadoPerfil | null;
  empresa: { razaoSocial: string; nomeFantasia: string; logoData: string | null };
}

export default function RelatorioPerfilPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [avaliacao, setAvaliacao] = useState<AvaliacaoDetalhe | null>(null);
  const [erro, setErro] = useState('');
  const [gerandoPdf, setGerandoPdf] = useState(false);

  useEffect(() => {
    let cancelado = false;
    fetch(`/api/perfil-disc/${encodeURIComponent(id)}`, { cache: 'no-store' })
      .then(async res => {
        const dados = await res.json().catch(() => ({}));
        if (cancelado) return;
        if (!res.ok) setErro(dados.error || 'Não foi possível carregar o relatório.');
        else setAvaliacao(dados.avaliacao);
      })
      .catch(() => { if (!cancelado) setErro('Sem conexão com o servidor.'); });
    return () => { cancelado = true; };
  }, [id]);

  const nome = avaliacao?.nomeRespondente || 'Respondente';
  const empresa = avaliacao ? avaliacao.empresa.nomeFantasia || avaliacao.empresa.razaoSocial : '';

  const baixar = async () => {
    if (!avaliacao?.resultado) return;
    setGerandoPdf(true);
    try {
      await baixarPdfPerfil({
        resultado: avaliacao.resultado,
        nome,
        cargo: avaliacao.cargoRespondente,
        empresa,
        tipo: avaliacao.tipoRespondente,
        concluidoEm: avaliacao.concluidoEm,
        tempoRespostaSeg: avaliacao.tempoRespostaSeg,
        empresaLogoData: avaliacao.empresa.logoData,
      });
    } catch (e) {
      console.error('Erro ao gerar o PDF do perfil:', e);
      toast.error('Não foi possível gerar o PDF.');
    } finally {
      setGerandoPdf(false);
    }
  };

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Relatório de Perfil Comportamental</div>
          <div className="page-subtitle">{avaliacao ? `${nome} · ${empresa}` : 'Resultado salvo da avaliação'}</div>
        </div>
        <div className="header-actions" style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button className="btn btn-secondary" onClick={() => router.push('/consultor/perfil-disc')}>← Voltar</button>
          {avaliacao?.resultado && (
            <button className="btn btn-primary" onClick={baixar} disabled={gerandoPdf}>
              {gerandoPdf ? '⏳ Gerando...' : 'Baixar PDF'}
            </button>
          )}
        </div>
      </div>

      <div className="page-body">
        {erro ? (
          <div className="card" style={{ textAlign: 'center', fontSize: 14, color: 'var(--red)' }}>{erro}</div>
        ) : !avaliacao ? (
          <div className="card" style={{ textAlign: 'center', fontSize: 14, color: 'var(--text-muted)' }}>⏳ Carregando relatório...</div>
        ) : !avaliacao.resultado ? (
          <div className="card" style={{ textAlign: 'center', fontSize: 14, color: 'var(--text-secondary)' }}>
            Esta pessoa ainda não respondeu. O relatório aparece aqui assim que as respostas forem enviadas.
          </div>
        ) : (
          <RelatorioPerfil
            resultado={avaliacao.resultado}
            respondente={{
              nome,
              cargo: avaliacao.cargoRespondente,
              empresa,
              tipo: avaliacao.tipoRespondente,
              concluidoEm: avaliacao.concluidoEm,
              consentimentoEm: avaliacao.consentimentoEm,
              tempoRespostaSeg: avaliacao.tempoRespostaSeg,
            }}
          />
        )}
      </div>
    </>
  );
}
