import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Image, Animated, Alert } from 'react-native';
import { styles, loadingStyles, overlayStyles } from './style';
import { useSyncEmpresa } from '../database/sincronizacao';
import LottieView from 'lottie-react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { adicionarValor, recuperarValor } from '../scripts/adicionarourecuperar';
import SyncLogPanel from '../logs/logssincronizacao';
import AnimatedMessage from './animatemensage';
import { useNavigation } from '@react-navigation/native';
import { getCatalogoPDF } from '../produto/catalogo';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

type RootStackParamList = {
  home: { cnpj: string };
  listaritens: { formaId: number; permitirSelecao?: boolean; exibirModal?: boolean };
  listarcliente: { selecionarHabilitado: boolean };
  SyncOptions: undefined;
  GerenciarPedidos: undefined;
};

type Props = NativeStackScreenProps<RootStackParamList, 'home'>;

export interface RetryOptions {
  tentativas?: number;
  delay?: number;
  factor?: number;
  jitter?: boolean;
  onRetry?: (tentativa: number, error: any, waitTime: number) => void;
}

export async function retryWithBackoff<T, P = any>(
  fn: (param?: P) => Promise<T>,
  param?: P,
  options: RetryOptions = {}
): Promise<T> {
  const { tentativas = 3, delay = 1000, factor = 2, jitter = true, onRetry } = options;
  let tentativa = 0;
  let currentDelay = delay;

  while (tentativa < tentativas) {
    try {
      return await fn(param);
    } catch (error) {
      tentativa++;
      if (tentativa >= tentativas) throw error;

      let waitTime = currentDelay;
      if (jitter) waitTime = Math.random() * currentDelay;
      if (onRetry) onRetry(tentativa, error, waitTime);

      await new Promise(res => setTimeout(res, waitTime));
      currentDelay *= factor;
    }
  }
  throw new Error('Falha na execução com retry');
}

const LoadingOverlay: React.FC<{ message: string }> = ({ message }) => {
  const [fadeAnim] = useState(new Animated.Value(0));

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, []);

  return (
    <Animated.View style={[loadingStyles.container, { opacity: fadeAnim }]}>
      <LottieView
        source={require('../assets/animations/loading.json')}
        autoPlay
        loop
        style={loadingStyles.animation}
      />
      <Text style={loadingStyles.message}>{message}</Text>
    </Animated.View>
  );
};

