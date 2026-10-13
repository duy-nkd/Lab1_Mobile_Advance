import React, { useState } from 'react';
import { StatusBar, StyleSheet } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import HomeScreen from './screens/HomeScreen';
import GroupScreen from './screens/GroupScreen';

export default function App() {
  const [name, setName] = useState('');
  const [isChatOpen, setIsChatOpen] = useState(false);

  function startChat(userName: string) {
    setName(userName);
    setIsChatOpen(true);
  }

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={styles.container}>
        {isChatOpen ? (
          <GroupScreen name={name} onBack={() => setIsChatOpen(false)} />
        ) : (
          <HomeScreen initialName={name} onStartChat={startChat} />
        )}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
});
