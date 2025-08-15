import React, { useState } from 'react';
import { Modal, View, Text, TextInput, TouchableOpacity, Alert } from 'react-native';
import { modalStyles } from './styles';
import { salvarPedidoDeVenda } from './salvarpedido';
import { recuperarValor } from '../scripts/adicionarourecuperar';
import type { PedidoDeVenda } from '../types/pedidotypes';
import ModalAcrescDesc from '../pedido/modalacrescdesc';

export interface Produto {
  id: number;
  codigo: string;
  descricao: string;
  precovenda: number;
  casasdecimais?: "0" | "1";
  percentualdesconto?: number;
}

interface PedidoModalProps {
  produto: Produto;
  valorunitariovenda: number;
  percentualdesconto?: number;
  casasdecimais?: "0" | "1";
  visivel: boolean;
  onFechar: () => void;
  onAdicionarItem: (item: {
    id: number;
    codigo: string;
    descricao: string;
    valorUnitario: number;
    valorunitariovenda: number;
    quantidade: number;
    desconto?: number;
    valoracrescimo?: number;
    total: number;
  }) => void;
  empresa: number;
  codigocondPagamento: string;
  codigovendedor: string;
  codigocliente: string;
  nomecliente: string;
}

const ModalPedidoVenda: React.FC<PedidoModalProps> = ({
  produto,
  valorunitariovenda,
  percentualdesconto = 0,
  casasdecimais = '0',
  visivel,
  onFechar,
  onAdicionarItem,
  empresa,
  codigovendedor,
  codigocliente,
  nomecliente,
}) => {
  const [quantidade, setQuantidade] = useState(1);
  const [modalAcrescVisible, setModalAcrescVisible] = useState(false);
  const [dadosAcrescDesc, setDadosAcrescDesc] = useState<{
    tipo: 'desconto' | 'acrescimo';
    forma: 'valor' | 'percentual';
    valor: number;
  } | null>(null);

  const valorBase = quantidade * valorunitariovenda;

  function validarDesconto(): boolean {
    if (!dadosAcrescDesc || dadosAcrescDesc.tipo !== 'desconto') return true;

    const { forma, valor } = dadosAcrescDesc;
    if (forma === 'percentual') {
      if (valor > percentualdesconto) {
        Alert.alert(
          'Desconto inválido',
          `O desconto máximo permitido é ${percentualdesconto.toFixed(2)}%.`
        );
        return false;
      }
    } else if (forma === 'valor') {
      const valorMaximo = (percentualdesconto / 100) * valorBase;
      if (valor > valorMaximo) {
        Alert.alert(
          'Desconto inválido',
          `O desconto máximo permitido é R$ ${valorMaximo.toFixed(2)}.`
        );
        return false;
      }
    }
    return true;
  }

  const valorTotal = (() => {
    if (!dadosAcrescDesc) return valorBase;

    const { tipo, forma, valor } = dadosAcrescDesc;
    const valorCalculado = forma === 'percentual' ? (valor / 100) * valorBase : valor;

    return tipo === 'desconto' ? valorBase - valorCalculado : valorBase + valorCalculado;
  })();

  const adicionarItem = async () => {
    if (!validarDesconto()) return;

    // Recupera valores async
    const empresaStr = await recuperarValor('@empresa');
    const formaPagamento = await recuperarValor('@forma');
    const clienteStr = await recuperarValor('@cliente');
    const nomeRec = await recuperarValor('@nomecliente');
    const codVendedorRec = await recuperarValor('@codigovendedor');

    // Valores finais
    const empresaRec = empresaStr ? parseInt(empresaStr, 10) : empresa;
    const condPagamentoRec = formaPagamento ?? '';
    const clienteRec = clienteStr ?? codigocliente;
    const nomeclienteRec = nomeRec ?? nomecliente;
    const codigovendedorFinal = codVendedorRec ?? codigovendedor;

    const { tipo, forma, valor } = dadosAcrescDesc || {
      tipo: 'desconto',
      forma: 'valor',
      valor: 0,
    };

    const valorCalculado = forma === 'percentual' ? (valor / 100) * valorBase : valor;

    const item = {
      id: produto.id,
      codigo: produto.codigo,
      descricao: produto.descricao,
      valorUnitario: produto.precovenda,
      valorunitariovenda,
      quantidade,
      desconto: tipo === 'desconto' ? valorCalculado : 0,
      valoracrescimo: tipo === 'acrescimo' ? valorCalculado : 0,
      total: parseFloat(valorTotal.toFixed(2)),
    };

    onAdicionarItem(item);
    onFechar();

    const pedido: PedidoDeVenda = {
      empresa: empresaRec,
      numerodocumento: 0,
      codigocondpagamento: condPagamentoRec,
      codigovendedor: codigovendedorFinal,
      codigocliente: clienteRec,
      nomecliente: nomeclienteRec,
      valortotal: item.total,
      dataregistro: new Date().toISOString(),
      status: 'P',
      itens: [
        {
          codigoproduto: String(item.codigo),
          descricaoproduto: item.descricao || 'Descrição padrão',
          valorunitario: item.valorUnitario,
          valorunitariovenda: item.valorunitariovenda,
          valortotal: item.total,
          quantidade: item.quantidade,
          valordesconto: item.desconto,
          valoracrescimo: item.valoracrescimo,
          codigocliente: clienteRec,
        },
      ],
    };

    await salvarPedidoDeVenda(pedido);
  };

  return (
    <Modal visible={visivel} transparent animationType="fade">
      <View style={modalStyles.modalContainer}>
        <Text style={modalStyles.tituloProduto}>{produto.descricao}</Text>
        <Text style={modalStyles.valorUnitario}>
          R$ {valorunitariovenda.toFixed(2)}
        </Text>

        <Text style={{ textAlign: 'center', marginBottom: 8, color: '#888' }}>
          Desconto máximo permitido: {percentualdesconto.toFixed(2)}%
        </Text>

        <View style={modalStyles.quantidadeContainer}>
          <TouchableOpacity
            onPress={() => setQuantidade(q => Math.max(1, q - 1))}
          >
            <Text style={modalStyles.botaoQuantidade}>−</Text>
          </TouchableOpacity>

          <TextInput
            style={modalStyles.inputQuantidade}
            keyboardType="numeric"
            value={
              casasdecimais === '0'
                ? String(Math.floor(quantidade))
                : quantidade.toString()
            }
            onChangeText={(text) => {
              let valorLimpo = text.replace(',', '.').replace(/[^0-9.]/g, '');
              if (casasdecimais === '0') {
                const inteiro = parseInt(valorLimpo, 10);
                setQuantidade(!isNaN(inteiro) && inteiro >= 1 ? inteiro : 1);
              } else {
                if (valorLimpo.includes('.')) {
                  const [int, dec] = valorLimpo.split('.');
                  valorLimpo = int + '.' + dec.slice(0, 3);
                }
                const decimal = parseFloat(valorLimpo);
                setQuantidade(!isNaN(decimal) && decimal >= 0 ? decimal : 0);
              }
            }}
          />

          <TouchableOpacity onPress={() => setQuantidade(q => q + 1)}>
            <Text style={modalStyles.botaoQuantidade}>+</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={modalStyles.botaoAjuste}
          onPress={() => setModalAcrescVisible(true)}
        >
          <Text style={modalStyles.textoBotao}>Informar acrec/desc</Text>
        </TouchableOpacity>

        <Text style={modalStyles.total}>Total R$ {valorTotal.toFixed(2)}</Text>

        <View style={modalStyles.botoes}>
          <TouchableOpacity onPress={onFechar} style={modalStyles.botaoSecundario}>
            <Text>Fechar</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={adicionarItem} style={modalStyles.botaoPrincipal}>
            <Text>Adicionar item</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ModalAcrescDesc
        visivel={modalAcrescVisible}
        totalProduto={valorBase}
        percentualMaximoDesconto={percentualdesconto}
        validarDesconto={false}
        onFechar={() => setModalAcrescVisible(false)}
        onConfirmar={(dados) => {
          setDadosAcrescDesc(dados);
          setModalAcrescVisible(false);
        }}
      />
    </Modal>
  );
};

export default ModalPedidoVenda;
