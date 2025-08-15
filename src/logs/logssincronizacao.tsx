import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Dimensions } from 'react-native';

type TotaisSincronizacao = {
  [key: string]: {
    inseridos?: number;
    atualizados?: number;
    ignorados?: number;
    totalProcessados?: number;
    total?: number; // para imagens ou outros casos
  };
};

type Props = {
  logs: string[];
  totais?: TotaisSincronizacao;
  visible: boolean;
  onClear: () => void;
  onClose: () => void;
};

const SyncLogPanel: React.FC<Props> = ({ logs, totais = {}, visible, onClear, onClose }) => {
  if (!visible) return null;

  const { height } = Dimensions.get('window');
  const painelHeight = Math.min(380, height * 0.65);

  const LinhaTotal = ({ descricao, valor }: { descricao: string; valor: number | string }) => (
    <View style={styles.linhaTotal}>
      <Text style={styles.totalDescricao}>{descricao}</Text>
      <Text style={styles.totalValor}>{valor}</Text>
    </View>
  );

  return (
    <View style={styles.overlay}>
      <View style={[styles.logContainer, { maxHeight: painelHeight, marginTop: 280 }]}>
        <Text style={styles.logTitle}>Resumo da Sincronização</Text>

        <View style={styles.separador} />

        {/* Totais sincronizados */}
        <ScrollView style={styles.totaisContainer} nestedScrollEnabled>
          {Object.entries(totais).length === 0 && (
            <Text style={styles.semDadosText}>Nenhum dado de totais disponível.</Text>
          )}
          {Object.entries(totais).map(([chave, dados]) => (
            <View key={chave} style={styles.totaisBloco}>
              <Text style={styles.totaisTitulo}>
                {chave.charAt(0).toUpperCase() + chave.slice(1).replace(/([A-Z])/g, ' $1')}
              </Text>
              {dados.inseridos !== undefined && <LinhaTotal descricao="Inseridos:" valor={dados.inseridos} />}
              {dados.atualizados !== undefined && <LinhaTotal descricao="Atualizados:" valor={dados.atualizados} />}
              {dados.ignorados !== undefined && <LinhaTotal descricao="Ignorados:" valor={dados.ignorados} />}
              {(dados.totalProcessados !== undefined || dados.total !== undefined) && (
                <LinhaTotal descricao="Total:" valor={dados.totalProcessados ?? dados.total ?? 0} />
              )}
            </View>
          ))}
        </ScrollView>

        <View style={styles.separador} />

        {/* Logs de texto */}
        <Text style={styles.logTitle}>Logs da Sincronização</Text>
        <ScrollView style={styles.logMessagesContainer} nestedScrollEnabled>
          {logs.length === 0 && <Text style={styles.semDadosText}>Nenhum log disponível.</Text>}
          {logs.map((msg, index) => (
            <Text key={index} style={styles.logMessage}>
              {msg}
            </Text>
          ))}
        </ScrollView>

        <View style={styles.logButtonsContainer}>
          {/* Caso queira ativar botão limpar */}
          {/* <TouchableOpacity onPress={onClear} style={[styles.logButton, styles.clearButton]}>
            <Text style={styles.logButtonText}>Limpar</Text>
          </TouchableOpacity> */}
          <TouchableOpacity onPress={onClose} style={styles.logButton}>
            <Text style={styles.logButtonText}>Fechar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)', // fundo escuro em toda a tela
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,

  },
  logContainer: {
    width: '100%',
    maxWidth: 420,
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 10,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
    flexShrink: 1,
  },
  logTitle: {
    fontWeight: '700',
    fontSize: 18,
    marginBottom: 8,
    color: '#222',
  },
  separador: {
    height: 1,
    backgroundColor: '#ddd',
    marginVertical: 8,
  },
  totaisContainer: {
    flexGrow: 0,
    flexShrink: 1,
    maxHeight: 150,
    marginBottom: 10,
  },
  totaisBloco: {
    marginBottom: 10,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  totaisTitulo: {
    fontWeight: '700',
    fontSize: 15,
    marginBottom: 5,
    color: '#444',
  },
  linhaTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  totalDescricao: {
    fontSize: 14,
    color: '#555',
  },
  totalValor: {
    fontSize: 14,
    fontWeight: '700',
    color: '#000',
  },
  logMessagesContainer: {
    flexGrow: 1,
    flexShrink: 1,
    maxHeight: 120,
    backgroundColor: '#f9f9f9',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginBottom: 12,
  },
  logMessage: {
    fontSize: 13,
    marginVertical: 2,
    color: '#333',
  },
  semDadosText: {
    fontStyle: 'italic',
    color: '#999',
    fontSize: 13,
    paddingHorizontal: 6,
  },
  logButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingBottom: 8,
  },
  logButton: {
    marginLeft: 12,
    paddingVertical: 8,
    paddingHorizontal: 18,
    backgroundColor: '#007AFF',
    borderRadius: 6,
  },
  logButtonText: {
    color: 'white',
    fontWeight: '700',
    fontSize: 15,
  },
  clearButton: {
    backgroundColor: '#d9534f',
  },
});

export default SyncLogPanel;
