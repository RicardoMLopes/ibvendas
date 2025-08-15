import { StyleSheet } from "react-native";

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 20,
    paddingTop: 40,
  },
  label: {
    fontWeight: 'bold',
    marginBottom: 6,
    fontSize: 14,
    color: '#333',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    backgroundColor: '#fff',
    fontSize: 16,
    color: '#000',
  },
  empresa: {
    fontSize: 16,
    marginBottom: 12,
    color: '#333',
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#007AFF',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 16,
    elevation: 2, // sombra sutil para Android
    shadowColor: '#000', // sombra para iOS
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 18,
    marginTop:120,
    marginBottom: 20,
    alignItems: 'center',
    borderColor: '#007AFF',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  empresaNome: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 6,
    color: '#333',
    textAlign: 'center',
  },
  documento: {
    fontSize: 16,
    color: '#666',
    marginBottom: 12,
    textAlign: 'center',
  },
  trocarTexto: {
    color: '#007AFF',
    textDecorationLine: 'underline',
    fontSize: 14,
    marginTop: 6,
  },
  linkTexto: {
    color: '#007AFF',
    textAlign: 'center',
    fontSize: 16,
    textDecorationLine: 'underline',
    fontWeight: '500',
    marginTop: 12,
  },
  fraseReflexiva: {
  fontSize: 15,
  textAlign: 'center',
  fontStyle: 'italic',
  color: '#555',
  marginBottom: 12,
  marginTop: 238,
  paddingHorizontal: 16,
  lineHeight: 22,
},

campoDocumento: {
  borderWidth: 1,
  borderColor: '#007AFF',
  borderRadius: 8,
  padding: 12,
  marginBottom: 16,
  backgroundColor: '#fff',
  fontSize: 16,
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.05,
  shadowRadius: 2,
  elevation: 1,
}
});

export default styles;