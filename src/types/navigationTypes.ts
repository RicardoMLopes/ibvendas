export type RootStackParamList = {
  login: undefined;
  home: { cnpj: string };
  listaritens: {   
    formaId: string;
    permitirSelecao: boolean;
    exibirModal: boolean;
    acrescimo?: number;
    codigocliente: string;
    codigovendedor: string;
    codigocondPagamento: string;
    nomecliente: string;
    pedidoNumero: string;
  };
  listarcliente: { selecionarHabilitado: boolean };
  SyncOptions: undefined;
  GerenciarPedidos:undefined;
  listarpagamento: {
    clienteId: string;
    pedidoNumero: string;
    clienteNome: string;
  };
  PedidoVenda: { empresa: string | null; numerodocumento: string };
};