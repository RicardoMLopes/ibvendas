import { StyleSheet } from 'react-native';

export const modalStyles = StyleSheet.create({
  modalContainer: {
    backgroundColor: '#fff',
    marginHorizontal: 20,
    marginTop: '30%',
    padding: 20,
    borderRadius: 10,
    elevation: 5,
  },
  tituloProduto: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
    textAlign: 'center',
  },
  tipoTexto: {
    fontSize: 14,
    color: '#555',
  },
  tipoBotao: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#e0e0e0',
    borderRadius: 6,
  },
  inputAjuste: {
    borderWidth: 1,
    borderColor: '#999',
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    width: 100,
    textAlign: 'center',
    fontSize: 14,
    marginRight: 8,
  },
  ajusteContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },

  valorUnitario: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#007acc',
    textAlign: 'center',
    marginBottom: 16,
  },

  quantidadeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    gap: 12, // espaçamento uniforme entre elementos
  },

  botaoQuantidade: {
    fontSize: 28,
    paddingHorizontal: 20,
    paddingVertical: 6,
    backgroundColor:  '#ccc',  // azul tema
    borderRadius: 10,
    color: '#fff',               // texto branco
    textAlign: 'center',
    fontWeight: 'bold',
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },

  inputQuantidade: {
    width: 90,
    height: 44,
    textAlign: 'center',
    borderWidth: 1,
    borderColor: '#007acc',     // borda azul tema
    borderRadius: 10,
    fontSize: 18,
    color: '#222',
    backgroundColor: '#f9faff',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 2,
    fontWeight: '600',
  },

  botaoAjuste: {
    backgroundColor: '#eee',
    paddingVertical: 10,
    marginBottom: 16,
    borderRadius: 8,
  },

  textoBotao: {
    textAlign: 'center',
    fontWeight: '500',
    color: '#555',
  },

  total: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#009e00',
    textAlign: 'center',
    marginVertical: 12,
  },

  botoes: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },

  botaoSecundario: {
    flex: 1,
    backgroundColor: '#ccc',
    padding: 10,
    borderRadius: 6,
    marginRight: 10,
    alignItems: 'center',
  },

  botaoPrincipal: {
    flex: 1,
    backgroundColor: '#007acc',
    padding: 10,
    borderRadius: 6,
    alignItems: 'center',
  },
});

export const pedidoStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f2f2f2',
    padding: 16,
  },
  titulo: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#333',
    textAlign: 'center',
  },
  botaoProduto: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    elevation: 2,
  },
  itemPedido: {
    backgroundColor: '#fff',
    padding: 10,
    borderRadius: 8,
    marginVertical: 6,
    borderLeftWidth: 4,
    borderLeftColor: '#007acc',
  },
  totalPedido: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#006600',
    marginTop: 16,
    textAlign: 'center',
  },
});
