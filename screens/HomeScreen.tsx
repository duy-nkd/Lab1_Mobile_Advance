import React, { useState } from 'react';
import {
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
} from 'react-native';

type Props = {
  initialName: string;
  onStartChat: (name: string) => void;
};

export default function HomeScreen({ initialName, onStartChat }: Props) {
  const [name, setName] = useState(initialName);
  const [error, setError] = useState('');

  function startChat() {
    if (!name.trim()) {
      setError('Please enter your name.');
      return;
    }
    Keyboard.dismiss();
    onStartChat(name.trim());
  }

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>Your Name</Text>
      <Text style={styles.subtitle}>
        Please enter your name to start a new chat
      </Text>
      <Text style={styles.label}>Your name</Text>
      <TextInput
        testID="name-input"
        accessibilityLabel="Your name"
        style={styles.input}
        placeholder="Enter your name"
        value={name}
        onChangeText={text => {
          setName(text);
          setError('');
        }}
        maxLength={40}
        returnKeyType="go"
        onSubmitEditing={startChat}
      />
      <Text testID="name-error" style={styles.error}>
        {error}
      </Text>
      <Pressable
        testID="start-chat-button"
        accessibilityRole="button"
        onPress={startChat}
        style={styles.button}
      >
        <Text style={styles.buttonText}>Start Chat</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 88,
    paddingBottom: 24,
  },
  title: { textAlign: 'center', fontSize: 17, color: '#18201F' },
  subtitle: {
    marginTop: 36,
    textAlign: 'center',
    fontSize: 14,
    color: '#929795',
  },
  label: { marginTop: 74, fontSize: 13, color: '#267C73' },
  input: {
    height: 44,
    borderBottomWidth: 1,
    borderBottomColor: '#DADDDD',
    fontSize: 16,
    color: '#18201F',
  },
  error: { height: 36, paddingTop: 6, fontSize: 12, color: '#BD443D' },
  button: {
    backgroundColor: '#267C73',
    borderRadius: 14,
    paddingVertical: 8,
    alignItems: 'center',
  },
  buttonText: { color: '#FFFFFF', fontSize: 28, letterSpacing: 3 },
});
