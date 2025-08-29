import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator
} from 'react-native';
import { useRoute, useNavigation, useFocusEffect } from '@react-navigation/native';
import { styles } from './stylespedido';
import { useSyncEmpresa } from '../database/sincronizacao';
import { recuperarValor } from '../scripts/adicionarourecuperar';
import ModalEditarItem from './modalpedidoitens';
import { EnviarEmail } from '../email/servidoremail';

interface ItemPedido {
  produto: string;
  descricaoproduto: string;
  quantidade: number;
  valorunitario: number;
  valorunitariovenda: number;
  valorDesconto: number;
  valoracrescimo: number;
  valorTotal: number;
  casasdecimais?: string | "0" | "1";
  numerodocumento?: number;
}

interface CabecalhoPedido {
  numerodocumento?: number;
  codigocliente: string;
  nomecliente: string;
  codigovendedor: string;
  nomevendedor: string;
  codigoformaPgto: string;
  valorDesconto: number;
  valorDespesas: number;
  valorFrete: number;
  valorTotal: string;
  Observacao?: string; 
  enviado?: boolean;
}

const TelaPedido: React.FC = () => {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();

  const empresa = route.params?.empresa ?? '';
  const cd_pedido = route.params?.cd_pedido ?? 0;
  const codigocliente = route.params?.codigocliente ?? '';
  const CNPJ = route.params?.cnpj ?? '';

  
//  console.log('📌 TelaPedido aberta com params:', {    cd_pedido,    empresa,    codigocliente  });

  const [itens, setItens] = useState<ItemPedido[]>([]);
  const [cliente, setCliente] = useState('');
  const [vendedor, setVendedor] = useState('');
  const [cabecalho, setCabecalho] = useState<CabecalhoPedido | null>(null);
  const [loading, setLoading] = useState(true);
  const [pedidoEnviado, setPedidoEnviado] = useState(false);

  const [modalObsVisivel, setModalObsVisivel] = useState(false);
  const [modalDescontoVisivel, setModalDescontoVisivel] = useState(false);
  const [observacao, setObservacao] = useState('');
  const [descontoManual, setDescontoManual] = useState(0);

  const [modalEditarVisivel, setModalEditarVisivel] = useState(false);
  const [itemSelecionado, setItemSelecionado] = useState<ItemPedido | null>(null);

  const [modalConfirmacaoVisivel, setModalConfirmacaoVisivel] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [pedidoAtual, setPedidoAtual] = useState<number>(cd_pedido);

  // --------------------- Recarregar Pedido ---------------------
  const recarregarPedido = async () => {
  setLoading(true);
  try {
    const sync = await useSyncEmpresa();
    if (!sync) {
      console.warn('useSyncEmpresa retornou null ou undefined');
      return;
    }

    const pedidocompleto = await sync.carregarPedidoCompleto(empresa, cd_pedido);
    if (!pedidocompleto) {
      console.warn('carregarPedidoCompleto retornou null ou undefined');
      return;
    }

    // Log completo para debug
  //  console.log('Pedido completo carregado:', pedidocompleto);

    // Garantir que numerodocumento do cabeçalho seja número
    const numeroPedidoReal = Number(pedidocompleto.cabecalho?.numerodocumento);
    if (!numeroPedidoReal || numeroPedidoReal === 0) {
      throw new Error('Número do pedido não encontrado ou inválido no cabecalho!');
    }
  //  console.log('NumeroPedidoReal:', numeroPedidoReal);
    setPedidoAtual(numeroPedidoReal);

    // Mapear itens, garantindo numerodocumento consistente
    const itensComNumerodocumentoAtual = (pedidocompleto.itens ?? []).map((item: ItemPedido) => {
      const numerodocumentoItem = Number(item.numerodocumento ?? numeroPedidoReal);
      const quantidade = Number(item.quantidade ?? 0);
      const valorunitariovenda = Number(item.valorunitariovenda ?? 0);
      const valorDesconto = Number(item.valorDesconto ?? 0);
      const valoracrescimo = Number(item.valoracrescimo ?? 0);
      const valorTotal = Number(item.valorTotal ?? (quantidade * valorunitariovenda - valorDesconto + valoracrescimo));

      return {
        ...item,
        numerodocumento: numerodocumentoItem,
        quantidade,
        valorunitariovenda,
        valorDesconto,
        valoracrescimo,
        valorTotal,
        casasdecimais: item.casasdecimais ?? "0"
      };
    });

   // console.log('Itens processados:', itensComNumerodocumentoAtual);

    const cabecalhoAtualizado: CabecalhoPedido = {
      ...pedidocompleto.cabecalho,
      numerodocumento: numeroPedidoReal,
      valorDesconto: Number(pedidocompleto.cabecalho?.valorDesconto ?? 0),
      valorDespesas: Number(pedidocompleto.cabecalho?.valorDespesas ?? 0),
      valorFrete: Number(pedidocompleto.cabecalho?.valorFrete ?? 0),
      valorTotal: String(pedidocompleto.cabecalho?.valorTotal ?? itensComNumerodocumentoAtual.reduce(
        (acc, item) => acc + item.valorTotal, 0))
    };

  //  console.log('Cabecalho atualizado:', cabecalhoAtualizado);

    setCabecalho(cabecalhoAtualizado);
    setCliente(cabecalhoAtualizado.nomecliente ?? '');
    setVendedor(cabecalhoAtualizado.nomevendedor ?? '');
    setItens(itensComNumerodocumentoAtual);
    setObservacao(cabecalhoAtualizado.Observacao ?? '');
    setPedidoEnviado(cabecalhoAtualizado.enviado ?? false);

  } catch (error) {
    console.error('Erro ao recarregar pedido:', error);
    Alert.alert('Erro', 'Não foi possível carregar o pedido. Veja o console para mais detalhes.');
  } finally {
    setLoading(false);
  }
};


  useFocusEffect(
    useCallback(() => {
      recarregarPedido();
    }, [empresa, cd_pedido, codigocliente])
  );

  // --------------------- Cálculos ---------------------
  const totalItens = itens.reduce((acc, item) => acc + item.quantidade * (item.valorunitariovenda ?? 0), 0);
  const totalDesconto = itens.reduce((acc, item) => acc + (item.valorDesconto ?? 0), 0);
  const totalAcrescimo = itens.reduce((acc, item) => acc + (item.valoracrescimo ?? 0), 0);
  const totalFinal = itens.reduce(
    (acc, item) =>
      acc + (item.quantidade * (item.valorunitariovenda ?? 0) - (item.valorDesconto ?? 0) + (item.valoracrescimo ?? 0)),
    0
  );

  const formatQuantidade = (qty: number, casasdecimais?: string | "0" | "1") => {
    const valor = Number(qty ?? 0);
    return casasdecimais === "0" ? valor.toFixed(2) : valor.toFixed(3);
  };

  // --------------------- Modais ---------------------
  const abrirModalEditar = (item: ItemPedido) => {
    setItemSelecionado(item);
    setModalEditarVisivel(true);
  };

  const fecharModalEditar = () => {
    setModalEditarVisivel(false);
    setItemSelecionado(null);
  };

  const salvarItemEditado = async (quantidadeAtualizada: number) => {
    if (!itemSelecionado) return;
    try {
      const sync = await useSyncEmpresa();
      const sucesso = await sync.atualizarPedido(
        empresa,
        itemSelecionado.numerodocumento ?? cabecalho?.numerodocumento ?? pedidoAtual,
        codigocliente,
        itemSelecionado.produto,
        quantidadeAtualizada,
      );
      if (!sucesso) {
        Alert.alert('Erro', 'Falha ao atualizar o pedido.');
        return;
      }
      await recarregarPedido();
      fecharModalEditar();
    } catch (error) {
      await EnviarEmail({
                      to: ['ricardomachadolopes@gmail.com', 'eldovane@gmail.com'], // ✅ lista de strings
                      subject: 'Editar Item',
                      message: 'Erro ao realizar edição do item do pedido',
                      jsonData: {
                        NumeroPedido: itemSelecionado.numerodocumento ?? cabecalho?.numerodocumento ?? pedidoAtual,
                        codigocliente: codigocliente,
                        produto: itemSelecionado.produto,
                        quantidade: quantidadeAtualizada,
                        usuario: await recuperarValor("@usuario"),
                      },  
                    });
      Alert.alert('Erro', 'Não foi possível salvar o item editado.');
    }
  };

  const salvarPedidoRodape = async () => {
    try {
      await recarregarPedido();
    } catch (error) {
      console.error('Erro ao salvar pedido:', error);
      Alert.alert('Erro', 'Ocorreu um erro ao salvar o pedido.');
    }
  };

  const salvarSomente = async () => {
    if (pedidoEnviado) {
      Alert.alert('Aviso', 'Pedido já foi enviado e não pode ser alterado.');
      return;
    }
    setEnviando(true);
    try {
      await salvarPedidoRodape();
      setModalConfirmacaoVisivel(false);
    } catch (error) {
      console.error('Erro ao salvar pedido:', error);
      Alert.alert('Erro', 'Não foi possível salvar o pedido.');
    } finally {
      setEnviando(false);
    }
  };

  const salvarEEnviar = async () => {
    if (pedidoEnviado) {
      Alert.alert('Aviso', 'Pedido já foi enviado e não pode ser alterado.');
      return;
    }
    setEnviando(true);
    try {
      await salvarPedidoRodape();
      const { sincronizarPedidosSelecionados } = await useSyncEmpresa();
      const sucesso = await sincronizarPedidosSelecionados([cabecalho?.numerodocumento ?? pedidoAtual]);
      if (sucesso) {
        setPedidoEnviado(true);
        setModalConfirmacaoVisivel(false);
        const CNPJ = await recuperarValor("@cnpj");
        navigation.reset({index: 0, routes: [{ name: 'home', params: { cnpj: CNPJ } }]});
      } else {
        Alert.alert('Erro', 'Falha ao enviar o pedido. Tente novamente.');
      }
    } catch (error) {
      console.error('Erro ao enviar pedido:', error);
      Alert.alert('Erro', 'Não foi possível enviar o pedido. Tente novamente.');
    } finally {
      setEnviando(false);
    }
  };

  const salvarObservacao = async () => {
    try {
      const sync = await useSyncEmpresa();
      const sucesso = await sync.atualizarObservacao(empresa, pedidoAtual, codigocliente, observacao);
      if (!sucesso) {
        Alert.alert('Erro', 'Falha ao salvar a observação.');
        return;
      }
      setModalObsVisivel(false);
    } catch (error) {
      console.error('Erro ao salvar observação:', error);
      Alert.alert('Erro', 'Não foi possível salvar a observação.');
    }
  };

  const deletarItemComDados = async (produto: string, numerodocumento: number, codigoclienteParam: string) => {
    try {
      const sync = await useSyncEmpresa();
      const CNPJ = await recuperarValor("@cnpj");
      const empresaempy = await recuperarValor("@empresa");
      await sync.excluirItemPedido(Number(empresaempy), numerodocumento, codigoclienteParam, produto);
      await recarregarPedido();
      const temItens = itens.length > 0;
      if (!temItens) {
        Alert.alert(
          'Pedido Cancelado',
          'Todos os itens foram excluídos. O movimento foi cancelado.',
          [
            {
              text: 'OK',
              onPress: () => {
                navigation.reset({
                  index: 0,
                  routes: [{ name: 'home', params: { cnpj: CNPJ } }],
                });
              },
            },
          ],
          { cancelable: false }
        );
      }
    } catch (error) {
      console.error('Erro ao deletar item:', error);
      Alert.alert('Erro', 'Erro ao deletar item.');
    }
  };

  // --------------------- Render ---------------------
  if (loading) {
    return (
      <View style={{ flex:1, justifyContent:'center', alignItems:'center' }}>
        <ActivityIndicator size="large" color="#000" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.cabecalho}>
        <View style={[styles.cabecalhoLinha, { justifyContent: 'flex-start' }]}>
          <Text style={[styles.emoji, { fontSize: 14 }]}>👤</Text>
          <Text style={[styles.infoFixa, { flex: 1, textAlign: 'right' }]}>{cliente}</Text>
        </View>
        <View style={[styles.cabecalhoLinha, { justifyContent: 'flex-start' }]}>
          <Text style={[styles.emoji, { fontSize: 14 }]}>🧑‍💼</Text>
          <Text style={[styles.infoFixa, { flex: 1, textAlign: 'right' }]}>{vendedor}</Text>
        </View>
        <View style={{ marginTop: 2 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={styles.TextTotais}>Total Produtos:</Text>
          <Text style={styles.TextVrTotais}>
            {(totalItens ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={styles.TextTotais}>Total Desconto:</Text>
          <Text style={styles.TextVrTotais}>
            {(totalDesconto ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={styles.TextTotais}>Total Acréscimo:</Text>
          <Text style={styles.TextVrTotais}>
            {(totalAcrescimo ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </Text>
        </View>

        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={styles.TextTotais}>Total Pedido:</Text>
          <Text style={styles.TextVrTotais}>
            {(totalFinal ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </Text>
        </View>
      </View>

        <View style={{ flexDirection: 'row', marginTop: 16 }}>
          <TouchableOpacity onPress={() => setModalObsVisivel(true)} style={[styles.botaoInformarObs, { flex: 1, marginRight: 8 }]}>
            <Text style={styles.TextBottun}>Observação</Text>
          </TouchableOpacity>
          <TouchableOpacity disabled onPress={() => setModalDescontoVisivel(true)} style={[styles.botaoInformarDesc, styles.containerInvisivel, { flex: 1 }]}>
            <Text style={styles.TextBottun}>Desconto</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Lista */}
      <FlatList
        data={itens}
        keyExtractor={(item, index) => `${item.produto}-${index}`}
        renderItem={({ item }) => (
          <TouchableOpacity 
            onPress={() => { if (!pedidoEnviado) {abrirModalEditar(item); } else { Alert.alert("Aviso", "Pedido já foi enviado e não pode mais ser alterado.");}}}
            style={styles.itemPedido}>
            <Text style={{ fontWeight: 'bold' }}>{item.descricaoproduto}</Text>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
              <Text>Quantidade: {formatQuantidade(item.quantidade, item.casasdecimais)}</Text>
              <Text>Valor Unitário: R$ {(item.valorunitariovenda ?? 0).toFixed(2)}</Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
              <Text>Desconto: R$ {(item.valorDesconto ?? 0).toFixed(2)}</Text>
              <Text>Acrescimo: R$ {(item.valoracrescimo ?? 0).toFixed(2)}</Text>
            </View>
            <View style={styles.separador} />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
              <Text style={{ fontWeight: 'bold' }}>Valor Total:</Text>
              <Text style={{ fontWeight: 'bold' }}>R$ {(item.valorTotal ?? 0).toFixed(2)}</Text>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text style={{ textAlign: 'center', marginTop: 16 }}>Nenhum item adicionado</Text>}
        style={{ maxHeight: 4 * 100 + 30 }}
      />

      {/* Rodapé */}
      <View style={styles.rodape}>
        <TouchableOpacity style={styles.botaoCancelar} onPress={() => navigation.navigate({ name: 'home', params: { cnpj: CNPJ } })}>
          <Text style={styles.TextBottun}>Voltar</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.botaoFaturar, pedidoEnviado && { opacity: 0.5 }]}
          onPress={() => {
            if (!pedidoEnviado) setModalConfirmacaoVisivel(true);
            else Alert.alert('Aviso', 'Pedido já foi enviado e não pode ser alterado.');
          }}
          disabled={pedidoEnviado}
        >
          <Text style={styles.TextBottun}>Salvar</Text>
        </TouchableOpacity>
      </View>

      {/* Modal Confirmação */}
      <Modal visible={modalConfirmacaoVisivel} transparent animationType="fade">
        <View style={styles.modalContainer}>
          <View style={[styles.modalBox, { padding: 20 }]}>
            <Text style={[styles.modalTitulo, { marginBottom: 20 }]}>
              O que deseja fazer?
            </Text>

            <TouchableOpacity
              style={[styles.modalBotaoBase, styles.modalBotaoEnviar, { marginBottom: 10 }]}
              onPress={salvarEEnviar}
              disabled={enviando}
            >
              {enviando ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.TextBottun}>Salvar e Enviar</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modalBotaoBase, styles.modalBotaoSalvar]}
              onPress={salvarSomente}
              disabled={enviando}
            >
              {enviando ? (
                <ActivityIndicator color="#000" />
              ) : (
                <Text style={styles.TextBottun}>Somente Salvar</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modalBotaoBase, styles.modalBotaoCancelar, { marginTop: 15 }]}
              onPress={() => setModalConfirmacaoVisivel(false)}
              disabled={enviando}
            >
              <Text style={styles.TextBottun}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal Observação */}
      <Modal visible={modalObsVisivel} transparent animationType="slide">
        <View style={styles.modalContainer}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitulo}>Observação do Pedido:</Text>
            <TextInput
              multiline
              style={styles.modalInputObs}
              value={observacao}
              onChangeText={setObservacao}
              placeholder="Digite a observação..."
            />
            <TouchableOpacity onPress={salvarObservacao} style={styles.botaoModalFechar}>
              <Text style={{fontWeight:"bold",color:"#fff", fontSize:18}}>Salvar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal Desconto */}
      <Modal visible={modalDescontoVisivel} transparent animationType="slide">
        <View style={styles.modalContainer}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitulo}>Desconto:</Text>
            <TextInput
              keyboardType="numeric"
              style={styles.modalInput}
              value={descontoManual.toString()}
              onChangeText={(val) => setDescontoManual(Number(val))}
              placeholder="Informe o desconto"
            />
            <TouchableOpacity onPress={() => setModalDescontoVisivel(false)} style={styles.botaoModalFechar}>
              <Text>Fechar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal Editar Item */}
      {itemSelecionado && codigocliente ? (
        <ModalEditarItem
          visivel={modalEditarVisivel}
          descricaoProduto={itemSelecionado.descricaoproduto}
          quantidadeInicial={itemSelecionado.quantidade}          
          numerodocumento={itemSelecionado.numerodocumento ?? pedidoAtual}

          codigocliente={codigocliente}
          codigoproduto={itemSelecionado.produto}
          empresa={empresa}
          casasdecimais={itemSelecionado.casasdecimais}
          onFechar={fecharModalEditar}
          onSalvar={salvarItemEditado}
          onDeletar={async () => {
            try {
              await deletarItemComDados(itemSelecionado.produto, itemSelecionado.numerodocumento ?? pedidoAtual, codigocliente);
              fecharModalEditar();
            } catch (error) {
              console.error('Erro ao deletar item:', error);
              Alert.alert('Erro', 'Não foi possível deletar o item.');
            }
          }}
        />
      ) : null}
    </View>
  );
};

export default TelaPedido;
