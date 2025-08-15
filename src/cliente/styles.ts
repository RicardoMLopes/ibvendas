import { StyleSheet, Platform, Dimensions } from 'react-native';

const styles = StyleSheet.create({
  container: {
     flex: 1, 
     padding: 20, 
     backgroundColor: '#f8f8f8' 
    },
  titulo: { 
    fontSize: 24, 
    fontWeight: 'bold', 
    marginBottom: 15 
  },
  input: {
    flex:1,
    borderBottomWidth: 1,
    borderColor: '#aaa',
    marginBottom: 10,
    padding: 8,
    fontSize: 16,
    backgroundColor: '#fff',
    borderRadius: 6
  },
  card: {
    backgroundColor: '#fff',
    padding: 15,
    marginBottom: 10,
    borderRadius: 8,
    elevation: 2
  },
  nome: { fontSize: 18, fontWeight: 'bold', marginBottom: 5 },
  separador: {
    borderBottomWidth: 1,
    borderColor: '#ddd',
    marginVertical: 5
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4
  },
   buscacontainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 4,
    borderRadius: 8,
    marginBottom: 12,
  },
  icon: {
    marginRight: 8,
  },

});

export default styles;