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
            {pedido ? `Pedido de ${pedido.nomecliente}` : 'Pedido'}
          </Text>

          <View style={styles.modalBotoes}>
            <TouchableOpacity
              style={[styles.botao, { backgroundColor: '#ccc' }]}
              onPress={onClose}
            >
              <Text>Sair</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.botao, { backgroundColor: '#28a745' }]}
              onPress={() => {
                if (pedido) onEnviar(pedido);
              }}
            >
              <Text style={{ color: '#fff' }}>Enviar</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.botao, { backgroundColor: '#007bff' }]}
              onPress={() => {
                if (pedido) onGerarPDF(pedido);
              }}
            >
              <Text style={{ color: '#fff' }}>Enviar PDF</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
