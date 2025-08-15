import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Image, Animated, Alert } from 'react-native';
import { styles, loadingStyles, overlayStyles } from './style'; // seus estilos existentes
import { useSyncEmpresa } from '../database/sincronizacao';
import LottieView from 'lottie-react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { adicionarValor, recuperarValor } from '../scripts/adicionarourecuperar';
import { retryWithBackoff } from '../scripts/funcoes';
import SyncLogPanel from '../logs/logssincronizacao';
import AnimatedMessage from './animatemensage';
import { useNavigation } from '@react-navigation/native';

type RootStackParamList = {
  home: { cnpj: string };
  listaritens: {
    formaId: number;
    permitirSelecao?: boolean;
    exibirModal?: boolean;
  };
  listarcliente: undefined;
  SyncOptions: undefined;
  GerenciarPedidos: undefined;
};

type Props = NativeStackScreenProps<RootStackParamList, 'home'>;

const LoadingOverlay: React.FC<{ message: string }> = ({ message }) => {
  const [fadeAnim] = useState(new Animated.Value(0));

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
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
  const [nomeEmpresa, setNomeEmpresa] = useState('Minha Empresa LTDA'); // fallback
  const [Vendedor, setVendedor] = useState<string | null>(null);
  const [syncLogs, setSyncLogs] = useState<string[]>([]);
  const [showLog, setShowLog] = useState(false);
  const [totaisSincronizacao, setTotaisSincronizacao] = useState<Record<string, any>>({});
  const navigations = useNavigation<any>();

  const { cnpj } = route.params;

  useEffect(() => {
    async function carregarNomeEmpresa() {
      try {
        const {buscarVendedorDoUsuario} = await useSyncEmpresa();
        
        const usuarioId = await recuperarValor('@IDUSER');
      //  console.log('🔍 ID do usuário:', usuarioId);
        const resultado = await buscarVendedorDoUsuario(Number(usuarioId));
        adicionarValor('@CodigoVendedor', resultado!.codigo!.toString());
        adicionarValor('@Vendedor', resultado!.nome!.toString());
        const nome = await recuperarValor('@nomeEmpresa');
        

        if (nome) {
          setNomeEmpresa(nome);
        } else {
          setNomeEmpresa('Minha Empresa LTDA');
        }
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

  // Função auxiliar para rodar cada passo da sincronização com retry opcional e abortar ao erro
  async function executarSincronizacao<T>(
    nome: string,
    func: () => Promise<T>,
    mensagemLoading: string,
    retry = false,
    tentativas = 3,
    delayMs = 1000
  ): Promise<T> {
    try {
      adicionarLog(`▶️ Iniciando sincronização de ${nome}...`);
      setMensagem(mensagemLoading);
      const resultado = retry
        ? await retryWithBackoff(func, tentativas)
        : await func();
      adicionarLog(`✅ ${nome} sincronizados`);
      setTotaisSincronizacao(prev => ({ ...prev, [nome.toLowerCase()]: resultado }));
      return resultado;
    } catch (error) {
      adicionarLog(`❌ Falha na sincronização de ${nome}.`);
      setMensagem(`Falha ao sincronizar ${nome}. Tente novamente mais tarde.`);
      setLoading(false);
      throw error; // aborta a execução da sincronização
    }
  }

  async function RodarZincronizacao() {
    setLoading(true);
    setMensagem('');
    setSyncLogs([]);
    setShowLog(false);
    setTotaisSincronizacao({});

    const {
      sincronizarProdutos,
      sincronizarClientes,
      sincronizarParametros,
      sincronizarCondicoesPagamento,
      sincronizarVendedores,
      sincronizarImagens,
      
    } = await useSyncEmpresa();

    try {
      await executarSincronizacao('Produtos', sincronizarProdutos, 'Cadastro de produtos sincronizando....', true);
      await executarSincronizacao('Clientes', sincronizarClientes, 'Cadastro de clientes sincronizando....', true);
      await executarSincronizacao('Parâmetros', sincronizarParametros, 'Cadastro de parâmetros sincronizando....', false);
      await executarSincronizacao('Formas de Pagamento', sincronizarCondicoesPagamento, 'Cadastro de forma de pgtos sincronizando....', false);
      await executarSincronizacao('Vendedores', sincronizarVendedores, 'Cadastro de vendedores sincronizando....', true);
      await executarSincronizacao('Imagens', sincronizarImagens, 'Imagens estão sincronizando....', false);
    } catch (error) {
      // O erro já foi logado e mensagem setada na função executarSincronizacao
      setLoading(false);
      setShowLog(true);
      return; // interrompe a sincronização
    }

    setLoading(false);
    setShowLog(true);
  }

  return (
    <View style={styles.container}>
      {/* Título da empresa */}
      {!loading && <Text style={styles.mainTitle}>{nomeEmpresa}</Text>}

      {/* Overlay para mensagem animada durante loading */}
      {loading && (
        <View style={overlayStyles.animatedMessageOverlay}>
          <AnimatedMessage message="Vamos tomar um café? Uma pausa saborosa que faz toda a diferença!" />
        </View>
      )}

      {/* Loading animation */}
      {loading && <LoadingOverlay message={`👉 ${mensagem}`} />}

      {/* Botões e painel de logs */}
      {!loading && (
        <>
          <View style={styles.optionsContainer}>
            <TouchableOpacity
              style={styles.option}
              onPress={() => navigation.navigate('listarcliente')}
            >
              <Image source={require('../static/img/logo/novo_pedido.png')} style={styles.icon} />
              <Text style={styles.optionText}>Novo Pedido</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.option}
              onPress={() => navigation.navigate('GerenciarPedidos')}
            >
              <Image source={require('../static/img/logo/gerar_pedidos.png')} style={styles.icon} />
              <Text style={styles.optionText}>Ger. Pedidos</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.option}
              onPress={() => {
                Alert.alert(
                  'Confirmação',
                  'Deseja sincronizar todos os dados de uma vez?',
                  [
                    {
                      text: 'Não',
                      onPress: () => navigations.navigate('SyncOptions'),
                      style: 'cancel',
                    },
                    {
                      text: 'Sim',
                      onPress: RodarZincronizacao,
                    },
                  ],
                  { cancelable: false }
                );
              }}
            >
              <Image source={require('../static/img/logo/Sincronizar_2.png')} style={styles.icon} />
              <Text style={styles.optionText}>Sincronizar</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.option}
              onPress={() =>
                navigation.navigate('listaritens', { formaId: 1, permitirSelecao: false, exibirModal: false })
              }
            >
              <Image source={require('../static/img/logo/Produtos.png')} style={styles.icon} />
              <Text style={styles.optionText}>Produtos</Text>
            </TouchableOpacity>
          </View>

          {/* SyncLogPanel */}
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
