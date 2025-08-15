import { StyleSheet } from 'react-native';



const styles = StyleSheet.create({
  modalFundo: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    backgroundColor: '#fff',
    padding: 24,
    borderRadius: 8,
    width: '80%',
    alignItems: 'center',
  },
  modalTitulo: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  modalBotoes: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  botao: {
    flex: 1,
    marginHorizontal: 6,
    paddingVertical: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
});

export default styles;