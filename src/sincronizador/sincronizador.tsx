import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Animated, Alert } from 'react-native';
import { useSyncEmpresa } from '../database/sincronizacao';
import SyncLogPanel from '../logs/logssincronizacao';
import LottieView from 'lottie-react-native';

interface ProgressoImagens {
  baixadas: number;
  total: number;
}

const LoadingOverlay: React.FC<{ message: string; imagensProgresso?: ProgressoImagens }> = ({ message, imagensProgresso }) => {
  const [fadeAnim] = React.useState(new Animated.Value(0));

  React.useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, []);

  return (
    <Animated.View style={{ 
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'rgba(255,255,255,0.9)',
      opacity: fadeAnim,
      position: 'absolute',
      top: 0, left: 0, right: 0, bottom: 0,
      zIndex: 10,
    }}>
      <LottieView
        source={require('../assets/animations/loading.json')}
        autoPlay
        loop
        style={{ width: 400, height: 400 }}
      />
      <Text style={{ marginTop: 10, fontSize: 16, fontWeight: '600', color: '#007AFF' }}>
        {message}
      </Text>
      {imagensProgresso && (
        <Text style={{ marginTop: 10, fontSize: 16, fontWeight: '600', color: '#007AFF' }}>
          📷 Baixando imagens: {imagensProgresso.baixadas} / {imagensProgresso.total}
        </Text>
      )}
    </Animated.View>
  );
};

