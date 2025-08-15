// ListarPagamento.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
} from 'react-native';
import styles from './styles';
import { Ionicons } from '@expo/vector-icons';
import { NavigationProp, useNavigation, useRoute } from '@react-navigation/native';
import { adicionarValor, recuperarValor } from '../scripts/adicionarourecuperar';
import { useSyncEmpresa } from '../database/sincronizacao';
import type { RootStackParamList } from '../types/navigationTypes';
import * as SQLite from 'expo-sqlite';

interface formapgto {
  id: number;
  codigo: string;
  descricao: string;
  acrescimo: number;
}

export default function ListarPagamento() {
  const [filtro, setFiltro] = useState('');
  const [lista, setLista] = useState<formapgto[]>([]);
  const [formaSelecionada, setFormaSelecionada] = useState<string | null>(null);

  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const route = useRoute();
  const { clienteId, pedidoNumero, clienteNome } = route.params as {
    clienteId: string;
    pedidoNumero: string;
    clienteNome: string;
  };

  useEffect(() => {
    const carregarFormas = async () => {
      const { ListarFormaPgto, buscarFormaPagamentoDoPedido } = await useSyncEmpresa();
      try {
        const listapagamento = await ListarFormaPgto();
        const empresaString = await recuperarValor('@empresa');
      //  console.log("Codigo Empresa: ", empresaString, " Codigo CLiente: ", clienteId)
        setFormaSelecionada( await  buscarFormaPagamentoDoPedido(clienteId, Number(empresaString)));
        setLista(listapagamento);
      } catch (error) {
        console.error('Erro ao carregar formas de pagamento:', error);
      }
    };
    carregarFormas();
  }, [clienteId]);

  const selecionarForma = async (codigo: string, acrescimo: number) => {
    setFormaSelecionada(codigo);
    await adicionarValor('@forma', codigo);
    navigation.navigate('listaritens', {
      formaId: codigo,
      codigocliente: clienteId,
      codigovendedor: '00001',
      codigocondPagamento: codigo,
      nomecliente: clienteNome,
      pedidoNumero,
      permitirSelecao: true,
      exibirModal: true,
      acrescimo,
    });
  };

  const obterEmoji = (descricao: string) => {
    const desc = descricao.toLowerCase();
    if (desc.includes('à vista')) return '💵';
    if (desc.includes('cartão')) return '💳';
    if (desc.includes('pix')) return '🔁';
    if (desc.includes('boleto')) return '📄';
    if (desc.includes('boleta')) return '📄';
    if (desc.includes('cheque')) return '🏦';
    if (desc.includes('duplicata')) return '📑';
    if (desc.includes('promissória')) return '📝';
    return '💰';
  };

  const filtrarFormas = () =>
    lista.filter((f) => f.descricao.toLowerCase().includes(filtro.toLowerCase()));

  return (
    <View style={styles.container}>
      <View style={styles.buscacontainer}>
        <Ionicons name="card-outline" size={20} color="#5f6368" style={styles.icon} />
        <TextInput
          style={styles.input}
          placeholder="Buscar forma de pagamento"
          value={filtro}
          onChangeText={setFiltro}
        />
      </View>
      <FlatList
        data={filtrarFormas()}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => {
          const selecionado = item.codigo === formaSelecionada;
          return (
            <TouchableOpacity onPress={() => selecionarForma(item.codigo, item.acrescimo)}>
              <View style={[styles.card, selecionado && { backgroundColor: '#d1f7c4' }]}>
                <View style={styles.itemContainer}>
                  <Text style={styles.emoji}>{obterEmoji(item.descricao)}</Text>
                  <View style={styles.descricaoContainer}>
                    <Text style={styles.nome}>{item.descricao}</Text>
                    <View style={styles.separador} />
                    <Text style={styles.legenda}>
                      {selecionado ? 'Selecionada anteriormente' : 'Forma de Pagamento'}
                    </Text>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}
