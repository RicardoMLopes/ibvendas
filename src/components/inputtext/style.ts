import { StyleSheet,Platform } from "react-native";

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    marginBottom: 4,
    fontWeight: '600',
    fontSize: 14,
  },
  
  inputError: {
    borderColor: 'red',
  },
  errorText: {
    marginTop: 4,
    color: 'red',
    fontSize: 12,
  },
});

export default styles;