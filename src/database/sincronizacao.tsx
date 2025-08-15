import { useSQLiteContext } from "expo-sqlite";
import api from '../config/app';
import { setParametrosSistema } from '../config/parametros';
import {ParametrosSistema} from '../config/configs'
import { criarPastaImagens } from '../scripts/criarpasta';
import { baixarImagem } from '../scripts/criarpasta';
import DatabaseManager from '../database/databasemanager';
import { formatarDataRegistro, sanitizarNumero, tentarRequisicao } from "../scripts/funcoes";

type ImagemServidor = string;

export async function useSyncEmpresa() {
  const database = DatabaseManager.getCurrentDatabase();
  if (!database) {
    console.log("❌ useSyncEmpresa: Banco de dados ainda *não foi inicializado*.");
    throw new Error("Database not initialized");
  }

  // (verificação de tabelas e logs aqui...)

  async function sincronizarEmpresas() {
    let empresas: any[] = [];

    try {  
      const response = await tentarRequisicao(() => api.get('empresa'), 3, 1500);
      const dados = response.data;
      empresas = Array.isArray(dados) ? dados : [dados];
    } catch (error: any) {
      console.log('❌ Erro ao buscar do empresas após 3 tentativas:', error.message);
      return;
    }   
   
    try {
      await database.withTransactionAsync(async () => {
        for (const empresa of empresas) {
          try {
            const result = await database.getAllAsync(
              'SELECT * FROM cadempresa WHERE codigo = ?',
              [empresa.codigo]  // parâmetro como array!
            );

            if (result.length === 0) {
              await database.runAsync(
                `INSERT INTO cadempresa (codigo, nome, cnpj, rua, numero, bairro, cidade, telefone, email)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                  empresa.codigo,
                  empresa.nome,
                  empresa.cnpj,
                  empresa.rua,
                  empresa.numero,
                  empresa.bairro,
                  empresa.cidade,
                  empresa.telefone,
                  empresa.email,
                ]
              );
              console.log(`✅ Empresa ${empresa.nome} inserida.`);
            } else {
              const atual = result[0];

              const dadosDiferentes = (novo: any, atual: any) => {
                const campos = ['nome', 'cnpj', 'rua', 'numero', 'bairro', 'cidade', 'telefone', 'email'];
                return campos.some(campo =>
                  (novo[campo] ?? '').toString().trim() !== (atual[campo] ?? '').toString().trim()
                );
              };

              if (dadosDiferentes(empresa, atual)) {
                await database.runAsync(
                  `UPDATE cadempresa SET
                     nome = ?, cnpj = ?, rua = ?, numero = ?, bairro = ?, cidade = ?, telefone = ?, email = ?
                   WHERE codigo = ?`,
                  [
                    empresa.nome,
                    empresa.cnpj,
                    empresa.rua,
                    empresa.numero,
                    empresa.bairro,
                    empresa.cidade,
                    empresa.telefone,
                    empresa.email,
                    empresa.codigo
                  ]
                );
                console.log(`🔄 Empresa ${empresa.nome} atualizada.`);
              } else {
                console.log(`⏭ Empresa ${empresa.nome} sem alteração.`);
              }
            }
          } catch (err) {
            console.error('❌ Erro ao sincronizar empresa:', err);
          }
        }
      });
    } catch (error: any) {
      console.error('❌ Erro ao salvar empresas no banco:', error.message);
      throw new Error('Falha na sincronização das empresas');
    }
  }
//================================================================================================
// ***********************Inicio da função de sincronização de produtos **************************
//------------------------------------------------------------------------------------------------

interface ProdutoLocal {
  empresa: number | string;
  codigo: string;
  descricao: string;
  unidadeMedida: string;
  codigobarra: string;
  agrupamento: string;
  marca: string;
  modelo: string;
  tamanho: string;
  cor: string;
  peso: number;
  precovenda: number;
  casasdecimais: string;
  percentualdesconto: number;
  estoque: number;
  reajustacondicaopagamento: string;
  percentualComissao: number;
  situacaoregistro: string;
  dataregistro: string;
  versao: number;
  imagens: number;
}

interface ProdutoAPI {
  empresa: number | string;
  codigo: string;
  descricao?: string;
  unidadeMedida?: string;
  unidademedida?: string;
  codigoBarra?: string;
  codigobarra?: string;
  agrupamento?: string;
  marca?: string;
  modelo?: string;
  tamanho?: string;
  cor?: string;
  peso?: number;
  precoVenda?: number;
  precovenda?: number;
  casasdecimais?: string | number;
  percentualDesconto?: number;
  percentualdesconto?: number;
  estoque?: number;
  reajustaCondicaoPagamento?: string;
  reajustacondicaopagamento?: string;
  percentualComissao?: number;
  percentualcomissao?: number;
  situacaoRegistro?: string;
  situacaoregistro?: string;
  dataRegistro?: string;
  dataregistro?: string;
  versao?: number;
  imagens?: number | string;
}

async function sincronizarProdutos(): Promise<{
  inseridos: number;
  atualizados: number;
  ignorados: number;
  totalProcessados: number;
}> {
  await criarPastaImagens();

  console.log('🔍 Iniciando sincronização de PRODUTOS...');
  const database = DatabaseManager.getCurrentDatabase();

  if (!database) {
    console.log("❌ Banco de dados não disponível em sincronização de PRODUTOS");
    throw new Error("Database não disponível em sincronização de PRODUTOS");
  }

  // Verifica se a tabela existe (opcional)
  try {
    const res = await database.getAllAsync<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='cadproduto'"
    );
    console.log("🔎 Tabela cadproduto existe:", res.length > 0);
  } catch (err) {
    console.error("❌ Erro ao verificar tabela cadproduto:", err);
  }

  let produtos: ProdutoAPI[] = [];

  // Buscar dados da API com retry
  try {
    const response = await tentarRequisicao(() => api.get<ProdutoAPI[]>('produtos'), 3, 1500);
    const dados = response.data;
    produtos = Array.isArray(dados) ? dados : [dados];
  } catch (error: any) {
    console.log('❌ Erro ao buscar produtos após 3 tentativas:', error.message);
    throw error;
  }

  let totalInseridos = 0;
  let totalAtualizados = 0;
  let totalIgnorados = 0;

  // Busca produtos locais para comparar
  const produtosLocais = await database.getAllAsync<ProdutoLocal>('SELECT * FROM cadproduto');
  const mapaProdutosLocais = new Map(
    produtosLocais.map(p => [`${p.empresa}-${p.codigo}`, p])
  );

  try {
    await database.withTransactionAsync(async () => {
      for (const prodRaw of produtos) {
        try {
          // Normaliza dados da API para o formato local
          const produto: ProdutoLocal = {
            empresa: prodRaw.empresa,
            codigo: prodRaw.codigo,
            descricao: prodRaw.descricao ?? '',
            unidadeMedida: prodRaw.unidadeMedida ?? prodRaw.unidademedida ?? '',
            codigobarra: prodRaw.codigoBarra ?? prodRaw.codigobarra ?? '',
            agrupamento: prodRaw.agrupamento ?? '',
            marca: prodRaw.marca ?? '',
            modelo: prodRaw.modelo ?? '',
            tamanho: prodRaw.tamanho ?? '',
            cor: prodRaw.cor ?? '',
            peso: sanitizarNumero(prodRaw.peso),
            precovenda: sanitizarNumero(prodRaw.precoVenda ?? prodRaw.precovenda),
            casasdecimais: String(prodRaw.casasdecimais ?? '0'),
            percentualdesconto: sanitizarNumero(prodRaw.percentualDesconto ?? prodRaw.percentualdesconto),
            estoque: sanitizarNumero(prodRaw.estoque),
            reajustacondicaopagamento: prodRaw.reajustaCondicaoPagamento ?? prodRaw.reajustacondicaopagamento ?? '',
            percentualComissao: sanitizarNumero(prodRaw.percentualComissao ?? prodRaw.percentualcomissao),
            situacaoregistro: prodRaw.situacaoRegistro ?? prodRaw.situacaoregistro ?? '',
            dataregistro: formatarDataRegistro(prodRaw.dataRegistro ?? prodRaw.dataregistro ?? ''),
            versao: sanitizarNumero(prodRaw.versao),
            imagens: sanitizarNumero(prodRaw.imagens),
          };

          const chave = `${produto.empresa}-${produto.codigo}`;
          const registroAtual = mapaProdutosLocais.get(chave);

          function dadosDiferentes(prodNovo: ProdutoLocal, prodAtual: ProdutoLocal | undefined) {
            if (!prodAtual) return true; // não existe, é diferente
            const campos = [
              'descricao', 'unidadeMedida', 'codigobarra', 'agrupamento',
              'marca', 'modelo', 'tamanho', 'cor', 'peso', 'precovenda',
              'casasdecimais', 'percentualdesconto', 'estoque', 'reajustacondicaopagamento',
              'percentualComissao', 'situacaoregistro', 'dataregistro', 'versao', 'imagens'
            ];

            const camposNumericos = [
              'peso', 'precovenda', 'percentualdesconto', 'estoque', 'percentualComissao', 'imagens'
            ];

            return campos.some(campo => {
              const valNovo = (prodNovo as any)[campo] ?? '';
              const valAtual = (prodAtual as any)[campo] ?? '';

              if (camposNumericos.includes(campo)) {
                const numNovo = Number(valNovo);
                const numAtual = Number(valAtual);
                if (isNaN(numNovo) && isNaN(numAtual)) return false;
                if (numNovo !== numAtual) {
                  console.log(`Campo NUM ${campo} mudou: ${numAtual} -> ${numNovo}`);
                  return true;
                }
                return false;
              }

              if (campo === 'dataregistro') {
                if (valNovo !== valAtual) {
                  console.log(`Campo DATA ${campo} mudou: ${valAtual} -> ${valNovo}`);
                  return true;
                }
                return false;
              }

              if (valNovo.toString().trim() !== valAtual.toString().trim()) {
                console.log(`Campo STR ${campo} mudou: "${valAtual}" -> "${valNovo}"`);
                return true;
              }

              return false;
            });
          }

          if (!registroAtual) {
            // Inserir novo produto
            await database.runAsync(
              `INSERT INTO cadproduto (
                empresa, codigo, descricao, unidadeMedida, codigobarra,
                agrupamento, marca, modelo, tamanho, cor, peso, precovenda,
                casasdecimais, percentualdesconto, estoque, reajustacondicaopagamento,
                percentualComissao, situacaoregistro, dataregistro,
                versao, imagens
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                produto.empresa,
                produto.codigo,
                produto.descricao,
                produto.unidadeMedida,
                produto.codigobarra,
                produto.agrupamento,
                produto.marca,
                produto.modelo,
                produto.tamanho,
                produto.cor,
                produto.peso,
                produto.precovenda,
                produto.casasdecimais,
                produto.percentualdesconto,
                produto.estoque,
                produto.reajustacondicaopagamento,
                produto.percentualComissao,
                produto.situacaoregistro,
                produto.dataregistro,
                produto.versao,
                produto.imagens
              ]
            );
            console.log(`✅ Produto ${produto.codigo} inserido.`);
            totalInseridos++;

          } else if (dadosDiferentes(produto, registroAtual)) {
            // Atualizar produto existente
            await database.runAsync(
              `UPDATE cadproduto SET
                descricao = ?, unidadeMedida = ?, codigobarra = ?, agrupamento = ?,
                marca = ?, modelo = ?, tamanho = ?, cor = ?, peso = ?, precovenda = ?,
                casasdecimais = ?, percentualdesconto = ?, estoque = ?, reajustacondicaopagamento = ?,
                percentualComissao = ?, situacaoregistro = ?, dataregistro = ?,
                versao = ?, imagens = ?
              WHERE empresa = ? AND codigo = ?`,
              [
                produto.descricao,
                produto.unidadeMedida,
                produto.codigobarra,
                produto.agrupamento,
                produto.marca,
                produto.modelo,
                produto.tamanho,
                produto.cor,
                produto.peso,
                produto.precovenda,
                produto.casasdecimais,
                produto.percentualdesconto,
                produto.estoque,
                produto.reajustacondicaopagamento,
                produto.percentualComissao,
                produto.situacaoregistro,
                produto.dataregistro,
                produto.versao,
                produto.imagens,
                produto.empresa,
                produto.codigo
              ]
            );
            console.log(`🔄 Produto ${produto.codigo} atualizado.`);
            totalAtualizados++;

          } else {
            console.log(`⏭ Produto ${produto.codigo} sem alteração.`);
            totalIgnorados++;
          }
        } catch (err) {
          console.error(`❌ Erro ao sincronizar produto ${prodRaw.codigo}:`, err);
        }
      }
    });
  } catch (error: any) {
    console.error('❌ Erro geral ao sincronizar produtos:', error.message);
    throw new Error('Falha na sincronização dos produtos');
  }

  console.log(`🏁 Sincronização finalizada:`);
  console.log(`✅ Inseridos: ${totalInseridos}`);
  console.log(`🔄 Atualizados: ${totalAtualizados}`);
  console.log(`⏭ Ignorados: ${totalIgnorados}`);
  console.log(`📦 Total processados: ${produtos.length}`);

  return {
    inseridos: totalInseridos,
    atualizados: totalAtualizados,
    ignorados: totalIgnorados,
    totalProcessados: produtos.length,
  };
}




//================================================================================================
// ***********************Inicio da função de sincronização das imagens **************************
//------------------------------------------------------------------------------------------------
async function sincronizarImagens(): Promise<number> {
  try {
    let totalimagem = 0;
    const response = await api.get<{ imagens: string[] }>('lista/imagem');
    const urls = response.data.imagens;

    for (const url of urls) {
      totalimagem++;
      const nomeArquivo = url.split('/').pop();
      if (nomeArquivo) {
        await baixarImagem(url, nomeArquivo);
      }
    }
    console.log('total de imagens:', totalimagem);
    console.log(`✅ ${totalimagem} imagens baixadas com sucesso.`);

    return totalimagem; // Retorna o total sincronizado
  } catch (error) {
    console.error('❌ Erro ao buscar imagens:', error);
    throw error;
  }
}



// ***********************Inicio da função de sincronização das imagens **************************
//------------------------------------------------------------------------------------------------
// Interface para tipagem forte
interface Produto {
  id: number;
  codigo: string;
  descricao: string;
  codigobarra: string;
  precovenda: number;
  casasdecimais: string;
  unidadeMedida: string;
  percentualComissao: number;
  percentualdesconto:number,
  agrupamento: string;
  reajustacondicaopagamento: string;

}

// Função de listagem com tipagem correta
async function ListarItens(): Promise<Produto[]> {
  try {
    const resultados = await database.getAllAsync<Produto>(
      `SELECT id, codigo, descricao, codigobarra, precovenda, casasdecimais, unidadeMedida, percentualComissao, 
       reajustacondicaopagamento, percentualdesconto, agrupamento FROM cadproduto 
       WHERE situacaoregistro <> 'E' 
       ORDER BY trim(descricao)`
    );

    return resultados;
  } catch (error) {
    console.error('❌ Erro ao listar os itens:', error);
    throw error;
  }
}
//================================================================================================
// Função de listagem de clientes
// ==================================

// Interface para tipagem forte
interface Clientes {
  id: number;
  codigo: string;
  nome: string;
  rua: string;
  telefone: number;
  cpfCnpj: string;
}

async function ListarClientes(): Promise<Clientes[]> {
  try {
    const resultados = await database.getAllAsync<Clientes>(
      `SELECT *
       FROM cadcliente 
       WHERE situacaoregistro <> 'E' 
       ORDER BY trim(nome)`
    );

    return resultados;
  } catch (error) {
    console.error('❌ Erro ao listar os clientes:', error);
    throw error;
  }
}
//==============================================================
// Função de listagem da forma de pagamento
// =============================================================

// Interface para tipagem forte
interface formapgto {
  id: number;
  codigo:string;
  descricao: string;
  acrescimo: number;
  
}

async function ListarFormaPgto(): Promise<formapgto[]> {
  try {
    const resultados = await database.getAllAsync<formapgto>(
      `SELECT *
       FROM cadcondicaopagamento 
       WHERE situacaoregistro <> 'E' 
       ORDER BY trim(descricao) desc`
    );

    return resultados;
  } catch (error) {
    console.error('❌ Erro ao listar a forma pagto:', error);
    throw error;
  }
}

//================================================================================================
// Função de listagem com tipagem correta

interface Empresa{
  id: number; 
  codigo: string;
  nome: string; 
  cnpj: string; 
  cidade: string; 
  rua: string; 
  numero: string; 
  bairro: string; 
  telefone: string; 
  email: string; 
}

async function ConsultarEmpresa(CNPJ:string): Promise<Empresa[]> {
  console.log('Entrou na rotina da cosnulta empresa:')
  try {
    const resultados = await database.getAllAsync<Empresa>(
      `SELECT id, codigo, nome, cnpj, cidade, rua,numero,bairro, telefone, email from cadempresa
      WHERE cnpj = ?`, CNPJ.trim()
    );

    return resultados;
  } catch (error) {
    console.error('❌ Erro ao listar os itens:', error);
    throw error;
  }
}



// ***********************Inicio da função de sincronização dos parâmetros **************************
//------------------------------------------------------------------------------------------------
async function sincronizarParametros() {
  let parametros: any[] = [];

  let totalInseridos = 0;
  let totalAtualizados = 0;
  let totalIgnorados = 0;

  try {
    const response = await tentarRequisicao(() => api.get('parametro'), 3, 1500);
    const dados = response.data;
    parametros = Array.isArray(dados) ? dados : [dados];
  } catch (error: any) {
    console.log('❌ Erro ao buscar do parâmetros após 3 tentativas:', error.message);
    return { inseridos: 0, atualizados: 0, ignorados: 0, totalProcessados: 0 };
  }

  try {
    interface Parametro {
      empresa: number;
      // os demais campos conforme sua estrutura
    }

    const parametrosLocais = await database.getAllAsync<Parametro>('SELECT * FROM cadparametro');
    const mapaParametrosLocais = new Map(parametrosLocais.map(p => [p.empresa, p]));

    await database.withTransactionAsync(async () => {
      for (let parametro of parametros) {
        try {
          const registroAtual = mapaParametrosLocais.get(parametro.empresa);

          function dadosDiferentes(novo: any, atual: any) {
            const campos = [
              'vendedorPadrao', 'atualizaCliente', 'atualizaCondPagamento',
              'atualizaParametro', 'atualizaProduto', 'atualizaVendedor',
              'controlaSaldoEstoque', 'casaDecimalQuantidade', 'casaDecimalValor',
              'controlaFormaPagamento', 'percentualDescontoVenda',
              'mostrarFinanceiro', 'mostrarFinanceiroVencido',
              'dataUltimaAtualizacao', 'situacaoRegistro',
              'dataRegistro', 'versaoGeral', 'versaoVendedor', 'versaoCliente',
              'versaoCondicaoPagamento', 'versaoCheckListPergunta', 'versaoCheckListResposta',
              'versaoFinanceiro', 'versaoRotaCondicaoPagamento', 'versaoRotaCliente',
              'versaoProduto', 'versaoParametro'
            ];
            return campos.some(campo => {
              const novoVal = novo[campo] ?? '';
              const atualVal = atual?.[campo] ?? '';
              return novoVal.toString().trim() !== atualVal.toString().trim();
            });
          }

          if (!registroAtual) {
            await database.runAsync(
              `INSERT INTO cadparametro (
                empresa, vendedorPadrao, atualizaCliente, atualizaCondPagamento,
                atualizaParametro, atualizaProduto, atualizaVendedor, controlaSaldoEstoque,
                casaDecimalQuantidade, casaDecimalValor, controlaFormaPagamento,
                percentualDescontoVenda, mostrarFinanceiro, mostrarFinanceiroVencido,
                dataUltimaAtualizacao, situacaoRegistro, dataRegistro,
                versaoGeral, versaoVendedor, versaoCliente,
                versaoCondicaoPagamento, versaoCheckListPergunta,
                versaoCheckListResposta, versaoFinanceiro, versaoRotaCondicaoPagamento,
                versaoRotaCliente, versaoProduto, versaoParametro
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                parametro.empresa, parametro.vendedorPadrao, parametro.atualizaCliente,
                parametro.atualizaCondPagamento, parametro.atualizaParametro,
                parametro.atualizaProduto, parametro.atualizaVendedor, parametro.controlaSaldoEstoque,
                parametro.casaDecimalQuantidade, parametro.casaDecimalValor, parametro.controlaFormaPagamento,
                parametro.percentualDescontoVenda, parametro.mostrarFinanceiro, parametro.mostrarFinanceiroVencido,
                parametro.dataUltimaAtualizacao, parametro.situacaoRegistro, parametro.dataRegistro,
                parametro.versaoGeral, parametro.versaoVendedor, parametro.versaoCliente,
                parametro.versaoCondicaoPagamento, parametro.versaoCheckListPergunta,
                parametro.versaoCheckListResposta, parametro.versaoFinanceiro, parametro.versaoRotaCondicaoPagamento,
                parametro.versaoRotaCliente, parametro.versaoProduto, parametro.versaoParametro
              ]
            );
            console.log(`✅ Parâmetro da empresa ${parametro.empresa} inserido.`);
            totalInseridos++;
          } else if (dadosDiferentes(parametro, registroAtual)) {
            await database.runAsync(
              `UPDATE cadparametro SET
                vendedorPadrao = ?, atualizaCliente = ?, atualizaCondPagamento = ?,
                atualizaParametro = ?, atualizaProduto = ?, atualizaVendedor = ?,
                controlaSaldoEstoque = ?, casaDecimalQuantidade = ?, casaDecimalValor = ?,
                controlaFormaPagamento = ?, percentualDescontoVenda = ?,
                mostrarFinanceiro = ?, mostrarFinanceiroVencido = ?,
                dataUltimaAtualizacao = ?, situacaoRegistro = ?, dataRegistro = ?,
                versaoGeral = ?, versaoVendedor = ?, versaoCliente = ?,
                versaoCondicaoPagamento = ?, versaoCheckListPergunta = ?,
                versaoCheckListResposta = ?, versaoFinanceiro = ?, versaoRotaCondicaoPagamento = ?,
                versaoRotaCliente = ?, versaoProduto = ?, versaoParametro = ?
              WHERE empresa = ?`,
              [
                parametro.vendedorPadrao, parametro.atualizaCliente, parametro.atualizaCondPagamento,
                parametro.atualizaParametro, parametro.atualizaProduto, parametro.atualizaVendedor,
                parametro.controlaSaldoEstoque, parametro.casaDecimalQuantidade, parametro.casaDecimalValor,
                parametro.controlaFormaPagamento, parametro.percentualDescontoVenda,
                parametro.mostrarFinanceiro, parametro.mostrarFinanceiroVencido,
                parametro.dataUltimaAtualizacao, parametro.situacaoRegistro, parametro.dataRegistro,
                parametro.versaoGeral, parametro.versaoVendedor, parametro.versaoCliente,
                parametro.versaoCondicaoPagamento, parametro.versaoCheckListPergunta,
                parametro.versaoCheckListResposta, parametro.versaoFinanceiro, parametro.versaoRotaCondicaoPagamento,
                parametro.versaoRotaCliente, parametro.versaoProduto, parametro.versaoParametro,
                parametro.empresa
              ]
            );
            console.log(`🔄 Parâmetro da empresa ${parametro.empresa} atualizado.`);
            totalAtualizados++;
          } else {
            console.log(`⏭ Parâmetro da empresa ${parametro.empresa} sem alterações.`);
            totalIgnorados++;
          }

        } catch (err) {
          console.error(`❌ Erro ao processar parâmetro da empresa ${parametro.empresa}:`, err);
        }
      }
    });

    const totalProcessados = totalInseridos + totalAtualizados + totalIgnorados;
    console.log(`📊 Sincronização de parâmetros finalizada.`);
    return { inseridos: totalInseridos, atualizados: totalAtualizados, ignorados: totalIgnorados, totalProcessados };
  } catch (error: any) {
    console.error('❌ Erro geral ao sincronizar parâmetros:', error.message);
    throw new Error('Falha na sincronização dos parâmetros');
  }
}


// ***********************Inicio da função de sincronização das rotas de clientes **************************
//------------------------------------------------------------------------------------------------
async function sincronizarRotaClientes() {
  let dadosRota: any[] = [];

  try {
    const response = await api.get('rotaclientes/');
    const dados = response.data;
    dadosRota = Array.isArray(dados) ? dados : [dados];
  } catch (error) {
    console.error('❌ Erro ao buscar rota de clientes:', error);
    return;
  }

  try {
    interface RotaCliente {
      empresa: number;
      codigorota: number;
      codigocliente: string;
      situacaoRegistro?: string;
      dataRegistro?: string;
      versao: number;
    }

    const locais = await database.getAllAsync<RotaCliente>('SELECT * FROM cadrotacliente');
    const mapaLocais = new Map(
      locais.map(r => [`${r.empresa}-${r.codigorota}-${r.codigocliente}`, r])
    );

    await database.withTransactionAsync(async () => {
      for (let registro of dadosRota) {
        try {
          const chave = `${registro.empresa}-${registro.codigorota}-${registro.codigocliente}`;
          const atual = mapaLocais.get(chave);

          function dadosDiferentes(novo: any, atual: any) {
            const campos = ['situacaoRegistro', 'dataRegistro', 'versao'];
            return campos.some(campo => {
              const novoVal = novo[campo] ?? '';
              const atualVal = atual?.[campo] ?? '';
              return novoVal.toString().trim() !== atualVal.toString().trim();
            });
          }

          if (!atual) {
            await database.runAsync(
              `INSERT INTO cadrotacliente (
                empresa, codigorota, codigocliente, situacaoRegistro, dataRegistro, versao
              ) VALUES (?, ?, ?, ?, ?, ?)`,
              [
                registro.empresa,
                registro.codigorota,
                registro.codigocliente,
                registro.situacaoRegistro ?? '',
                registro.dataRegistro ?? '',
                registro.versao ?? 0
              ]
            );
            console.log(`✅ Rota ${registro.codigorota} cliente ${registro.codigocliente} inserido.`);
          } else if (dadosDiferentes(registro, atual)) {
            await database.runAsync(
              `UPDATE cadrotacliente SET
                situacaoRegistro = ?, dataRegistro = ?, versao = ?
              WHERE empresa = ? AND codigorota = ? AND codigocliente = ?`,
              [
                registro.situacaoRegistro ?? '',
                registro.dataRegistro ?? '',
                registro.versao ?? 0,
                registro.empresa,
                registro.codigorota,
                registro.codigocliente
              ]
            );
            console.log(`🔄 Rota ${registro.codigorota} cliente ${registro.codigocliente} atualizado.`);
          } else {
            console.log(`⏭ Rota ${registro.codigorota} cliente ${registro.codigocliente} sem alteração.`);
          }

        } catch (err) {
          console.error(`❌ Erro ao processar rota cliente ${registro.codigocliente}:`, err);
        }
      }
    });

    console.log(`📊 Sincronização de rotas-clientes finalizada.`);
  } catch (error: any) {
    console.error('❌ Erro geral ao sincronizar rotas-clientes:', error.message);
    throw new Error('Falha na sincronização de rotas-clientes');
  }
}

// ***********************Inicio da função de sincronização dos cadastros de clientes **************************
//------------------------------------------------------------------------------------------------

async function sincronizarClientes() {
  let clientes: any[] = [];
  const database = DatabaseManager.getCurrentDatabase();

  if (!database) {
    console.log("❌ Banco de dados ainda não está disponível em sincronização de CLIENTE");
    throw new Error("Database não disponível em sincronização de CLIENTE");
  }

  try {
    const res = await database.getAllAsync("SELECT name FROM sqlite_master WHERE type='table' AND name='cadcliente'");
    console.log("🔎 Tabela cadcliente existe:", res.length > 0);
  } catch (err) {
    console.error("❌ Erro ao verificar tabela cadcliente:", err);
  }

  try {
    console.log("🔗 URL chamada:", api.defaults.baseURL + 'clientes');

    // Buscar dados da API com retry
    const response = await tentarRequisicao(() => api.get('clientes'), 3, 1500);
    let dados = response.data;

    // Parse seguro se vier como string
    if (typeof dados === 'string') {
      try {
        dados = JSON.parse(dados);
      } catch (err) {
        console.error('❌ Não foi possível parsear os dados da API:', err);
        dados = [];
      }
    }

    clientes = Array.isArray(dados) ? dados : [dados];

    // Filtro clientes inválidos
    const clientesValidos = clientes.filter(c => {
      const valido = c?.empresa != null && c?.codigo != null && c?.codigo !== '';
      if (!valido) console.warn("⚠️ Cliente inválido ignorado:", c);
      return valido;
    });
    clientes = clientesValidos;

    console.log(`📦 Total de clientes válidos: ${clientes.length}`);

  } catch (error: any) {
    if (error.response) {
      console.error("❌ Erro de resposta:", error.response.status, error.response.data);
    } else if (error.request) {
      console.error("❌ Erro de rede ou servidor inacessível:", error.message);
    } else {
      console.error("❌ Erro inesperado:", error.message);
    }
    throw error;
  }

  try {
    interface Cliente {
      empresa: number;
      codigo: string;
      // Demais campos
    }

    const locais = await database.getAllAsync<Cliente>('SELECT * FROM cadcliente');
    const mapaLocais = new Map(
      locais.map(c => [`${c.empresa}-${c.codigo}`, c])
    );

    let totalInseridos = 0;
    let totalAtualizados = 0;
    let totalIgnorados = 0;

    await database.withTransactionAsync(async () => {
      for (let cliente of clientes) {
        try {
          // Validação obrigatórios
          if (!cliente?.empresa || !cliente?.codigo) {
            console.warn(`⚠️ Cliente inválido, ignorando:`, cliente);
            totalIgnorados++;
            continue;
          }

          const chave = `${cliente.empresa}-${cliente.codigo}`;
          const atual = mapaLocais.get(chave);

          function dadosDiferentes(novo: any, atual: any) {
            const campos = [
              'codigovendedor', 'nome', 'contato', 'cpfCnpj', 'rua', 'numero',
              'bairro', 'cidade', 'estado', 'telefone', 'limiteCredito',
              'observacao', 'restricao', 'reajuste', 'situacaoRegistro',
              'dataRegistro', 'versao'
            ];
            return campos.some(campo => {
              const novoVal = novo[campo] ?? '';
              const atualVal = atual?.[campo] ?? '';
              return novoVal.toString().trim() !== atualVal.toString().trim();
            });
          }

          if (!atual) {
            await database.runAsync(
              `INSERT INTO cadcliente (
                empresa, codigo, codigovendedor, nome, contato, cpfCnpj, rua,
                numero, bairro, cidade, estado, telefone, limiteCredito,
                observacao, restricao, reajuste, situacaoRegistro, dataRegistro, versao
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                sanitizarNumero(cliente.empresa), cliente.codigo,
                cliente.codigovendedor ? sanitizarNumero(cliente.codigovendedor) : 0,
                cliente.nome ?? '', cliente.contato ?? '', cliente.cpfCnpj ?? '', cliente.rua ?? '',
                cliente.numero ?? '', cliente.bairro ?? '', cliente.cidade ?? '',
                cliente.estado ?? '', cliente.telefone ?? '', sanitizarNumero(cliente.limiteCredito),
                cliente.observacao ?? '', cliente.restricao ?? '', sanitizarNumero(cliente.reajuste),
                cliente.situacaoRegistro ?? 'I', cliente.dataRegistro ?? '', sanitizarNumero(cliente.versao, 1)
              ]
            );
            console.log(`✅ Cliente ${cliente.codigo} inserido.`);
            totalInseridos++;
          } else if (dadosDiferentes(cliente, atual)) {
            await database.runAsync(
              `UPDATE cadcliente SET
                codigovendedor = ?, nome = ?, contato = ?, cpfCnpj = ?, rua = ?,
                numero = ?, bairro = ?, cidade = ?, estado = ?, telefone = ?,
                limiteCredito = ?, observacao = ?, restricao = ?, reajuste = ?,
                situacaoRegistro = ?, dataRegistro = ?, versao = ?
              WHERE empresa = ? AND codigo = ?`,
              [
                cliente.codigovendedor ? sanitizarNumero(cliente.codigovendedor) : 0,
                cliente.nome ?? '', cliente.contato ?? '', cliente.cpfCnpj ?? '', cliente.rua ?? '', cliente.numero ?? '',
                cliente.bairro ?? '', cliente.cidade ?? '', cliente.estado ?? '', cliente.telefone ?? '',
                sanitizarNumero(cliente.limiteCredito), cliente.observacao ?? '', cliente.restricao ?? '',
                sanitizarNumero(cliente.reajuste), cliente.situacaoRegistro ?? 'I', cliente.dataRegistro ?? '',
                sanitizarNumero(cliente.versao, 1), sanitizarNumero(cliente.empresa), cliente.codigo
              ]
            );
            console.log(`🔄 Cliente ${cliente.codigo} atualizado.`);
            totalAtualizados++;
          } else {
            console.log(`⏭ Cliente ${cliente.codigo} sem alteração.`);
            totalIgnorados++;
          }

        } catch (err) {
          console.error(`❌ Erro ao processar cliente ${cliente.codigo}:`, err);
          totalIgnorados++;
        }
      }
    });

    console.log(`🏁 Sincronização de CLIENTE finalizada:`);
    console.log(`✅ Inseridos: ${totalInseridos}`);
    console.log(`🔄 Atualizados: ${totalAtualizados}`);
    console.log(`⏭ Ignorados: ${totalIgnorados}`);
    console.log(`📦 Total processados: ${clientes.length}`);

    return {
      inseridos: totalInseridos,
      atualizados: totalAtualizados,
      ignorados: totalIgnorados,
      totalProcessados: clientes.length,
    };

  } catch (error: any) {
    console.error('❌ Erro geral ao sincronizar clientes:', error.message);
    throw new Error('Falha na sincronização de CLIENTES');
  }
}



// ***********************Inicio da função de sincronização dos cadastros de vendedores **************************
//----------------------------------------------------------------------------------------------------------------
async function sincronizarVendedores() {
  let vendedores: any[] = [];
  const database = DatabaseManager.getCurrentDatabase();

  if (!database) {
    console.log("❌ Banco de dados ainda não está disponível em sincronização de VENDEDORES");
    throw new Error("Database não disponível em sincronização de VENDEDORES");
  }

  try {  
    const response = await tentarRequisicao(() => api.get('vendedores'), 3, 1500);
    const dados = response.data;
    vendedores = Array.isArray(dados) ? dados : [dados];
  } catch (error: any) {
    console.log('❌ Erro ao buscar vendedores após 3 tentativas:', error.message);
    throw error;
  }  

  try {
    interface Vendedor {
      empresa: number;
      codigo: string;
      codigorota?: number | null;
      nome: string;
      situacaoRegistro?: string;
      dataRegistro?: string;
      versao: number;
    }

    const locais = await database.getAllAsync<Vendedor>('SELECT * FROM cadvendedor');
    const mapaLocais = new Map(
      locais.map(v => [`${v.empresa}-${v.codigo}`, v])
    );

    let totalInseridos = 0;
    let totalAtualizados = 0;
    let totalIgnorados = 0;

    await database.withTransactionAsync(async () => {
      for (let vendedor of vendedores) {
        try {
          const chave = `${vendedor.empresa}-${vendedor.codigo}`;
          const atual = mapaLocais.get(chave);

          function dadosDiferentes(novo: any, atual: any) {
            const campos = ['codigorota', 'nome', 'situacaoRegistro', 'dataRegistro', 'versao'];
            return campos.some(campo => {
              const novoVal = novo[campo] ?? '';
              const atualVal = atual?.[campo] ?? '';
              return novoVal.toString().trim() !== atualVal.toString().trim();
            });
          }

          if (!atual) {
            await database.runAsync(
              `INSERT INTO cadvendedor (
                empresa, codigo, codigorota, nome, situacaoRegistro, dataRegistro, versao
              ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
              [
                vendedor.empresa,
                vendedor.codigo,
                vendedor.codigorota ?? null,
                vendedor.nome,
                vendedor.situacaoRegistro ?? 'I',
                vendedor.dataRegistro ?? '',
                vendedor.versao ?? 1
              ]
            );
            console.log(`✅ Vendedor ${vendedor.codigo} inserido.`);
            totalInseridos++;
          } else if (dadosDiferentes(vendedor, atual)) {
            await database.runAsync(
              `UPDATE cadvendedor SET
                codigorota = ?, nome = ?, situacaoRegistro = ?, dataRegistro = ?, versao = ?
              WHERE empresa = ? AND codigo = ?`,
              [
                vendedor.codigorota ?? null,
                vendedor.nome,
                vendedor.situacaoRegistro ?? 'I',
                vendedor.dataRegistro ?? '',
                vendedor.versao ?? 1,
                vendedor.empresa,
                vendedor.codigo
              ]
            );
            console.log(`🔄 Vendedor ${vendedor.codigo} atualizado.`);
            totalAtualizados++;
          } else {
            console.log(`⏭ Vendedor ${vendedor.codigo} sem alteração.`);
            totalIgnorados++;
          }

        } catch (err) {
          console.error(`❌ Erro ao processar vendedor ${vendedor.codigo}:`, err);
        }
      }
    });

    console.log(`🏁 Sincronização de vendedores finalizada:`);
    console.log(`✅ Inseridos: ${totalInseridos}`);
    console.log(`🔄 Atualizados: ${totalAtualizados}`);
    console.log(`⏭ Ignorados: ${totalIgnorados}`);
    console.log(`📦 Total processados: ${vendedores.length}`);

    return {
      inseridos: totalInseridos,
      atualizados: totalAtualizados,
      ignorados: totalIgnorados,
      totalProcessados: vendedores.length,
    };

  } catch (error: any) {
    console.error('❌ Erro geral ao sincronizar vendedores:', error.message);
    throw new Error('Falha na sincronização de vendedores');
  }
}


// ***********************Inicio da função de sincronização forma de pagamento **************************
//-------------------------------------------------------------------------------------------------------
async function sincronizarCondicoesPagamento() {
  let condicoes: any[] = [];

  let totalInseridos = 0;
  let totalAtualizados = 0;
  let totalIgnorados = 0;

  try {
    
    const response = await tentarRequisicao(() => api.get('condicoespagamento'), 3, 2000);
    const dados = response.data;
    condicoes = Array.isArray(dados) ? dados : [dados];
  } catch (error: any) {
    console.log('❌ Erro ao buscar do condições de pagamento após 3 tentativas:', error.message);
    return { inseridos: 0, atualizados: 0, ignorados: 0 };
  } 


  try {
    interface CondicaoPagamento {
      empresa: number;
      codigo: string;
      // Outros campos conforme a estrutura da tabela
    }

    const locais = await database.getAllAsync<CondicaoPagamento>('SELECT * FROM cadcondicaopagamento');
    const mapaLocais = new Map(locais.map(c => [`${c.empresa}-${c.codigo}`, c]));

    await database.withTransactionAsync(async () => {
      for (let condicao of condicoes) {
        try {
          const chave = `${condicao.empresa}-${condicao.codigo}`;
          const atual = mapaLocais.get(chave);

          function dadosDiferentes(novo: any, atual: any) {
            const campos = [
              'descricao', 'acrescimo', 'desconto',
              'situacaoRegistro', 'dataRegistro', 'versao'
            ];
            return campos.some(campo => {
              const novoVal = novo[campo] ?? '';
              const atualVal = atual?.[campo] ?? '';
              return novoVal.toString().trim() !== atualVal.toString().trim();
            });
          }

          if (!atual) {
            await database.runAsync(
              `INSERT INTO cadcondicaopagamento (
                empresa, codigo, descricao, acrescimo, desconto,
                situacaoRegistro, dataRegistro, versao
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                condicao.empresa,
                condicao.codigo,
                condicao.descricao ?? '',
                condicao.acrescimo ?? 0.0,
                condicao.desconto ?? 0.0,
                condicao.situacaoRegistro ?? 'I',
                condicao.dataRegistro ?? '',
                condicao.versao ?? 1
              ]
            );
            console.log(`✅ Cond. pagamento ${condicao.codigo} inserida.`);
            totalInseridos++;
          } else if (dadosDiferentes(condicao, atual)) {
            await database.runAsync(
              `UPDATE cadcondicaopagamento SET
                descricao = ?, acrescimo = ?, desconto = ?,
                situacaoRegistro = ?, dataRegistro = ?, versao = ?
              WHERE empresa = ? AND codigo = ?`,
              [
                condicao.descricao ?? '',
                condicao.acrescimo ?? 0.0,
                condicao.desconto ?? 0.0,
                condicao.situacaoRegistro ?? 'I',
                condicao.dataRegistro ?? '',
                condicao.versao ?? 1,
                condicao.empresa,
                condicao.codigo
              ]
            );
            console.log(`🔄 Cond. pagamento ${condicao.codigo} atualizada.`);
            totalAtualizados++;
          } else {
            console.log(`⏭ Cond. pagamento ${condicao.codigo} sem alteração.`);
            totalIgnorados++;
          }

        } catch (err) {
          console.error(`❌ Erro ao processar condição ${condicao.codigo}:`, err);
        }
      }
    });

    console.log(`📊 Sincronização de condições de pagamento finalizada.`);
    const totalProcessados = totalInseridos + totalAtualizados + totalIgnorados;
    return { inseridos: totalInseridos, atualizados: totalAtualizados, ignorados: totalIgnorados, totalProcessados };
  } catch (error: any) {
    console.error('❌ Erro geral ao sincronizar condições de pagamento:', error.message);
    throw new Error('Falha na sincronização das condições de pagamento');
  }
}

// =============================================================================================
//                         ROTINA PARA GRAVAR PEDIDO DE VENDA    
// =============================================================================================

interface Pedido {
  empresa: number;
  codigocondpagamento: string;
  codigovendedor: string;
  codigocliente: string;
  nomecliente?: string;
  vrdesconto?: number;
  vrdespesas?: number;
  valorFrete?: number;
  valortotal: number;
  pesototal?: number;
  observacao?: string;
  status?: string;
  datalancamento?: string;
  dataregistro: string;
  itens: PedidoItem[];
}

interface PedidoItem {
  codigoproduto: string;
  descricaoproduto?: string;
  valorunitario: number;
  valorunitariovenda: number;
  valordesconto?: number;
  valoracrescimo?: number;
  valortotal: number;
  quantidade: number;
  codigocliente: string;
}

async function GravarPedidos(pedido: Pedido): Promise<void> {
//  console.log("Dados do pedido: ", pedido);
  try {
    await database.runAsync("BEGIN TRANSACTION");

    if (!pedido.empresa) throw new Error("Empresa não informada.");
    if (!pedido.codigocondpagamento) throw new Error("Forma de pagamento não informada.");
    if (!pedido.codigovendedor) throw new Error("Vendedor não informado.");
    if (!pedido.codigocliente) throw new Error("Cliente não informado.");
    if (!pedido.itens || pedido.itens.length === 0) throw new Error("Nenhum item informado para o pedido.");
    if (!pedido.dataregistro) throw new Error("Data de registro não informada.");

    let numerodocumento: number;

    const result = await database.getFirstAsync<{ numerodocumento: number }>(
      `SELECT numerodocumento FROM movnota WHERE empresa = ? AND codigocliente = ? AND status = 'P' LIMIT 1`,
      [pedido.empresa, pedido.codigocliente]
    );

    if (result) {
      numerodocumento = result.numerodocumento;

      const updateNotaQuery = `
        UPDATE movnota SET
          codigocondPagamento = ?, codigovendedor = ?, codigocliente = ?, nomecliente = ?,
          valorDesconto = ?, valorDespesas = ?, valorFrete = ?, pesoTotal = ?,
          observacao = ?, dataLancamento = ?, dataRegistro = ?, situacaoregistro = "A" 
        WHERE empresa = ? AND numerodocumento = ? 
      `;

      await database.runAsync(updateNotaQuery, [
        pedido.codigocondpagamento,
        pedido.codigovendedor,
        pedido.codigocliente,
        pedido.nomecliente ?? '',
        pedido.vrdesconto ?? 0,
        pedido.vrdespesas ?? 0,
        pedido.valorFrete ?? 0,
        pedido.pesototal ?? 0,
        pedido.observacao ?? '',
        formatarDataRegistro(pedido.datalancamento ?? new Date().toISOString()),
        formatarDataRegistro(pedido.dataregistro),
        pedido.empresa,
        numerodocumento
      ]);

      console.log("✏️ movnota atualizada (sem valorTotal ainda).");

    } else {
      numerodocumento = await gerarnumerodocumento(pedido.empresa, pedido.codigocliente);
   //   console.log("Código pedido gerado: ", numerodocumento);

      const insertNotaQuery = `
        INSERT INTO movnota (
          empresa, numerodocumento, codigocondPagamento, codigovendedor, codigocliente, nomecliente,
          valorDesconto, valorDespesas, valorFrete, valorTotal, pesoTotal,
          observacao, status, dataLancamento, dataRegistro
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      await database.runAsync(insertNotaQuery, [
        pedido.empresa,
        numerodocumento,
        pedido.codigocondpagamento,
        pedido.codigovendedor,
        pedido.codigocliente,
        pedido.nomecliente ?? '',
        pedido.vrdesconto ?? 0,
        pedido.vrdespesas ?? 0,
        pedido.valorFrete ?? 0,
        0,
        pedido.pesototal ?? 0,
        pedido.observacao ?? '',
        pedido.status ?? 'A',
        formatarDataRegistro(pedido.datalancamento ?? new Date().toISOString()),
        formatarDataRegistro(pedido.dataregistro)
      ]);

      console.log("✅ movnota inserida (valorTotal será calculado após os itens).");
    }

    const selectItemQuery = `
      SELECT quantidade, valorUnitario, valorunitariovenda, valorDesconto, valoracrescimo, valorTotal
      FROM movnotaitem
      WHERE empresa = ? AND numerodocumento = ? AND codigoproduto = ? AND codigocliente = ?
    `;

    const updateItemQuery = `
      UPDATE movnotaitem SET
        quantidade = ?,
        valorUnitario = ?,
        valorunitariovenda = ?,
        valorDesconto = ?,
        valoracrescimo = ?,
        valorTotal = ?,
        situacaoregistro = "A"
      WHERE empresa = ? AND numerodocumento = ? AND codigoproduto = ? AND codigocliente = ?
    `;

    const insertItemQuery = `
      INSERT INTO movnotaitem (
        empresa, numerodocumento, codigovendedor, codigoproduto, descricaoproduto,
        valorUnitario, valorunitariovenda, valorDesconto, valoracrescimo, valorTotal, quantidade,
        dataRegistro, codigocliente
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    for (const [index, item] of pedido.itens.entries()) {
      if (!item.codigoproduto) throw new Error(`Produto não informado no item ${index + 1}.`);
      if (!item.quantidade || item.quantidade <= 0) throw new Error(`Quantidade inválida no item ${index + 1}.`);
      if (item.valorunitario == null || item.valorunitario < 0) throw new Error(`Valor unitário inválido no item ${index + 1}.`);
      if (item.valorunitariovenda == null || item.valorunitariovenda < 0) throw new Error(`Valor unitário inválido no item ${index + 1}.`);
      if (item.valortotal == null || item.valortotal < 0) console.warn(`⚠️ Valor total indefinido no item ${index + 1}.`);
      if (!item.codigocliente) console.warn(`⚠️ Código do cliente ausente no item ${index + 1}.`);

      const itemExistente = await database.getFirstAsync<{
        quantidade: number;
        valorUnitario: number;
        valorunitariovenda: number;
        valorDesconto: number;
        valoracrescimo: number;
        valorTotal: number;
      }>(selectItemQuery, [
        pedido.empresa, numerodocumento, item.codigoproduto, item.codigocliente ?? ''
      ]);

      if (itemExistente) {
        const novaQuantidade = itemExistente.quantidade + item.quantidade;
        const valorUnitario = item.valorunitario;
        const valorunitariovenda = item.valorunitariovenda;
        const valorDesconto = item.valordesconto ?? 0;
        const valoracrescimo = item.valoracrescimo ?? 0;
        const novoValorTotal = Number(((novaQuantidade * valorunitariovenda) + valoracrescimo - valorDesconto ).toFixed(2));

        await database.runAsync(updateItemQuery, [
          novaQuantidade,
          valorUnitario,
          valorunitariovenda,
          valorDesconto,
          valoracrescimo,
          novoValorTotal,
          pedido.empresa, numerodocumento, item.codigoproduto, item.codigocliente ?? ''
        ]);

     //   console.log(`✏️ Item atualizado: ${item.codigoproduto}`);
      } else {
        const valorTotalItem = Number(((item.valorunitariovenda * item.quantidade) + (item.valoracrescimo ?? 0) - (item.valordesconto ?? 0)).toFixed(2));

        await database.runAsync(insertItemQuery, [
          pedido.empresa,
          numerodocumento,
          pedido.codigovendedor,
          item.codigoproduto,
          item.descricaoproduto ?? '',
          item.valorunitario,
          item.valorunitariovenda,
          item.valordesconto ?? 0,
          item.valoracrescimo ?? 0,
          valorTotalItem,
          item.quantidade,
          formatarDataRegistro(pedido.dataregistro),
          item.codigocliente ?? ''
        ]);

     //   console.log(`✅ Item inserido: ${item.codigoproduto}`);
      }
    }

    const resultadoTotal = await database.getFirstAsync<{ total: number }>(
      `
      SELECT SUM((quantidade * valorunitariovenda) + valoracrescimo - valorDesconto) AS total
      FROM movnotaitem
      WHERE empresa = ? AND numerodocumento = ?
      `,
      [pedido.empresa, numerodocumento]
    );

    const totalItens = resultadoTotal?.total ?? 0;
    const desconto = pedido.vrdesconto ?? 0;
    const despesas = pedido.vrdespesas ?? 0;
    const valorTotalFinal = Number((totalItens - desconto + despesas).toFixed(2));

    await database.runAsync(
      `UPDATE movnota SET valorTotal = ? WHERE empresa = ? AND numerodocumento = ? `, 
      [valorTotalFinal, pedido.empresa, numerodocumento]
    );

  //  console.log("🔁 valorTotal atualizado com base nos itens + despesas - desconto:", valorTotalFinal);

    await database.runAsync("COMMIT");
    console.log("✅ Pedido e itens salvos com sucesso!");

  } catch (error: any) {
    await database.runAsync("ROLLBACK");
    console.error("❌ Erro ao salvar pedido de venda:", error.message || error);
    throw error;
  }
}





//=======================================================================================
//                   EXIBIR PEDIDO DE VENDA
//---------------------------------------------------------------------------------------
interface ItemPedido {
  id: number;
  produto: string;
  descricaoproduto:string;
  quantidade: number;
  valorunitario: number;
  valorunitariovenda: number,
  valorDesconto: number;
  valoracrescimo: number,
  valorTotal: number;

}

interface CabecalhoPedido {
  
  nomecliente: string;
  nomevendedor: string;
  descricaoforma: string;
  valorDesconto: number;
  valorDespesas: number;
  valorFrete: number;
  valorTotal: string; // formatado com 2 casas decimais
  Observacao: string;
}

async function carregarPedidoCompleto(empresa: number, numerodocumento: number) {
  const linhas = await database.getAllAsync(
    `SELECT 
      B.id,
      A.numerodocumento, 
      A.codigocliente, 
      C.nome as nomecliente,
      A.codigocondPagamento, 
      P.descricao as descricaoforma,  
      A.numerodocumento, 
      A.codigovendedor, 
      V.nome as nomevendedor,
      A.valorDesconto, 
      A.valorDespesas, 
      A.valorFrete, 
      A.valorTotal,
      A.observacao,
      B.codigoproduto, 
      B.descricaoproduto, 
      B.valorunitario, 
      B.valorunitariovenda, 
      B.quantidade, 
      B.valorDesconto as itemValorDesconto,
      B.valoracrescimo, 
      B.codigocliente as codcliente,
      B.valorTotal as itemValorTotal  
    FROM movnota A
    INNER JOIN movnotaitem B ON
      A.codigocliente = B.codigocliente AND
      A.numerodocumento = B.numerodocumento AND
      A.empresa = B.empresa
    INNER JOIN cadcliente C ON
      A.codigocliente = C.codigo AND
      A.empresa = C.empresa
    INNER JOIN cadvendedor V ON
      A.codigovendedor = V.codigo AND
      A.empresa = V.empresa
    INNER JOIN cadcondicaopagamento P ON
      A.codigocondPagamento = P.codigo AND
      A.empresa = P.empresa
    WHERE A.empresa = ? AND A.numerodocumento = ? AND B.situacaoregistro <> "E"
    GROUP BY A.numerodocumento, A.codigocliente, B.codigoproduto`,
    [empresa, numerodocumento]
  ) as any[];
  // console.log("Exibir dados da consulta\n carregarPedidoCompleto: ", linhas)
  if (linhas.length === 0) {
    return null;
  }

  const cabecalho: CabecalhoPedido = {    
    nomecliente: linhas[0]?.nomecliente ?? '',
    nomevendedor: linhas[0]?.nomevendedor ?? '',
    Observacao: linhas[0]?.observacao ?? '',
    descricaoforma: linhas[0]?.descricaoforma ?? '',
    valorDesconto: Number(linhas[0]?.valorDesconto ?? 0),
    valorDespesas: Number(linhas[0]?.valorDespesas ?? 0),
    valorFrete: Number(linhas[0]?.valorFrete ?? 0),
    valorTotal: (Number(linhas[0]?.valorTotal ?? 0)).toFixed(2),
  };

  const itens: ItemPedido[] = linhas.map(linha => ({
    id: linha.id,
    produto: linha.codigoproduto,
    descricaoproduto: linha.descricaoproduto,
    quantidade: linha.quantidade ?? 0,
    valorunitario: linha.valorUnitario ?? 0,
    valorunitariovenda: linha.valorunitariovenda ?? 0,
    valorDesconto: linha.itemValorDesconto ?? 0,
    valoracrescimo: linha.valoracrescimo ?? 0,
    valorTotal: linha.itemValorTotal ?? 0,
  //  codigocliente: linha.codcliente, 
  }));
 
  return { cabecalho, itens };
}

//============================================================================================
//                      Gerar Proximo numerodocumento ou trazer numero atual 
//=============================================================================================
async function gerarnumerodocumento(empresa: number, codigocliente: string): Promise<number> {
  try {
    // Verifica se já existe pedido Pendente para esse cliente
    const pedidoExistente = await database.getFirstAsync<{ numerodocumento: number }>(
      `SELECT numerodocumento FROM movnota WHERE empresa = ? AND codigocliente = ? AND status = 'P' LIMIT 1`,
      [empresa, codigocliente]
    );

    if (pedidoExistente && pedidoExistente.numerodocumento) {
      return pedidoExistente.numerodocumento; // já existe: retorna o código atual
    }

    // Caso não exista, busca o maior código atual
    const ultimoPedido = await database.getFirstAsync<{ max_codigo: number }>(
      `SELECT MAX(numerodocumento) as max_codigo FROM movnota WHERE empresa = ?`,
      [empresa]
    );

    const novoCodigo = (ultimoPedido?.max_codigo ?? 0) + 1;
    return novoCodigo;

  } catch (error: any) {
    console.error("Erro ao gerar código do pedido:", error.message || error);
    throw new Error("Falha ao gerar código do pedido");
  }
}

//================================================================================================
//                           CONTAR A QUANTIDADE ITENS NO CARRINHO
//================================================================================================
const contarItensCarrinho = async (empresa: number, numerodocumento: number, cliente: string): Promise<number> => {
  try {
    const resultado = await database.getFirstAsync<{ total: number }>(
      `SELECT COUNT(*) as total FROM movnotaitem WHERE empresa = ? AND numerodocumento = ? AND codigocliente = ?`,
      [empresa, numerodocumento, cliente]
    );
    return resultado?.total ?? 0;
  } catch (error: any) {
    console.error("Erro ao contar itens do carrinho:", error.message || error);
    return 0;
  }
};

//=======================================================================================
//             CARREGAR OS PARÂMETROS DO SISTEMA
//=======================================================================================

async function carregarParametros() {
  const db = useSQLiteContext();

  try {
    const result = await db.getFirstAsync<ParametrosSistema>(
      'SELECT * FROM cadparametro LIMIT 1'
    );

    if (result) {
      setParametrosSistema(result);
    } else {
      console.warn('Nenhum parâmetro encontrado em cadparametro');
    }
  } catch (error) {
    console.error('Erro ao carregar parâmetros:', error);
  }
}

//==========================================================================================
//                 PESQUISAR SE EXITE FORMA PGTO PARA O CLIENTE
//------------------------------------------------------------------------------------------
async function buscarFormaPagamentoDoPedido(clienteId: string, empresa:number) {
   type ResultadoForma = { codigocondPagamento: string };
  
  const result = await database.getFirstAsync<ResultadoForma>(
    'SELECT codigocondPagamento FROM movnota WHERE codigocliente = ? AND empresa = ? AND status = "P" ',
    [clienteId, empresa]
  );
  return result?.codigocondPagamento || null;
}

// =======================================================================================================
//         DELETAR ITEM DO PEDIDO DE VENDA
// -------------------------------------------------------------------------------------------------------
const excluirItemPedido = async (
  empresa: number,
  numerodocumento: number,
  codigocliente: string,
  idItem: string,
): Promise<boolean> => {
  try {
    // 1. Atualiza o campo situacaoregistro para 'E' no item
    await database.runAsync(
      `UPDATE movnotaitem SET situacaoregistro = 'E' 
       WHERE empresa = ? AND numerodocumento = ? AND codigocliente = ? AND codigoproduto = ?`,
      [empresa, numerodocumento, codigocliente, idItem]
    );

    // 2. Conta quantos itens ativos restam (excluindo os marcados com 'E')
    const resultado = await database.getFirstAsync<{ total: number }>(
      `SELECT sum(valortotal) as total FROM movnotaitem 
       WHERE empresa = ? AND numerodocumento = ? AND codigocliente = ? AND situacaoregistro <> 'E'`,
      [empresa, numerodocumento, codigocliente]
    );

    const totalItens = resultado?.total ?? 0;

    // 3. Recalcula o valor total dos itens ativos (valorunitariovenda - valordesconto + valoracrescimo)
    const somaItens = await database.getFirstAsync<{ total: number }>(
      `SELECT 
         IFNULL(SUM((quantidade * valorunitariovenda) - valordesconto + valoracrescimo), 0) as total 
       FROM movnotaitem
       WHERE empresa = ? AND numerodocumento = ? AND codigocliente = ? AND situacaoregistro <> 'E'`,
      [empresa, numerodocumento, codigocliente]
    );
    
    const valorTotalItens = somaItens?.total ?? 0;
    const valorTotalArredondado = Math.round(valorTotalItens * 100) / 100;

    console.log("Valor recalculado: ", valorTotalArredondado.toString())
    if (valorTotalArredondado === 0) {
      // 4. Se não houver mais itens ativos, marca o cabeçalho do pedido como excluído (situacaoregistro = 'E') e zera valorTotal
      await database.runAsync(
        `UPDATE movnota SET situacaoregistro = 'E', valorTotal = 0
         WHERE empresa = ? AND numerodocumento = ? AND codigocliente = ?`,
        [empresa, numerodocumento, codigocliente]
      );
    } else {
      // 5. Atualiza o valorTotal na movnota com o valor calculado
      await database.runAsync(
        `UPDATE movnota SET valorTotal = ? 
         WHERE empresa = ? AND numerodocumento = ? AND codigocliente = ?`,
        [valorTotalArredondado, empresa, numerodocumento, codigocliente]
      );
    }

    return true;
  } catch (error: any) {
    console.error("Erro ao excluir item do pedido:", error.message || error);
    return false;
  }
};



// =======================================================================================================
//                                     ATUALIZAR O PEDIDO DE VENDA
// -------------------------------------------------------------------------------------------------------
const atualizarPedido = async (
  empresa: number,
  numerodocumento: number,
  codigocliente: string,
  codigoproduto: string,
  novaQuantidade: number,
  observacao: string
): Promise<boolean> => {
  try {
    // 1️⃣ Atualiza a quantidade
    await database.runAsync(
      `UPDATE movnotaitem 
       SET quantidade = ?, situacaoregistro = "A"
       WHERE empresa = ? AND numerodocumento = ? AND codigocliente = ? AND codigoproduto = ?`,
      [novaQuantidade, empresa, numerodocumento, codigocliente, codigoproduto]
    );

    // 2️⃣ Busca os valores do item para recalcular valorTotal do item
    const item = await database.getFirstAsync<{
      valorunitariovenda: number;
      valordesconto: number;
      valoracrescimo: number;
    }>(
      `SELECT valorunitariovenda, 
              COALESCE(valordesconto,0) as valordesconto, 
              COALESCE(valoracrescimo,0) as valoracrescimo
       FROM movnotaitem
       WHERE empresa = ? AND numerodocumento = ? AND codigocliente = ? AND codigoproduto = ?`,
      [empresa, numerodocumento, codigocliente, codigoproduto]
    );

    if (!item) {
      console.error("Item não encontrado para atualização.");
      return false;
    }

    const novoValorTotalItem =
      novaQuantidade * item.valorunitariovenda -
      item.valordesconto +
      item.valoracrescimo;

    // Atualiza o valorTotal do item
    await database.runAsync(
      `UPDATE movnotaitem
       SET valorTotal = ?, situacaoregistro = "A"
       WHERE empresa = ? AND numerodocumento = ? AND codigocliente = ? AND codigoproduto = ?`,
      [novoValorTotalItem, empresa, numerodocumento, codigocliente, codigoproduto]
    );

    // 3️⃣ Soma de todos os itens para calcular valor total do pedido
    const resultado = await database.getFirstAsync<{ somaItens: number }>(
      `SELECT COALESCE(SUM(valorTotal), 0) as somaItens
       FROM movnotaitem
       WHERE empresa = ? AND numerodocumento = ? AND codigocliente = ?`,
      [empresa, numerodocumento, codigocliente]
    );

    const valorTotalPedido = resultado?.somaItens ?? 0;
    
    // 4️⃣ Atualiza movnota com total e observação
    await database.runAsync(
      `UPDATE movnota 
       SET valorTotal = ?
       WHERE empresa = ? AND numerodocumento = ? AND codigocliente = ? AND status = "P"`,
      [valorTotalPedido, empresa, numerodocumento, codigocliente]
    );

    return true;
  } catch (error: any) {
    console.error("Erro ao atualizar item e pedido:", error.message || error);
    return false;
  }
};

//==============================================================================================
//                ATUALIZA OBSERVAÇÃO NA MOVNOTA
//-----------------------------------------------------------------------------------------------
const atualizarObservacao = async (
  empresa: number,
  numerodocumento: number,
  codigocliente: string,
  observacao: string
): Promise<boolean> => {
  try {
    await database.runAsync(
      `UPDATE movnota
       SET observacao = ?, situacaoregistro = "A"
       WHERE empresa = ? AND numerodocumento = ? AND codigocliente = ? AND status = "P"`,
      [observacao, empresa, numerodocumento, codigocliente]
    );
    return true;
  } catch (error) {
    console.error('Erro ao atualizar observação:', error);
    return false;
  }
};
//===============================================================================================
//                                CONSULTA GERENCIAL DE PEDIDO
//-----------------------------------------------------------------------------------------------
type GerencPedido = {
  numerodocumento: number;
  codigocliente: string;
  nomecliente: string;
  status: string;
  dataLancamento: string;
  valorTotal: number;
};

const ConsultaPedido = async (
  empresa: number,
  dataInicio?: string,
  dataFim?: string,
  nomeClienteFiltro?: string
): Promise<GerencPedido[]> => {
  try {
    const temData = !!dataInicio && !!dataFim;
    const temNome = !!nomeClienteFiltro && nomeClienteFiltro.trim().length > 0;

    // 1️⃣ Nenhum filtro => não consulta
    if (!temData && !temNome) {
      return [];
    }

    let sql = `
      SELECT numerodocumento, codigocliente, nomecliente, status, dataLancamento, valorTotal
      FROM movnota
      WHERE empresa = ? AND situacaoregistro <> "E"
    `;
    const params: (string | number)[] = [empresa];

    // 2️⃣ Apenas data
    if (temData && !temNome) {
      sql += ` AND dataLancamento BETWEEN ? AND ?`;
      params.push(dataInicio!);
      params.push(dataFim! + ' 23:59:59');
    }

    // 3️⃣ Apenas nome
    if (!temData && temNome) {
      sql += ` AND nomecliente LIKE ?`;
      params.push(`%${nomeClienteFiltro!.trim()}%`);
    }

    // 4️⃣ Data + nome
    if (temData && temNome) {
      sql += ` AND dataLancamento BETWEEN ? AND ? AND nomecliente LIKE ?`;
      params.push(dataInicio!);
      params.push(dataFim! + ' 23:59:59');
      params.push(`%${nomeClienteFiltro!.trim()}%`);
    }

    sql += ` ORDER BY dataLancamento DESC`;

    const resultado = await database.getAllAsync<GerencPedido>(sql, params);
    return resultado;
  } catch (error) {
    console.error('Erro ao consultar pedidos:', error);
    return [];
  }
};


//===============================================================================================
//                  CONSULTA VALIDAÇÂO DO USUÁRIO E SENHA
//-----------------------------------------------------------------------------------------------

interface Vendedor {
  codigo: number;
  nome: string;
  novasenha: string;
  senha: string;
  id: number;
}

interface ValidacaoUsuario {
  id?: number;
  valido: boolean;
  codigo?: number;
  nome?: string;
  novaSenha?: string;
  senhaantiga?: string;
}

const validarUsuarioLocal = async (
  empresaCodigo: number,
  usuario: string, // deve ser string
): Promise<ValidacaoUsuario> => {
  
  try {
    // Consulta local para validar usuário e senha
    const result: Vendedor | null | undefined = await database.getFirstAsync(
      `SELECT id, novasenha, senha 
       FROM cadusers 
       
       WHERE usuario = ?
       AND empresa = ?`,
      [usuario.trim(), empresaCodigo]
    );

    if (result) {
      return { valido: true, novaSenha: result.novasenha, senhaantiga: result.senha, id:result.id, };
    } else {
      return { valido: false };
    }
  } catch (error) {
    console.error('Erro ao validar usuário local:', error);
    return { valido: false };
  }
};

//===============================================================================================
//                          SINCRONIZAÇÃO DE USUÁRIOS
//-----------------------------------------------------------------------------------------------
interface Usuario {
  empresa: string;
  codigovendedor: number;
  usuario: string;
  senha: string;
  novasenha?: string;
  situacaoregistro: string;
  token?: string | null;
}

async function sincronizarUsuarios() {
  if (!database) {
    throw new Error("Database not initialized");
  }

  let totalProcessados = 0;
  let totalInseridos = 0;
  let totalAtualizados = 0;

  try {
    // Busca todos os usuários da empresa (via API)
    const response = await tentarRequisicao(() => api.get('sincronizausers'), 3, 1500);
    const usuarios: Usuario[] = Array.isArray(response.data) ? response.data : [response.data];

    await database.withTransactionAsync(async () => {
      for (const user of usuarios) {
        totalProcessados++;

        try {
          // Log para depuração
          console.log("🔍 Processando usuário:", user.empresa, user.usuario);

          // Verifica se o usuário já existe
          const result = await database.getAllAsync<Usuario>(
            `SELECT * FROM cadusers WHERE empresa = ? AND usuario = ?`,
            [user.empresa, user.usuario]
          );

          const atual = result[0]; // Tipo Usuario | undefined
         // console.log("📦 Registro encontrado no banco:", atual);

          if (!atual) {
            // Inserir novo usuário
            console.log("➕ Inserindo novo usuário:", user.usuario);

            await database.runAsync(
              `INSERT INTO cadusers 
               (empresa, codigovendedor, usuario, senha, novasenha, situacaoregistro, token)
               VALUES (?, ?, ?, ?, ?, ?, ?)`,
              [
                user.empresa,
                user.codigovendedor,
                user.usuario,
                user.senha,
                user.novasenha || '',
                user.situacaoregistro || 'ativo',
                user.token || null,
              ]
            );
            totalInseridos++;
          } else {
            // Verifica diferenças para atualizar
            const camposDiferentes = ['codigovendedor', 'senha', 'novasenha', 'situacaoregistro', 'token']
              .some(campo =>
                (user[campo as keyof Usuario] ?? '').toString().trim() !==
                (atual[campo as keyof Usuario] ?? '').toString().trim()
              );

            if (camposDiferentes) {
              console.log("🔄 Atualizando usuário:", user.usuario);

              await database.runAsync(
                `UPDATE cadusers SET codigovendedor = ?, senha = ?, novasenha = ?, situacaoregistro = ?, token = ?
                 WHERE empresa = ? AND usuario = ?`,
                [
                  user.codigovendedor,
                  user.senha,
                  user.novasenha || '',
                  user.situacaoregistro || 'ativo',
                  user.token || null,
                  user.empresa,
                  user.usuario,
                ]
              );
              totalAtualizados++;
            }
          }
        } catch (err: any) {
          console.error('❌ Erro ao processar usuário:', user.usuario, err.message);
        }
      }
    });

    console.log(`✅ Usuários processados: ${totalProcessados}`);
    console.log(`➕ Inseridos: ${totalInseridos}`);
    console.log(`🔄 Atualizados: ${totalAtualizados}`);
  } catch (error: any) {
    console.error('❌ Falha na sincronização de usuários:', error.message);
    throw new Error('Falha na sincronização de usuários');
  }
}

// ===============================================================================================
//          BUSCAR O CÓDIGO DO VENDEDOR ASSOCIADO AO USUÁRIO
// -----------------------------------------------------------------------------------------------

interface Vendedor {
  codigo: number;
  nome: string;
}

async function buscarVendedorDoUsuario(usuarioId: number): Promise<Vendedor | null> {
  try {
    const database = DatabaseManager.getCurrentDatabase();
    if (!database) {
      console.error("❌ Banco de dados não disponível");
      return null;
    }

    // Consulta para pegar o vendedor vinculado ao usuário
    const query = `
      SELECT CAST(v.codigo AS TEXT) AS codigo, v.nome
      FROM cadvendedor v
      INNER JOIN cadusers u ON u.codigovendedor = v.codigo
      WHERE u.id = ?
      AND u.situacaoregistro <> 'E'
    `;

    const resultado = await database.getFirstAsync<Vendedor>(query, [usuarioId]);

    if (!resultado) {
      console.log(`⚠ Nenhum vendedor encontrado para o usuário ${usuarioId}`);
      return null;
    }

    return resultado;

  } catch (error) {
    console.error('❌ Erro ao buscar vendedor do usuário:', error);
    return null;
  }
}

//===============================================================================================
//                          EXPORTAÇÃO DAS FUNÇÕES DE PEDIDO DE VENDA
//-----------------------------------------------------------------------------------------------


type MovNota = {
  empresa: number;
  numerodocumento: number;
  codigocondPagamento: string;
  codigovendedor: string;
  codigocliente: string;
  nomecliente?: string;
  codigopedido?: number;
  valorDesconto: number;
  valorDespesas: number;
  valorFrete: number;
  valorTotal: number;
  pesoTotal: number;
  observacao?: string;
  status: string;
  dataLancamento: string;
  situacaoRegistro: string;
  dataRegistro?: string;
};

type MovNotaItem = {
  empresa: number;
  numerodocumento: number;
  codigovendedor: string;
  codigoproduto: string;
  descricaoproduto?: string;
  valorUnitario?: number;
  valorunitariovenda?: number;
  valorDesconto?: number;
  valoracrescimo?: number;
  valorTotal?: number;
  quantidade?: number;
  codigocliente?: string;
  dataRegistro?: string;
  situacaoRegistro: string;
};

async function sincronizarTodosPedidos() {
  const errosPedidos: string[] = [];
  let totalEnviados = 0;

  try {
    const movnotas = (await database.getAllAsync(
      `SELECT * FROM movnota WHERE status != 'R' AND situacaoRegistro <> 'E'`
    )) as MovNota[];

    if (!movnotas || movnotas.length === 0) {
      console.log('Nenhum pedido para sincronizar');
      return { total: 0, erros: [] };
    }

    for (const nota of movnotas) {
      const itens = (await database.getAllAsync(
        `SELECT * FROM movnotaitem WHERE numerodocumento = ? AND situacaoRegistro <> 'E'`,
        [nota.numerodocumento]
      )) as MovNotaItem[];

      const payload = {
        empresa: nota.empresa,
        numerodocumento: nota.numerodocumento,
        codigocondPagamento: nota.codigocondPagamento,
        codigovendedor: nota.codigovendedor,
        codigocliente: nota.codigocliente,
        nomecliente: nota.nomecliente,
        codigopedido: nota.codigopedido,
        valorDesconto: nota.valorDesconto,
        valorDespesas: nota.valorDespesas,
        valorFrete: nota.valorFrete,
        valorTotal: nota.valorTotal,
        pesoTotal: nota.pesoTotal,
        observacao: nota.observacao,
        status: nota.status,
        dataLancamento: nota.dataLancamento,
        dataRegistro: nota.dataRegistro,
        itens: itens.map((item: MovNotaItem) => ({
          empresa: item.empresa,
          numerodocumento: item.numerodocumento,
          codigovendedor: item.codigovendedor,
          codigoproduto: item.codigoproduto,
          descricaoproduto: item.descricaoproduto,
          valorUnitario: item.valorUnitario,
          valorunitariovenda: item.valorunitariovenda,
          valorDesconto: item.valorDesconto,
          valoracrescimo: item.valoracrescimo,
          valorTotal: item.valorTotal,
          quantidade: item.quantidade,
          codigocliente: item.codigocliente,
          dataRegistro: item.dataRegistro,
        })),
      };

      try {
        const response = await api.post('pedidos', payload);
        if (response.status === 200) {
          await database.runAsync(
            `UPDATE movnota SET status = 'R' WHERE numerodocumento = ?`,
            [nota.numerodocumento]
          );
          console.log(`Pedido ${nota.numerodocumento} sincronizado com sucesso!`);
          totalEnviados++;
        } else {
          const msg = `Falha no pedido ${nota.numerodocumento}: status ${response.status}`;
          console.log(msg);
          errosPedidos.push(msg);
        }
      } catch (error: any) {
        const msg = `Erro no pedido ${nota.numerodocumento}: ${error.message}`;
        console.log(msg);
        errosPedidos.push(msg);
      }
    }

    return { total: totalEnviados, erros: errosPedidos };
  } catch (err: any) {
    console.log('Erro ao sincronizar pedidos:', err.message);
    return { total: 0, erros: [err.message] };
  }
}

// ===============================================================================================
//                          EXPORTAÇÃO DAS FUNÇÕES DE SINCRONIZAÇÃO
//-----------------------------------------------------------------------------------------------
async function sincronizarPedidosSelecionados(numeros: number[]) {

  

  try {
    if (!numeros || numeros.length === 0) {
      console.log('Nenhum pedido selecionado para sincronizar');
      return true;
    }

    // Transformar array de números em string para SQL IN (?, ?, ?)
    const placeholders = numeros.map(() => '?').join(',');
    
    // Buscar apenas os pedidos selecionados
    const movnotas = (await database.getAllAsync(
      `SELECT * FROM movnota WHERE numerodocumento IN (${placeholders}) AND status != 'R' AND situacaoRegistro <> 'E'`,
      numeros
    )) as MovNota[];

    if (!movnotas || movnotas.length === 0) {
      console.log('Nenhum pedido encontrado para os números selecionados');
      return true;
    }

    for (const nota of movnotas) {
      const itens = (await database.getAllAsync(
        `SELECT * FROM movnotaitem WHERE numerodocumento = ? AND situacaoRegistro <> 'E'`,
        [nota.numerodocumento]
      )) as MovNotaItem[];

      const payload = {
        empresa: nota.empresa,
        numerodocumento: nota.numerodocumento,
        codigocondPagamento: nota.codigocondPagamento,
        codigovendedor: nota.codigovendedor,
        codigocliente: nota.codigocliente,
        nomecliente: nota.nomecliente,
        codigopedido: nota.codigopedido,
        valorDesconto: nota.valorDesconto,
        valorDespesas: nota.valorDespesas,
        valorFrete: nota.valorFrete,
        valorTotal: nota.valorTotal,
        pesoTotal: nota.pesoTotal,
        observacao: nota.observacao,
        status: nota.status,
        dataLancamento: nota.dataLancamento,
        dataRegistro: nota.dataRegistro,
        itens: itens.map((item: MovNotaItem) => ({
          empresa: item.empresa,
          numerodocumento: item.numerodocumento,
          codigovendedor: item.codigovendedor,
          codigoproduto: item.codigoproduto,
          descricaoproduto: item.descricaoproduto,
          valorUnitario: item.valorUnitario,
          valorunitariovenda: item.valorunitariovenda,
          valorDesconto: item.valorDesconto,
          valoracrescimo: item.valoracrescimo,
          valorTotal: item.valorTotal,
          quantidade: item.quantidade,
          codigocliente: item.codigocliente,
          dataRegistro: item.dataRegistro,
        })),
      };

      try {
        const response = await api.post('pedidos', payload);
        if (response.status === 200) {
          await database.runAsync(
            `UPDATE movnota SET status = 'R' WHERE numerodocumento = ?`,
            [nota.numerodocumento]
          );
          console.log(`Pedido ${nota.numerodocumento} sincronizado com sucesso!`);
        } else {
          console.log(`Falha ao enviar pedido ${nota.numerodocumento}:`, response.status);
        }
      } catch (error: any) {
        console.log(`Erro ao enviar pedido ${nota.numerodocumento}:`, error.message);
      }
    }

    return true;
  } catch (err: any) {
    console.log('Erro ao sincronizar pedidos selecionados:', err.message);
    return false;
  }
}




//===============================================================================================


  return { sincronizarEmpresas, sincronizarProdutos, sincronizarImagens, ListarItens, 
           ConsultarEmpresa, sincronizarParametros, sincronizarClientes, ListarClientes, 
           sincronizarVendedores, sincronizarCondicoesPagamento, ListarFormaPgto, sincronizarUsuarios,
           carregarPedidoCompleto, gerarnumerodocumento, contarItensCarrinho, carregarParametros,
           buscarFormaPagamentoDoPedido, excluirItemPedido, atualizarPedido, atualizarObservacao,
           ConsultaPedido ,validarUsuarioLocal,  GravarPedidos, buscarVendedorDoUsuario, 
           sincronizarPedidosSelecionados, sincronizarTodosPedidos,
          };
}

