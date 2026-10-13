const http = require('node:http');
const { randomUUID } = require('node:crypto');
const { Server } = require('socket.io');

function reply(ack, result) {
  if (typeof ack === 'function') {
    ack(result);
  }
}

function createChatServer() {
  const server = http.createServer((request, response) => {
    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ status: 'ok' }));
  });
  const io = new Server(server);

  io.on('connection', socket => {
    console.log('Connected:', socket.id);

    socket.on('user_join', (data, ack) => {
      const name = typeof data?.name === 'string' ? data.name.trim() : '';
      if (!name || name.length > 40) {
        reply(ack, {
          ok: false,
          error: 'Name must contain 1 to 40 characters.',
        });
        return;
      }

      const firstJoin = !socket.data.name;
      socket.data.name = name;
      reply(ack, { ok: true });

      if (firstJoin) {
        console.log('Joined:', name);
        socket.broadcast.emit('user_joined', { name });
      }
    });

    socket.on('send_message', (data, ack) => {
      if (!socket.data.name) {
        reply(ack, {
          ok: false,
          error: 'Join the group before sending a message.',
        });
        return;
      }

      const text = typeof data?.text === 'string' ? data.text.trim() : '';
      if (!text || text.length > 2000) {
        reply(ack, {
          ok: false,
          error: 'Message must contain 1 to 2000 characters.',
        });
        return;
      }

      const message = {
        id: randomUUID(),
        senderId: socket.id,
        sender: socket.data.name,
        text,
        createdAt: new Date().toISOString(),
      };

      // Include the sender: every app updates from the same event.
      io.emit('receive_message', message);
      reply(ack, { ok: true });
    });

    socket.on('disconnect', () => {
      console.log('Disconnected:', socket.data.name || socket.id);
    });
  });

  return { server, io };
}

if (require.main === module) {
  const { server } = createChatServer();
  const port = Number(process.env.PORT || 3000);
  server.on('error', error => {
    console.error('Cannot start chat server:', error.message);
    process.exit(1);
  });
  server.listen(port, '0.0.0.0', () => {
    console.log('Chat server listening on port', port);
  });
}

module.exports = { createChatServer };
