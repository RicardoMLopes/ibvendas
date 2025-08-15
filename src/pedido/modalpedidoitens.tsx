import React, { useState, useEffect } from 'react';
import { Modal, View, Text, TouchableOpacity, TextInput, Alert } from 'react-native';
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

  useEffect(() => {
    setQuantidadeInput(formatQuantidadeParaInput(quantidadeInicial));
  }, [quantidadeInicial, casasdecimais]);

  // Formata para exibir, 2 casas decimais se casasdecimais==="0", senão 3 casas
  const formatQuantidadeParaInput = (qty: number) => {
    if (casasdecimais === "0") return qty.toFixed(2);
    return qty.toFixed(3);
  };

  const onChangeQuantidadeInput = (text: string) => {
    // Sempre converte vírgula para ponto
    let valor = text.replace(',', '.');

    if (casasdecimais === "0") {
      // Permite só dígitos (inteiros), remove tudo que não for número
      // Se digitou ponto (.), remove
      valor = valor.replace(/[^0-9]/g, '');
    } else {
      // Permite números e um único ponto decimal
      const partes = valor.split('.');
      if (partes.length > 2) {
        valor = partes.shift() + '.' + partes.join('');
      }
      valor = valor.replace(/[^0-9.]/g, '');
    }

    setQuantidadeInput(valor);
  };

  const handleSalvar = () => {
    let valorNum = parseFloat(quantidadeInput.replace(',', '.'));
    if (isNaN(valorNum) || valorNum < 1) {
      Alert.alert('Quantidade inválida', 'A quantidade deve ser no mínimo 1.');
      return;
    }

    if (casasdecimais === "0") {
      valorNum = Math.floor(valorNum); // força inteiro
    } else {
      valorNum = parseFloat(valorNum.toFixed(3));
    }

    onSalvar(valorNum);
  };

  const alterarQuantidadeEditada = (incremento: number) => {
    let atual = parseFloat(quantidadeInput.replace(',', '.'));
    if (isNaN(atual)) atual = quantidadeInicial;

    let novoValor = atual + incremento;
    if (novoValor < 1) novoValor = 1;

    if (casasdecimais === "0") {
      novoValor = Math.floor(novoValor);
    } else {
      novoValor = parseFloat(novoValor.toFixed(3));
    }

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
            const { excluirItemPedido } = await useSyncEmpresa();
            try {
              await excluirItemPedido(empresa, numerodocumento, codigocliente, codigoproduto);
              onDeletar();
            } catch (error) {
              Alert.alert('Erro', 'Não foi possível deletar o item.');
              console.error(error);
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
            >
              <Text style={[modalstyles.botaoQuantidadeTexto, { color: 'red' }]}>−</Text>
            </TouchableOpacity>

            <TextInput
              style={[modalstyles.inputQuantidadeModal, { textAlign: 'center', minWidth: 80 }]}
              keyboardType="numeric"
              value={quantidadeInput}
              onChangeText={onChangeQuantidadeInput}
              maxLength={casasdecimais === "0" ? 6 : 7} // tamanho razoável
              placeholder="0"
            />

            <TouchableOpacity
              onPress={() => alterarQuantidadeEditada(1)}
              style={[modalstyles.botaoQuantidade, { marginLeft: 15 }]}
            >
              <Text style={[modalstyles.botaoQuantidadeTexto, { color: 'green' }]}>+</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            onPress={confirmarDeletar}
            style={[modalstyles.botaoDeletar]}
          >
            <Text style={modalstyles.textoBotaoDeletar}>Deletar Item</Text>
          </TouchableOpacity>

          <View style={modalstyles.botoesInferiores}>
            <TouchableOpacity onPress={onFechar} style={modalstyles.botaoSecundario}>
              <Text>Cancelar</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleSalvar}
              style={modalstyles.botaoPrincipal}
            >
              <Text style={{ color: '#fff' }}>Salvar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default ModalEditarItem;
