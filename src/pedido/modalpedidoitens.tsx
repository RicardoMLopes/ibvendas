import React, { useState, useEffect } from 'react';
import { Modal, View, Text, TouchableOpacity, TextInput, Alert, ActivityIndicator } from 'react-native';
import { modalstyles } from './stylespedido';
import { useSyncEmpresa } from '../database/sincronizacao';

interface ModalEditarItemProps {
  visivel: boolean;
  descricaoProduto: string;
  quantidadeInicial: number;
  empresa: number;
  numerodocumento: number;
  codigocliente: string;
  codigoproduto: string;
  casasdecimais?: string | "0" | "1";
  onFechar: () => void;
  onSalvar: (quantidadeAtualizada: number) => void;
  onDeletar: () => void;
}

const ModalEditarItem: React.FC<ModalEditarItemProps> = ({
  visivel,
  descricaoProduto,
  quantidadeInicial,
  empresa,
  numerodocumento,
  codigocliente,
  codigoproduto,
  casasdecimais = "0",
  onFechar,
  onSalvar,
  onDeletar,
}) => {
  const [quantidadeInput, setQuantidadeInput] = useState<string>('');
  const [processando, setProcessando] = useState(false); // novo estado de processamento

  useEffect(() => {
    console.log("Qual o numero:", numerodocumento);
    setQuantidadeInput(formatQuantidadeParaInput(quantidadeInicial));
  }, [quantidadeInicial, casasdecimais]);

  const formatQuantidadeParaInput = (qty: number) => {
    if (casasdecimais === "0") return qty.toFixed(2);
    return qty.toFixed(3);
  };

  const onChangeQuantidadeInput = (text: string) => {
    let valor = text.replace(',', '.');
    if (casasdecimais === "0") {
      valor = valor.replace(/[^0-9]/g, '');
    } else {
      const partes = valor.split('.');
      if (partes.length > 2) valor = partes.shift() + '.' + partes.join('');
      valor = valor.replace(/[^0-9.]/g, '');
    }
    setQuantidadeInput(valor);
  };

  const handleSalvar = async () => {
    let valorNum = parseFloat(quantidadeInput.replace(',', '.'));
    if (isNaN(valorNum) || valorNum < 1) {
      Alert.alert('Quantidade inválida', 'A quantidade deve ser no mínimo 1.');
      return;
    }

    if (casasdecimais === "0") valorNum = Math.floor(valorNum);
    else valorNum = parseFloat(valorNum.toFixed(3));

    setProcessando(true);
    try {
      // chama o callback de salvar
      await onSalvar(valorNum);
     // Alert.alert('Sucesso', 'Item atualizado com sucesso.');
      onFechar();
    } catch (error) {
      console.error(error);
      Alert.alert('Erro', 'Não foi possível salvar o item. Tente novamente.');
    } finally {
      setProcessando(false);
    }
  };

  const alterarQuantidadeEditada = (incremento: number) => {
    let atual = parseFloat(quantidadeInput.replace(',', '.'));
    if (isNaN(atual)) atual = quantidadeInicial;

    let novoValor = atual + incremento;
    if (novoValor < 1) novoValor = 1;

    if (casasdecimais === "0") novoValor = Math.floor(novoValor);
    else novoValor = parseFloat(novoValor.toFixed(3));

    setQuantidadeInput(novoValor.toString());
  };

  const confirmarDeletar = () => {
    Alert.alert(
      'Confirmar exclusão',
      'Deseja realmente deletar este item?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Deletar',
          style: 'destructive',
          onPress: async () => {
            setProcessando(true);
            const { excluirItemPedido } = await useSyncEmpresa();
            try {
              await excluirItemPedido(empresa, numerodocumento, codigocliente, codigoproduto);
              onDeletar();
            } catch (error) {
              console.error(error);
              Alert.alert('Erro', 'Não foi possível deletar o item.');
            } finally {
              setProcessando(false);
            }
          },
        },
      ],
      { cancelable: true }
    );
  };

  return (
    <Modal visible={visivel} transparent animationType="slide">
      <View style={modalstyles.modalOverlay}>
        <View style={modalstyles.modalContaineritem}>
          <Text style={modalstyles.tituloProduto}>{descricaoProduto}</Text>
          <View style={modalstyles.separadormodal} />

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              marginVertical: 15,
            }}
          >
            <TouchableOpacity
              onPress={() => alterarQuantidadeEditada(-1)}
              style={[modalstyles.botaoQuantidade, { marginRight: 15 }]}
              disabled={processando}
            >
              <Text style={[modalstyles.botaoQuantidadeTexto, { color: 'red' }]}>−</Text>
            </TouchableOpacity>

            <TextInput
              style={[modalstyles.inputQuantidadeModal, { textAlign: 'center', minWidth: 80 }]}
              keyboardType="numeric"
              value={quantidadeInput}
              onChangeText={onChangeQuantidadeInput}
              maxLength={casasdecimais === "0" ? 6 : 7}
              placeholder="0"
              editable={!processando}
            />

            <TouchableOpacity
              onPress={() => alterarQuantidadeEditada(1)}
              style={[modalstyles.botaoQuantidade, { marginLeft: 15 }]}
              disabled={processando}
            >
              <Text style={[modalstyles.botaoQuantidadeTexto, { color: 'green' }]}>+</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            onPress={confirmarDeletar}
            style={modalstyles.botaoDeletar}
            disabled={processando}
          >
            {processando ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={modalstyles.textoBotaoDeletar}>Deletar Item</Text>
            )}
          </TouchableOpacity>

          <View style={modalstyles.botoesInferiores}>
            <TouchableOpacity
              onPress={onFechar}
              style={modalstyles.botaoSecundario}
              disabled={processando}
            >
              <Text>Cancelar</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleSalvar}
              style={modalstyles.botaoPrincipal}
              disabled={processando}
            >
              {processando ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={{ color: '#fff' }}>Salvar</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default ModalEditarItem;
