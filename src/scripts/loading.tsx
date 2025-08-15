import React from 'react';
import { View, ActivityIndicator, StyleSheet, Modal, Text } from 'react-native';

type LoadingOverlayProps = {
  visible: boolean;
  message?: string;
};

export  function LoadingOverlay({ visible, message = 'Carregando...' }: LoadingOverlayProps) {
  if (!visible) return null;

  return (
    <Modal transparent animationType="fade" visible={visible}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <ActivityIndicator size="large" color="#ffffff" />
          <Text style={styles.message}>{message}</Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    padding: 20,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 10,
    alignItems: 'center',
  },
  message: {
    color: '#ffffff',
    fontSize: 16,
    marginTop: 12,
    textAlign: 'center',
  },
});
