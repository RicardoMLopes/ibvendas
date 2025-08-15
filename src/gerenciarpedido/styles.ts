import { StyleSheet } from 'react-native';

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    padding: 16, 
    backgroundColor: '#fff' 
  },

  filtrosLinha: {
    flexDirection: 'row',
    marginBottom: 10,
  },

  inputData: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: 10,
    backgroundColor: '#fff',
  },

  inputCliente: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#fff',
  },

  botaoPesquisar: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 6,
    marginLeft: 10,
    height: 44,
  },

  lista: {
    marginTop: 4,
    marginBottom: 100,    
  },

  item: {
    marginBottom: 18,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 6,
    backgroundColor: '#fafafa',
  },

  linhaClienteStatus: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },

  cliente: { 
    fontWeight: '700', 
    fontSize: 16, 
    color: '#222',
    flexWrap: 'wrap',
    maxWidth: '70%',
    lineHeight: 20,
  },

  // Status moderno
  statusContainerPendente: {
    backgroundColor: '#FFA500', // laranja
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    minWidth: 90,
    alignItems: 'center',
    justifyContent: 'center',
  },

  statusContainerEnviado: {
    backgroundColor: '#007BFF', // azul
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    minWidth: 90,
    alignItems: 'center',
    justifyContent: 'center',
  },

  statusTexto: { 
    color: '#fff', 
    fontWeight: 'bold', 
    fontSize: 14 
  },

  separador: {
    borderBottomWidth: 1,
    borderBottomColor: '#bbb',
    marginVertical: 6,
  },

  linhaPedido: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },

  pedidoInfo: {
    fontSize: 14,
    color: '#333',
  },

  pedidoValor: {
    fontSize: 14,
    fontWeight: '700',
    color: '#007BFF', // total azul
    marginTop: 2,
  },

  totalizadorContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 50,
    backgroundColor: '#CDCDCDCD',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderColor: '#999',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },

  totalizadorTexto: {
    fontWeight: 'bold',
    fontSize: 18,
    color: '#000',
  },  
  pedidoTexto: {
    fontSize: 14,
    flexShrink: 1,
  },

});

export default styles;
