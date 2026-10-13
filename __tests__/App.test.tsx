import React from 'react';
import { FlatList } from 'react-native';
import ReactTestRenderer, { act } from 'react-test-renderer';
import App from '../App';
import { socket } from '../services/socket';

jest.mock(
  'react-native-safe-area-context',
  () => require('react-native-safe-area-context/jest/mock').default,
);

jest.mock('../services/socket', () => {
  const handlers = new Map<string, (...args: unknown[]) => void>();
  const mockSocket = {
    id: 'my-connection',
    connected: false,
    on: jest.fn((event: string, handler: (...args: unknown[]) => void) => {
      handlers.set(event, handler);
    }),
    off: jest.fn((event: string, handler: (...args: unknown[]) => void) => {
      if (handlers.get(event) === handler) {
        handlers.delete(event);
      }
    }),
    connect: jest.fn(() => {
      mockSocket.connected = true;
      handlers.get('connect')?.();
    }),
    disconnect: jest.fn(() => {
      mockSocket.connected = false;
    }),
    timeout: jest.fn(),
    emit: jest.fn(
      (
        _event: string,
        _data: unknown,
        ack: (error: Error | null, result: { ok: boolean }) => void,
      ) => ack(null, { ok: true }),
    ),
    fire: (event: string, data?: unknown) => handlers.get(event)?.(data),
    reset: () => {
      handlers.clear();
      mockSocket.connected = false;
      mockSocket.id = 'my-connection';
    },
  };
  mockSocket.timeout.mockReturnValue(mockSocket);
  return { socket: mockSocket };
});

type MockSocket = typeof socket & {
  fire: (event: string, data?: unknown) => void;
  reset: () => void;
};
const mockSocket = socket as MockSocket;
let renderer: ReactTestRenderer.ReactTestRenderer;
const byId = (testID: string) => renderer.root.findByProps({ testID });
const getMessages = () => renderer.root.findByType(FlatList).props.data;
const message = {
  id: 'message-1',
  senderId: 'my-connection',
  sender: 'Richard Nguyen',
  text: 'Hello everyone!',
  createdAt: '2026-10-13T08:00:00.000Z',
};

async function openChat() {
  await act(() => byId('name-input').props.onChangeText('  Richard Nguyen  '));
  await act(() => byId('start-chat-button').props.onPress());
}

beforeEach(async () => {
  jest.clearAllMocks();
  mockSocket.reset();
  await act(() => {
    renderer = ReactTestRenderer.create(<App />);
  });
});

afterEach(async () => {
  await act(() => renderer.unmount());
});

test('requires a nonblank name before opening the group', async () => {
  await act(() => byId('name-input').props.onChangeText('   '));
  await act(() => byId('start-chat-button').props.onPress());
  expect(byId('name-error').props.children).toBe('Please enter your name.');
  expect(socket.connect).not.toHaveBeenCalled();
});

test('joins with the name and adds a sent message only from the server broadcast', async () => {
  await openChat();
  expect(socket.emit).toHaveBeenCalledWith(
    'user_join',
    { name: 'Richard Nguyen' },
    expect.any(Function),
  );
  expect(getMessages()).toEqual([]);
  expect(byId('connection-status').props.children).toBe('Connected');

  await act(() =>
    byId('message-input').props.onChangeText('  Hello everyone!  '),
  );
  await act(() => byId('send-button').props.onPress());
  expect(socket.emit).toHaveBeenCalledWith(
    'send_message',
    { text: 'Hello everyone!' },
    expect.any(Function),
  );
  expect(getMessages()).toEqual([]);

  await act(() => mockSocket.fire('receive_message', message));
  await act(() => mockSocket.fire('receive_message', message));
  expect(getMessages()).toHaveLength(1);
  expect(getMessages()[0].isMine).toBe(true);
  expect(byId('message-input').props.value).toBe('');

  await act(() =>
    mockSocket.fire('receive_message', {
      ...message,
      id: 'message-2',
      senderId: 'other-connection',
    }),
  );
  expect(getMessages()[1].isMine).toBe(false);
});

test('cleans up listeners and opens a fresh empty group on return', async () => {
  await openChat();
  await act(() => mockSocket.fire('receive_message', message));
  await act(() => byId('back-button').props.onPress());
  expect(socket.disconnect).toHaveBeenCalledTimes(1);
  expect(socket.off).toHaveBeenCalledWith(
    'receive_message',
    expect.any(Function),
  );
  expect(byId('name-input').props.value).toBe('Richard Nguyen');

  await openChat();
  expect(getMessages()).toEqual([]);
  expect(socket.connect).toHaveBeenCalledTimes(2);
});

test('disables sending while disconnected and rejoins after reconnecting', async () => {
  await openChat();
  await act(() => mockSocket.fire('receive_message', message));
  await act(() => byId('message-input').props.onChangeText('Keep this draft'));
  await act(() => {
    mockSocket.connected = false;
    mockSocket.fire('disconnect');
  });
  expect(byId('send-button').props.disabled).toBe(true);
  const emitted = jest.mocked(socket.emit).mock.calls.length;
  await act(() => byId('send-button').props.onPress());
  expect(jest.mocked(socket.emit).mock.calls.length).toBe(emitted);
  expect(byId('message-input').props.value).toBe('Keep this draft');

  await act(() => {
    mockSocket.connected = true;
    mockSocket.id = 'new-connection';
    mockSocket.fire('connect');
  });
  expect(
    jest
      .mocked(socket.emit)
      .mock.calls.filter(([event]) => event === 'user_join'),
  ).toHaveLength(2);
  expect(byId('send-button').props.disabled).toBe(false);
  expect(getMessages()[0].isMine).toBe(true);
});

test('keeps the draft and shows an error when sending is not acknowledged', async () => {
  await openChat();
  jest.mocked(socket.emit).mockImplementationOnce((_event, _data, ack: any) => {
    ack(new Error('timeout'));
    return socket;
  });
  await act(() => byId('message-input').props.onChangeText('Keep this draft'));
  await act(() => byId('send-button').props.onPress());
  expect(byId('message-input').props.value).toBe('Keep this draft');
  expect(byId('send-error').props.children).toContain('Sending not confirmed');
});
