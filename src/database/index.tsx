import { SQLiteDatabase } from "expo-sqlite";

/**
 * Inicializa o banco de dados de forma dinâmica.
 * Cria tabelas se não existirem e adiciona colunas novas automaticamente.
 */
export async function initializedatabase(database: SQLiteDatabase) {

  // --- 1️⃣ Criação inicial de todas as tabelas ---
  const createSQL = `
    CREATE TABLE IF NOT EXISTS cadempresa (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      codigo TEXT UNIQUE,
      nome TEXT,
      cnpj TEXT,
      rua TEXT,
      numero TEXT,
      bairro TEXT,
      cidade TEXT,
      telefone TEXT,
      email TEXT
    );

    CREATE TABLE IF NOT EXISTS cadproduto (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      empresa INTEGER NOT NULL DEFAULT 0,
      codigo  VARCHAR(5) NOT NULL DEFAULT '',
      descricao TEXT NOT NULL DEFAULT '',
      unidadeMedida TEXT,
      codigobarra TEXT,
      agrupamento TEXT,
      marca TEXT,
      modelo TEXT,
      tamanho TEXT,
      cor TEXT,
      peso REAL NOT NULL DEFAULT 0.0,
      precovenda REAL NOT NULL DEFAULT 0.0,
      casasdecimais TEXT NOT NULL DEFAULT '',
      percentualdesconto REAL NOT NULL DEFAULT 0.0,
      estoque REAL NOT NULL DEFAULT 0.0,
      reajustacondicaopagamento TEXT NOT NULL DEFAULT 'N',
      percentualComissao REAL NOT NULL DEFAULT 0.0,
      situacaoregistro TEXT NOT NULL DEFAULT 'I',
      dataregistro TEXT NOT NULL DEFAULT '',
      versao INTEGER NOT NULL DEFAULT 1,
      imagens INTEGER NOT NULL DEFAULT 0,
      UNIQUE (empresa, codigo)
    );

    CREATE TABLE IF NOT EXISTS cadparametro (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      empresa INTEGER NOT NULL DEFAULT 0,
      vendedorPadrao TEXT,
      atualizaCliente INTEGER NOT NULL DEFAULT 1,
      atualizaCondPagamento INTEGER NOT NULL DEFAULT 1,
      atualizaParametro INTEGER NOT NULL DEFAULT 1,
      atualizaProduto INTEGER NOT NULL DEFAULT 1,
      atualizaVendedor INTEGER NOT NULL DEFAULT 1,
      controlaSaldoEstoque INTEGER NOT NULL DEFAULT 1,
      casaDecimalQuantidade INTEGER NOT NULL DEFAULT 0,
      casaDecimalValor INTEGER NOT NULL DEFAULT 2,
      controlaFormaPagamento INTEGER NOT NULL DEFAULT 0,
      percentualDescontoVenda REAL NOT NULL DEFAULT 0.0,
      mostrarFinanceiro INTEGER NOT NULL DEFAULT 0,
      mostrarFinanceiroVencido INTEGER NOT NULL DEFAULT 0,
      dataUltimaAtualizacao TEXT,
      situacaoRegistro TEXT NOT NULL DEFAULT 'I',
      dataRegistro TEXT NOT NULL DEFAULT '',
      versaoGeral INTEGER DEFAULT 0,
      versaoVendedor INTEGER DEFAULT 0,
      versaoCliente INTEGER DEFAULT 0,
      versaoCondicaoPagamento INTEGER DEFAULT 0,
      versaoCheckListPergunta INTEGER DEFAULT 0,
      versaoCheckListResposta INTEGER DEFAULT 0,
      versaoFinanceiro INTEGER DEFAULT 0,
      versaoRotaCondicaoPagamento INTEGER DEFAULT 0,
      versaoRotaCliente INTEGER DEFAULT 0,
      versaoProduto INTEGER DEFAULT 0,
      versaoParametro INTEGER DEFAULT 0,
      datacatalogo TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS cadrotacliente (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      empresa INTEGER NOT NULL DEFAULT 0,
      codigorota INTEGER NOT NULL DEFAULT 0,
      codigocliente TEXT NOT NULL DEFAULT '',
      situacaoRegistro TEXT DEFAULT '',
      dataRegistro TEXT DEFAULT '',
      versao INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS cadvendedor (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      empresa INTEGER NOT NULL DEFAULT 0,
      codigo  VARCHAR(5) NOT NULL DEFAULT '',
      codigorota INTEGER DEFAULT 0,
      nome TEXT NOT NULL DEFAULT '',
      situacaoRegistro TEXT NOT NULL DEFAULT 'I',
      dataRegistro TEXT DEFAULT '',
      versao INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS cadcliente (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      empresa INTEGER NOT NULL DEFAULT 0,
      codigo  VARCHAR(5) NOT NULL DEFAULT '',
      codigovendedor  VARCHAR(5) NOT NULL DEFAULT '',
      nome TEXT NOT NULL DEFAULT '',
      contato TEXT DEFAULT '',
      cpfCnpj TEXT DEFAULT '',
      rua TEXT DEFAULT '',
      numero TEXT DEFAULT '',
      bairro TEXT DEFAULT '',
      cidade TEXT DEFAULT '',
      estado TEXT DEFAULT '',
      telefone TEXT DEFAULT '',
      limiteCredito REAL NOT NULL DEFAULT 0.0,
      observacao TEXT DEFAULT '',
      restricao TEXT DEFAULT '',
      reajuste REAL NOT NULL DEFAULT 0.0,
      situacaoRegistro TEXT NOT NULL DEFAULT 'I',
      dataRegistro TEXT DEFAULT '',
      versao INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS cadcondicaopagamento (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      empresa INTEGER NOT NULL DEFAULT 0,
      codigo  VARCHAR(5) NOT NULL DEFAULT '',
      descricao TEXT DEFAULT '',
      acrescimo REAL NOT NULL DEFAULT 0.0,
      desconto REAL NOT NULL DEFAULT 0.0,
      situacaoRegistro TEXT NOT NULL DEFAULT 'I',
      dataRegistro TEXT DEFAULT '',
      versao INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS movnota (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      empresa INTEGER NOT NULL DEFAULT 0,
      numerodocumento INTEGER NOT NULL DEFAULT 0,
      codigocondPagamento VARCHAR(5) NOT NULL DEFAULT '',
      codigovendedor  VARCHAR(5) NOT NULL DEFAULT '',
      codigocliente  VARCHAR(5) NOT NULL DEFAULT '',
      nomecliente TEXT DEFAULT '',
      valorDesconto REAL NOT NULL DEFAULT 0.0,
      valorDespesas REAL NOT NULL DEFAULT 0.0,
      valorFrete REAL NOT NULL DEFAULT 0.0,
      valorTotal REAL NOT NULL DEFAULT 0.0,
      pesoTotal REAL NOT NULL DEFAULT 0.0,
      observacao TEXT DEFAULT '',
      status TEXT DEFAULT '',
      dataLancamento TEXT DEFAULT '',
      situacaoRegistro TEXT NOT NULL DEFAULT 'I',
      dataRegistro TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS movnotaitem (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      empresa INTEGER NOT NULL DEFAULT 0,
      numerodocumento INTEGER NOT NULL DEFAULT 0,
      codigovendedor  VARCHAR(5) NOT NULL DEFAULT '',
      codigoproduto  VARCHAR(5) NOT NULL DEFAULT '',
      descricaoproduto TEXT DEFAULT '',
      valorUnitario REAL DEFAULT 0.0,
      valorunitariovenda REAL DEFAULT 0.0,
      valorDesconto REAL DEFAULT 0.0,
      valoracrescimo REAL DEFAULT 0.0,
      valorTotal REAL DEFAULT 0.0,
      quantidade INTEGER DEFAULT 0,
      situacaoRegistro TEXT NOT NULL DEFAULT 'I',
      dataRegistro TEXT DEFAULT '',
      codigocliente  VARCHAR(5) NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS movfinanceiro (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      empresa TEXT NOT NULL DEFAULT '',
      nomecomputador TEXT NOT NULL DEFAULT '',
      codigocliente  VARCHAR(5) NOT NULL DEFAULT '',
      codigotipoDocumento  VARCHAR(5) NOT NULL DEFAULT '',
      numeroDocumento TEXT NOT NULL DEFAULT '',
      parcela REAL NOT NULL DEFAULT 0.0,
      movimentacao TEXT NOT NULL DEFAULT '',
      serie TEXT NOT NULL DEFAULT '',
      valorDocumento REAL NOT NULL DEFAULT 0.0,
      dataEmissao TEXT NOT NULL DEFAULT '',
      dataVencimento TEXT NOT NULL DEFAULT '',
      dataPagamento TEXT DEFAULT '',
      situacaoRegistro TEXT NOT NULL DEFAULT 'I',
      dataRegistro TEXT NOT NULL DEFAULT '',
      versao INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS cadusers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      empresa TEXT NOT NULL DEFAULT '',
      codigovendedor  VARCHAR(5) NOT NULL DEFAULT '',
      usuario TEXT NOT NULL UNIQUE DEFAULT '',
      senha TEXT NOT NULL DEFAULT '',
      token TEXT DEFAULT '',
      novasenha TEXT DEFAULT '',
      situacaoregistro TEXT NOT NULL DEFAULT 'ativo',
      dataregistro DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (codigovendedor) REFERENCES cadvendedor(codigovendedor)
    );

    CREATE TABLE IF NOT EXISTS config (
      chave TEXT PRIMARY KEY,
      valor TEXT
    );

  `;

  await database.execAsync(createSQL);

  // --- 2️⃣ Parser dinâmico para adicionar colunas novas automaticamente ---
  const tabelaRegex = /CREATE TABLE IF NOT EXISTS (\w+)\s*\(([\s\S]+?)\);/gi;
  let match;
  while ((match = tabelaRegex.exec(createSQL)) !== null) {
    const nomeTabela = match[1];

    const linhas = match[2].split(/\n/).map(l => l.trim()).filter(l => l.length > 0);

    const colunasDefinidas = linhas
      .filter(l => !/^(PRIMARY KEY|FOREIGN KEY|UNIQUE)\s*\(/i.test(l))
      .map(l => l.replace(/,$/, ''))
      .map(l => {
        const partes = l.split(/\s+/);
        let tipo = partes.slice(1).join(' ');

        // ⚡ Se for NOT NULL sem DEFAULT, adiciona default automaticamente
        if (/NOT NULL/i.test(tipo) && !/DEFAULT/i.test(tipo)) {
          if (/TEXT/i.test(tipo)) tipo += " DEFAULT ''";
          else tipo += " DEFAULT 0";
        }

        return { nome: partes[0], tipo };
      });

    const result: any[] = await database.getAllAsync(`PRAGMA table_info(${nomeTabela})`);
    const colunasExistentes = result.map(r => r.name);

    for (const coluna of colunasDefinidas) {
      if (!colunasExistentes.includes(coluna.nome)) {
        console.log(`🛠 Adicionando coluna '${coluna.nome}' na tabela '${nomeTabela}'`);
        await database.execAsync(`ALTER TABLE ${nomeTabela} ADD COLUMN ${coluna.nome} ${coluna.tipo}`);
      }
    }
  }

  console.log("✅ Banco inicializado com todas as tabelas e colunas (dinâmico e seguro)");
}
