import React from 'react';
import { TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CommonActions } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

export const HeaderLogoutButton: React.FC = () => {
  const navigation = useNavigation();

  const handleLogout = async () => {
    try {
      // Remove todos os dados do usuário
      await AsyncStorage.multiRemove(['@CNPJ','@IDUSER','@usuario','@empresa','@nomeEmpresa']);

      // Reseta a navegação para a tela de login
      navigation.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{ name: 'login' }],
        })
      );
    } catch (err) {
      console.log('Erro no logout:', err);
    }
  };

  return (
    <TouchableOpacity style={{ marginRight: 15 }} onPress={handleLogout}>
      <Ionicons name="log-out-outline" size={28} color="red" />
    </TouchableOpacity>
  );
};
