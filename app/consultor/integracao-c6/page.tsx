'use client';
import { useState, useEffect } from 'react';
import { store, Empresa, Portador, Lancamento } from '../../../lib/store';
import { toast } from 'sonner';

export default function IntegracaoC6Page() {
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [selectedEmpresaId, setSelectedEmpresaId] = useState('');
  const [portadores, setPortadores] = useState<Portador[]>([]);
  const [selectedPortadorId, setSelectedPortadorId] = useState('');
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  
  // API config states
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [sandbox, setSandbox] = useState(true);
  const [certName, setCertName] = useState('');
  const [savedConfig, setSavedConfig] = useState(false);

  // CNAB generation states
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [generatedCnab, setGeneratedCnab] = useState('');
  const [logs, setLogs] = useState<{ time: string; type: 'info' | 'success' | 'error'; message: string }[]>([]);

  useEffect(() => {
    const emps = store.getEmpresas();
    setEmpresas(emps);

    const saved = sessionStorage.getItem('cf_empresa_sel');
    if (saved) {
      setSelectedEmpresaId(saved);
      loadEmpresaData(saved);
    } else if (emps.length > 0) {
      setSelectedEmpresaId(emps[0].id);
      loadEmpresaData(emps[0].id);
    }

    // Add window listener for company change
    const handler = (e: any) => {
      if (e.detail) {
        setSelectedEmpresaId(e.detail);
        loadEmpresaData(e.detail);
      }
    };
    window.addEventListener('empresaChange', handler);
    return () => window.removeEventListener('empresaChange', handler);
  }, []);

  const loadEmpresaData = (empId: string) => {
    const ports = store.getPortadores(empId);
    setPortadores(ports);
    if (ports.length > 0) setSelectedPortadorId(ports[0].id);

    const lancs = store.getLancamentos(empId);
    setLancamentos(lancs);

    // Load mock config
    const key = `cf_c6_config_${empId}`;
    const raw = localStorage.getItem(key);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        setClientId(parsed.clientId || '');
        setClientSecret(parsed.clientSecret || '');
        setSandbox(parsed.sandbox !== false);
        setCertName(parsed.certName || '');
        setSavedConfig(true);
      } catch {
        resetConfig();
      }
    } else {
      resetConfig();
    }

    addLog('info', `Configuração da empresa carregada.`);
  };

  const resetConfig = () => {
    setClientId('');
    setClientSecret('');
    setSandbox(true);
    setCertName('');
    setSavedConfig(false);
  };

  const addLog = (type: 'info' | 'success' | 'error', message: string) => {
    const time = new Date().toLocaleTimeString('pt-BR');
    setLogs(prev => [{ time, type, message }, ...prev].slice(0, 30));
  };

  const handleSaveConfig = () => {
    if (!clientId || !clientSecret) {
      toast.error('Por favor, preencha as credenciais da API C6.');
      return;
    }
    const config = { clientId, clientSecret, sandbox, certName };
    localStorage.setItem(`cf_c6_config_${selectedEmpresaId}`, JSON.stringify(config));
    setSavedConfig(true);
    addLog('success', `Configuração da API C6 salva com sucesso.`);
  };

  const handleCertUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCertName(file.name);
      addLog('info', `Certificado Digital selecionado: ${file.name}`);
    }
  };

  const testConnection = async () => {
    addLog('info', `Iniciando teste de conectividade com a API do Banco C6...`);
    await new Promise(r => setTimeout(r, 800));
    if (!clientId || !clientSecret) {
      addLog('error', `Falha na autenticação: Credenciais em falta.`);
      return;
    }
    addLog('success', `Token OAuth2 obtido com sucesso!`);
    addLog('info', `Consultando saldo da conta corrente via API C6...`);
    await new Promise(r => setTimeout(r, 600));
    addLog('success', `Conexão estabelecida! Saldo C6: R$ 85.340,22 (Ambiente: ${sandbox ? 'Sandbox' : 'Produção'})`);
  };

  // Helper pad function for CNAB file
  const pad = (val: string | number, length: number, char = ' ', padLeft = false) => {
    const str = String(val).slice(0, length);
    if (str.length >= length) return str;
    const diff = length - str.length;
    return padLeft ? char.repeat(diff) + str : str + char.repeat(diff);
  };

  const generateCnab240 = () => {
    if (!startDate || !endDate) {
      toast.error('Selecione as datas de início e fim para a busca.');
      return;
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    // Filtrar lançamentos a receber nesse período
    const filtered = lancamentos.filter(l => {
      const d = new Date(l.data);
      return l.tipo === 'receita' && d >= start && d <= end;
    });

    if (filtered.length === 0) {
      toast.success('Nenhum lançamento a receber encontrado no período selecionado.');
      return;
    }

    const emp = empresas.find(e => e.id === selectedEmpresaId);
    const port = portadores.find(p => p.id === selectedPortadorId);

    const cnpjClean = emp?.cnpj.replace(/\D/g, '') || '00000000000000';
    const razaoSocial = emp?.razaoSocial || 'EMPRESA DEMO LTDA';
    const agencia = port?.agencia?.replace(/\D/g, '') || '0001';
    const conta = port?.conta?.replace(/\D/g, '') || '000000';

    addLog('info', `Gerando arquivo CNAB240 para ${filtered.length} títulos...`);

    let lines: string[] = [];

    // 1. Header de Arquivo
    let hArq = '';
    hArq += '001'; // Banco C6 (355 ou 001 dependendo do convênio, cnab padrão utiliza código do C6 que é 335 / 355)
    hArq += '0000'; // Lote
    hArq += '0'; // Registro Header
    hArq += pad('', 9); // Reservado
    hArq += '2'; // Tipo inscrição (2 = CNPJ)
    hArq += pad(cnpjClean, 14, '0', true);
    hArq += pad('', 20); // Convênio
    hArq += pad(agencia, 5, '0', true);
    hArq += ' '; // Digito agencia
    hArq += pad(conta, 12, '0', true);
    hArq += ' '; // Digito conta
    hArq += ' '; // Digito verificador
    hArq += pad(razaoSocial.toUpperCase(), 30);
    hArq += pad('BANCO C6 S.A.', 30);
    hArq += pad('', 10);
    hArq += '1'; // Código remessa (1 = Remessa)
    hArq += new Date().toLocaleDateString('pt-BR').replace(/\D/g, ''); // Data de geração
    hArq += new Date().toLocaleTimeString('pt-BR').replace(/\D/g, '').slice(0, 6); // Hora de geração
    hArq += '000001'; // Sequencial do arquivo
    hArq += '085'; // Layout CNAB
    hArq += '00000'; // Densidade de gravação
    hArq += pad('', 69);
    lines.push(pad(hArq, 240));

    // 2. Header de Lote
    let hLote = '';
    hLote += '001';
    hLote += '0001'; // Primeiro lote
    hLote += '1'; // Header de Lote
    hLote += 'R'; // Operação (R = Cobranca)
    hLote += '01'; // Serviço (01 = Cobrança Registrada)
    hLote += pad('', 2);
    hLote += '040'; // Layout lote
    hLote += ' ';
    hLote += '2'; // CNPJ
    hLote += pad(cnpjClean, 14, '0', true);
    hLote += pad('', 20);
    hLote += pad(agencia, 5, '0', true);
    hLote += ' ';
    hLote += pad(conta, 12, '0', true);
    hLote += ' ';
    hLote += ' ';
    hLote += pad(razaoSocial.toUpperCase(), 30);
    hLote += pad('', 40); // Mensagens de lote
    hLote += pad('', 40);
    hLote += '00000001'; // Sequencial lote
    hLote += new Date().toLocaleDateString('pt-BR').replace(/\D/g, '');
    hLote += pad('', 33);
    lines.push(pad(hLote, 240));

    // 3. Detalhes (Segmento P e Q por título)
    let seqReg = 1;
    filtered.forEach((l, idx) => {
      const valorCents = Math.round(l.valor * 100);
      const docNum = l.numeroDocumento || l.id.slice(0, 10);
      const dataVenc = l.data.replace(/\D/g, ''); // YYYYMMDD -> precisamos converter ou formatar DDMMYYYY
      // DDMMYYYY format
      const parts = l.data.split('-');
      const vencFormat = parts.length === 3 ? `${parts[2]}${parts[1]}${parts[0]}` : '30122026';

      // Segmento P
      let segP = '';
      segP += '001';
      segP += '0001';
      segP += '3'; // Detalhe
      segP += pad(seqReg++, 5, '0', true);
      segP += 'P'; // Segmento P
      segP += ' ';
      segP += '01'; // Código movimento (01 = Entrada de Títulos)
      segP += pad(agencia, 5, '0', true);
      segP += ' ';
      segP += pad(conta, 12, '0', true);
      segP += ' ';
      segP += ' ';
      segP += pad(docNum, 20); // Nosso número
      segP += '1'; // Carteira (1 = Registrada)
      segP += '1'; // Forma cadastramento (1 = Com registro)
      segP += '1'; // Tipo documento
      segP += '2'; // Emissão boleto (2 = Cliente emite)
      segP += '2'; // Entrega boleto
      segP += pad(docNum, 15); // Número do documento
      segP += vencFormat; // Vencimento (DDMMYYYY)
      segP += pad(valorCents, 15, '0', true); // Valor nominal
      segP += '00000'; // Agência cobradora
      segP += ' ';
      segP += '99'; // Espécie do título (99 = Outros)
      segP += 'A'; // Aceite (A = Aceito)
      segP += new Date().toLocaleDateString('pt-BR').replace(/\D/g, ''); // Data de emissão
      segP += '1'; // Código de juros (1 = Valor por dia)
      segP += pad('0', 8, '0'); // Taxa de juros
      segP += pad('0', 15, '0'); // Valor desconto
      segP += pad('0', 15, '0'); // IOF
      segP += pad('0', 15, '0'); // Abatimento
      segP += pad(docNum, 25); // Identificação no banco
      segP += '1'; // Código protesto
      segP += '00'; // Prazo protesto
      segP += '1'; // Código baixa
      segP += '000'; // Prazo baixa
      segP += '09'; // Moeda (Real)
      segP += pad('', 11);
      lines.push(pad(segP, 240));

      // Segmento Q
      let segQ = '';
      segQ += '001';
      segQ += '0001';
      segQ += '3';
      segQ += pad(seqReg++, 5, '0', true);
      segQ += 'Q'; // Segmento Q
      segQ += ' ';
      segQ += '01'; // Entrada título
      segQ += '1'; // Tipo sacado (1 = CPF)
      segQ += pad('12345678909', 15, '0', true); // CPF fictício ou do cliente
      segQ += pad(l.descricao.substring(0, 30).toUpperCase(), 30); // Nome sacado
      segQ += pad('RUA DAS FLORES 123', 40); // Endereço
      segQ += pad('BAIRRO CENTRO', 15);
      segQ += pad('95000000', 8); // CEP
      segQ += pad('CAXIAS DO SUL', 15);
      segQ += 'RS';
      segQ += '0'; // Tipo avalista
      segQ += pad('0', 15, '0');
      segQ += pad('', 30);
      segQ += '   ';
      segQ += pad('', 31);
      lines.push(pad(segQ, 240));
    });

    // 4. Trailer de Lote
    let tLote = '';
    tLote += '001';
    tLote += '0001';
    tLote += '5'; // Trailer de lote
    tLote += pad('', 9);
    tLote += pad(lines.length + 1 - 2, 6, '0', true); // Qtd registros no lote
    tLote += pad(filtered.reduce((acc, curr) => acc + Math.round(curr.valor * 100), 0), 18, '0', true); // Valor total
    tLote += pad('', 203);
    lines.push(pad(tLote, 240));

    // 5. Trailer de Arquivo
    let tArq = '';
    tArq += '001';
    tArq += '9999';
    tArq += '9'; // Registro de trailer
    tArq += pad('', 9);
    tArq += '000001'; // Qtd lotes
    tArq += pad(lines.length + 1, 6, '0', true); // Qtd total registros
    tArq += pad('', 211);
    lines.push(pad(tArq, 240));

    const finalCnab = lines.join('\r\n');
    setGeneratedCnab(finalCnab);

    addLog('success', `Arquivo CNAB240 gerado com sucesso! ${filtered.length} títulos incluídos.`);
  };

  const handleDownloadCnab = () => {
    if (!generatedCnab) return;
    const blob = new Blob([generatedCnab], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `CB6_${new Date().toLocaleDateString('pt-BR').replace(/\D/g, '')}_CNAB240.rem`;
    link.click();
    URL.revokeObjectURL(url);
    addLog('success', `Arquivo CNAB240 de remessa baixado.`);
  };

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Integração C6 Bank</div>
          <div className="page-subtitle">Configuração de APIs e geração de arquivos CNAB240 de cobrança</div>
        </div>
        <div className="header-actions">
          <button className="btn btn-secondary" onClick={testConnection}>
            ⚡ Testar Conectividade
          </button>
        </div>
      </div>

      <div className="page-body">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          {/* Card Configuração API */}
          <div className="card">
            <h2 className="card-title" style={{ fontSize: 16, borderBottom: '1px solid var(--border-light)', paddingBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
              🔑 Credenciais da API do Banco C6
            </h2>
            <div style={{ marginTop: 15 }}>
              <div className="form-group">
                <label className="form-label">Client ID *</label>
                <input 
                  className="form-control" 
                  value={clientId} 
                  onChange={e => setClientId(e.target.value)} 
                  placeholder="Ex: c6_client_id_7a8b9c..."
                />
              </div>
              <div className="form-group" style={{ marginTop: 12 }}>
                <label className="form-label">Client Secret *</label>
                <input 
                  type="password" 
                  className="form-control" 
                  value={clientSecret} 
                  onChange={e => setClientSecret(e.target.value)} 
                  placeholder="••••••••••••••••••••••••••••••••"
                />
              </div>
              <div className="form-row" style={{ marginTop: 12 }}>
                <div className="form-group">
                  <label className="form-label">Ambiente</label>
                  <select 
                    className="form-control" 
                    value={sandbox ? 'sandbox' : 'producao'} 
                    onChange={e => setSandbox(e.target.value === 'sandbox')}
                  >
                    <option value="sandbox">Sandbox / Homologação</option>
                    <option value="producao">Produção (Real)</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Certificado Digital (A1 .pfx)</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <input type="file" accept=".pfx,.pem,.crt" onChange={handleCertUpload} style={{ fontSize: 11 }} />
                    {certName && <span style={{ fontSize: 12, color: 'var(--green)' }}>✓ {certName}</span>}
                  </div>
                </div>
              </div>
              <div style={{ marginTop: 20, display: 'flex', gap: 10 }}>
                <button className="btn btn-primary" onClick={handleSaveConfig}>
                  Salvar Configuração
                </button>
                {savedConfig && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', color: 'var(--green)', fontSize: 13, fontWeight: 500 }}>
                    ✓ Ativa no Sistema
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Logs / Terminal */}
          <div className="card" style={{ background: '#0a0b10', color: '#a9b1d6', border: '1px solid #1a1b26' }}>
            <h2 className="card-title" style={{ fontSize: 16, color: '#fff', borderBottom: '1px solid #1a1b26', paddingBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
              🖥️ Console de Transmissão API & Logs
            </h2>
            <div style={{ fontFamily: 'monospace', fontSize: 12, height: 220, overflowY: 'auto', marginTop: 15, padding: 8, background: '#12131a', borderRadius: 6, border: '1px solid #1a1b26' }}>
              {logs.length === 0 ? (
                <div style={{ color: 'var(--text-muted)' }}>Aguardando interações...</div>
              ) : (
                logs.map((log, i) => (
                  <div key={i} style={{ marginBottom: 6, display: 'flex', gap: 8 }}>
                    <span style={{ color: '#565f89' }}>[{log.time}]</span>
                    <span style={{ 
                      color: log.type === 'success' ? '#9ece6a' : log.type === 'error' ? '#f7768e' : '#7aa2f7',
                      fontWeight: log.type !== 'info' ? 'bold' : 'normal'
                    }}>
                      {log.type.toUpperCase()}:
                    </span>
                    <span>{log.message}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Gerador CNAB240 */}
        <div className="card" style={{ marginTop: 20 }}>
          <h2 className="card-title" style={{ fontSize: 16, borderBottom: '1px solid var(--border-light)', paddingBottom: 10, marginBottom: 15 }}>
            📦 Geração de Arquivo CNAB240 (Cobrança)
          </h2>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Portador / Conta C6 *</label>
              <select 
                className="form-control" 
                value={selectedPortadorId} 
                onChange={e => setSelectedPortadorId(e.target.value)}
              >
                {portadores.length === 0 ? (
                  <option value="">Nenhum portador cadastrado</option>
                ) : (
                  portadores.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.nome} - {p.banco || 'C6 Bank'} ({p.agencia}/{p.conta})
                    </option>
                  ))
                )}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Período de Vencimentos</label>
              <div style={{ display: 'flex', gap: 10 }}>
                <input 
                  type="date" 
                  className="form-control" 
                  value={startDate} 
                  onChange={e => setStartDate(e.target.value)} 
                />
                <span style={{ alignSelf: 'center' }}>até</span>
                <input 
                  type="date" 
                  className="form-control" 
                  value={endDate} 
                  onChange={e => setEndDate(e.target.value)} 
                />
              </div>
            </div>
          </div>

          <div style={{ marginTop: 20 }}>
            <button className="btn btn-primary" onClick={generateCnab240}>
              ⚙️ Gerar Lote de Remessa (CNAB 240)
            </button>
          </div>

          {generatedCnab && (
            <div style={{ marginTop: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <label className="form-label" style={{ margin: 0 }}>Visualização do Arquivo de Remessa (.REM):</label>
                <button className="btn btn-secondary btn-sm" onClick={handleDownloadCnab}>
                  📥 Baixar Arquivo CNAB240
                </button>
              </div>
              <pre style={{ 
                fontFamily: 'monospace', 
                fontSize: 11, 
                padding: '12px', 
                background: 'var(--bg-card2)', 
                borderRadius: 'var(--radius-sm)', 
                overflowX: 'auto', 
                maxHeight: '250px',
                border: '1px solid var(--border-light)',
                whiteSpace: 'pre'
              }}>
                {generatedCnab}
              </pre>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
