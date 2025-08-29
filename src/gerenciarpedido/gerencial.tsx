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
  Modal,
  Switch,
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
import { useNavigation } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigationTypes';
import { EnviarEmail } from '../email/servidoremail';

type GerencPedido = {
  numerodocumento: number;
  codigocliente: string;
  nomecliente?: string;
  nomevendedor?: string;
  status: string;
  dataLancamento: string;
  valorTotal: number;
};

type Props = NativeStackScreenProps<RootStackParamList, 'listarcliente'>;

export default function GerenciarPedidos() {
  const hoje = new Date();
  const [dataInicio, setDataInicio] = useState<Date | null>(hoje);
  const [dataFim, setDataFim] = useState<Date | null>(hoje);
  const [showPickerInicio, setShowPickerInicio] = useState(false);
  const [showPickerFim, setShowPickerFim] = useState(false);
  const [clienteFiltro, setClienteFiltro] = useState('');
  const [resultado, setResultado] = useState<PedidoDeVenda[]>([]);
  const [loading, setLoading] = useState(false);
  const navigation = useNavigation<any>();
  const [modalVisivel, setModalVisivel] = useState(false);
  const [pedidoSelecionado, setPedidoSelecionado] = useState<PedidoDeVenda | null>(null);

  // Modal de filtros (Pendente / Enviado)
  const [modalFiltrosVisivel, setModalFiltrosVisivel] = useState(false);
  const [mostrarPendente, setMostrarPendente] = useState(false);
  const [mostrarEnviado, setMostrarEnviado] = useState(false);

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

      let pedidos: PedidoDeVenda[] = pedidosRaw.map(p => ({
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

      // FILTRAR DUPLICADOS POR numerodocumento
      pedidos = pedidos.filter(
        (pedido, index, self) =>
          index === self.findIndex(p => p.numerodocumento === pedido.numerodocumento)
      );

      // aplicar filtros de status:
      // - Se apenas Pendente marcado -> mostra status 'P'
      // - Se apenas Enviado marcado -> mostra status 'R'
      // - Se ambos marcados ou nenhum marcado -> mostra todos
      if (mostrarPendente && !mostrarEnviado) {
        pedidos = pedidos.filter(p => p.status === 'P');
      } else if (!mostrarPendente && mostrarEnviado) {
        pedidos = pedidos.filter(p => p.status === 'R');
      }

      setResultado(pedidos);
    } catch (error) {
    //  console.error('Erro ao consultar pedidos:', error);
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
        formapagamento: pedidoCompleto.cabecalho.codigoformaPgto,
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
    //  console.error('Erro ao gerar PDF:', error);
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
   //   console.error('Erro ao enviar pedido:', err);
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
           //   console.error('Erro ao deletar pedido:', err);
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
    let novoNumero: number | null = null;

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

              novoNumero = await DuplicarPedido(
                Number(pedido.empresa),
                Number(pedido.numerodocumento),
                String(pedido.codigocliente)
              );
              if (novoNumero) {
                const cnpjRaw = await recuperarValor("@cnpj"); // pode ser string | null

                // Garantir que não seja null antes de usar replace
                const cnpjLimpo = (cnpjRaw ?? '').replace(/\D/g, '');

                navigation.reset({
                  index: 4, // posição do PedidoVenda
                  routes: [
                    { name: 'home', params: { cnpj: cnpjLimpo } }, // raiz da pilha
                    { name: 'listarcliente', params: { empresa: pedido.empresa, clienteId: pedido.codigocliente } },
                    { name: 'listarpagamento', params: { empresa: pedido.empresa, codigocondPagamento: pedido.codigocondpagamento } },
                    { name: 'listaritens', params: { codigocliente: pedido.codigocliente, formaId: pedido.codigocondpagamento,
                                                      codigovendedor: pedido.codigovendedor,
                                                      permitirSelecao: true,
                                                      exibirModal: true,
                                                      cd_pedido: novoNumero.toString(),}, },
                    { 
                      name: 'PedidoVenda',
                      params: {
                        empresa: pedido.empresa,
                        cd_pedido:  novoNumero.toString(),
                        codigocliente: pedido.codigocliente,
                      }
                    },
                  ],
                });
              }

              // Atualiza lista e fecha todos os swipeables
              pesquisar();
              swipeRefs.current.forEach((swipe) => swipe.close());

             // Alert.alert('Sucesso', `Pedido copiado com novo número: ${novoNumero}`);
            } catch (err) {

              await EnviarEmail({
                to: ['ricardomachadolopes@gmail.com', 'eldovane@gmail.com'], // ✅ lista de strings
                subject: 'Copia do pedido',
                message: 'Erro ao realizar a cópia do pedido',
                jsonData: {
                  NumeroPedido: novoNumero?.toString() ?? 'não gerado',
                  codigocliente: pedido.codigocliente,
                  empresa: pedido.empresa,
                  codigovendedor: pedido.codigovendedor,
                  usuario: await recuperarValor("@usuario"),
                },  
              });

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

      {/* FILTROS: datas + botão abrir modal filtros */}
      <View style={styles.filtrosLinha}>
        <TouchableOpacity style={styles.inputData} onPress={() => setShowPickerInicio(true)}>
          <Text>{dataInicio ? formatDateBR(dataInicio.toISOString()) : 'Data Início'}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.inputData} onPress={() => setShowPickerFim(true)}>
          <Text>{dataFim ? formatDateBR(dataFim.toISOString()) : 'Data Fim'}</Text>
        </TouchableOpacity>

        {/* Botão abrir modal de filtros */}
        <TouchableOpacity
          style={[styles.botaoPesquisar, { marginLeft: 8, backgroundColor: 'hsla(197, 19%, 93%, 1.00)', borderColor: '#ccc', borderWidth: 1 }]}
          onPress={() => setModalFiltrosVisivel(true)}
        >
          <Ionicons name="filter" size={23} color="#373434ff" />
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
          <Ionicons name="search" size={23} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* LISTA DE PEDIDOS */}
      <FlatList
        data={resultado}
        keyExtractor={(item) => String(item.numerodocumento)} // numerodocumento é único
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

      {/* Modal de filtros */}
      <Modal
        visible={modalFiltrosVisivel}
        transparent
        animationType="slide"
        onRequestClose={() => setModalFiltrosVisivel(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}>
          <View style={{ width: 320, backgroundColor: '#fff', padding: 20, borderRadius: 8 }}>
            <Text style={{ fontWeight: 'bold', fontSize: 16, marginBottom: 12 }}>
              Filtrar por status
            </Text>

            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
              <Switch value={mostrarPendente} onValueChange={setMostrarPendente} />
              <Text style={{ marginLeft: 8 }}>Pendente</Text>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
              <Switch value={mostrarEnviado} onValueChange={setMostrarEnviado} />
              <Text style={{ marginLeft: 8 }}>Enviado</Text>
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <TouchableOpacity
                onPress={() => setModalFiltrosVisivel(false)}
                style={{ padding: 10, backgroundColor: '#ccc', borderRadius: 4, minWidth: 100, alignItems: 'center' }}
              >
                <Text>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  setModalFiltrosVisivel(false);
                  pesquisar(); // aplica com filtros
                }}
                style={{ padding: 10, backgroundColor: '#007bff', borderRadius: 4, minWidth: 100, alignItems: 'center' }}
              >
                <Text style={{ color: '#fff' }}>Aplicar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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
