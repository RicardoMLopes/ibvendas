import axios, { AxiosError } from 'axios';
import * as Crypto from 'expo-crypto';
import Configs from '../config/configs';

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

// Formatar data para o padrão 'YYYY-MM-DD HH:mm:ss.SS'
export function formatarDataRegistro(data: any): string {
  if (!data) return '';
  const d = new Date(data);
  if (isNaN(d.getTime())) return ''; // Se não for data válida
  const pad = (n: number, z = 2) => n.toString().padStart(z, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
         `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 2)}`;
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

interface RetryOptions {
  tentativas?: number;       // Máximo de tentativas
  delay?: number;            // Tempo inicial em ms
  factor?: number;           // Multiplicador do backoff exponencial
  jitter?: boolean;          // Se true, adiciona variação aleatória ao delay
  onRetry?: (tentativa: number, error: any, nextDelay: number) => void; // Callback a cada falha
}

export async function retryWithBackoff<T, P = any>(
  fn: AsyncFunction<T, P>,
  param?: P,
  options: RetryOptions = {}
): Promise<T> {
  const {
    tentativas = 5,
    delay = 500,
    factor = 2,
    jitter = true,
    onRetry,
  } = options;

  let tentativa = 0;
  let currentDelay = delay;

  while (tentativa < tentativas) {
    try {
      return await fn(param);
    } catch (error) {
      tentativa++;
      if (tentativa >= tentativas) throw error;

      let waitTime = currentDelay;
      if (jitter) {
        waitTime = Math.random() * currentDelay; // backoff com jitter
      }

      if (onRetry) onRetry(tentativa, error, waitTime);

      await new Promise((resolve) => setTimeout(resolve, waitTime));
      currentDelay *= factor; // aumento exponencial do delay
    }
  }

  throw new Error('Falha na execução com retry');
}
