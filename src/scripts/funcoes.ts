import axios, { AxiosError } from 'axios';
import * as Crypto from 'expo-crypto';
import Configs from '../config/configs';
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system';
import  {obterTokenCNPJ}  from '../scripts/criarpasta';


const SALT = Configs.SECRET_KEY

// Função para tentar uma requisição com múltiplas tentativas
export async function tentarRequisicao<T>(
  fn: () => Promise<T>,
  tentativas = 1,
  atrasoMs = 25000
): Promise<T> {
  let erroFinal: any;

  for (let i = 1; i <= tentativas; i++) {
    try {
      return await fn();
    } catch (err: any) {
      erroFinal = err;

      console.warn(`⚠️ Tentativa ${i} falhou:`, {
        message: err.message,
        code: err.code,
        status: err.response?.status,
        isAxiosError: err.isAxiosError ?? false
      });

      const isNetworkError =
        err.message === "Network Error" || err.code === "ECONNABORTED";

      // Segunda tentativa especial
      if (isNetworkError && i < tentativas) {
        console.warn("🌐 Network Error detectado — tentando novamente com timeout maior e parse desativado...");

        try {
          // Aqui chamamos diretamente o Axios para evitar problema no parse
          const url = (err.config?.baseURL || '') + (err.config?.url || '');
          const response = await axios.get(url, {
            timeout: 30000,
            transformResponse: r => r, // pega como texto cru
            headers: err.config?.headers || {}
          });

          return response as unknown as T; // converte para o tipo esperado
        } catch (retryErr: any) {
          console.warn("❌ Tentativa com ajustes também falhou:", retryErr.message);
        }
      }

      if (i < tentativas) {
        await new Promise(res => setTimeout(res, atrasoMs));
      }
    }
  }

  throw erroFinal;
}

// Adicionar ou recuperar valor de um objeto, retornando o valor atualizado
export function sanitizarNumero(valor: any, padrao = 0): number {
  const num = Number(valor);
  return isNaN(num) ? padrao : num;
}

// Formatar data para 'YYYY-MM-DD HH:mm:ss'
export function formatarDataRegistro(data: any): string {
  if (!data) return '';
  const d = data instanceof Date ? data : new Date(data);
  if (isNaN(d.getTime())) return ''; // Se não for data válida
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
         `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}



  // Formatar data para o padrão brasileiro 'DD/MM/YYYY HH:mm:ss'
  export const formatDateBRHora = (dateString: string) => {
    if (!dateString) return '';
    const d = new Date(dateString);
    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const year = d.getFullYear();
    const hour = d.getHours().toString().padStart(2, '0');
    const minute = d.getMinutes().toString().padStart(2, '0');
    const second = d.getSeconds().toString().padStart(2, '0');
    return `${day}/${month}/${year} ${hour}:${minute}:${second}`;
  };

  // Formatar data para o padrão brasileiro 'DD/MM/YYYY'
  export const formatDateBR = (dateString: string | Date | null) => {
  if (!dateString) return '';
  const d = dateString instanceof Date ? dateString : new Date(dateString);
  const day = d.getDate().toString().padStart(2, '0');
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
};

// Gerar hash da senha usando SHA-256
export async function gerarHashSenhaExpo(senha: string): Promise<string> {
  const hash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    SALT + senha
  );
  return hash;
}

// Validar senha usando o hash armazenado
export async function validarSenhaExpo(senhaDigitada: string, hashArmazenado: string): Promise<boolean> {
  if (!hashArmazenado) return false;
  const hash = await gerarHashSenhaExpo(senhaDigitada);
  return hash === hashArmazenado;
}


// Função para recuperar valor de armazenamento local
type AsyncFunction<T, P = any> = (param?: P) => Promise<T>;

export interface RetryOptions {
  tentativas?: number;
  delay?: number;
  factor?: number;
  jitter?: boolean;
  onRetry?: (tentativa: number, error: any, waitTime: number) => void;
}


export async function retryWithBackoff<T, P = any>(
  fn: (param?: P) => Promise<T>,
  param?: P,
  options: RetryOptions = {}
): Promise<T> {
  const { tentativas = 5, delay = 500, factor = 2, jitter = true, onRetry } = options;
  let tentativa = 0;
  let currentDelay = delay;

  while (tentativa < tentativas) {
    try {
      return await fn(param);
    } catch (error) {
      tentativa++;
      if (tentativa >= tentativas) throw error;

      let waitTime = currentDelay;
      if (jitter) waitTime = Math.random() * currentDelay;

      if (onRetry) onRetry(tentativa, error, waitTime);

      await new Promise(res => setTimeout(res, waitTime));
      currentDelay *= factor;
    }
  }

  throw new Error('Falha na execução com retry');
}



export async function carregarLogoBase64(): Promise<string | null> {
  try {
    const asset = Asset.fromModule(require('../../assets/empresa.jpg'));
    await asset.downloadAsync(); // garante que o asset está disponível

    // Usa localUri ou uri, ambos funcionam no APK e no Expo Go
    const caminho = asset.localUri ?? asset.uri;
    if (!caminho) return null;

    const base64 = await FileSystem.readAsStringAsync(caminho, {
      encoding: FileSystem.EncodingType.Base64,
    });

    return base64;
  } catch (error) {
    console.warn('Erro ao carregar logo base64:', error);
    return null;
  }
}

export function formatarCnpjCpf(valor: string | null): string {
  if (!valor) return "";

  // Remove tudo que não for número
  const apenasNumeros = valor.replace(/\D/g, "");

  if (apenasNumeros.length === 11) {
    // CPF -> 000.000.000-00
    return apenasNumeros.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  } else if (apenasNumeros.length === 14) {
    // CNPJ -> 00.000.000/0000-00
    return apenasNumeros.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  }

  // Se não tiver tamanho esperado, retorna só os números
  return apenasNumeros;
}



export async function obterInfoArquivoLocal(nomeArquivo: string): Promise<{ mtime: number } | null> {
  try {
    const caminhoLocal = FileSystem.documentDirectory + nomeArquivo;
    const info = await FileSystem.getInfoAsync(caminhoLocal);
    if (info.exists && info.modificationTime) {
      return { mtime: info.modificationTime };
    }
    return null;
  } catch (e) {
    console.error('Erro ao obter info do arquivo local:', e);
    return null;
  }
}

export function arredondar(valor: number, casas: number = 2) {
  const fator = Math.pow(10, casas);
  return Math.round(valor * fator) / fator;
}

export async function contarImagensNoDispositivo(): Promise<number> {
  // Obtém o token do CNPJ
  const token = await obterTokenCNPJ();
  const pastaImagens = (FileSystem.documentDirectory as string) + 'ibvendas/img/' + token + '/';

  console.log(`🔍 Verificando pasta de imagens para o token ${token}: ${pastaImagens}`);

  // Verifica se a pasta existe
  const info = await FileSystem.getInfoAsync(pastaImagens);
  if (!info.exists) {
    console.log('⚠️ Pasta não existe. Criando...');
    await FileSystem.makeDirectoryAsync(pastaImagens, { intermediates: true });
    return 0; // ainda não há imagens
  }

  // Lista arquivos na pasta
  const arquivos = await FileSystem.readDirectoryAsync(pastaImagens);
  if (arquivos.length === 0) {
    console.log('📂 Pasta existe, mas não contém nenhuma imagem.');
  } else {
    console.log(`📂 Pasta contém ${arquivos.length} imagem(ns).`);
  }

  return arquivos.length;
}