// components/InputText/index.tsx
import React from 'react';
import { TextInput, View, Text, TextInputProps } from 'react-native';
import styles from './style'; // Import your styles

interface InputTextProps extends TextInputProps {
  label?: string;
  error?: string;
}

const InputText: React.FC<InputTextProps> = ({ label, error, ...rest }) => {
  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      <TextInput
        style={[error ? styles.inputError : null]}
        {...rest}
      />
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
};

export default InputText;

