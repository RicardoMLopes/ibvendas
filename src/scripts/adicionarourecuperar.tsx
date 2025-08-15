import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Recupera qualquer valor do AsyncStorage baseado na chave fornecida.
 * @param chave Nome da chave que deseja buscar no armazenamento.
 * @returns Valor como string ou null se não existir ou houver erro.
 */
export const recuperarValor = async (chave: string): Promise<string | null> => {
  try {
    const valor = await AsyncStorage.getItem(chave);
    return valor ?? null;
  } catch (erro) {
    console.error(`Erro ao recuperar chave "${chave}":`, erro);
    return null;
  }
};

export const adicionarValor = async (chave: string, campo: string): Promise<string | null> => {
  try {
    await AsyncStorage.setItem(chave, campo);
    return campo; // opcional: retorna o valor adicionado
  } catch (erro) {
    console.error(`Erro ao adicionar a chave "${chave}":`, erro);
    return null;
  }
};
