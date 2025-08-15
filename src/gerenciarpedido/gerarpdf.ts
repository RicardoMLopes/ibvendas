import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { format } from 'date-fns';
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system';

interface ItemPedido {
  codigobarra: string;
  descricao: string;
  quantidade: number;
  valorunitario: number;
  desconto: number;
  acrescimo: number;
  valortotal: number;
}

interface Pedido {
  numerodocumento: number;
  nomeempresa: string;
  datalancamento: string;
  nomecliente: string;
  nomevendedor: string;
  formapagamento: string;
  itens: ItemPedido[];
  totaldesconto: number;
  totalacrescimo: number;
  valortotal: number;
}

// Função para carregar o logo e converter em base64
async function carregarLogoBase64(): Promise<string | null> {
  try {
    const asset = Asset.fromModule(require('../static/img/logo/empresa.jpg'));
    await asset.downloadAsync();

    const base64 = await FileSystem.readAsStringAsync(asset.localUri ?? '', {
      encoding: FileSystem.EncodingType.Base64,
    });
    return base64;
  } catch (error) {
    console.warn('Erro ao carregar logo base64:', error);
    return null;
  }
}

export async function gerarPdfPedido(pedido: Pedido) {
  const dataEmissao = format(new Date(), 'dd/MM/yyyy HH:mm');

  let dataLancamentoFormatada = '';
  if (pedido.datalancamento) {
    const dataObj = new Date(pedido.datalancamento);
    if (!isNaN(dataObj.getTime())) {
      dataLancamentoFormatada = format(dataObj, 'dd/MM/yyyy HH:mm:ss');
    } else {
      dataLancamentoFormatada = pedido.datalancamento; // fallback
    }
  }

  const logoBase64 = await carregarLogoBase64();
  const logoImg = logoBase64
    ? `<img src="data:image/png;base64,${logoBase64}" class="logo" />`
    : `<img src="https://via.placeholder.com/80" class="logo" />`;

  const html = `
    <html>
      <head>
        <style>
          body { font-family: Arial; font-size: 12px; padding: 10px; }
          .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #000; padding-bottom: 8px; margin-bottom: 10px; }
          .logo { width: 80px; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          th, td { border: 1px solid #000; padding: 4px; text-align: left; font-size: 11px; }
          th { background: #eee; }
          .totais {
            margin-top: 10px;
            display: flex;
            justify-content: space-between;
            font-size: 12px;
          }
          .pagamento-vendedor {
            flex: 1;
            text-align: left;
            font-weight: bold;
          }
          .valores-totais {
            flex: 1;
            text-align: right;
          }
          .valores-totais > div {
            margin-bottom: 4px;
          }
          .assinatura { margin-top: 40px; text-align: center; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div><strong>Nº Documento:</strong> ${pedido.numerodocumento}</div>
            <div><strong>Empresa:</strong> ${pedido.nomeempresa}</div>
            <div><strong>Data Emissão:</strong> ${dataEmissao}</div>
            <div><strong>Data Lançamento:</strong> ${dataLancamentoFormatada}</div>
            <div><strong>Cliente:</strong> ${pedido.nomecliente}</div>
          </div>
          ${logoImg}
        </div>

        <table>
          <thead>
            <tr>
              <th>Código Barra</th>
              <th>Descrição</th>
              <th>Qtd</th>
              <th>Vlr Unit</th>
              <th>Desc</th>
              <th>Acrésc</th>
              <th>Vlr Total</th>
            </tr>
          </thead>
          <tbody>
            ${pedido.itens
              .map(
                (item) => `
              <tr>
                <td>${item.codigobarra}</td>
                <td>${item.descricao}</td>
                <td>${item.quantidade}</td>
                <td>R$ ${item.valorunitario.toFixed(2)}</td>
                <td>R$ ${item.desconto.toFixed(2)}</td>
                <td>R$ ${item.acrescimo.toFixed(2)}</td>
                <td>R$ ${item.valortotal.toFixed(2)}</td>
              </tr>`
              )
              .join('')}
          </tbody>
        </table>

        <div class="totais">
          <div class="pagamento-vendedor">
            <div><strong>Forma de Pagamento:</strong> ${pedido.formapagamento || 'N/A'}</div>
            <div><strong>Vendedor:</strong> ${pedido.nomevendedor || 'N/A'}</div>
          </div>
          <div class="valores-totais">
            <div><strong>Total Desc:</strong> R$ ${(pedido.totaldesconto ?? 0).toFixed(2)}</div>
            <div><strong>Total Acrésc:</strong> R$ ${(pedido.totalacrescimo ?? 0).toFixed(2)}</div>
            <div><strong>Valor Total:</strong> R$ ${(pedido.valortotal ?? 0).toFixed(2)}</div>
          </div>
        </div>

        <div class="assinatura">
          ___________________________________<br/>
          Assinatura do Cliente
        </div>
      </body>
    </html>
  `;

  const { uri } = await Print.printToFileAsync({ html });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri);
  }
}
