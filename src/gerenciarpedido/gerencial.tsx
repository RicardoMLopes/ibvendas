import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Swipeable } from 'react-native-gesture-handler';
import { useSyncEmpresa } from '../database/sincronizacao';
import styles from './styles';
import { recuperarValor } from '../scripts/adicionarourecuperar';
import ModalPedidoAcoes from './modalgerencial';
import { gerarPdfPedido } from './gerarpdf';
import type { PedidoDeVenda } from '../types/pedidotypes';
import { formatDateBR } from '../scripts/funcoes';
import { LoadingOverlay } from '../scripts/loading';

type GerencPedido = {
  numerodocumento: number;
  codigocliente: string;
  nomecliente?: string;
  nomevendedor?: string;
  status: string;
  dataLancamento: string;
  valorTotal: number;
};

export default function GerenciarPedidos() {
  const hoje = new Date();
  const [dataInicio, setDataInicio] = useState<Date | null>(hoje);
  const [dataFim, setDataFim] = useState<Date | null>(hoje);
  const [showPickerInicio, setShowPickerInicio] = useState(false);
  const [showPickerFim, setShowPickerFim] = useState(false);
  const [clienteFiltro, setClienteFiltro] = useState('');
  const [resultado, setResultado] = useState<PedidoDeVenda[]>([]);
  const [loading, setLoading] = useState(false);

  const [modalVisivel, setModalVisivel] = useState(false);
  const [pedidoSelecionado, setPedidoSelecionado] = useState<PedidoDeVenda | null>(null);

  // Referências dos Swipeable para fechar após ação
  const swipeRefs = useRef<Map<number, Swipeable>>(new Map());

  const formatDate = (date: Date | null) => {
    if (!date) return '';
    const d = date;
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const day = d.getDate().toString().padStart(2, '0');
    return `${d.getFullYear()}-${month}-${day}`;
  };

  const formatarReais = (valor: number) =>
    valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  async function pesquisar() {
    if (!clienteFiltro) {
      if (!dataInicio) {
        Alert.alert('Atenção', 'Por favor, informe a Data Inícial para pesquisa.');
        return;
      }
      if (!dataFim) {
        Alert.alert('Atenção', 'Por favor, informe a Data Fim para pesquisa.');
        return;
      }
    }

    try {
      setLoading(true);
      const { ConsultaPedido } = await useSyncEmpresa();
      const empresaId = await recuperarValor("@empresa");

      const dataInicioStr = dataInicio ? `${formatDate(dataInicio)} 00:00:00` : '1900-01-01 00:00:00';
      const dataFimStr = dataFim ? `${formatDate(dataFim)} 23:59:59` : '2999-12-31 23:59:59';

      const pedidosRaw: GerencPedido[] = await ConsultaPedido(Number(empresaId), dataInicioStr, dataFimStr, clienteFiltro);

      const pedidos: PedidoDeVenda[] = pedidosRaw.map(p => ({
        empresa: Number(empresaId),
        numerodocumento: p.numerodocumento,
        codigocliente: p.codigocliente,
        nomecliente: p.nomecliente ?? '',
        codigocondpagamento: '',
        codigovendedor: '',
        nomevendedor: p.nomevendedor ?? '',
        valortotal: p.valorTotal,
        dataregistro: p.dataLancamento,
        status: p.status === 'P' || p.status === 'R' ? p.status : 'P',
        itens: [],
      }));

      setResultado(pedidos);
    } catch (error) {
      console.error('Erro ao consultar pedidos:', error);
      setResultado([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    pesquisar();
  }, []);

  const totalValor = resultado.reduce((acc, cur) => acc + cur.valortotal, 0);

  function abrirModal(pedido: PedidoDeVenda) {
    setPedidoSelecionado(pedido);
    setModalVisivel(true);
  }

  function fecharModal() {
    setModalVisivel(false);
    setPedidoSelecionado(null);
  }

  async function handleEnviarPDF(pedido: PedidoDeVenda) {
    try {
      setLoading(true);
      const empresaId = pedido.empresa;
      const numerodocumento = pedido.numerodocumento;
      const { carregarPedidoCompleto } = await useSyncEmpresa();
      const pedidoCompleto = await carregarPedidoCompleto(empresaId, numerodocumento);

      if (!pedidoCompleto) {
        Alert.alert('Erro', 'Pedido completo não encontrado para gerar PDF.');
        return;
      }

      const nomeEmpresaRaw = await recuperarValor("@nomeEmpresa");
      const nomeEmpresa = nomeEmpresaRaw ?? "Empresa Padrão";
      const nomeVendedor = await recuperarValor("@Vendedor");

      const totalDescontoItens = pedidoCompleto.itens.reduce((acc, item) => acc + (item.valorDesconto ?? 0), 0);
      const totalAcrescimoItens = pedidoCompleto.itens.reduce((acc, item) => acc + (item.valoracrescimo ?? 0), 0);
      const totalAcrescimoCabecalho = (pedidoCompleto.cabecalho.valorDespesas ?? 0) + (pedidoCompleto.cabecalho.valorFrete ?? 0);

      const pedidoParaPdf = {
        numerodocumento,
        nomeempresa: nomeEmpresa,
        datalancamento: pedido.dataregistro,
        nomecliente: pedidoCompleto.cabecalho.nomecliente ?? '',
        nomevendedor: nomeVendedor ?? 'N/A',
        formapagamento: pedidoCompleto.cabecalho.descricaoforma,
        itens: pedidoCompleto.itens.map(item => ({
          codigobarra: item.produto,
          descricao: item.descricaoproduto,
          quantidade: item.quantidade,
          valorunitario: item.valorunitariovenda,
          desconto: item.valorDesconto,
          acrescimo: item.valoracrescimo,
          valortotal: item.valorTotal,
        })),
        totaldesconto: totalDescontoItens,
        totalacrescimo: totalAcrescimoItens + totalAcrescimoCabecalho,
        valortotal: Number(pedidoCompleto.cabecalho.valorTotal),
      };

      await gerarPdfPedido(pedidoParaPdf);
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      Alert.alert('Erro', 'Falha ao gerar ou compartilhar o PDF.');
    } finally {
      setLoading(false);
      fecharModal();
    }
  }

  async function enviarPedidoSelecionado(pedido: PedidoDeVenda) {
    try {
      setLoading(true);
      const { sincronizarPedidosSelecionados } = await useSyncEmpresa();
      const sucesso = await sincronizarPedidosSelecionados([pedido.numerodocumento]);

      if (sucesso) {
        pesquisar();
        fecharModal();
      } else {
        Alert.alert('Erro', `Não foi possível enviar o pedido ${pedido.numerodocumento}. Tente novamente.`);
      }
    } catch (err) {
      console.error('Erro ao enviar pedido:', err);
      Alert.alert('Erro', 'Ocorreu uma falha inesperada ao enviar o pedido. Por favor, tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  async function deletarPedido(pedido: PedidoDeVenda) {
    if (pedido.status !== 'P') {
      Alert.alert('Ação não permitida', 'Pedidos enviados não podem ser deletados.');
      return;
    }

    Alert.alert(
      'Confirmação',
      `Deseja realmente deletar o pedido ${pedido.numerodocumento}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Deletar',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              const { deletarPedidoPorNumero } = await useSyncEmpresa();
              const sucesso = await deletarPedidoPorNumero(
                pedido.empresa,
                pedido.numerodocumento,
                pedido.codigocliente
              );

              if (sucesso) {
                Alert.alert('Sucesso', `Pedido ${pedido.numerodocumento} deletado.`);
                pesquisar();
              } else {
                Alert.alert('Erro', 'Não foi possível deletar o pedido.');
              }
            } catch (err) {
              console.error('Erro ao deletar pedido:', err);
              Alert.alert('Erro', 'Falha ao deletar o pedido.');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  }

  async function copiarPedido(pedido: PedidoDeVenda) {
    if (pedido.status !== 'R') {
      Alert.alert('Atenção', 'Somente pedidos enviados podem ser copiados.');
      return;
    }

    Alert.alert(
      'Confirmação',
      `Deseja criar uma cópia do pedido ${pedido.numerodocumento}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sim',
          onPress: async () => {
            try {
              setLoading(true);
              const { DuplicarPedido } = await useSyncEmpresa();

              const novoNumero = await DuplicarPedido(
                Number(pedido.empresa),
                Number(pedido.numerodocumento),
                String(pedido.codigocliente)
              );

              // Atualiza lista e fecha todos os swipeables
              pesquisar();
              swipeRefs.current.forEach((swipe) => swipe.close());

              Alert.alert('Sucesso', `Pedido copiado com novo número: ${novoNumero}`);
            } catch (err) {
              console.error('Erro ao copiar pedido:', err);
              Alert.alert('Erro', 'Não foi possível copiar o pedido.');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  }

  const renderRightActions = (pedido: PedidoDeVenda) => (
    <TouchableOpacity
      style={{ backgroundColor: '#28a745', justifyContent: 'center', padding: 20 }}
      onPress={() => copiarPedido(pedido)}
    >
      <Text style={{ color: '#fff', fontWeight: 'bold' }}>Copiar</Text>
    </TouchableOpacity>
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <LoadingOverlay visible={loading} />

      {/* FILTROS */}
      <View style={styles.filtrosLinha}>
        <TouchableOpacity style={styles.inputData} onPress={() => setShowPickerInicio(true)}>
          <Text>{dataInicio ? formatDateBR(dataInicio.toISOString()) : 'Data Início'}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.inputData} onPress={() => setShowPickerFim(true)}>
          <Text>{dataFim ? formatDateBR(dataFim.toISOString()) : 'Data Fim'}</Text>
        </TouchableOpacity>
      </View>

      {showPickerInicio && (
        <DateTimePicker
          value={dataInicio || new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'calendar'}
          onChange={(event, selectedDate) => {
            if (event.type === 'set' && selectedDate) setDataInicio(selectedDate);
            setShowPickerInicio(false);
          }}
        />
      )}

      {showPickerFim && (
        <DateTimePicker
          value={dataFim || new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'calendar'}
          onChange={(event, selectedDate) => {
            if (event.type === 'set' && selectedDate) setDataFim(selectedDate);
            setShowPickerFim(false);
          }}
        />
      )}

      <View style={styles.filtrosLinha}>
        <TextInput
          style={[styles.inputCliente, { paddingVertical: 8, paddingHorizontal: 6, borderColor: '#ccc', borderWidth: 1, borderRadius: 4, flex: 1 }]}
          placeholder="Consultar Cliente"
          value={clienteFiltro}
          onChangeText={setClienteFiltro}
          returnKeyType="search"
          onSubmitEditing={pesquisar}
          clearButtonMode="while-editing"
        />
        <TouchableOpacity style={[styles.botaoPesquisar, { marginLeft: 8 }]} onPress={pesquisar} disabled={loading} activeOpacity={0.7}>
          <Ionicons name="search" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* LISTA DE PEDIDOS */}
      <FlatList
        data={resultado}
        keyExtractor={(item) => `${item.numerodocumento}-${item.codigocliente}`} // chave única
        style={styles.lista}
        contentContainerStyle={{ paddingBottom: 100 }}
        ListEmptyComponent={
          <Text style={{ textAlign: 'center', marginTop: 20, fontStyle: 'italic', color: '#555' }}>
            Nenhum pedido encontrado.
          </Text>
        }
        renderItem={({ item }) => {
          const nomeCliente = item.nomecliente ?? '';
          const nomeFormatado = nomeCliente.length > 25 ? nomeCliente.match(/.{1,25}/g)?.join('\n') : nomeCliente;

          return (
            <Swipeable
              ref={(ref) => { if (ref) swipeRefs.current.set(item.numerodocumento, ref); }}
              renderRightActions={() => renderRightActions(item)}
            >
              <TouchableOpacity
                onPress={() => abrirModal(item)}
                onLongPress={() => { if (item.status === 'P') deletarPedido(item); else Alert.alert('Ação não permitida', 'Pedidos enviados não podem ser deletados.'); }}
                delayLongPress={3000}
              >
                <View style={styles.item}>
                  <View style={styles.linhaClienteStatus}>
                    <Text style={{ maxWidth: '70%', flexWrap: 'wrap', fontSize: 16, fontWeight: 'bold', lineHeight: 20 }} numberOfLines={2}>
                      {nomeFormatado}
                    </Text>
                    <View style={{ backgroundColor: item.status === 'P' ? '#FFA500' : '#007bff', paddingVertical: 4, paddingHorizontal: 10, borderRadius: 12, minWidth: 90, alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 14 }}>
                        {item.status === 'P' ? 'PENDENTE' : 'ENVIADO'}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.separador} />

                  <View style={styles.linhaPedido}>
                    <Text style={{ fontWeight: 'bold', marginTop: 2 }}>
                      N.Pedido: <Text style={{ fontWeight: 'normal' }}>{item.numerodocumento}</Text>
                    </Text>
                    <Text style={{ fontWeight: 'bold', marginTop: 2 }}>
                      Data: <Text style={{ fontWeight: 'normal' }}>{formatDateBR(item.dataregistro)}</Text>
                    </Text>
                    <Text style={styles.pedidoValor}>{formatarReais(item.valortotal)}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            </Swipeable>
          );
        }}
      />

      <View style={styles.totalizadorContainer}>
        <Text style={{ fontWeight: 'bold', color: '#2318f1ff', fontSize: 18 }}>
          Valor Total: {formatarReais(totalValor)}
        </Text>
      </View>

      <ModalPedidoAcoes
        visible={modalVisivel}
        pedido={pedidoSelecionado}
        onClose={fecharModal}
        onEnviar={enviarPedidoSelecionado}
        onGerarPDF={handleEnviarPDF}
      />
    </KeyboardAvoidingView>
  );
}
