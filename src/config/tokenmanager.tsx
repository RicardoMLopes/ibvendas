// tokenManager.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import CryptoJS from 'crypto-js';

// Gera um hash SHA256 com base no CNPJ e uma chave secreta
export const gerarTokenCNPJ = (cnpj: string, chaveSecreta: string): string => {
  const cnpjLimpo = cnpj.replace(/[^\d]/g, '');
  const texto = cnpjLimpo + chaveSecreta;
  return CryptoJS.SHA256(texto).toString(CryptoJS.enc.Hex);
};

// Salva o token no armazenamento local
export const salvarTokenCNPJ = async (cnpj: string, chaveSecreta: string): Promise<string> => {
  try {
    const token = gerarTokenCNPJ(cnpj, chaveSecreta);
    await AsyncStorage.setItem('@tokenCNPJ', token);
    
    return token;
  } catch (error) {
    console.error('Erro ao salvar o token:', error);
    throw error;
  }
};

// Recupera o token armazenado
export const obterTokenCNPJ = async (): Promise<string | null> => {
  try {
    const token = await AsyncStorage.getItem('@tokenCNPJ');
    return token;
  } catch (error) {
    console.error('Erro ao obter o token:', error);
    return null;
  }
};

// Remove o token armazenado
export const removerTokenCNPJ = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem('@tokenCNPJ');
  } catch (error) {
    console.error('Erro ao remover o token:', error);
  }
};
