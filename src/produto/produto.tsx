import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  Image,
  Modal,
  Pressable,
  TouchableOpacity,
} from 'react-native';
import styles from './styles';
import { Ionicons } from '@expo/vector-icons';
import { mapearImagensDaPasta } from '../scripts/mapearpastaimagens';
import { getCaminhoImagens } from '../scripts/criarpasta';
import { useSyncEmpresa } from '../database/sincronizacao';
import ModalPedidoVenda from '../pedido/modalpedido';
import { useRoute, useNavigation, useFocusEffect } from '@react-navigation/native';
import type { ItemPedido } from '../types/pedidotypes';
import { recuperarValor } from '../scripts/adicionarourecuperar';
import * as FileSystem from 'expo-file-system';
import Share from 'react-native-share';

type ListarProdutosProps = {
  modo?: string;
  permitirSelecao?: boolean;
  onAdicionarItem?: (item: ItemPedido) => Promise<void>;
  pedidoNumero?: string;
};

interface Produto {
  id: number;
  codigo: string;
  codigobarra: string;
  descricao: string;
  precovenda: number;
  unidadeMedida: string;  
  percentualComissao: number;
  percentualdesconto: number,
  imagem?: string;
  agrupamento?: string;
  acrescimo?: number;
  valorunitariovenda?: number;
  casasdecimais?: "0" | "1"; 
}

type RouteParams = {
  formaId: number;
  permitirSelecao: boolean;
  exibirModal: boolean;
  empresa: any;
  codigocliente: string;
  codigovendedor: string;
  codigocondPagamento: string;
  nomecliente: string;
  acrescimo?: number;
};

