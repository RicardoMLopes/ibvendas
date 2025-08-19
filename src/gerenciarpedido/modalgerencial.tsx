import React from 'react';
import styles from './stylesmodal';
import { Modal, View, Text, TouchableOpacity } from 'react-native';
import type { PedidoDeVenda } from '../types/pedidotypes'; // ajuste o caminho conforme seu projeto

type ModalPedidoAcoesProps = {
  visible: boolean;
  pedido: PedidoDeVenda | null;
  onClose: () => void;
  onEnviar: (pedido: PedidoDeVenda) => void;
  onGerarPDF: (pedido: PedidoDeVenda) => void;
};

export default function ModalPedidoAcoes({
  visible,
  pedido,
  onClose,
  onEnviar,
  onGerarPDF,
}: ModalPedidoAcoesProps) {
  if (!pedido) return null;

  const podeEnviar = pedido.status === 'P'; // só pode enviar se for pendente

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalFundo}>
        <View style={styles.modalContainer}>
          <Text style={styles.modalTitulo}>
            Pedido de {pedido.nomecliente}
          </Text>

          <View style={styles.modalBotoes}>
            <TouchableOpacity
              style={[styles.botao, { backgroundColor: '#ccc' }]}
              onPress={onClose}
            >
              <Text>Sair</Text>
            </TouchableOpacity>

            {podeEnviar && (
              <TouchableOpacity
                style={[styles.botao, { backgroundColor: '#28a745' }]}
                onPress={() => onEnviar(pedido)}
              >
                <Text style={{ color: '#fff' }}>Enviar</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.botao, { backgroundColor: '#007bff' }]}
              onPress={() => onGerarPDF(pedido)}
            >
              <Text style={{ color: '#fff' }}>Gerar PDF</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
