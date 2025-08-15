import React from 'react';
import { useRoute, RouteProp } from '@react-navigation/native';
import ListarProdutos from '../produto/produto';
import type { RootStackParamList } from '../types/navigationTypes';
import type { ItemPedido } from '../types/pedidotypes'; // ✅ usando tipo padronizado

export default function ListarItensPedido() {
  const route = useRoute<RouteProp<RootStackParamList, 'listaritens'>>();
  const { formaId } = route.params;
   const pedidoNumero = 'TEMP_NUMERO'; 

  const gravarItemPedido = async (item: ItemPedido) => {
    console.log('Gravando item:', item.descricaoproduto, item.valortotal);
    // Aqui você pode acionar outros efeitos, como salvar ou navegar
  };

  return (
    <ListarProdutos
      modo="pedido"
      permitirSelecao={true}
      onAdicionarItem={gravarItemPedido}
      pedidoNumero={pedidoNumero}
    />
  );
}