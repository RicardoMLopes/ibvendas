export interface ItemPedido {
  codigoproduto: string;
  descricaoproduto: string;
  valorunitario: number;
  valorunitariovenda: number;
  valortotal: number;
  quantidade: number;
  valordesconto: number;
  valoracrescimo: number;
  codigocliente: string;
}

export interface PedidoDeVenda {
  empresa: number;
  numerodocumento: number;
  codigocondpagamento: string;
  codigovendedor: string;
  nomevendedor?: string // agora opcional
  codigocliente: string;
  nomecliente?: string;
  valortotal: number;
  dataregistro: string;
  status:string;
  itens: ItemPedido[];
}
