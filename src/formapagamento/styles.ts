import { StyleSheet, Platform, Dimensions } from 'react-native';

const styles = StyleSheet.create({
  container: {
     flex: 1, 
     padding: 20, 
     backgroundColor: '#f8f8f8' 
    },
  itemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  descricaoContainer: {
    flex: 1,
    alignItems: 'center',
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
    padding: 10,
    backgroundColor: '#fff',
    marginVertical: 5,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
  },

  nome: { 
    fontSize: 18, 
    fontWeight: 'bold', 
    marginBottom: 5,
    textAlign: 'center',  
    color: '#333',
 },
    separador: {
    width: '60%',
    height: 1,
    backgroundColor: '#ccc',
    marginVertical: 4,
  },

  legenda: {
    fontSize: 12,
    color: '#777',
    fontStyle: 'italic',
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
 emoji: {
    fontSize: 28,
    marginRight: 12,
  },

});

export default styles;