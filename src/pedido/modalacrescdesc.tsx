import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  Pressable,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import styles from './stylesmodalacrescdesc';

type Props = {
  visivel: boolean;
  totalProduto: number;
  percentualMaximoDesconto?: number; // opcional para validação externa
  validarDesconto?: boolean; // opcional para controlar validação
  onFechar: () => void;
  onConfirmar: (dados: {
    tipo: 'desconto' | 'acrescimo';
    forma: 'valor' | 'percentual';
    valor: number;
  }) => void;
};

export default function ModalAcrescDesc({
  visivel,
  totalProduto,
  percentualMaximoDesconto = 100,
  validarDesconto = true,
  onFechar,
  onConfirmar,
}: Props) {
  const [tipo, setTipo] = useState<'desconto' | 'acrescimo'>('desconto');
  const [forma, setForma] = useState<'valor' | 'percentual'>('percentual');

  // valorTexto para controlar texto digitado e evitar travar o campo
  const [valorTexto, setValorTexto] = useState('0,00');
  // valor numérico real para uso interno
  const [valor, setValor] = useState(0);

  // Sincroniza valorTexto com valor numérico inicial (quando abrir modal)
  useEffect(() => {
  const parteInteira = Math.floor(valor);
  const parteDecimal = Math.round((valor - parteInteira) * 100);

  const valorFormatado = `${parteInteira},${parteDecimal.toString().padStart(2, '0')}`;
  setValorTexto(valorFormatado);
}, [visivel]);

  const alterarValor = (delta: number) => {
  setValor((v) => {
    let novo = Math.max(0, Math.round(v + delta)); // Garante inteiro e não-negativo

    // Formata como "1,00", "2,00", etc.
    const valorFormatado = `${novo},00`;
    setValorTexto(valorFormatado);

    return novo;
  });
};

  const validar = () => {
    if (!validarDesconto) return true;

    if (tipo === 'desconto') {
      if (forma === 'percentual') {
        if (valor > percentualMaximoDesconto) {
          alert(
            `O desconto máximo permitido é ${percentualMaximoDesconto.toFixed(
              2,
            )}%.`,
          );
          return false;
        }
      } else if (forma === 'valor') {
        const maxValor = (percentualMaximoDesconto / 100) * totalProduto;
        if (valor > maxValor) {
          alert(`O desconto máximo permitido é R$ ${maxValor.toFixed(2)}.`);
          return false;
        }
      }
    }
    return true;
  };

  const confirmar = () => {
    if (!validar()) return;
    onConfirmar({ tipo, forma, valor });
    onFechar();
  };

  return (
    <Modal visible={visivel} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <View style={styles.headerContainer}>
            <Text style={styles.modalTitle}>Informar Desconto/Acréscimo</Text>
            <View style={styles.separator} />
          </View>

          <View style={styles.checkContainer}>
            <TouchableOpacity
              onPress={() => setTipo('desconto')}
              style={styles.checkItem}
            >
              <Ionicons
                name={tipo === 'desconto' ? 'checkbox' : 'square-outline'}
                size={24}
              />
              <Text>Desconto</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setTipo('acrescimo')}
              style={styles.checkItem}
            >
              <Ionicons
                name={tipo === 'acrescimo' ? 'checkbox' : 'square-outline'}
                size={24}
              />
              <Text>Acréscimo</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.checkContainer}>
            <TouchableOpacity
              onPress={() => setForma('valor')}
              style={styles.checkItem}
            >
              <Ionicons
                name={forma === 'valor' ? 'checkbox' : 'square-outline'}
                size={24}
              />
              <Text>R$ Valor</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setForma('percentual')}
              style={styles.checkItem}
            >
              <Ionicons
                name={forma === 'percentual' ? 'checkbox' : 'square-outline'}
                size={24}
              />
              <Text>% Percentual</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.valorContainer}>
            <TouchableOpacity
              onPress={() => alterarValor(-1)}
              style={styles.btnAlterar}
            >
              <Ionicons name="remove" size={25} color="#ea040bff" />
            </TouchableOpacity>

            <TextInput
              style={styles.valorInput}
              keyboardType="numeric"
              value={valorTexto}
              onChangeText={(text) => {
                // Remove tudo que não for número
                let numeros = text.replace(/\D/g, '');

                // Preenche com zeros à esquerda se necessário
                while (numeros.length < 3) {
                  numeros = '0' + numeros;
                }

                // Separa os centavos
                const parteInteira = numeros.slice(0, -2);
                const parteDecimal = numeros.slice(-2);

                // Formata com vírgula
                const valorFormatado = `${parseInt(parteInteira)},${parteDecimal}`;

                setValorTexto(valorFormatado);

                // Converte para número real
                const valorNumerico = parseFloat(`${parteInteira}.${parteDecimal}`);
                setValor(valorNumerico);
              }}
            />

            <TouchableOpacity
              onPress={() => alterarValor(1)}
              style={styles.btnAlterar}
            >
              <Ionicons name="add" size={25} color="#066931ff" />
            </TouchableOpacity>
          </View>

          <View style={styles.botoesContainer}>
            <Pressable onPress={onFechar} style={styles.botaoCancelar}>
              <Text>Cancelar</Text>
            </Pressable>
            <Pressable onPress={confirmar} style={styles.botaoConfirmar}>
              <Text style={styles.textoBotao}>ADICIONAR</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
