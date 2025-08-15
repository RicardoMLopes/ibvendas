// components/AnimatedMessage.tsx
import React, { useState, useEffect } from 'react';
import { Text, View, StyleSheet } from 'react-native';

export default function AnimatedMessage({ message }: { message: string }) {
  const [displayedText, setDisplayedText] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  useEffect(() => {
    let timeoutIds: NodeJS.Timeout[] = [];

    const startTyping = () => {
      setIsTyping(true);
      setDisplayedText('');
      message.split('').forEach((char, index) => {
        const id = setTimeout(() => {
          setDisplayedText(prev => prev + char);
          if (index === message.length - 1) {
            setIsTyping(false);
          }
        }, index * 80);
        timeoutIds.push(id);
      });
    };

    startTyping();

    const loop = setInterval(() => {
      if (!isTyping) {
        startTyping();
      }
    }, message.length * 80 + 10000);

    return () => {
      timeoutIds.forEach(clearTimeout);
      clearInterval(loop);
    };
  }, [message]);

  return (
    <View style={styles.container}>
      <Text style={styles.message}>{displayedText}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingVertical: 8 },
  message: { fontSize: 16, fontWeight: 'bold', color: '#284fffff' }
});
