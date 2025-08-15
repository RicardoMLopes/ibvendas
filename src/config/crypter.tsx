import CryptoJS from "crypto-js";

export const criptografar = (texto: string, chave: string): string => {
  try {
    if (!texto || !chave) {
      throw new Error('Texto ou chave não fornecidos.');
    }

    // Gera IV aleatório
    const iv = CryptoJS.lib.WordArray.random(16);
    const chaveHash = CryptoJS.SHA256(chave);

    // Criptografa com AES CBC + PKCS7
    const encrypted = CryptoJS.AES.encrypt(texto, chaveHash, {
      iv: iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7
    });

    // Concatena IV + ciphertext
    const encryptedBytes = iv.concat(encrypted.ciphertext);
    const encryptedBase64 = CryptoJS.enc.Base64.stringify(encryptedBytes);

    return encryptedBase64;

  } catch (error: any) {
    console.error('Erro ao criptografar:', error.message);
    return "";
  }
};


const descriptografar = (textoCriptografado: string, chave: string) => {
  // Decodifica Base64
  const encryptedBytes = CryptoJS.enc.Base64.parse(textoCriptografado);
  
  // Extrai IV (primeiros 16 bytes)
  const iv = CryptoJS.lib.WordArray.create(encryptedBytes.words.slice(0, 4));
  
  // Extrai ciphertext (restante dos bytes)
  const ciphertext = CryptoJS.lib.WordArray.create(encryptedBytes.words.slice(4));

  const chaveHash = CryptoJS.SHA256(chave);

  // Descriptografa com AES CBC + PKCS7
  const cipherParams = CryptoJS.lib.CipherParams.create({
    ciphertext: ciphertext
  });
  const decrypted = CryptoJS.AES.decrypt(cipherParams, chaveHash, {
    iv: iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7
  });

  return decrypted.toString(CryptoJS.enc.Utf8);
};


export const gerarTokenCNPJ = (cnpj:string, chaveSecreta:string) => {
  const cnpjLimpo = cnpj.replace(/[^\d]/g, '');
  const texto = cnpjLimpo + chaveSecreta;

  // SHA256 no frontend (usa alguma lib como crypto-js)
  const CryptoJS = require("crypto-js");
  return CryptoJS.SHA256(texto).toString(CryptoJS.enc.Hex);
};
