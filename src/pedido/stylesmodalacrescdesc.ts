import { StyleSheet } from 'react-native';

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    backgroundColor: '#fefefe',
    padding: 24,
    borderRadius: 16,
    width: '90%',
    elevation: 5,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#2c3e50',
    textAlign: 'center',
    marginBottom: 8,
  },
  checkContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  checkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
  },
  valorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: 16,
    backgroundColor: '#f1f1f1',
    borderRadius: 12,
    paddingHorizontal: 8,
  },
  btnAlterar: {
    padding: 10,
    backgroundColor: '#ddd',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    width: 42,
    height: 42,
  },
  valorInput: {
    borderWidth: 1,
    borderColor: '#ccc',
    backgroundColor: '#fff',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    width: '50%',
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '500',
    color: '#333',
  },
  botoesContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  botaoCancelar: {
    flex: 1,
    marginRight: 8,
    paddingVertical: 12,
    backgroundColor: '#e0e0e0',
    borderRadius: 10,
    alignItems: 'center',
  },
  botaoConfirmar: {
    flex: 1,
    marginLeft: 8,
    paddingVertical: 12,
    backgroundColor: '#2196F3',
    borderRadius: 10,
    alignItems: 'center',
  },
  textoBotao: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  headerContainer: {
  marginBottom: 20,
},



separator: {
  height: 2,
  backgroundColor: '#2196F3',
  width: '98%',
  alignSelf: 'center',
  borderRadius: 2,
},

});

export default styles;
