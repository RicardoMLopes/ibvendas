import { StyleSheet, Platform, Dimensions } from 'react-native';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f0f0f5',
  },
  buscacontainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 8,
    borderRadius: 8,
    marginBottom: 12,
  },
  icon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 16,
    borderBottomWidth: 1,
    color: '#333',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 14,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 5,
  },
  cardSelecionado: {
    backgroundColor: '#d6f5d6', // verde clarinho
    borderWidth: 2,
    borderColor: '#3ca34c',
  },

item: {
  flexDirection: 'row',
  alignItems: 'center', // 👈 Centraliza verticalmente os elementos
  gap: 12,
},

imagem: {
  width: 80,          // 👈 Tamanho mais generoso
  height: 80,
  resizeMode: 'contain', // Preenche sem distorcer
  borderRadius: 8,
 // backgroundColor: '#eaeaea', // 👈 Fundo neutro como fallback
},

  info: {
  width: '84%',
  flexDirection: 'column',
  alignItems: 'flex-start',
  paddingLeft: 8,
}, 
  nome: {
    fontWeight: 'bold',
    fontSize: 16,
    color: '#333',
    marginBottom: 8,
    flexWrap: 'wrap',
    lineHeight: 22,
  },
  linhaDescricao: {
    height: 1,
    backgroundColor: '#ccc',
    marginVertical: 6,
  },
  separador: {
    height: 1,
    backgroundColor: '#e0e0e0',
    marginVertical: 4,
  },
  erroTexto: {
  color: '#D32F2F', // tom de vermelho para destacar o erro
  fontSize: 16,
  textAlign: 'center',
  marginTop: 20,
  paddingHorizontal: 20,
  fontWeight: '600',
},
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imagemGrande: {
    width: '90%',
    height: '80%',
  },



});

export default styles;