export default function ListarProdutos(props: ListarProdutosProps) {
  const route = useRoute();
  const navigation = useNavigation<any>();
  const {
    permitirSelecao,
    exibirModal,
    empresa,
    codigocliente,
    codigovendedor,
    codigocondPagamento,
    nomecliente,
    acrescimo = 0,
  } = route.params as RouteParams;

  const [busca, setBusca] = useState('');
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [mapaImagens, setMapaImagens] = useState<Record<string, string>>({});
  const [itemSelecionado, setItemSelecionado] = useState<Produto | null>(null);
  const [modalVisivel, setModalVisivel] = useState(false);
  const [produtosAdicionados, setProdutosAdicionados] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroVisivel, setFiltroVisivel] = useState(false);
  const [agrupamentoFiltro, setAgrupamentoFiltro] = useState('');
  const [codigoBarraFiltro, setCodigoBarraFiltro] = useState('');
  const [unidadeFiltro, setUnidadeFiltro] = useState('');
  const [precoMin, setPrecoMin] = useState('');
  const [precoMax, setPrecoMax] = useState('');
  const [filter, setfilter] =  useState<Produto[]>([]);



  useEffect(() => {
    const carregarImagens = async () => {
      const caminho = await getCaminhoImagens();
      const mapa = await mapearImagensDaPasta(caminho);
      setMapaImagens(mapa);
    };
    carregarImagens();
  }, []);
 
  function parseCasasDecimais(valor: any): "0" | "1" {
    if (valor === "1") return "1";
    return "0";
  }

  const carregarDados = async () => {
    const { ListarItens, carregarPedidoCompleto, gerarnumerodocumento } = await useSyncEmpresa();
    try {
      const itens = await ListarItens();
      const itensComValorVenda = itens.map((produto) => {
        const aplicarAcrescimo = produto.reajustacondicaopagamento === 'S';
        const valorunitariovenda = aplicarAcrescimo
          ? produto.precovenda * (1 + Number(acrescimo) / 100)
          : produto.precovenda;
        return {
          ...produto,
          valorunitariovenda,
          casasdecimais: parseCasasDecimais(produto.casasdecimais),
        };
      });

      setProdutos(itensComValorVenda);
      setfilter(itensComValorVenda); // mostra todos inicialmente


      if (permitirSelecao) {
        const empresaString = await recuperarValor('@empresa');
        const numeropedido = await gerarnumerodocumento(Number(empresaString), codigocliente);
        const pedido = await carregarPedidoCompleto(Number(empresaString), Number(numeropedido));

        if (numeropedido && Number(empresaString) && pedido) {
          const idsProdutos = pedido.itens.map((item) => item.produto.trim().toLowerCase());
          setProdutosAdicionados(idsProdutos);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar os produtos:', error);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      carregarDados();
    }, [acrescimo, permitirSelecao, codigocliente])
  );

  useEffect(() => {
    if (!permitirSelecao) {
      navigation.setOptions({ headerRight: () => null });
      return;
    }

    async function atualizarHeader() {
      const { gerarnumerodocumento } = await useSyncEmpresa();
      try {
        const empresaString = await recuperarValor('@empresa');
        const empresaNum = Number(empresaString);
        if (!empresaString || !empresaNum) {
          navigation.setOptions({ headerRight: () => null });
          return;
        }

        const numeroPedido = await gerarnumerodocumento(empresaNum, codigocliente);
        navigation.setOptions({
          headerRight: () => (
            <View style={{ overflow: 'visible' }}>
              <TouchableOpacity
                style={{ position: 'relative', marginRight: 25, paddingHorizontal: 8 }}
                onPress={() =>
                  navigation.navigate('PedidoVenda', {
                    empresa: empresaNum,
                    cd_pedido: numeroPedido.toString(),
                    codigocliente: codigocliente,
                  })
                }
                activeOpacity={0.7}
              >
                <Ionicons name="cart-outline" size={30} color="#000" />
                {produtosAdicionados.length > 0 && (
                  <View
                    style={{
                      position: 'absolute',
                      right: 2,
                      top: -4,
                      backgroundColor: 'red',
                      borderRadius: 12,
                      paddingHorizontal: 6,
                      minHeight: 24,
                      minWidth: 24,
                      alignItems: 'center',
                      justifyContent: 'center',
                      zIndex: 999,
                    }}
                  >
                    <Text
                      style={{
                        color: 'white',
                        fontSize: 16,
                        fontWeight: 'bold',
                        lineHeight: 20,
                        textAlign: 'center',
                        paddingVertical: 1,
                      }}
                    >
                      {produtosAdicionados.length}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          ),
        });
      } catch (error) {
        console.warn('Erro ao configurar header do carrinho:', error);
        navigation.setOptions({ headerRight: () => null });
      }
    }

    atualizarHeader();
  }, [produtosAdicionados, permitirSelecao, navigation, codigocliente]);


  useEffect(() => {
    const resultado = produtos.filter((item) => {
      const preco = item.valorunitariovenda ?? item.precovenda;

      const correspondeBusca =
        !busca ||
        item.descricao?.toLowerCase().includes(busca.toLowerCase()) ||
        item.codigobarra?.includes(busca) ||
        item.agrupamento?.toLowerCase().includes(busca.toLowerCase());

      const correspondeAgrupamento =
        !agrupamentoFiltro || item.agrupamento?.toLowerCase().includes(agrupamentoFiltro.toLowerCase());

      const correspondeCodigo =
        !codigoBarraFiltro || item.codigobarra?.includes(codigoBarraFiltro);

      const correspondeUnidade =
        !unidadeFiltro || item.unidadeMedida?.toLowerCase().includes(unidadeFiltro.toLowerCase());

      const precoMinNum = parseFloat(precoMin);
      const precoMaxNum = parseFloat(precoMax);

      const correspondePrecoMin = isNaN(precoMinNum) || preco >= precoMinNum;
      const correspondePrecoMax = isNaN(precoMaxNum) || preco <= precoMaxNum;

      return (
        correspondeBusca &&
        correspondeAgrupamento &&
        correspondeCodigo &&
        correspondeUnidade &&
        correspondePrecoMin &&
        correspondePrecoMax
      );
    });

    setfilter(resultado);
  }, [busca, agrupamentoFiltro, codigoBarraFiltro, unidadeFiltro, precoMin, precoMax, produtos]);


  const lidarComClique = (item: Produto) => {
    if (permitirSelecao) {
      setItemSelecionado({
        ...item,
        casasdecimais: item.casasdecimais ?? '0',
        percentualdesconto: item.percentualdesconto ?? 0,
      });
      setModalVisivel(true);
    }
  };

  const confirmarItem = async (itemConfirmado: {
    id: number;
    codigo: string;
    descricao: string;
    valorUnitario: number;
    valorunitariovenda: number;
    quantidade: number;
    desconto?: number;
    acrescimo?: number;
    total: number;
  }) => {
    const codigoNormalizado = itemConfirmado.codigo.trim().toLowerCase();
    setProdutosAdicionados((produtosAtuais) => {
      const jaExiste = produtosAtuais.includes(codigoNormalizado);
      if (jaExiste) {
        return produtosAtuais.map((codigo) =>
          codigo === codigoNormalizado ? codigoNormalizado : codigo
        );
      } else {
        return [...produtosAtuais, codigoNormalizado];
      }
    });
    setItemSelecionado(null);
    setModalVisivel(false);
  };

  const ItemCard = ({ item }: { item: Produto }) => {
    const [imagemSelecionada, setImagemSelecionada] = useState<string | null>(null);
    const uriImagem = mapaImagens[item.codigo] ?? mapaImagens['sem_imagem'];
    const codigoNormalizado = item.codigo.trim().toLowerCase();
    const foiAdicionado = produtosAdicionados.includes(codigoNormalizado);

const compartilharImagem = async () => {
  try {
    if (!uriImagem) {
      alert('Imagem não disponível para compartilhamento');
      return;
    }

    let caminhoParaCompartilhar: string;

    // Sempre copia/baixa a imagem para cache local
    const nomeArquivo = `${item.codigo}.jpg`;
    const destino = FileSystem.cacheDirectory + nomeArquivo;

    // Se for URL HTTP/HTTPS, baixa
    if (uriImagem.startsWith('http://') || uriImagem.startsWith('https://')) {
      const download = await FileSystem.downloadAsync(uriImagem, destino);
      caminhoParaCompartilhar = download.uri;
    }
    // Se for local, copia para cache
    else {
      await FileSystem.copyAsync({ from: uriImagem, to: destino });
      caminhoParaCompartilhar = destino;
    }

    // Confirma que o arquivo existe
    const fileInfo = await FileSystem.getInfoAsync(caminhoParaCompartilhar);
    if (!fileInfo.exists) {
      alert('Erro: arquivo não encontrado para compartilhamento');
      return;
    }

    const mensagem = `Produto: ${item.descricao}\nCódigo de Barra: ${item.codigobarra || 'Não informado'}`;

    await Share.open({
      title: 'Compartilhar produto',
      message: mensagem,
      url: caminhoParaCompartilhar.startsWith('file://') ? caminhoParaCompartilhar : 'file://' + caminhoParaCompartilhar,
      type: 'image/jpeg',
    });

  } catch (error: any) {
    if (error?.message !== 'User did not share') {
      console.error('Erro ao compartilhar a imagem:', error);
      alert('Erro ao compartilhar a imagem. Tente novamente.');
    }
  }
};

   
    return (
      <View style={[styles.card, foiAdicionado && styles.cardSelecionado]}>
        <View style={styles.item}>
          <Pressable onPress={() => setImagemSelecionada(uriImagem)}>
            <Image source={{ uri: uriImagem }} style={styles.imagem} />
          </Pressable>
          <Pressable onPress={() => lidarComClique(item)}>
            <View style={styles.info}>
              <Text style={styles.nome}>{item.descricao}</Text>
              <View style={styles.linhaDescricao} />
              <Text>📋 Código Barra: {item.codigobarra}</Text>
              <Text>💲 Preço: R$ {(item.valorunitariovenda ?? item.precovenda).toFixed(2)}</Text>
              <Text>📏 Unidade: {item.unidadeMedida}</Text>
              <Text>💼 Comissão: {item.percentualComissao}%</Text>
              <Text>📦 Agrupamento: {item.agrupamento ?? 'Não informado'}</Text>
            </View>
          </Pressable>
        </View>

        <Modal visible={!!imagemSelecionada} transparent animationType="fade">
          <Pressable style={styles.modalContainer} onPress={() => setImagemSelecionada(null)}>
            <Image
              source={{ uri: imagemSelecionada ?? '' }}
              style={styles.imagemGrande}
              resizeMode="contain"
            />
            {/* Botão para compartilhar */}
            <TouchableOpacity
              style={{
                position: 'absolute',
                bottom: 20,
                right: 20,
                backgroundColor: '#25D366',
                padding: 12,
                borderRadius: 50,
                elevation: 5,
              }}
              onPress={compartilharImagem}
            >
              <Ionicons name="share-social" size={28} color="white" />
            </TouchableOpacity>
          </Pressable>
        </Modal>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.buscacontainer}>
        <Ionicons name="search" size={20} color="#5f6368" style={styles.icon} />
        <TextInput
          style={styles.input}
          placeholder="Buscar por nome, código ou agrupamento"
          value={busca}
          onChangeText={setBusca}
        />
        <TouchableOpacity style={styles.botaoFiltro} onPress={() => setFiltroVisivel(true)}>
          <Ionicons name="filter" size={20} color="#5f6368" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={{ padding: 20, alignItems: 'center' }}>
          <Text style={{ color: '#999' }}>Carregando os produtos...</Text>
        </View>
      ) : produtos.length === 0 ? (
        <View style={{ padding: 20, alignItems: 'center' }}>
          <Text style={{ color: 'blue', fontSize: 18 }}>
            Favor sincronizar o sistema.
          </Text>
        </View>
      ) : (
        <FlatList
          data={filter}
          keyExtractor={(item) => `${item.codigo}-${acrescimo}`} 
          renderItem={({ item }) => <ItemCard item={item} />}
          ItemSeparatorComponent={() => <View style={styles.separador} />}
          showsVerticalScrollIndicator
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={5}
          removeClippedSubviews
          getItemLayout={(_, index) => ({
            length: 150,
            offset: 150 * index,
            index,
          })}
        />
      )}

      {modalVisivel && itemSelecionado && exibirModal && (
        <ModalPedidoVenda
          produto={itemSelecionado}
          valorunitariovenda={itemSelecionado.valorunitariovenda ?? itemSelecionado.precovenda}
          casasdecimais={itemSelecionado.casasdecimais ?? '0'} 
          percentualdesconto={itemSelecionado.percentualdesconto}
          visivel={modalVisivel}
          onFechar={() => {
            setModalVisivel(false);
            setItemSelecionado(null);
          }}
          onAdicionarItem={confirmarItem}
          empresa={empresa}
          codigocliente={codigocliente}
          codigovendedor={codigovendedor}
          codigocondPagamento={codigocondPagamento}
          nomecliente={nomecliente}
        />
      )}

      <Modal visible={filtroVisivel} transparent animationType="slide">
      <View style={styles.modalFiltro}>
        <View style={styles.modalContent}>
          <Text style={styles.tituloModal}>🔍 Filtros Avançados</Text>

          <Text style={styles.labelModal}>Agrupamento</Text>
          <TextInput
            style={styles.inputModal}
            placeholder="Agrupamento"
            placeholderTextColor={'#999'}
            value={agrupamentoFiltro}
            onChangeText={setAgrupamentoFiltro}
          />

          <Text style={styles.labelModal}>Código de Barra</Text>
          <TextInput
            style={styles.inputModal}
            placeholder="Código de Barra"
            placeholderTextColor={'#999'}
            value={codigoBarraFiltro}
            onChangeText={setCodigoBarraFiltro}
            keyboardType="numeric"
          />

          <Text style={styles.labelModal}>Unidade de Medida</Text>
          <TextInput
            style={styles.inputModal}
            placeholder="Unidade de Medida"
            placeholderTextColor={'#999'}
            value={unidadeFiltro}
            onChangeText={setUnidadeFiltro}
          />

          <Text style={styles.labelModal}>Faixa de Preço</Text>
          <View style={styles.linhaPreco}>
            <TextInput
              style={[styles.inputModal, { flex: 1, marginRight: 5 }]}
              placeholder="0,00"
              placeholderTextColor={'#999'}
              value={precoMin}
              onChangeText={setPrecoMin}
              keyboardType="numeric"
            />
            <TextInput
              style={[styles.inputModal, { flex: 1, marginLeft: 5 }]}
              placeholder="999.999,99"
              placeholderTextColor={'#999'}
              value={precoMax}
              onChangeText={setPrecoMax}
              keyboardType="numeric"
            />
          </View>

          <View style={styles.botoesModal}>
            <TouchableOpacity style={styles.botaoModal} onPress={() => setFiltroVisivel(false)}>
              <Text style={styles.textoBotaoModal}>Aplicar Filtros</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.botaoModal, { backgroundColor: '#ccc' }]} onPress={() => setFiltroVisivel(false)}>
              <Text style={[styles.textoBotaoModal, { color: '#333' }]}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>

    </View>
  );
}
