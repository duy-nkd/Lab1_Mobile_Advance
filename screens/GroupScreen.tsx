import React, { useEffect, useRef, useState } from 'react';
import {
  FlatList,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { socket, type Message } from '../services/socket';

type ChatMessage = Message & { isMine: boolean };
type Props = { name: string; onBack: () => void };

export default function GroupScreen({ name, onBack }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [ready, setReady] = useState(false);
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState('Connecting...');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const list = useRef<FlatList<ChatMessage>>(null);
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;

    function onConnect() {
      setReady(false);
      setStatus('Joining group...');
      // Also runs after reconnection to register the name again.
      socket.timeout(5000).emit('user_join', { name }, (err, result) => {
        if (!mounted.current) {
          return;
        }
        const joined = !err && result?.ok;
        setReady(Boolean(joined));
        setStatus(
          joined ? 'Connected' : result?.error || 'Could not join group.',
        );
      });
    }

    function onMessage(message: Message) {
      const received = { ...message, isMine: message.senderId === socket.id };
      setMessages(current =>
        current.some(item => item.id === message.id)
          ? current
          : [...current, received],
      );
    }

    function onUserJoined(user: { name: string }) {
      setNotice(user.name + ' joined the group');
    }

    function onDisconnect() {
      setReady(false);
      setStatus('Disconnected - reconnecting...');
    }

    function onConnectError() {
      setReady(false);
      setStatus('Cannot connect to server - retrying...');
    }

    // Register once, outside onConnect, to avoid duplicate listeners.
    socket.on('connect', onConnect);
    socket.on('receive_message', onMessage);
    socket.on('user_joined', onUserJoined);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onConnectError);
    socket.connect();

    return () => {
      mounted.current = false;
      socket.off('connect', onConnect);
      socket.off('receive_message', onMessage);
      socket.off('user_joined', onUserJoined);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onConnectError);
      socket.disconnect();
    };
  }, [name]);

  function sendMessage() {
    if (!text.trim() || !ready || !socket.connected || sending) {
      return;
    }

    setSending(true);
    setError('');
    socket
      .timeout(5000)
      .emit('send_message', { text: text.trim() }, (err, result) => {
        if (!mounted.current) {
          return;
        }
        setSending(false);
        if (err || !result?.ok) {
          setError(
            result?.error ||
              'Sending not confirmed. Check the chat before sending again.',
          );
          return;
        }
        setText('');
      });
    // The list updates only when receive_message arrives from the server.
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable
          testID="back-button"
          accessibilityRole="button"
          accessibilityLabel="Back to Home"
          onPress={() => {
            Keyboard.dismiss();
            onBack();
          }}
          style={styles.backButton}
        >
          <Text style={styles.backArrow}>←</Text>
        </Pressable>
        <View>
          <Text style={styles.title}>Group CSE 434</Text>
          <Text testID="connection-status" style={styles.status}>
            {status}
          </Text>
        </View>
      </View>
      {notice ? <Text style={styles.notice}>{notice}</Text> : null}

      <FlatList
        testID="message-list"
        ref={list}
        style={styles.list}
        contentContainerStyle={styles.messages}
        data={messages}
        keyExtractor={item => item.id}
        onContentSizeChange={() => list.current?.scrollToEnd()}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => (
          <View style={[styles.message, item.isMine && styles.myMessage]}>
            <Text style={styles.sender}>{item.sender}</Text>
            <View style={[styles.bubble, item.isMine && styles.myBubble]}>
              <Text style={[styles.messageText, item.isMine && styles.myText]}>
                {item.text}
              </Text>
            </View>
            <Text style={styles.time}>
              {new Date(item.createdAt).toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Text>
          </View>
        )}
      />

      {error ? (
        <Text testID="send-error" style={styles.error}>
          {error}
        </Text>
      ) : null}
      <View style={styles.composer}>
        <TextInput
          testID="message-input"
          accessibilityLabel="Message"
          style={styles.input}
          placeholder="Type a message"
          value={text}
          onChangeText={setText}
          editable={!sending}
          maxLength={2000}
        />
        <Pressable
          testID="send-button"
          accessibilityRole="button"
          accessibilityLabel="Send"
          disabled={!text.trim() || !ready || sending}
          onPress={sendMessage}
          style={[styles.sendButton, (!ready || sending) && styles.disabled]}
        >
          <Text style={styles.sendIcon}>➤</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  backButton: { width: 36, height: 44, justifyContent: 'center' },
  backArrow: { fontSize: 24, color: '#273333' },
  title: { fontSize: 16, color: '#182423' },
  status: { fontSize: 10, color: '#667571', marginTop: 3 },
  notice: { textAlign: 'center', fontSize: 12, color: '#667571', padding: 8 },
  list: { flex: 1 },
  messages: { padding: 20 },
  message: {
    alignSelf: 'flex-start',
    alignItems: 'flex-start',
    maxWidth: '80%',
    marginBottom: 16,
  },
  myMessage: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  sender: { fontSize: 12, color: '#667571', marginBottom: 4 },
  bubble: { backgroundColor: '#F1F5F6', borderRadius: 12, padding: 12 },
  myBubble: { backgroundColor: '#1F9F91' },
  messageText: { fontSize: 14, color: '#22302F' },
  myText: { color: '#FFFFFF' },
  time: { fontSize: 10, color: '#949A99', marginTop: 5 },
  error: { color: '#BD443D', fontSize: 12, paddingHorizontal: 16 },
  composer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  input: {
    flex: 1,
    height: 44,
    paddingHorizontal: 12,
    backgroundColor: '#F1F5F6',
    borderRadius: 12,
    color: '#22302F',
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1F9F91',
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.5 },
  sendIcon: { fontSize: 22, color: '#FFFFFF' },
});
