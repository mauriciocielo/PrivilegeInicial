const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });

  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  // Attach io to global so App Router API routes can access it
  global.io = io;

  io.on('connection', (socket) => {
    console.log('🔌 Cliente WebSocket conectado:', socket.id);

    // Permitir propagação rápida direta caso o cliente emita
    socket.on('lancamento_criado', (data) => {
      socket.broadcast.emit('lancamento_criado', data);
    });

    socket.on('lancamento_atualizado', (data) => {
      socket.broadcast.emit('lancamento_atualizado', data);
    });

    socket.on('lancamento_excluido', (id) => {
      socket.broadcast.emit('lancamento_excluido', id);
    });

    socket.on('colecao_atualizada', (data) => {
      socket.broadcast.emit('colecao_atualizada', data);
    });

    socket.on('disconnect', () => {
      console.log('🔌 Cliente WebSocket desconectado:', socket.id);
    });
  });

  const port = process.env.PORT || 3000;
  httpServer.listen(port, () => {
    console.log(`> Ready on http://localhost:${port}`);
    agendarRelatorioFiscalDiario(port);
    agendarMonitorNfeDestinadas(port);
  });
});

// Envio diário das NFS-e (emitidas e tomadas) ao setor fiscal. O servidor roda
// continuamente (não é serverless), então o agendamento fica aqui mesmo.
// NFSE_RELATORIO_HORA: hora de Brasília (padrão 7). NFSE_RELATORIO_DESATIVADO=1 desliga.
function agendarRelatorioFiscalDiario(port) {
  if (process.env.NFSE_RELATORIO_DESATIVADO === '1') return;
  const segredo = process.env.CRON_SECRET || '835327beee70cd2d562f0621ace5090349fc8a37041db9c1';
  const hora = Number(process.env.NFSE_RELATORIO_HORA ?? 7);
  let ultimoDiaEnviado = '';
  setInterval(() => {
    const agoraBrasilia = new Date(Date.now() - 3 * 3600 * 1000);
    const dia = agoraBrasilia.toISOString().slice(0, 10);
    if (agoraBrasilia.getUTCHours() !== hora || ultimoDiaEnviado === dia) return;
    ultimoDiaEnviado = dia;
    fetch(`http://127.0.0.1:${port}/api/nfse/relatorio-diario`, { headers: { Authorization: `Bearer ${segredo}` } })
      .then(r => r.json())
      .then(d => console.log('[relatorio-fiscal]', d.mensagem || d.error))
      .catch(err => console.error('[relatorio-fiscal] Falha ao disparar:', err.message));
  }, 60 * 1000);
}

// Monitor contínuo de NF-e, CT-e e NFS-e destinadas às empresas com certificado A1 ativo.
// Consulta a SEFAZ respeitando a janela anti-bloqueio de 60-65 min e o ADN Nacional.
// NFE_MONITOR_DESATIVADO=1 desliga o agendador local.
function agendarMonitorNfeDestinadas(port) {
  if (process.env.NFE_MONITOR_DESATIVADO === '1') return;
  const segredo = process.env.CRON_SECRET || '835327beee70cd2d562f0621ace5090349fc8a37041db9c1';

  // Executa uma primeira rodada 15 segundos após o boot e a cada 10 minutos em seguida.
  setTimeout(() => {
    disparar();
    setInterval(disparar, 10 * 60 * 1000);
  }, 15 * 1000);

  function disparar() {
    fetch(`http://127.0.0.1:${port}/api/nfe/monitor/executar`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${segredo}` }
    })
      .then(r => r.json())
      .then(d => {
        if (d.iniciado) console.log('[nfe-monitor]', d.mensagem);
      })
      .catch(err => console.error('[nfe-monitor] Falha ao acionar rodada:', err.message));
  }
}
