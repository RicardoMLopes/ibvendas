import { useSQLiteContext } from "expo-sqlite";
import api from '../config/app';
import { setParametrosSistema } from '../config/parametros';
import {ParametrosSistema} from '../config/configs'
import { criarPastaImagens, getArquivoLocalMtime, setArquivoLocalMtime } from '../scripts/criarpasta';
import { baixarImagem } from '../scripts/criarpasta';
import DatabaseManager from '../database/databasemanager';
import { arredondar, contarImagensNoDispositivo, formatarDataRegistro, obterInfoArquivoLocal, sanitizarNumero, tentarRequisicao } from "../scripts/funcoes";
import { id } from "date-fns/locale";
import { format, parseISO } from "date-fns";
import * as FileSystem from 'expo-file-system';



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
  lastSync?: string | null;
}> {
  await criarPastaImagens();

  const database = DatabaseManager.getCurrentDatabase();
  if (!database) throw new Error("Database não disponível para sincronização de PRODUTO");

  // 1) last_sync local
  const lastSyncLocal = await carregarConfig("last_sync_produtos");
  console.log("⏱ Última sincronização local:", lastSyncLocal ?? "—");

  // 2) chamada API
  const url = lastSyncLocal ? `produtos?last_sync=${encodeURIComponent(lastSyncLocal)}` : "produtos";
  const response = await tentarRequisicao(() => api.get(url), 3, 1500);
  const dados = response.data;
  const produtosRemotos: ProdutoAPI[] = Array.isArray(dados?.produtos)
    ? dados.produtos
    : Array.isArray(dados) ? dados : [];
  const lastSyncServerRaw: string | null = dados?.last_sync ?? null;

  // Formata para YYYY-MM-DDTHH:mm:ss
  const lastSyncServer = lastSyncServerRaw
    ? format(parseISO(lastSyncServerRaw), "yyyy-MM-dd HH:mm:ss")
    : null;




  console.log("⏱ last_sync recebido do servidor:", lastSyncServer);


  console.log("🌐 Produtos recebidos da API:", produtosRemotos.length ?? 0);

  // 3) buscar locais
  const locais = await database.getAllAsync<ProdutoLocal>("SELECT * FROM cadproduto");
  const mapaLocais = new Map(locais.map(p => [`${p.empresa}-${p.codigo}`, p]));

  // contadores
  let totalInseridos = 0;
  let totalAtualizados = 0;
  let totalIgnorados = 0;

  // helpers (sem undefined)
  const sanitizarNumero = (valor: any, fallback = 0): number => {
    const n = Number(valor);
    return Number.isFinite(n) ? n : fallback;
  };
  const formatarDataRegistro = (valor?: string): string => {
    if (!valor) return "";
    const d = new Date(valor);
    return isNaN(d.getTime()) ? "" : d.toISOString();
  };

  // 4) se API não retornou nada => conta como ignorados os locais (mesmo padrão do vendedor)
  if (!produtosRemotos || produtosRemotos.length === 0) {
    totalIgnorados = locais.length;
    if (lastSyncServer) await salvarConfig("last_sync_produtos", lastSyncServer);

    const totalProcessados = 0; // nenhum remoto para processar
    console.log(`🏁 Produtos: Inseridos=${totalInseridos}, Atualizados=${totalAtualizados}, Ignorados=${totalIgnorados}, Total processados=${totalProcessados}`);
    return {
      inseridos: totalInseridos,
      atualizados: totalAtualizados,
      ignorados: totalIgnorados,
      totalProcessados,
      lastSync: lastSyncServer
    };
  }

  // 5) filtrar válidos (empresa+codigo); os inválidos entram como ignorados
  const produtosValidos = produtosRemotos.filter(p => p.empresa != null && p.codigo != null);
  const descartadosChave = produtosRemotos.length - produtosValidos.length;
  if (descartadosChave > 0) {
    console.warn(`⚠️ Itens descartados por falta de chave (empresa/codigo): ${descartadosChave}`);
    totalIgnorados += descartadosChave;
  }

  // 6) diferença de dados
  const dadosDiferentes = (novo: ProdutoLocal, atual?: ProdutoLocal) => {
    if (!atual) return true;

    const camposNumericos: (keyof ProdutoLocal)[] = [
      "peso", "precovenda", "percentualdesconto", "estoque", "percentualComissao", "versao", "imagens"
    ];
    const camposTexto: (keyof ProdutoLocal)[] = [
      "descricao", "unidadeMedida", "codigobarra", "agrupamento",
      "marca", "modelo", "tamanho", "cor", "casasdecimais",
      "reajustacondicaopagamento", "situacaoregistro", "dataregistro"
    ];

    for (const c of camposNumericos) {
      const a = sanitizarNumero((atual as any)[c]);
      const b = sanitizarNumero((novo as any)[c]);
      if (a !== b) return true;
    }
    for (const c of camposTexto) {
      const a = String((atual as any)[c] ?? "").trim();
      const b = String((novo as any)[c] ?? "").trim();
      if (a !== b) return true;
    }
    return false;
  };

  // 7) transação de upsert
  await database.withTransactionAsync(async () => {
    for (const r of produtosValidos) {
      try {
        const produto: ProdutoLocal = {
          empresa: r.empresa!,
          codigo: r.codigo!,
          descricao: r.descricao ?? "",
          unidadeMedida: r.unidadeMedida ?? r.unidademedida ?? "",
          codigobarra: r.codigoBarra ?? r.codigobarra ?? "",
          agrupamento: r.agrupamento ?? "",
          marca: r.marca ?? "",
          modelo: r.modelo ?? "",
          tamanho: r.tamanho ?? "",
          cor: r.cor ?? "",
          peso: sanitizarNumero(r.peso),
          precovenda: sanitizarNumero(r.precoVenda ?? r.precovenda),
          casasdecimais: String(r.casasdecimais ?? "0"),
          percentualdesconto: sanitizarNumero(r.percentualDesconto ?? r.percentualdesconto),
          estoque: sanitizarNumero(r.estoque),
          reajustacondicaopagamento: r.reajustaCondicaoPagamento ?? r.reajustacondicaopagamento ?? "",
          percentualComissao: sanitizarNumero(r.percentualComissao ?? r.percentualcomissao),
          situacaoregistro: r.situacaoRegistro ?? r.situacaoregistro ?? "",
          dataregistro: formatarDataRegistro(r.dataRegistro ?? r.dataregistro),
          versao: sanitizarNumero(r.versao),
          imagens: sanitizarNumero(r.imagens),
        };

        const chave = `${produto.empresa}-${produto.codigo}`;
        const atual = mapaLocais.get(chave);

        if (!atual) {
          await database.runAsync(
            `INSERT INTO cadproduto (
              empresa, codigo, descricao, unidadeMedida, codigobarra,
              agrupamento, marca, modelo, tamanho, cor, peso, precovenda,
              casasdecimais, percentualdesconto, estoque, reajustacondicaopagamento,
              percentualComissao, situacaoregistro, dataregistro, versao, imagens
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              String(produto.empresa),
              String(produto.codigo),
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
          totalInseridos++;
        } else if (dadosDiferentes(produto, atual)) {
          await database.runAsync(
            `UPDATE cadproduto SET
              descricao = ?, unidadeMedida = ?, codigobarra = ?, agrupamento = ?,
              marca = ?, modelo = ?, tamanho = ?, cor = ?, peso = ?, precovenda = ?,
              casasdecimais = ?, percentualdesconto = ?, estoque = ?, reajustacondicaopagamento = ?,
              percentualComissao = ?, situacaoregistro = ?, dataregistro = ?, versao = ?, imagens = ?
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
              String(produto.empresa),
              String(produto.codigo)
            ]
          );
          totalAtualizados++;
        } else {
          totalIgnorados++;
        }
      } catch (err) {
        console.error(`❌ Erro ao processar produto ${r.codigo}:`, err);
        totalIgnorados++;
      }
    }
  });

  // 8) persiste last_sync do servidor
  if (lastSyncServer) {
    await salvarConfig("last_sync_produtos", lastSyncServer);
    console.log("⏱ last_sync atualizado para:", lastSyncServer);
  }

  // 9) totais finais (mesmo padrão do vendedor/cliente)
  const totalProcessados = totalInseridos + totalAtualizados + totalIgnorados;
  console.log(`🏁 Produtos: Inseridos=${totalInseridos}, Atualizados=${totalAtualizados}, Ignorados=${totalIgnorados}, Total processados=${totalProcessados}`);

  return {
    inseridos: totalInseridos,
    atualizados: totalAtualizados,
    ignorados: totalIgnorados,
    totalProcessados,
    lastSync: lastSyncServer
  };
}



