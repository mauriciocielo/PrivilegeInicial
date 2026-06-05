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
  });
});