const Home: React.FC<Props> = ({ route, navigation }) => {
  const [mensagem, setMensagem] = useState('');
  const [loading, setLoading] = useState(false);
  const [nomeEmpresa, setNomeEmpresa] = useState('Minha Empresa LTDA');
  const [syncLogs, setSyncLogs] = useState<string[]>([]);
  const [showLog, setShowLog] = useState(false);
  const [totaisSincronizacao, setTotaisSincronizacao] = useState<Record<string, any>>({});
  const [semInternet, setSemInternet] = useState(false);

  const navigations = useNavigation<any>();
  const cnpj = route.params?.cnpj || '';

  useEffect(() => {
    async function carregarNomeEmpresa() {
      try {
        const { buscarVendedorDoUsuario } = await useSyncEmpresa();
        const usuarioId = await recuperarValor('@IDUSER');
        const resultado = await buscarVendedorDoUsuario(Number(usuarioId));
        adicionarValor('@CodigoVendedor', resultado!.codigo!.toString());
        adicionarValor('@Vendedor', resultado!.nome!.toString());
        const nome = await recuperarValor('@nomeEmpresa');
        setNomeEmpresa(nome || 'Minha Empresa LTDA');
      } catch (error) {
        console.error('Erro ao recuperar nome da empresa:', error);
        setNomeEmpresa('Minha Empresa LTDA');
      }
    }
    carregarNomeEmpresa();
  }, []);

  function adicionarLog(mensagem: string) {
    setSyncLogs(prev => [...prev, mensagem]);
  }

  async function verificarInternet(): Promise<boolean> {
    try {
      const response = await fetch('https://www.google.com', { method: 'HEAD', cache: 'no-cache' });
      return response.ok;
    } catch {
      return false;
    }
  }

  async function executarSincronizacao<T>(
    nome: string,
    func: () => Promise<T>,
    mensagemLoading: string,
    retry = false
  ): Promise<T> {
    setMensagem(mensagemLoading);
    adicionarLog(`▶️ Iniciando sincronização de ${nome}...`);

    try {
      const resultado = retry ? await retryWithBackoff(func) : await func();

      let totalObj: any = {};
      if (resultado && typeof resultado === 'object' && 'totalProcessados' in resultado) {
        totalObj = resultado as any;
      } else if (typeof resultado === 'number') {
        totalObj = { total: resultado };
      } else {
        totalObj = { total: 0 };
      }

      setTotaisSincronizacao(prev => ({
        ...prev,
        [nome.toLowerCase()]: totalObj
      }));

      adicionarLog(`✅ ${nome} sincronizados com sucesso.`);
      return resultado;
    } catch (error: any) {
      adicionarLog(`❌ Falha na sincronização de ${nome}: ${error?.message || 'Erro desconhecido'}`);
      setMensagem(`Falha ao sincronizar ${nome}.`);
      setLoading(false);
      throw error;
    }
  }

  async function RodarZincronizacao() {
    const conectado = await verificarInternet();
    if (!conectado) {
      setSemInternet(true);
      setTimeout(() => setSemInternet(false), 3000); // desaparece após 3s
      return;
    }

    setLoading(true);
    setMensagem('');
    setSyncLogs([]);
    setShowLog(false);
    setTotaisSincronizacao({});
    setSemInternet(false);

    const {
      sincronizarProdutos,
      sincronizarClientes,
      sincronizarParametros,
      sincronizarCondicoesPagamento,
      sincronizarVendedores,
      sincronizarImagens,
    } = await useSyncEmpresa();

    try {
      await executarSincronizacao('Produtos', async () => {
        const totalProdutos = await sincronizarProdutos();
        adicionarLog(
          `✅ Produtos sincronizados:\n` +
          `🆕 Inseridos: ${totalProdutos.inseridos}\n` +
          `🔄 Atualizados: ${totalProdutos.atualizados}\n` +
          `⏸️ Ignorados: ${totalProdutos.ignorados}\n` +
          `📦 Total no banco: ${totalProdutos.totalNoBanco}`
        );
        return totalProdutos;
      }, 'Cadastro de produtos sincronizando....', true);

      await executarSincronizacao('Clientes', sincronizarClientes, 'Cadastro de clientes sincronizando....', true);
      await executarSincronizacao('Parâmetros', sincronizarParametros, 'Cadastro de parâmetros sincronizando....', false);
      await executarSincronizacao('Formas de Pagamento', sincronizarCondicoesPagamento, 'Cadastro de forma de pgtos sincronizando....', false);
      await executarSincronizacao('Vendedores', sincronizarVendedores, 'Cadastro de vendedores sincronizando....', true);
      await executarSincronizacao('Imagens', sincronizarImagens, 'Imagens estão sincronizando....', false);
    } catch {
      setShowLog(true);
      setLoading(false);
      return;
    }

    setLoading(false);
    setShowLog(true);
  }

  return (
    <View style={styles.container}>
      {!loading && <Text style={styles.mainTitle}>{nomeEmpresa}</Text>}

      {/* Mensagem de sem internet */}
      {semInternet && (
        <View style={{
          position: 'absolute', top: '40%', left: 20, right: 20,
          padding: 20, backgroundColor: '#FFF3F3', borderRadius: 12, alignItems: 'center',
          shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25,
          shadowRadius: 3.84, elevation: 5,
          zIndex: 100
        }}>
          <MaterialCommunityIcons name="wifi-off" size={50} color="#FF4C4C" />
          <Text style={{ marginTop: 10, fontSize: 16, fontWeight: '600', color: '#FF4C4C', textAlign: 'center' }}>
            Sem conexão com a internet
          </Text>
        </View>
      )}

      {loading && (
        <View style={overlayStyles.animatedMessageOverlay}>
          <AnimatedMessage message="Vamos tomar um café? Uma pausa saborosa que faz toda a diferença!" />
        </View>
      )}

      {loading && <LoadingOverlay message={`👉 ${mensagem}`} />}

      {!loading && (
        <>
          <View style={styles.optionsContainer}>
            {/* Seus botões de navegação e sincronização */}
            <TouchableOpacity
              style={styles.option}
              onPress={() => navigation.navigate('listarcliente', { selecionarHabilitado: true })}
            >
              <Image source={require('./../../assets/novo_pedido.png')} style={styles.icon} />
              <Text style={styles.optionText}>Novo Pedido</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.option}
              onPress={() => navigation.navigate('GerenciarPedidos')}
            >
              <Image source={require('./../../assets/gerar_pedidos.png')} style={styles.icon} />
              <Text style={styles.optionText}>Ger. Pedidos</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.option}
              onPress={() => {
                Alert.alert(
                  'Confirmação',
                  'Deseja sincronizar todos os dados de uma vez?',
                  [
                    { text: 'Não', onPress: () => navigations.navigate('SyncOptions'), style: 'cancel' },
                    { text: 'Sim', onPress: RodarZincronizacao },
                  ],
                  { cancelable: false }
                );
              }}
            >
              <Image source={require('./../../assets/Sincronizar_2.png')} style={styles.icon} />
              <Text style={styles.optionText}>Sincronizar</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.option}
              onPress={() =>
                navigation.navigate('listaritens', { formaId: 1, permitirSelecao: false, exibirModal: false })
              }
            >
              <Image source={require('./../../assets/Produtos.png')} style={styles.icon} />
              <Text style={styles.optionText}>Produtos</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.option}
              onPress={async () => await getCatalogoPDF()}
            >
              <Image source={require('./../../assets/catalogo.png')} style={styles.icon} />
              <Text style={styles.optionText}>Abrir Catálogo</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.option}
              onPress={() => navigation.navigate('listarcliente', { selecionarHabilitado: false })}
            >
              <Image source={require('./../../assets/clientes.png')} style={styles.icon} />
              <Text style={styles.optionText}>Clientes</Text>
            </TouchableOpacity>
          </View>

          {showLog && (syncLogs.length > 0 || Object.keys(totaisSincronizacao).length > 0) && (
            <SyncLogPanel
              logs={syncLogs}
              totais={totaisSincronizacao}
              visible={true}
              onClear={() => {
                setSyncLogs([]);
                setTotaisSincronizacao({});
              }}
              onClose={() => setShowLog(false)}
            />
          )}
        </>
      )}
    </View>
  );
};

export default Home;
