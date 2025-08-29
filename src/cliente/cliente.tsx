import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
} from 'react-native';
import styles from './styles';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSyncEmpresa } from '../database/sincronizacao';
import { adicionarValor } from '../scripts/adicionarourecuperar';
import { RouteProp } from '@react-navigation/native';

type RootStackParamList = {
  ListarClientes: { selecionarHabilitado: boolean }; // ✅ Agora aceita o parâmetro
};
type ListarClientesRouteProp = RouteProp<RootStackParamList, 'ListarClientes'>;
interface ListarClientesProps {
  route: ListarClientesRouteProp;
}

export default function ListarClientes({ route }: ListarClientesProps) {
  const { selecionarHabilitado = true } = route?.params || {};
  const [filtro, setFiltro] = useState('');
  const [list, setList] = useState<Clientes[]>([]);
  const [clienteSelecionado, setClienteSelecionado] = useState<string | null>(null);
  const navigation: any = useNavigation();
  const [loading, setLoading] = useState(true);

  interface Clientes {
    id: number;
    codigo: string;
    nome: string;
    rua: string;
    telefone: number;
    cpfCnpj: string;
  }

  useEffect(() => {
    const carregarclientes = async () => {
      const { ListarClientes } = await useSyncEmpresa();

      try {
        const lista = await ListarClientes();
        setList(lista);
      } catch (error) {
        console.error('Erro ao carregar os produtos:', error);
      } finally {
        setLoading(false);
      }
    };

    carregarclientes();
  }, []);

  const filtrarClientes = () =>
    list.filter((c) =>
      c.nome.toLowerCase().includes(filtro.toLowerCase()) ||
      c.cpfCnpj.includes(filtro) ||
      c.telefone.toString().includes(filtro) ||
      c.rua.toLowerCase().includes(filtro.toLowerCase())
    );

  const selecionarCliente = (codigo: string, nome: string) => {
    if (!selecionarHabilitado) return;
    setClienteSelecionado(codigo);
    adicionarValor('@cliente', codigo);
    adicionarValor('@nomecliente', nome);
    navigation.navigate('listarpagamento', { clienteId: codigo });
  };

  return (
    <View style={styles.container}>
      <View style={styles.buscacontainer}>
        <Ionicons name="search" size={20} color="#5f6368" style={styles.icon} />
        <TextInput
          style={styles.input}
          placeholder="Buscar por nome ou código"
          value={filtro}
          onChangeText={setFiltro}
        />
      </View>

      {loading ? (
        <View style={{ padding: 20, alignItems: 'center' }}>
          <Text style={{ color: '#999' }}>Carregando os clientes...</Text>
        </View>
      ) : list.length === 0 ? (
        <View style={{ padding: 20, alignItems: 'center' }}>
          <Text style={{ color: 'blue', fontSize: 18 }}>
            Favor sincronizar o sistema.
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtrarClientes()}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => (
            <TouchableOpacity
              disabled={!selecionarHabilitado}
              onPress={() => selecionarCliente(item.codigo, item.nome)}
            >
              <View style={[styles.card, !selecionarHabilitado && { opacity: .7 }]}>
                <Text style={styles.nome}>{item.nome}</Text>
                <View style={styles.separador} />
                <View style={styles.infoRow}>
                  <Text>🧾 CNP/CNPJ: {item.cpfCnpj}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text>📞 TELEFONE: {item.telefone}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text>🏠 ENDEREÇO: {item.rua}</Text>
                </View>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}