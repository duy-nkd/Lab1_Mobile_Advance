const { test } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { io: connectClient } = require('socket.io-client');
const { createChatServer } = require('./index');

async function setup(t) {
  const { server, io } = createChatServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const clients = [];
  t.after(async () => {
    clients.forEach(client => client.disconnect());
    await new Promise(resolve => io.close(resolve));
  });
  return async () => {
    const client = connectClient('http://127.0.0.1:' + server.address().port, {
      autoConnect: false,
    });
    clients.push(client);
    const connected = once(client, 'connect');
    client.connect();
    await connected;
    return client;
  };
}

function emit(client, event, data) {
  return client.timeout(2000).emitWithAck(event, data);
}

function waitForMessages(client, count) {
  return new Promise((resolve, reject) => {
    const received = [];
    const timer = setTimeout(() => {
      client.off('receive_message', handler);
      reject(new Error('Timed out waiting for messages'));
    }, 2000);
    function handler(message) {
      received.push(message);
      if (received.length === count) {
        clearTimeout(timer);
        client.off('receive_message', handler);
        resolve(received);
      }
    }
    client.on('receive_message', handler);
  });
}

test('three clients, including duplicate names, receive all simultaneous sends once', async t => {
  const connect = await setup(t);
  const clients = await Promise.all([connect(), connect(), connect()]);
  const names = ['An', 'An', 'Chi'];
  await Promise.all(
    clients.map((client, index) =>
      emit(client, 'user_join', { name: names[index] }),
    ),
  );
  const received = clients.map(() => []);
  clients.forEach((client, index) =>
    client.on('receive_message', message => received[index].push(message)),
  );
  const pending = clients.map(client => waitForMessages(client, 12));

  const accepted = await Promise.all(
    Array.from({ length: 12 }, (_, index) =>
      emit(clients[index % 3], 'send_message', {
        text: '  Message ' + index + '  ',
        sender: 'Fake',
      }),
    ),
  );
  accepted.forEach(result => assert.equal(result.ok, true));
  const lists = await Promise.all(pending);
  await new Promise(resolve => setTimeout(resolve, 50));
  received.forEach(list => assert.equal(list.length, 12));
  assert.deepEqual(lists[0], lists[1]);
  assert.deepEqual(lists[1], lists[2]);
  assert.equal(new Set(lists[0].map(message => message.id)).size, 12);
  for (const message of lists[0]) {
    const index = Number(message.text.slice('Message '.length));
    assert.equal(message.sender, names[index % 3]);
    assert.equal(message.senderId, clients[index % 3].id);
    assert.equal(message.text, message.text.trim());
    assert.ok(Number.isFinite(Date.parse(message.createdAt)));
  }
});

test('validates join and messages and broadcasts only a real first join', async t => {
  const connect = await setup(t);
  const observer = await connect();
  const client = await connect();
  const messages = [];
  const joins = [];
  observer.on('receive_message', message => messages.push(message));
  observer.on('user_joined', user => joins.push(user));

  assert.equal(
    (await emit(client, 'send_message', { text: 'Before join' })).ok,
    false,
  );
  for (const data of [
    null,
    {},
    { name: 123 },
    { name: '   ' },
    { name: 'x'.repeat(41) },
  ]) {
    assert.equal((await emit(client, 'user_join', data)).ok, false);
  }
  assert.equal(
    (await emit(client, 'user_join', { name: '  Bình  ' })).ok,
    true,
  );
  assert.equal((await emit(client, 'user_join', { name: 'Bình' })).ok, true);
  for (const data of [
    null,
    {},
    { text: 123 },
    { text: '   ' },
    { text: 'x'.repeat(2001) },
  ]) {
    assert.equal((await emit(client, 'send_message', data)).ok, false);
  }
  await new Promise(resolve => setTimeout(resolve, 50));
  assert.equal(messages.length, 0);
  assert.deepEqual(joins, [{ name: 'Bình' }]);
});

test('new clients have no history and disconnected clients can register again', async t => {
  const connect = await setup(t);
  const first = await connect();
  await emit(first, 'user_join', { name: 'An' });
  await emit(first, 'send_message', { text: 'Old message' });

  const second = await connect();
  const history = [];
  second.on('receive_message', message => history.push(message));
  await emit(second, 'user_join', { name: 'Bình' });
  assert.deepEqual(history, []);

  first.disconnect();
  const reconnected = once(first, 'connect');
  first.connect();
  await reconnected;
  assert.equal(
    (await emit(first, 'send_message', { text: 'Not registered yet' })).ok,
    false,
  );
  await emit(first, 'user_join', { name: 'An' });
  const pending = waitForMessages(second, 1);
  await emit(first, 'send_message', { text: 'New message' });
  const [message] = await pending;
  assert.equal(message.sender, 'An');
  assert.equal(message.senderId, first.id);
  assert.equal(message.text, 'New message');
});
