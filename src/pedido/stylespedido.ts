import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
container: {
    flex: 1,
    backgroundColor: '#fafafa',
    padding: 16,
    paddingBottom: 80,
  },
  cabecalho: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    elevation: 10,
  },
  cabecalhoLinha: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',  // garante alinhamento à esquerda
    marginBottom: 8,
  },
emoji: {
    fontSize: 18,
    marginRight: 8,
    backgroundColor: '#f0f0f0',
    borderRadius: 20,
    padding: 6,
    overflow: 'hidden',
  },
  infoFixa: {
    fontSize: 16,
    fontWeight: 'normal',
    color: '#444',
    flex: 1,           // ocupa espaço restante
    textAlign: 'left',
  },
  resumoTotais: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    elevation: 2,
  },
  valores: {
    alignItems: 'flex-end',
  },
  itemPedido: {
    backgroundColor: '#ffffff',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
    
    borderLeftWidth: 4,
    borderLeftColor: '#007acc',
    elevation:3,
  },
separador: {
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
    marginVertical: 8,
  },
rodape: {
  position: 'absolute',
  bottom: 60,
  left: 16,
  right: 16,
  flexDirection: 'row',
  justifyContent: 'space-between',
},
  botaoCancelar: {
    flex: 1,
    backgroundColor: 'rgba(245, 130, 7, 0.5)', // vermelho com 50% de opacidade
    padding: 12,
    borderRadius: 8,
    marginRight: 8,
    alignItems: 'center',
    elevation: 4,
  },
  botaoFaturar: {
    flex: 1,
    backgroundColor: '#0fc661e2',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    elevation: 2,
  },
  modalContainer: {
  flex: 1,
  justifyContent: 'center',
  alignItems: 'center',
  backgroundColor: 'rgba(0, 0, 0, 0.5)',
},
modalBox: {
  width: '85%',
  backgroundColor: '#fff',
  borderRadius: 12,
  padding: 20,
  elevation: 5,
},
modalTitulo: {
  fontSize: 16,
  fontWeight: 'bold',
  marginBottom: 12,
  textAlign: 'center',
},
modalInputObs: {
  borderWidth: 1,
  borderColor: '#ccc',
  borderRadius: 8,
  padding: 10,
  height: 300,
  textAlignVertical: 'top',
  marginBottom: 12,
},
modalInput: {
  borderWidth: 1,
  borderColor: '#ccc',
  borderRadius: 8,
  padding: 10,
  height: 40,
  textAlignVertical: 'top',
  marginBottom: 12,
},

botaoModalFechar: {
  backgroundColor: 'rgba(1, 17, 246, 1)',
  padding: 12,
  borderRadius: 8,
  alignItems: 'center',
},

botaoInformarObs: {
  backgroundColor: '#797c80ff', // azul claro
  padding: 12,
  borderRadius: 8,
  alignItems: 'center',
  elevation: 2,
},

botaoInformarDesc: {
  backgroundColor: '#5a5a57ff', // amarelo claro
  padding: 12,
  borderRadius: 8,
  alignItems: 'center',
  elevation: 2,
},
containerInvisivel: {
    opacity: 0, // Torna o TouchableOpacity invisível
    backgroundColor: 'transparent', // Garante que não haja cor de fundo
  },
  
TextBottun:{
  fontWeight:'bold',
  fontSize:16,
  fontStyle:'normal',
  color:'#ffffff',
},
TextTotais:{
  fontWeight:'bold',
  fontSize:16,
  fontStyle:'normal',
  color:'#000000',
},
TextVrTotais:{
  fontWeight:'regular',
  fontSize:14,
  fontStyle:'normal',
  color:'#000000',
},
// estilos baseados no que já existe
modalBotaoBase: {
  width: '100%',
  paddingVertical: 12,
  borderRadius: 8,
  alignItems: 'center',
},

modalBotaoEnviar: {
  backgroundColor: '#f28c28', // cor laranja
},

modalBotaoSalvar: {
  backgroundColor: '#068d43e2', // verde
},

modalBotaoCancelar: {
  backgroundColor: '#e74c3c', // vermelho
},

});



//===============================================
// modal do pedido item
//-----------------------------------------------
export const modalstyles = StyleSheet.create({
 modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalContaineritem: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 25,
    width: '100%',
    maxWidth: 400,
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
  },
  tituloProduto: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  separadormodal: {
    height: 1,
    backgroundColor: '#ddd',
    marginBottom: 20,
  },
  botaoQuantidade: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ccc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  botaoQuantidadeTexto: {
    fontSize: 28,
    fontWeight: 'bold',
    lineHeight: 28,
  },
  inputQuantidadeModal: {
    borderWidth: 1,
    borderColor: '#ccc',
    paddingVertical: 8,
    paddingHorizontal: 12,
    fontSize: 22,
    borderRadius: 6,
    textAlign: 'center',
  },
  botaoDeletar: {
    backgroundColor: '#d93025',
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 20,
    alignItems: 'center',
  },
  textoBotaoDeletar: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  botoesInferiores: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  botaoSecundario: {
    flex: 1,
    backgroundColor: '#eee',
    paddingVertical: 12,
    borderRadius: 8,
    marginRight: 12,
    alignItems: 'center',
  },
  botaoPrincipal: {
    flex: 1,
    backgroundColor: '#066931',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
});
