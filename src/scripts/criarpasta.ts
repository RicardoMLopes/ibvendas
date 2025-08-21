import RNFS from 'react-native-fs';
import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';

type ImagemServidor = string;

const pastaIbvendas = RNFS.DocumentDirectoryPath + '/ibvendas/img/';

// Função para obter o token do CNPJ
const obterTokenCNPJ = async (): Promise<string> => {
  try {
    const token = await AsyncStorage.getItem('@CNPJ');
    if (token) {
      return token;
    } else {
      console.log('❌ Token CNPJ não encontrado');
      return '';
    }
  } catch (error) {
    console.error('❌ Erro ao obter o token CNPJ:', error);
    return '';
  }
};

// Função para obter o caminho onde as imagens serão armazenadas
export async function getCaminhoImagens(): Promise<string> {
  const token = await obterTokenCNPJ();
  const tokenSeguro = token || 'default';
  const caminho = RNFS.DocumentDirectoryPath + '/ibvendas/img/' + tokenSeguro;
//  console.log('📂 Caminho das imagens:', caminho);
  return caminho;
}

// Função para criar a pasta onde as imagens serão armazenadas
export async function criarPastaImagens(): Promise<void> {
  try {
    const caminho = await getCaminhoImagens();
    const existe = await RNFS.exists(caminho);

    if (!existe) {
      await RNFS.mkdir(caminho);
      console.log('📂 Pasta criada com sucesso:', caminho);
    } else {
      console.log('📁 Pasta já existe:', caminho);
    }
  } catch (err) {
    console.log('❌ Erro ao criar a pasta:', err instanceof Error ? err.message : err);
  }
}

// Função para baixar e guardar uma imagem no dispositivo
export const baixarImagem = async (url: string, nomeArquivo: string): Promise<string | null> => {
  try {
    const token = await obterTokenCNPJ();
    const tokenSeguro = token || 'default';
    const pastadestino = FileSystem.documentDirectory + 'ibvendas/img/' + tokenSeguro + '/';
    
    await FileSystem.makeDirectoryAsync(pastadestino, { intermediates: true });
    const caminhoLocal = pastadestino + nomeArquivo;

    const download = await FileSystem.downloadAsync(url, caminhoLocal);
    console.log(`✅ Imagem baixada com sucesso: ${nomeArquivo}`);
    return download.uri;
  } catch (error) {
    console.error("❌ Erro ao baixar imagem:", error);
    return null;
  }
};

export async function getArquivoLocalMtime(nomeArquivo: string): Promise<number | null> {
  const value = await AsyncStorage.getItem(`arquivo:${nomeArquivo}`);
  if (!value) return null;
  return Number(value); // converte string para number
};

export async function setArquivoLocalMtime(nomeArquivo: string, mtime: number): Promise<void> {
  try {
    await AsyncStorage.setItem(`arquivo:${nomeArquivo}`, mtime.toString());
  } catch (e) {
    console.error(`Erro ao salvar mtime do arquivo ${nomeArquivo}:`, e);
  }
}
