import type { PedidoDeVenda } from '../types/pedidotypes';
import { useSyncEmpresa } from '../database/sincronizacao'; // ajuste o path conforme necessário

export async function salvarPedidoDeVenda(pedido: PedidoDeVenda): Promise<number | null> {
  try {
    const empresa = pedido.empresa; // ou o campo correto que indica a empresa
    const CodigoCliente = pedido.codigocliente;

    // ✅ Aguarda a função assíncrona retornar os métodos disponíveis
    const {
      gerarnumerodocumento,
      GravarPedidos,
    } = await useSyncEmpresa();   

    // ✅ Gera novo código para o pedido (ex: último código + 1)
    const novoCodigo = await gerarnumerodocumento(pedido.empresa, pedido.codigocliente) 

    const pedidoComCodigo: PedidoDeVenda = {
      empresa: pedido.empresa,
      numerodocumento: novoCodigo, // ✅ agora é um number válido
      codigocondpagamento: pedido.codigocondpagamento,
      codigovendedor: pedido.codigovendedor,
      codigocliente: pedido.codigocliente,
      nomecliente: pedido.nomecliente,
      valortotal: pedido.valortotal ?? 0,
      dataregistro: new Date().toISOString(),
      status: 'P',
      itens: pedido.itens,
    };

  //  console.log("Dados para salvar: ", pedidoComCodigo)
  //  console.log('Pedido pronto para gravar:', pedidoComCodigo);
  //  console.log('Itens:', pedidoComCodigo.itens);

    await GravarPedidos(pedidoComCodigo); // sua função que salva pedido e itens
    console.log('Novo pedido gravado:', novoCodigo);

    return novoCodigo;

  } catch (error) {
    console.error('Erro ao gravar pedido:', error);
    return null;
  }
}