//================================================================================================
// ***********************Inicio da função de sincronização das imagens **************************
//------------------------------------------------------------------------------------------------

// Função para processar várias tarefas com limite de concorrência
async function processarComLimite<T>(tarefas: (() => Promise<T>)[], limite: number): Promise<T[]> {
  const resultados: T[] = [];
  const fila = [...tarefas];

  async function executar() {
    while (fila.length > 0) {
      const tarefa = fila.shift();
      if (tarefa) {
        resultados.push(await tarefa());
      }
    }
  }

  const workers = Array.from({ length: limite }, () => executar());
  await Promise.all(workers);

  return resultados;
}

// Função principal de sincronização
async function sincronizarImagens(): Promise<{ novas: number; atualizadas: number; total: number }> {
  let novas = 0;
  let atualizadas = 0;

  try {
    // Garante que a pasta de imagens exista
    const pastaImagens = (FileSystem.documentDirectory as string) + 'imagens';
    const pastaExiste = await FileSystem.getInfoAsync(pastaImagens);
    if (!pastaExiste.exists) {
      await FileSystem.makeDirectoryAsync(pastaImagens, { intermediates: true });
    }

    // Lista imagens do servidor
    const response = await api.get<{ imagens: { url: string; mtime: number }[] }>("lista/imagem");
    const arquivos = response.data.imagens;

    // Cria tarefas de download/atualização
    const tarefas = arquivos.map((arquivo) => async () => {
      const nomeArquivo = arquivo.url.split("/").pop();
      if (!nomeArquivo) return null;

      const mtimeLocal = await getArquivoLocalMtime(nomeArquivo);

      if (!mtimeLocal) {
        await baixarImagem(arquivo.url, nomeArquivo);
        novas++;
      } else if (mtimeLocal < arquivo.mtime) {
        await baixarImagem(arquivo.url, nomeArquivo);
        atualizadas++;
      }

      if (!mtimeLocal || mtimeLocal < arquivo.mtime) {
        await setArquivoLocalMtime(nomeArquivo, arquivo.mtime);
      }

      return true;
    });

    // Executa downloads com limite de 5 simultâneos
    await processarComLimite(tarefas, 5);

    // Conta **todas** as imagens que existem na pasta local após sincronização
    let arquivosLocais: string[] = [];
    try {
      arquivosLocais = await FileSystem.readDirectoryAsync(pastaImagens);
    } catch {
      arquivosLocais = [];
    }

    const total = await contarImagensNoDispositivo();

    console.log(`🆕 Novas: ${novas}, 🔄 Atualizadas: ${atualizadas}, 📦 Total: ${total}`);
    return { novas, atualizadas, total };

  } catch (error: any) {
    console.error("❌ Erro ao sincronizar imagens:", error);
    return { novas: 0, atualizadas: 0, total: 0 };
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

// --- Tipo customizado do seu database com helpers ---
type SQLiteDatabase = {
  getAllAsync: <T = any>(sql: string, params?: any[]) => Promise<T[]>;
  getFirstAsync: <T = any>(sql: string, params?: any[]) => Promise<T | null>;
  runAsync: (sql: string, params?: any[]) => Promise<void>;
  withTransactionAsync: (callback: () => Promise<void>) => Promise<void>;
};

// --- Interface da API de clientes com index signature para acesso dinâmico ---
interface ClienteAPI {
  empresa: number;
  codigo: string;
  codigovendedor?: string;
  nome?: string;
  contato?: string;
  cpfCnpj?: string;
  rua?: string;
  numero?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
  telefone?: string;
  limiteCredito?: number;
  observacao?: string;
  restricao?: string;
  reajuste?: number;
  situacaoRegistro?: string;
  dataRegistro?: string;
  versao?: number;

  [key: string]: any; // <- permite acessar campos dinamicamente
}



async function sincronizarClientes() {
  const database = DatabaseManager.getCurrentDatabase();
  if (!database) throw new Error("Database não disponível para sincronização de CLIENTE");

  try {
    // 1️⃣ Recupera última sincronização
    const lastSyncLocal = await carregarConfig("last_sync_clientes");
    console.log("⏱ Última sincronização local:", lastSyncLocal ?? "—");

    // 2️⃣ Chamada API
    const url = lastSyncLocal ? `clientes?last_sync=${encodeURIComponent(lastSyncLocal)}` : "clientes";
    console.log("🔗 URL chamada:", api.defaults.baseURL + url);
    const response = await tentarRequisicao(() => api.get(url), 3, 1500);
    const dados = response.data;

    const clientesRemotos: ClienteAPI[] = Array.isArray(dados?.clientes)
      ? dados.clientes
      : Array.isArray(dados) ? dados : [];
    const lastSyncServerRaw: string | null = dados?.last_sync ?? null;

    // Formata lastSyncServer para "YYYY-MM-DD HH:mm:ss"
    const lastSyncServer: string | null = lastSyncServerRaw
      ? format(parseISO(lastSyncServerRaw), "yyyy-MM-dd HH:mm:ss")
      : null;

    // 3️⃣ Busca clientes já existentes
    const locais = await database.getAllAsync<ClienteAPI>("SELECT * FROM cadcliente");
    const mapaLocais = new Map(locais.map(c => [`${c.empresa}-${c.codigo}`, c]));

    let totalInseridos = 0;
    let totalAtualizados = 0;
    let totalIgnorados = 0;

    // 4️⃣ Se API não retornou nada, ignora todos locais
    if (!clientesRemotos || clientesRemotos.length === 0) {
      totalIgnorados = locais.length;
      if (lastSyncServer) await salvarConfig("last_sync_clientes", lastSyncServer);

      const totalProcessados = 0;
      console.log(`🏁 Clientes: Inseridos=${totalInseridos}, Atualizados=${totalAtualizados}, Ignorados=${totalIgnorados}, Total processados=${totalProcessados}`);
      return {
        inseridos: totalInseridos,
        atualizados: totalAtualizados,
        ignorados: totalIgnorados,
        totalProcessados,
        lastSync: lastSyncServer
      };
    }

    // 5️⃣ Filtra clientes válidos
    const clientesValidos = clientesRemotos.filter(c => c.empresa != null && c.codigo != null);
    const descartadosChave = clientesRemotos.length - clientesValidos.length;
    if (descartadosChave > 0) {
      console.warn(`⚠️ Clientes descartados por falta de chave (empresa/codigo): ${descartadosChave}`);
      totalIgnorados += descartadosChave;
    }

    // 6️⃣ Atualiza banco local
    await database.withTransactionAsync(async () => {
      for (const c of clientesValidos) {
        try {
          const chave = `${c.empresa}-${c.codigo}`;
          const atual = mapaLocais.get(chave);

          const dadosDiferentes = (novo: ClienteAPI, atual?: ClienteAPI) => {
            if (!atual) return true;
            const campos = [
              'codigovendedor','nome','contato','cpfCnpj','rua','numero',
              'bairro','cidade','estado','telefone','limiteCredito',
              'observacao','restricao','reajuste','situacaoRegistro',
              'dataRegistro','versao'
            ];
            return campos.some(f => String(novo[f] ?? '').trim() !== String(atual[f] ?? '').trim());
          };

          if (!atual) {
            await database.runAsync(
              `INSERT INTO cadcliente (
                empresa,codigo,codigovendedor,nome,contato,cpfCnpj,rua,
                numero,bairro,cidade,estado,telefone,limiteCredito,
                observacao,restricao,reajuste,situacaoRegistro,dataRegistro,versao
              ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
              [
                String(c.empresa),
                String(c.codigo ?? ''),
                c.codigovendedor != null ? String(c.codigovendedor).padStart(5, "0") : '',
                c.nome ?? '',
                c.contato ?? '',
                c.cpfCnpj ?? '',
                c.rua ?? '',
                c.numero ?? '',
                c.bairro ?? '',
                c.cidade ?? '',
                c.estado ?? '',
                c.telefone ?? '',
                Number(c.limiteCredito ?? 0),
                c.observacao ?? '',
                c.restricao ?? '',
                Number(c.reajuste ?? 0),
                c.situacaoRegistro ?? 'I',
                c.dataRegistro ? format(parseISO(c.dataRegistro), "yyyy-MM-dd HH:mm:ss") : '',
                Number(c.versao ?? 1)
              ]
            );
            totalInseridos++;
          } else if (dadosDiferentes(c, atual)) {
            await database.runAsync(
              `UPDATE cadcliente SET
                codigovendedor=?, nome=?, contato=?, cpfCnpj=?, rua=?,
                numero=?, bairro=?, cidade=?, estado=?, telefone=?,
                limiteCredito=?, observacao=?, restricao=?, reajuste=?,
                situacaoRegistro=?, dataRegistro=?, versao=?
              WHERE empresa=? AND codigo=?`,
              [
                c.codigovendedor != null ? String(c.codigovendedor).padStart(5, "0") : '',
                c.nome ?? '',
                c.contato ?? '',
                c.cpfCnpj ?? '',
                c.rua ?? '',
                c.numero ?? '',
                c.bairro ?? '',
                c.cidade ?? '',
                c.estado ?? '',
                c.telefone ?? '',
                Number(c.limiteCredito ?? 0),
                c.observacao ?? '',
                c.restricao ?? '',
                Number(c.reajuste ?? 0),
                c.situacaoRegistro ?? 'I',
                c.dataRegistro ? format(parseISO(c.dataRegistro), "yyyy-MM-dd HH:mm:ss") : '',
                Number(c.versao ?? 1),
                String(c.empresa),
                String(c.codigo)
              ]
            );
            totalAtualizados++;
          } else {
            totalIgnorados++;
          }

        } catch (err) {
          console.error(`❌ Erro ao processar cliente ${c.codigo}:`, err);
          totalIgnorados++;
        }
      }
    });

    // 7️⃣ Atualiza last_sync
    if (lastSyncServer) await salvarConfig("last_sync_clientes", lastSyncServer);
    console.log("⏱ last_sync atualizado para:", lastSyncServer);

    const totalProcessados = totalInseridos + totalAtualizados + totalIgnorados;
    console.log(`🏁 Clientes: Inseridos=${totalInseridos}, Atualizados=${totalAtualizados}, Ignorados=${totalIgnorados}, Total processados=${totalProcessados}`);

    return {
      inseridos: totalInseridos,
      atualizados: totalAtualizados,
      ignorados: totalIgnorados,
      totalProcessados,
      lastSync: lastSyncServer
    };

  } catch (error: any) {
    console.error("❌ Erro geral ao sincronizar clientes:", error.message);
    throw new Error("Falha na sincronização de CLIENTES");
  }
}







// ***********************Inicio da função de sincronização dos cadastros de vendedores **************************
//----------------------------------------------------------------------------------------------------------------
interface VendedorLocal {
  empresa: number;
  codigo: string;
  codigorota: number | null;
  nome: string;
  situacaoRegistro: string;
  dataRegistro: string;
  versao: number;
}



async function sincronizarVendedores(last_sync?: string) {
  const database = DatabaseManager.getCurrentDatabase();
  if (!database) throw new Error("Database não disponível em sincronização de VENDEDORES");

  // Converte last_sync em Date
  let filtroData: Date | null = null;
  if (last_sync) {
    filtroData = parseISO(last_sync);
    if (isNaN(filtroData.getTime())) {
      throw new Error("Formato inválido de last_sync. Use ISO 8601");
    }
  }

  // Buscar vendedores da API
  let vendedores: any[] = [];
  let lastSyncServer: string | null = null;

  try {
    const response = await tentarRequisicao(() => api.get('vendedores'), 3, 1500);
    vendedores = Array.isArray(response.data?.vendedores)
      ? response.data.vendedores
      : Array.isArray(response.data) ? response.data : [];
    lastSyncServer = response.data?.last_sync
      ? format(parseISO(response.data.last_sync), "yyyy-MM-dd HH:mm:ss")
      : null;
  } catch (err: any) {
    console.error('❌ Erro ao buscar vendedores:', err.message);
    throw err;
  }

  // Filtra registros válidos e aplica formatação de data
  const vendedoresValidos: VendedorLocal[] = vendedores
    .filter(v => v.empresa != null && v.codigo != null)
    .map(v => ({
      empresa: Number(v.empresa),
      codigo: String(v.codigo),
      codigorota: v.cd_rota != null ? Number(v.cd_rota) : null,
      nome: v.nome ?? '',
      situacaoRegistro: v.situacaoRegistro ?? 'I',
      dataRegistro: v.dataRegistro ? format(parseISO(v.dataRegistro), "yyyy-MM-dd HH:mm:ss") : '',
      versao: v.versao ?? 1,
    }))
    .filter(v => {
      if (!filtroData) return true;
      return new Date(v.dataRegistro).getTime() > filtroData.getTime();
    });

  // Buscar vendedores locais
  const locais = await database.getAllAsync<VendedorLocal>('SELECT * FROM cadvendedor');
  const mapaLocais = new Map(locais.map(v => [`${v.empresa}-${v.codigo}`, v]));

  let totalInseridos = 0;
  let totalAtualizados = 0;
  let totalIgnorados = 0;

  await database.withTransactionAsync(async () => {
    for (const vendedor of vendedoresValidos) {
      const chave = `${vendedor.empresa}-${vendedor.codigo}`;
      const atual = mapaLocais.get(chave);

      const dadosDiferentes = (novo: VendedorLocal, atual?: VendedorLocal) => {
        if (!atual) return true;
        const campos: (keyof VendedorLocal)[] = ['codigorota', 'nome', 'situacaoRegistro', 'dataRegistro', 'versao'];
        return campos.some(campo => (novo[campo] ?? '') !== (atual[campo] ?? ''));
      };

      try {
        if (!atual) {
          await database.runAsync(
            `INSERT INTO cadvendedor (empresa, codigo, codigorota, nome, situacaoRegistro, dataRegistro, versao)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
              vendedor.empresa,
              vendedor.codigo,
              vendedor.codigorota,
              vendedor.nome,
              vendedor.situacaoRegistro,
              vendedor.dataRegistro,
              vendedor.versao,
            ]
          );
          totalInseridos++;
        } else if (dadosDiferentes(vendedor, atual)) {
          await database.runAsync(
            `UPDATE cadvendedor SET codigorota=?, nome=?, situacaoRegistro=?, dataRegistro=?, versao=? 
             WHERE empresa=? AND codigo=?`,
            [
              vendedor.codigorota,
              vendedor.nome,
              vendedor.situacaoRegistro,
              vendedor.dataRegistro,
              vendedor.versao,
              vendedor.empresa,
              vendedor.codigo,
            ]
          );
          totalAtualizados++;
        } else {
          totalIgnorados++;
        }
      } catch (err) {
        console.error(`❌ Erro ao processar vendedor ${vendedor.codigo}:`, err);
        totalIgnorados++;
      }
    }
  });

  // Atualiza last_sync local
  if (lastSyncServer) {
    await salvarConfig("last_sync_vendedores", lastSyncServer);
    console.log("⏱ last_sync atualizado para:", lastSyncServer);
  }

  const totalProcessados = totalInseridos + totalAtualizados + totalIgnorados;

  console.log(`🏁 Sincronização finalizada: inseridos=${totalInseridos}, atualizados=${totalAtualizados}, ignorados=${totalIgnorados}, total processados=${totalProcessados}`);

  return {
    inseridos: totalInseridos,
    atualizados: totalAtualizados,
    ignorados: totalIgnorados,
    totalProcessados,
    lastSync: lastSyncServer
  };
}




// ***********************Inicio da função de sincronização forma de pagamento **************************
//-------------------------------------------------------------------------------------------------------
async function sincronizarCondicoesPagamento(): Promise<{
  inseridos: number;
  atualizados: number;
  ignorados: number;
  totalProcessados: number;
  lastSync?: string | null;
}> {
  const database = DatabaseManager.getCurrentDatabase();
  if (!database) throw new Error("Database não disponível para sincronização de CONDIÇÕES DE PAGAMENTO");

  let totalInseridos = 0;
  let totalAtualizados = 0;
  let totalIgnorados = 0;

  // 1️⃣ Recupera last_sync local
  const lastSyncLocal = await carregarConfig("last_sync_condicoes");
  console.log("⏱ Última sincronização local:", lastSyncLocal ?? "—");

  // 2️⃣ Chamada à API
  const url = lastSyncLocal
    ? `condicoespagamento?last_sync=${encodeURIComponent(lastSyncLocal)}`
    : "condicoespagamento";

  let condicoes: any[] = [];
  let lastSyncServer: string | null = null;

  try {
    const response = await tentarRequisicao(() => api.get(url), 3, 2000);
    const dados = response.data;
    condicoes = Array.isArray(dados?.condicoes) ? dados.condicoes : (Array.isArray(dados) ? dados : []);
    lastSyncServer = dados?.last_sync ? format(parseISO(dados.last_sync), "yyyy-MM-dd HH:mm:ss") : null;
    console.log(`📦 Condições recebidas: ${condicoes.length}`);
  } catch (error: any) {
    console.error('❌ Erro ao buscar condições de pagamento:', error.message);
    return { inseridos: 0, atualizados: 0, ignorados: 0, totalProcessados: 0 };
  }

  // 3️⃣ Busca registros locais
  const locais = await database.getAllAsync<any>('SELECT * FROM cadcondicaopagamento');
  const mapaLocais = new Map(locais.map(c => [`${c.empresa}-${c.codigo}`, c]));

  // 4️⃣ Se API não retornou nada => conta todos locais como ignorados
  if (!condicoes || condicoes.length === 0) {
    totalIgnorados = locais.length;
    if (lastSyncServer) await salvarConfig("last_sync_condicoes", lastSyncServer);
    console.log(`🏁 Condições: Inseridos=${totalInseridos}, Atualizados=${totalAtualizados}, Ignorados=${totalIgnorados}, Total processados=0`);
    return {
      inseridos: totalInseridos,
      atualizados: totalAtualizados,
      ignorados: totalIgnorados,
      totalProcessados: 0,
      lastSync: lastSyncServer
    };
  }

  // 5️⃣ Filtra válidos
  const condicoesValidas = condicoes.filter(c => c.empresa != null && c.codigo != null);
  const descartados = condicoes.length - condicoesValidas.length;
  if (descartados > 0) {
    console.warn(`⚠️ Condições descartadas por falta de chave: ${descartados}`);
    totalIgnorados += descartados;
  }

  // 6️⃣ Transação de upsert
  await database.withTransactionAsync(async () => {
    for (const cond of condicoesValidas) {
      try {
        const chave = `${cond.empresa ?? 0}-${cond.codigo ?? ''}`;
        const registroAtual = mapaLocais.get(chave);

        const registro = {
          ...cond,
          dataRegistro: cond.dataRegistro ? format(parseISO(cond.dataRegistro), "yyyy-MM-dd HH:mm:ss") : ''
        };

        const dadosDiferentes = (novo: any, atual?: any) => {
          if (!atual) return true;
          const campos = ['descricao', 'acrescimo', 'desconto', 'situacaoRegistro', 'dataRegistro', 'versao'];
          return campos.some(campo => String(novo[campo] ?? '').trim() !== String(atual[campo] ?? '').trim());
        };

        if (!registroAtual) {
          await database.runAsync(
            `INSERT INTO cadcondicaopagamento (
              empresa, codigo, descricao, acrescimo, desconto,
              situacaoRegistro, dataRegistro, versao
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              registro.empresa ?? 0,
              registro.codigo ?? '',
              registro.descricao ?? '',
              registro.acrescimo ?? 0.0,
              registro.desconto ?? 0.0,
              registro.situacaoRegistro ?? 'I',
              registro.dataRegistro ?? '',
              registro.versao ?? 1
            ]
          );
          totalInseridos++;
        } else if (dadosDiferentes(registro, registroAtual)) {
          await database.runAsync(
            `UPDATE cadcondicaopagamento SET
              descricao=?, acrescimo=?, desconto=?,
              situacaoRegistro=?, dataRegistro=?, versao=?
            WHERE empresa=? AND codigo=?`,
            [
              registro.descricao ?? '',
              registro.acrescimo ?? 0.0,
              registro.desconto ?? 0.0,
              registro.situacaoRegistro ?? 'I',
              registro.dataRegistro ?? '',
              registro.versao ?? 1,
              registro.empresa ?? 0,
              registro.codigo ?? ''
            ]
          );
          totalAtualizados++;
        } else {
          totalIgnorados++;
        }

      } catch (err) {
        console.error(`❌ Erro ao processar condição ${cond.codigo}:`, err);
        totalIgnorados++;
      }
    }
  });

  // 7️⃣ Atualiza last_sync
  if (lastSyncServer) {
    await salvarConfig("last_sync_condicoes", lastSyncServer);
    console.log("⏱ last_sync atualizado para:", lastSyncServer);
  }

  // 8️⃣ Totais finais
  const totalProcessados = totalInseridos + totalAtualizados + totalIgnorados;
  console.log(`🏁 Condições: Inseridos=${totalInseridos}, Atualizados=${totalAtualizados}, Ignorados=${totalIgnorados}, Total processados=${totalProcessados}`);

  return {
    inseridos: totalInseridos,
    atualizados: totalAtualizados,
    ignorados: totalIgnorados,
    totalProcessados,
    lastSync: lastSyncServer
  };
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
  try {
    await database.runAsync("BEGIN TRANSACTION");

    // Validações básicas
    if (!pedido.empresa) throw new Error("Empresa não informada.");
    if (!pedido.codigocondpagamento) throw new Error("Forma de pagamento não informada.");
    if (!pedido.codigovendedor) throw new Error("Vendedor não informado.");
    if (!pedido.codigocliente) throw new Error("Cliente não informado.");
    if (!pedido.itens || pedido.itens.length === 0) throw new Error("Nenhum item informado para o pedido.");
    if (!pedido.dataregistro) throw new Error("Data de registro não informada.");

    let numerodocumento: number;
    

    // Verifica se já existe pedido em aberto
    const result = await database.getFirstAsync<{ numerodocumento: number }>(
      `SELECT numerodocumento FROM movnota WHERE empresa = ? AND codigocliente = ? AND status = 'P' LIMIT 1`,
      [pedido.empresa, pedido.codigocliente]
    );

    if (result) {
      numerodocumento = result.numerodocumento;

      await database.runAsync(`
        UPDATE movnota SET
          codigocondPagamento = ?, codigovendedor = ?, codigocliente = ?, nomecliente = ?,
          valorDesconto = ?, valorDespesas = ?, valorFrete = ?, pesoTotal = ?,
          observacao = ?, dataLancamento = ?, dataRegistro = ?, situacaoregistro = "A" 
        WHERE empresa = ? AND numerodocumento = ? 
      `, [
        pedido.codigocondpagamento,
        pedido.codigovendedor,
        pedido.codigocliente,
        pedido.nomecliente ?? '',
        Math.round((pedido.vrdesconto ?? 0) * 100) / 100,
        Math.round((pedido.vrdespesas ?? 0) * 100) / 100,
        pedido.valorFrete ?? 0,
        pedido.pesototal ?? 0,
        pedido.observacao ?? '',
        formatarDataRegistro(pedido.datalancamento ?? new Date()),
        formatarDataRegistro(pedido.dataregistro),
        pedido.empresa,
        numerodocumento
      ]);

    } else {
      numerodocumento = await gerarnumerodocumento(pedido.empresa, pedido.codigocliente);

      await database.runAsync(`
        INSERT INTO movnota (
          empresa, numerodocumento, codigocondPagamento, codigovendedor, codigocliente, nomecliente,
          valorDesconto, valorDespesas, valorFrete, valorTotal, pesoTotal,
          observacao, status, dataLancamento, dataRegistro
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        pedido.empresa,
        numerodocumento,
        pedido.codigocondpagamento,
        pedido.codigovendedor,
        pedido.codigocliente,
        pedido.nomecliente ?? '',
        Math.round((pedido.vrdesconto ?? 0) * 100) / 100,
        Math.round((pedido.vrdespesas ?? 0) * 100) / 100,
        pedido.valorFrete ?? 0,
        0, // valorTotal será calculado após os itens
        pedido.pesototal ?? 0,
        pedido.observacao ?? '',
        pedido.status ?? 'A',
        formatarDataRegistro(pedido.datalancamento ?? new Date().toISOString()),
        formatarDataRegistro(pedido.dataregistro)
      ]);
    }

    const selectItemQuery = `
      SELECT quantidade, valorUnitario, valorunitariovenda, valorDesconto, valoracrescimo, valorTotal
      FROM movnotaitem
      WHERE empresa = ? AND numerodocumento = ? AND codigoproduto = ? AND codigocliente = ?
    `;

    const updateItemQuery = `
      UPDATE movnotaitem SET
        quantidade = ?, valorUnitario = ?, valorunitariovenda = ?, valorDesconto = ?, valoracrescimo = ?, valorTotal = ?, situacaoregistro = "A"
      WHERE empresa = ? AND numerodocumento = ? AND codigoproduto = ? AND codigocliente = ?
    `;

    const insertItemQuery = `
      INSERT INTO movnotaitem (
        empresa, numerodocumento, codigovendedor, codigoproduto, descricaoproduto,
        valorUnitario, valorunitariovenda, valorDesconto, valoracrescimo, valorTotal, quantidade,
        dataRegistro, codigocliente
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    // Função auxiliar para calcular valor total do item
    function calcularValorTotalItem(qtd: number, venda: number, desc: number, acr: number) {
      const vendaCalc = Math.round(venda * 100) / 100; // arredonda apenas para cálculo
      const descCalc = Math.round(desc * 100) / 100;
      const acrCalc = Math.round(acr * 100) / 100;
      return Math.round((qtd * vendaCalc + acrCalc - descCalc) * 100) / 100;
    }

    for (const [index, item] of pedido.itens.entries()) {
      if (!item.codigoproduto) throw new Error(`Produto não informado no item ${index + 1}.`);
      if (!item.quantidade || item.quantidade <= 0) throw new Error(`Quantidade inválida no item ${index + 1}.`);
      if (item.valorunitario == null || item.valorunitario < 0) throw new Error(`Valor unitário inválido no item ${index + 1}.`);
      if (item.valorunitariovenda == null || item.valorunitariovenda < 0) throw new Error(`Valor unitário de venda inválido no item ${index + 1}.`);

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

      const descontoArred = Math.round((item.valordesconto ?? 0) * 100) / 100;
      const acrescimoArred = Math.round((item.valoracrescimo ?? 0) * 100) / 100;

      if (itemExistente) {
        const novaQuantidade = itemExistente.quantidade + item.quantidade;
        const valorTotalItem = calcularValorTotalItem(novaQuantidade, item.valorunitariovenda, descontoArred, acrescimoArred);

        await database.runAsync(updateItemQuery, [
          novaQuantidade,
          item.valorunitario,
          item.valorunitariovenda, // mantém original
          descontoArred,
          acrescimoArred,
          valorTotalItem,
          pedido.empresa,
          numerodocumento,
          item.codigoproduto,
          item.codigocliente ?? ''
        ]);

      } else {
        const valorTotalItem = calcularValorTotalItem(item.quantidade, item.valorunitariovenda, descontoArred, acrescimoArred);

        await database.runAsync(insertItemQuery, [
          pedido.empresa,
          numerodocumento,
          pedido.codigovendedor,
          item.codigoproduto,
          item.descricaoproduto ?? '',
          item.valorunitario,
          item.valorunitariovenda, // mantém original
          descontoArred,
          acrescimoArred,
          valorTotalItem,
          item.quantidade,
          formatarDataRegistro(pedido.dataregistro),
          item.codigocliente ?? ''
        ]);
      }
    }

    // Atualiza valorTotal do pedido
    const resultadoTotal = await database.getFirstAsync<{ total: number }>(
      `SELECT IFNULL(SUM(
         ROUND(quantidade * ROUND(valorunitariovenda, 2), 2)
         + ROUND(valoracrescimo, 2)
         - ROUND(valorDesconto, 2)
       ), 0) AS total
       FROM movnotaitem
       WHERE empresa = ? AND numerodocumento = ?`,
      [pedido.empresa, numerodocumento]
    );

    const totalItens = resultadoTotal?.total ?? 0;
    const descontoPedido = Math.round((pedido.vrdesconto ?? 0) * 100) / 100;
    const despesasPedido = Math.round((pedido.vrdespesas ?? 0) * 100) / 100;
    const valorTotalFinal = Math.round((totalItens - descontoPedido + despesasPedido) * 100) / 100;

    await database.runAsync(
      `UPDATE movnota SET valorTotal = ? WHERE empresa = ? AND numerodocumento = ?`,
      [valorTotalFinal, pedido.empresa, numerodocumento]
    );

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
  numerodocumento: number;
  codigocliente: string;
  nomecliente: string;
  codigovendedor: string;
  nomevendedor: string;
  codigoformaPgto: string;
  valorDesconto: number;
  valorDespesas: number;
  valorFrete: number;
  valorTotal: string; // formatado com 2 casas decimais
  Observacao?: string;
  enviado?: boolean;
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
    numerodocumento: linhas[0]?.numerodocumento ?? 0,
    codigocliente: linhas[0]?.codigocliente ?? '',
    nomecliente: linhas[0]?.nomecliente ?? '',
    codigovendedor: linhas[0]?.codigovendedor ?? '',
    nomevendedor: linhas[0]?.nomevendedor ?? '',
    Observacao: linhas[0]?.observacao ?? '',
    codigoformaPgto: linhas[0]?.codigocondPagamento ?? '',
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
         IFNULL(SUM(
           ROUND(quantidade * ROUND(valorunitariovenda, 2), 2)
           - ROUND(valordesconto, 2)
           + ROUND(valoracrescimo, 2)
         ), 0) as total
       FROM movnotaitem
       WHERE empresa = ? 
         AND numerodocumento = ? 
         AND codigocliente = ? 
         AND situacaoregistro <> 'E'`,
      [empresa, numerodocumento, codigocliente]
    );
    
    const valorTotalItens = somaItens?.total ?? 0;
    const valorTotalArredondado = Math.round(valorTotalItens * 100) / 100;

    console.log("Valor recalculado: ", valorTotalArredondado.toString())
    if (valorTotalArredondado === 0) {
      // 4. Se não houver mais itens ativos, marca o cabeçalho do pedido como excluído (situacaoregistro = 'E') e zera valorTotal
      await database.runAsync(
        `UPDATE movnota SET situacaoregistro = 'E'
         WHERE empresa = ? AND numerodocumento = ? AND codigocliente = ?`,
        [empresa, numerodocumento, codigocliente]
      );
    } else {
      // 5. Atualiza o valorTotal na movnota com o valor calculado
      await database.runAsync(
        `UPDATE movnota SET valorTotal = ? 
         WHERE empresa = ? AND numerodocumento = ? AND codigocliente = ? AND situacaoregistro <> 'E'` ,
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
//         DELETAR O PEDIDO DE VENDA
// -------------------------------------------------------------------------------------------------------
const deletarPedidoPorNumero = async (
  empresa: number,
  numerodocumento: number,
  codigocliente: string
): Promise<boolean> => {
  try {
    // 1. Verifica se o pedido existe e está PENDENTE
    const pedido = await database.getFirstAsync<{ status: string, situacaoregistro: string }>(
      `SELECT status, situacaoregistro FROM movnota
       WHERE empresa = ? AND numerodocumento = ? AND codigocliente = ? AND situacaoregistro <> 'E' AND status = 'P'`,
      [empresa, numerodocumento, codigocliente]
    );

    if (!pedido) {
      console.warn("Pedido não encontrado.");
      return false;
    }

    if (pedido.status !== 'P' || pedido.situacaoregistro === 'E') {
      console.warn("Pedido não pode ser deletado (não é PENDENTE ou já excluído).");
      return false;
    }

    // 2. Marca todos os itens como excluídos
    await database.runAsync(
      `UPDATE movnotaitem SET situacaoregistro = 'E'
       WHERE empresa = ? AND numerodocumento = ? AND codigocliente = ? `,
      [empresa, numerodocumento, codigocliente]
    );

    // 3. Marca o cabeçalho do pedido como excluído (mantendo valorTotal)
    await database.runAsync(
      `UPDATE movnota SET situacaoregistro = 'E'
       WHERE empresa = ? AND numerodocumento = ? AND codigocliente = ? AND status = 'P' `,
      [empresa, numerodocumento, codigocliente]
    );

    return true;
  } catch (error: any) {
    console.error("Erro ao deletar pedido:", error.message || error);
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
): Promise<boolean> => {
  try {
    console.log("Atualizando item do pedido:", { empresa, numerodocumento, codigocliente, codigoproduto, novaQuantidade });

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
  console.log("Atualizando observação:", observacao);
  console.log("Empresa:", empresa);
  console.log("Número do documento:", numerodocumento);
  console.log("Código do cliente:", codigocliente);

  try {
    // Atualiza somente se houver texto na observação
    if (observacao.trim().length > 0) {
      await database.runAsync(
        `UPDATE movnota
         SET observacao = ?, situacaoregistro = "A"
         WHERE empresa = ? AND numerodocumento = ? AND codigocliente = ? AND status = "P"`,
        [observacao, empresa, numerodocumento, codigocliente]
      );
    }
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
  id: number;
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
  id: number;
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
        idpedido: nota.id, // Adicionando ID para rastreamento
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
          idpedido: item.id, // Adicionando ID do item para rastreamento
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

    const placeholders = numeros.map(() => '?').join(',');

    // Busca pedidos que ainda não foram marcados como 'R' ou excluídos
    const movnotas = (await database.getAllAsync(
      `SELECT * FROM movnota WHERE numerodocumento IN (${placeholders}) AND status != 'R' AND situacaoRegistro <> 'E'`,
      numeros
    )) as MovNota[];

    if (!movnotas || movnotas.length === 0) {
      console.log('Nenhum pedido encontrado para os números selecionados');
      return true;
    }

    // Função que envia um único pedido
    const enviarPedido = async (nota: MovNota) => {
      const itens = (await database.getAllAsync(
        `SELECT * FROM movnotaitem WHERE numerodocumento = ? AND situacaoRegistro <> 'E'`,
        [nota.numerodocumento]
      )) as MovNotaItem[];

      const payload = {
        idpedido: nota.id,
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
        itens: itens.map(item => ({
          idpedido: item.id,
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
          const data = response.data;

          // Se já sincronizado ou hash existe → marca local como 'R'
          if (data.status === 'ja_sincronizado' || data.pedido_hash) {
            await database.runAsync(
              `UPDATE movnota SET status = 'R' WHERE numerodocumento = ?`,
              [nota.numerodocumento]
            );
            console.log(`Pedido ${nota.numerodocumento} já sincronizado no servidor.`);
          } else {
            await database.runAsync(
              `UPDATE movnota SET status = 'R' WHERE numerodocumento = ?`,
              [nota.numerodocumento]
            );
            console.log(`Pedido ${nota.numerodocumento} sincronizado com sucesso!`);
          }
        } else {
          console.log(`Falha ao enviar pedido ${nota.numerodocumento}:`, response.status);
        }
      } catch (error: any) {
        console.log(`Erro ao enviar pedido ${nota.numerodocumento}:`, error.message);
      }
    };

    // Envia todos os pedidos em paralelo
    const resultados = await Promise.allSettled(movnotas.map(nota => enviarPedido(nota)));

    // Log final de resultados
    resultados.forEach((res, index) => {
      if (res.status === 'rejected') {
        console.log(`Pedido ${movnotas[index].numerodocumento} falhou na sincronização:`, res.reason);
      }
    });

    return true;
  } catch (err: any) {
    console.log('Erro ao sincronizar pedidos selecionados:', err.message);
    return false;
  }
}


//===============================================================================================
//                  DUPLICAR PEDIDO DE VENDA
//-----------------------------------------------------------------------------------------------

function formatarDataAgora(): string {
  const agora = new Date();
  const ano = agora.getFullYear();
  const mes = String(agora.getMonth() + 1).padStart(2, "0");
  const dia = String(agora.getDate()).padStart(2, "0");
  const hora = String(agora.getHours()).padStart(2, "0");
  const minuto = String(agora.getMinutes()).padStart(2, "0");
  const segundo = String(agora.getSeconds()).padStart(2, "0");
  return `${ano}-${mes}-${dia} ${hora}:${minuto}:${segundo}`;
}

async function DuplicarPedido(
  empresa: number,
  numerodocumentoOrigem: number,
  codigocliente: string
): Promise<number> {
  try {
    await database.runAsync("BEGIN TRANSACTION");

    // 1️⃣ Recupera pedido original
    const pedidoOrigem = await database.getFirstAsync<any>(
      `SELECT * FROM movnota 
       WHERE empresa = ? AND numerodocumento = ? AND codigocliente = ? 
         AND situacaoregistro <> 'E' AND status = 'R'`,
      [empresa, numerodocumentoOrigem, codigocliente]
    );
    if (!pedidoOrigem) throw new Error("Pedido original não encontrado.");
    console.log("Pedido original encontrado:", pedidoOrigem);

    // 2️⃣ Recupera itens do pedido original
    const itensOrigem: any[] = await database.getAllAsync(
      `SELECT codigoproduto, descricaoproduto, quantidade, valorUnitario, valorunitariovenda, valorDesconto, valoracrescimo, codigovendedor
       FROM movnotaitem
       WHERE empresa = ? AND numerodocumento = ? AND codigocliente = ? AND situacaoRegistro <> 'E'`,
      [empresa, numerodocumentoOrigem, codigocliente]
    );
    console.log(`Itens originais encontrados: ${itensOrigem.length}`);

    // 3️⃣ Processa cada item
    for (const item of itensOrigem) {
      const produto = await database.getFirstAsync<any>(
        `SELECT codigo, precovenda, reajustacondicaopagamento 
         FROM cadproduto 
         WHERE codigo = ? AND situacaoRegistro <> 'E'`,
        [item.codigoproduto]
      );
      if (!produto) {
        console.log(`⚠️ Produto ${item.codigoproduto} não encontrado no cadastro.`);
        continue;
      }

      console.log("Produto item:", item.codigoproduto, "PRECO VENDA:", produto.precovenda, "Reajuste:", produto.reajustacondicaopagamento);

      const quantidade = item.quantidade ?? 0;
      const valorDesconto = item.valorDesconto ?? 0;
      const valorAcrescimo = item.valoracrescimo ?? 0;

      // Valor unitário base
      item.valorunitario = produto.precovenda ?? 0;

      // Reajuste pela condição de pagamento
      if (produto.reajustacondicaopagamento === "S") {
        const condPagamento = await database.getFirstAsync<any>(
          `SELECT codigo, acrescimo, desconto 
           FROM cadcondicaopagamento 
           WHERE situacaoRegistro <> 'E' AND codigo = ?`,
          [pedidoOrigem.codigocondPagamento]
        );
        if (condPagamento) {
          const valorComAcrescimo = (produto.precovenda ?? 0) * (1 + (condPagamento.acrescimo ?? 0) / 100);
          item.valorunitariovenda = Math.round(valorComAcrescimo * 100) / 100;
        } else {
          item.valorunitariovenda = produto.precovenda ?? 0;
        }
      } else {
        item.valorunitariovenda = produto.precovenda ?? 0;
      }

      // Valor total do item
      item.valorTotalItem = Math.round(
        (quantidade * item.valorunitariovenda - valorDesconto + valorAcrescimo) * 100
      ) / 100;

      // Garantir vendedor
      item.codigovendedor = item.codigovendedor ?? pedidoOrigem.codigovendedor ?? "00000";

      console.log("Item processado:", {
        codigoproduto: item.codigoproduto,
        descricao: item.descricaoproduto,
        quantidade,
        valorUnitario: item.valorunitario,
        valorUnitarioVenda: item.valorunitariovenda,
        valorDesconto,
        valorAcrescimo,
        valorTotalItem: item.valorTotalItem,
        codigovendedor: item.codigovendedor
      });
    }

    // 4️⃣ Calcula valor total do pedido
    const totalItens = itensOrigem.reduce((acc, item) => acc + (item.valorTotalItem ?? 0), 0);
    const valorTotalPedido =
      Math.round((totalItens - (pedidoOrigem.valorDesconto ?? 0) + (pedidoOrigem.valorDespesas ?? 0)) * 100) / 100;

    console.log("Pedido a ser duplicado:", {
      empresa,
      codigocliente: pedidoOrigem.codigocliente,
      codigocondPagamento: pedidoOrigem.codigocondPagamento,
      valorDesconto: pedidoOrigem.valorDesconto,
      valorDespesas: pedidoOrigem.valorDespesas,
      valorFrete: pedidoOrigem.valorFrete,
      valorTotalPedido
    });

    // 5️⃣ Novo número de documento
    const novoNumerodocumento = await gerarnumerodocumento(empresa, codigocliente);

    // 6️⃣ Insere pedido em movnota
    await database.runAsync(
      `INSERT INTO movnota (
        empresa, numerodocumento, codigocondPagamento, codigovendedor, codigocliente, nomecliente,
        valorDesconto, valorDespesas, valorFrete, valorTotal, pesoTotal,
        observacao, status, dataLancamento, dataRegistro
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        empresa,
        novoNumerodocumento,
        pedidoOrigem.codigocondPagamento,
        pedidoOrigem.codigovendedor,
        pedidoOrigem.codigocliente,
        pedidoOrigem.nomecliente ?? '',
        pedidoOrigem.valorDesconto ?? 0,
        pedidoOrigem.valorDespesas ?? 0,
        pedidoOrigem.valorFrete ?? 0,
        valorTotalPedido,
        pedidoOrigem.pesoTotal ?? 0,
        pedidoOrigem.observacao ?? '',
        'P',
        formatarDataAgora(),
        formatarDataAgora()
      ]
    );

    // 7️⃣ Insere itens em movnotaitem
    for (const item of itensOrigem) {
      await database.runAsync(
        `INSERT INTO movnotaitem (
          empresa, numerodocumento, codigovendedor, codigoproduto, descricaoproduto,
          valorUnitario, valorunitariovenda, valorDesconto, valoracrescimo, valorTotal, quantidade,
          dataRegistro, codigocliente
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          empresa,
          novoNumerodocumento,
          item.codigovendedor,
          item.codigoproduto,
          item.descricaoproduto ?? '',
          item.valorunitario,
          item.valorunitariovenda,
          item.valorDesconto ?? 0,
          item.valoracrescimo ?? 0,
          item.valorTotalItem,
          item.quantidade,
          formatarDataAgora(),
          pedidoOrigem.codigocliente   // ✅ corrigido
        ]
      );
    }

    await database.runAsync("COMMIT");
    console.log(`✅ Pedido duplicado com sucesso! Novo número: ${novoNumerodocumento}`);
    return novoNumerodocumento;

  } catch (error: any) {
    await database.runAsync("ROLLBACK");
    console.error("❌ Erro ao duplicar pedido reajustado:", error.message || error);
    throw error;
  }
}

// ===============================================================================================
//                          FUNÇÕES AUXILIARES DE CONFIGURAÇÃO
//-----------------------------------------------------------------------------------------------

async function salvarConfig(
  
  chave: string,
  valor: string
): Promise<void> {
  try {
    await database.runAsync(
      `INSERT OR REPLACE INTO config (chave, valor) VALUES (?, ?)`,
      [chave, valor]
    );
    console.log(`✅ Config [${chave}] atualizada com sucesso`);
  } catch (error) {
    console.error(`❌ Erro ao salvar config [${chave}]:`, error);
    throw error;
  }
}

async function carregarConfig(  
  chave: string
): Promise<string | null> {
  try {
    const row = await database.getFirstAsync<{ valor: string }>(
      `SELECT valor FROM config WHERE chave = ?`,
      [chave]
    );
    return row?.valor ?? null;
  } catch (error) {
    console.error(`❌ Erro ao carregar config [${chave}]:`, error);
    return null;
  }
}

//==================================FIM==========================================================
//===============================================================================================
//                          EXPORTAÇÃO DAS FUNÇÕES DE SINCRONIZAÇÃO
//-----------------------------------------------------------------------------------------------

  return { sincronizarEmpresas, sincronizarProdutos, sincronizarImagens, ListarItens, 
           ConsultarEmpresa, sincronizarParametros, sincronizarClientes, ListarClientes, 
           sincronizarVendedores, sincronizarCondicoesPagamento, ListarFormaPgto, sincronizarUsuarios,
           carregarPedidoCompleto, gerarnumerodocumento, contarItensCarrinho, carregarParametros,
           buscarFormaPagamentoDoPedido, excluirItemPedido, atualizarPedido, atualizarObservacao,
           ConsultaPedido ,validarUsuarioLocal,  GravarPedidos, buscarVendedorDoUsuario, 
           sincronizarPedidosSelecionados, sincronizarTodosPedidos, deletarPedidoPorNumero,
           DuplicarPedido, salvarConfig, carregarConfig
          };
}

