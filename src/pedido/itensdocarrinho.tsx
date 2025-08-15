import React, { useEffect, useState } from 'react';
import { TouchableOpacity, View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { RootStackParamList } from '../types/navigationTypes';
import { useSyncEmpresa } from '../database/sincronizacao'; 
import { recuperarValor } from '../scripts/adicionarourecuperar';

type NavigationProps = NativeStackNavigationProp<RootStackParamList, 'listaritens'>;

interface CarrinhoHeaderProps {
  permitirSelecao?: boolean;
}

export const CarrinhoHeader: React.FC<CarrinhoHeaderProps> = ({ permitirSelecao = false }) => {
  const navigation = useNavigation<NavigationProps>();

  const [empresa, setEmpresa] = useState<string | null>(null);
  const [numerodocumento, setNumeroDocumento] = useState<number | null>(null);
  const [quantidadeItens, setQuantidadeItens] = useState<number>(0);

  useEffect(() => {
    async function carregarDados() {
      const { gerarnumerodocumento, contarItensCarrinho } = await useSyncEmpresa();

      try {
        const valor = await AsyncStorage.getItem('@empresa');
        setEmpresa(valor);

        const valorNum = Number(valor ?? 0);
        const codigocliente = (await recuperarValor('@cliente')) ?? '';

        const numeroPedido = await gerarnumerodocumento(valorNum, codigocliente);
        setNumeroDocumento(numeroPedido);
        
        const qtd = await contarItensCarrinho(valorNum, numeroPedido, codigocliente);
        setQuantidadeItens(qtd);
      } catch (e) {
        console.error('Erro ao carregar dados do carrinho:', e);
      }
    }

    carregarDados();
  }, []);

  if (!permitirSelecao) return null;

  return (
    <TouchableOpacity
      disabled={!empresa || numerodocumento === null}
      onPress={() => {
        if (empresa && numerodocumento !== null) {
          navigation.navigate('PedidoVenda', {
            empresa,
            numerodocumento: numerodocumento.toString(),
          });
        } else {
          console.warn('Empresa ou número do pedido ainda não disponíveis.');
        }
      }}
      style={{ opacity: !empresa || numerodocumento === null ? 0.5 : 1 }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 20 }}>
        <Ionicons name="cart-outline" size={28} color="#333" />
        {quantidadeItens > 0 && (
          <View
            style={{
              position: 'absolute',
              top: -4,
              right: -10,
              backgroundColor: 'red',
              borderRadius: 10,
              paddingHorizontal: 6,
              paddingVertical: 2,
            }}
          >
            <Text style={{ color: 'white', fontSize: 12, marginTop: 2 }}>
              {quantidadeItens}
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};
