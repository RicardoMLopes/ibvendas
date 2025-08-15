// src/config/parametros.ts
import { ParametrosSistema } from './configs';

let parametros: ParametrosSistema | null = null;

export function setParametrosSistema(dados: ParametrosSistema) {
  parametros = dados;
}

export function getParametrosSistema(): ParametrosSistema | null {
  return parametros;
}

export function getParametro(chave: keyof ParametrosSistema) {
  return parametros ? parametros[chave] : null;
}