const SyncOptions: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [syncLogs, setSyncLogs] = useState<string[]>([]);
  const [totaisSincronizacao, setTotaisSincronizacao] = useState<Record<string, any>>({});
  const [showLog, setShowLog] = useState(false);
  const [imagensProgresso, setImagensProgresso] = useState<ProgressoImagens | undefined>(undefined);

  function adicionarLog(mensagem: string) {
    setSyncLogs(prev => [...prev, String(mensagem)]);
  }

  async function handleSync(type: string) { 
    const {
      sincronizarProdutos,
      sincronizarClientes,
      sincronizarParametros,
      sincronizarCondicoesPagamento,
      sincronizarVendedores,
      sincronizarImagens,
      sincronizarTodosPedidos,
    } = await useSyncEmpresa();

    const confirmAndRun = (titulo: string, mensagem: string, acao: () => Promise<void>) => {
      Alert.alert(
        titulo,
        mensagem,
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Sim', onPress: () => void acao() }
        ],
        { cancelable: true }
      );
    };

    try {
      switch (type) {
        case 'produtos':
          confirmAndRun('Sincronizar produtos?', 'Deseja iniciar a sincronização dos produtos?', async () => {
            setLoading(true);
            setShowLog(false);
            setSyncLogs([]);
            setTotaisSincronizacao({});
            setImagensProgresso(undefined);

            adicionarLog('▶️ Iniciando sincronização de produtos...');

            try {
              const resultado = await sincronizarProdutos();

              const inseridos = resultado?.inseridos ?? 0;
              const atualizados = resultado?.atualizados ?? 0;
              const ignorados = resultado?.ignorados ?? 0;
              const totalProcessados = resultado?.totalProcessados ?? 0;
              const totalNoBancoLocal = resultado?.totalNoBanco ?? (totalProcessados > 0 ? totalProcessados : ignorados);

              adicionarLog(
                `✅ Produtos sincronizados:\n` +
                `📦 Total no banco local: ${String(totalNoBancoLocal)}\n` +
                `🆕 Inseridos: ${String(inseridos)}\n` +
                `🔄 Atualizados: ${String(atualizados)}\n` +
                `❌ Ignorados: ${String(ignorados)}`
              );

              setTotaisSincronizacao(prev => ({
                ...prev,
                produtos: {
                  totalNoBancoLocal,
                  inseridos,
                  atualizados,
                  ignorados,
                }
              }));
            } catch (error: any) {
              adicionarLog(`❌ Falha na sincronização de produtos: ${String(error.message || error)}`);
            } finally {
              setLoading(false);
              setShowLog(true);
            }
          });
          break;

        case 'clientes':
          confirmAndRun('Sincronizar clientes?', 'Deseja iniciar a sincronização dos clientes?', async () => {
            setLoading(true);
            setShowLog(false);
            setSyncLogs([]);
            setTotaisSincronizacao({});
            setImagensProgresso(undefined);

            adicionarLog('▶️ Iniciando sincronização de clientes...');
            try {
              const totalClientes = await sincronizarClientes();
              adicionarLog(`✅ Clientes sincronizados: ${String(totalClientes)}`);
              setTotaisSincronizacao(prev => ({ ...prev, clientes: totalClientes }));
            } catch {
              adicionarLog('❌ Falha na sincronização de clientes.');
            } finally {
              setLoading(false);
              setShowLog(true);
            }
          });
          break;

      case 'parametros':
        confirmAndRun('Sincronizar parâmetros?', 'Deseja iniciar a sincronização dos parâmetros?', async () => {
          setLoading(true);
          setShowLog(false);
          setSyncLogs([]);
          setTotaisSincronizacao({});
          setImagensProgresso(undefined);

          adicionarLog('▶️ Iniciando sincronização dos parâmetros...');
          try {
            const totalParametros = await sincronizarParametros();
            adicionarLog(`✅ Parâmetros sincronizados: ${totalParametros}`);
            setTotaisSincronizacao(prev => ({ ...prev, parametros: totalParametros }));
          } catch {
            adicionarLog('❌ Falha na sincronização dos parâmetros.');
          } finally {
            setLoading(false);
            setShowLog(true);
          }
        });
        break;

      case 'condicoesPagamento':
        confirmAndRun('Sincronizar formas de pagamento?', 'Deseja iniciar a sincronização das formas de pagamento?', async () => {
          setLoading(true);
          setShowLog(false);
          setSyncLogs([]);
          setTotaisSincronizacao({});
          setImagensProgresso(undefined);

          adicionarLog('▶️ Iniciando sincronização da forma de pgto...');
          try {
            const totalCondPagto = await sincronizarCondicoesPagamento();
            adicionarLog(`✅ Forma de pgto sincronizados: ${totalCondPagto}`);
            setTotaisSincronizacao(prev => ({ ...prev, condicoesPagamento: totalCondPagto }));
          } catch {
            adicionarLog('❌ Falha na sincronização da forma de pgto.');
          } finally {
            setLoading(false);
            setShowLog(true);
          }
        });
        break;

      case 'vendedores':
        confirmAndRun('Sincronizar vendedores?', 'Deseja iniciar a sincronização dos vendedores?', async () => {
          setLoading(true);
          setShowLog(false);
          setSyncLogs([]);
          setTotaisSincronizacao({});
          setImagensProgresso(undefined);

          adicionarLog('▶️ Iniciando sincronização de vendedores...');
          try {
            const totalVendedores = await sincronizarVendedores();
            adicionarLog(`✅ Vendedores sincronizados: ${totalVendedores}`);
            setTotaisSincronizacao(prev => ({ ...prev, vendedores: totalVendedores }));
          } catch {
            adicionarLog('❌ Falha na sincronização dos vendedores.');
          } finally {
            setLoading(false);
            setShowLog(true);
          }
        });
        break;

      case 'imagens':
        confirmAndRun('Sincronizar imagens?', 'Deseja iniciar a sincronização das imagens?', async () => {
          setLoading(true);
          setShowLog(false);
          setSyncLogs([]);
          setTotaisSincronizacao({});
          setImagensProgresso({ baixadas: 0, total: 0 });

          adicionarLog('▶️ Iniciando sincronização das imagens...');

          try {
            const inicio = Date.now();

            const { novas, atualizadas, total } = await sincronizarImagens((baixadas: number, total: number) => {
              setImagensProgresso({ baixadas, total });
            });

            const fim = Date.now();
            const duracao = ((fim - inicio) / 1000).toFixed(2);

            adicionarLog(
              `\n📊 Resultado da sincronização:\n` +
              `🆕 Novas: ${novas}, 🔄 Atualizadas: ${atualizadas}, 📦 Total: ${total}\n` +
              `⏱️ Tempo de execução: ${duracao}s`
            );

            setTotaisSincronizacao(prev => ({ ...prev, imagens: { novas, atualizadas, total } }));
          } catch (error: any) {
            adicionarLog(`❌ Falha na sincronização das imagens: ${error.message || error}`);
          } finally {
            setLoading(false);
            setShowLog(true);
            setImagensProgresso(undefined);
          }
        });
        break;

      case 'pedidos':
        confirmAndRun('Sincronizar todos os pedidos?', 'Essa ação pode demorar dependendo da quantidade de pedidos. Deseja continuar?', async () => {
          setLoading(true);
          setShowLog(false);
          setSyncLogs([]);
          setTotaisSincronizacao({});
          setImagensProgresso(undefined);

          adicionarLog('▶️ Iniciando sincronização dos Pedidos...');

          try {
            const { total, erros } = await sincronizarTodosPedidos();

            adicionarLog(`✅ Pedidos sincronizados: ${total}`);
            
            if (erros.length > 0) {
              adicionarLog(`⚠️ Alguns pedidos tiveram falha:`);
              erros.forEach(e => adicionarLog(`   • ${e}`));
            }

            setTotaisSincronizacao(prev => ({ ...prev, pedidos: total }));
          } catch {
            adicionarLog('❌ Falha na sincronização dos pedidos.');
          } finally {
            setLoading(false);
            setShowLog(true);
          }
        });
        break;

      default:
        adicionarLog('⚠️ Tipo de sincronização inválido.');
        break;
    }
  } catch {
    adicionarLog(`❌ Falha na sincronização de ${type}.`);
  }
}


    const buttonColors: Record<string, string> = {    
    produtos: '#00BFFF',
    clientes: '#1E90FF',
    parametros: '#4169E1',
    condicoesPagamento: '#0000FF',
    vendedores: '#0000CD',
    imagens: '#00008B',
    pedidos: '#6809EC',
  };

  const buttonLabels: Record<string, string> = {
    produtos: 'Sincronizar Produtos',
    clientes: 'Sincronizar Clientes',
    parametros: 'Sincronizar Parâmetros',
    condicoesPagamento: 'Sincronizar Condições de pagamento',
    vendedores: 'Sincronizar Vendedores',
    imagens: 'Sincronizar Imagens',
    pedidos: 'Sincronizar Pedidos',
  };

  return (
    <View style={{ flex: 1, padding: 20, backgroundColor: '#fff' }}>
      
      {/* Título Opções de Sincronização */}
      <Text style={{ fontSize: 22, fontWeight: 'bold', marginBottom: 20 }}>
        
      </Text>

      {loading && <LoadingOverlay message="Sincronizando... aguarde um momento." imagensProgresso={imagensProgresso} />}

      {!loading && (
        <ScrollView>
          {Object.keys(buttonColors).map(type => (
            <TouchableOpacity
              key={type}
              style={{
                backgroundColor: buttonColors[type],
                padding: 15,
                marginBottom: 15,
                borderRadius: 8,
              }}
              onPress={() => handleSync(type)}
              disabled={loading}
            >
              <Text
                style={{
                  color: 'white',
                  fontWeight: '600',
                  fontSize: 16,
                  textTransform: 'capitalize',
                  textAlign: 'center',
                }}
              >
                {buttonLabels[type]}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {!loading && showLog && (syncLogs.length > 0 || Object.keys(totaisSincronizacao).length > 0) && (
        <SyncLogPanel
          logs={syncLogs}
          totais={totaisSincronizacao}
          visible={true}
          onClear={() => {
            setSyncLogs([]); 
            setTotaisSincronizacao({}); 
            setShowLog(false);
          }}
          onClose={() => setShowLog(false)}
        />
      )}
    </View>
  );
};

export default SyncOptions;