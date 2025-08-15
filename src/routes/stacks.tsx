import { createNativeStackNavigator } from '@react-navigation/native-stack';
import Login from '../login/login';
import Home from '../home';
// import ListarProdutos from '../produto/produto';
import ListarClientes from '../cliente/cliente';
import ListarPagamento from '../formapagamento/forma';
import ListarItensPedido from '../pedido/listaitenspedido';
import { CarrinhoHeader } from '../pedido/itensdocarrinho';
import PedidoVenda from '../pedido/pedidovenda'
import {RootStackParamList} from '../types/navigationTypes'
import SyncOptions from '../sincronizador/sincronizador'
import GerenciarPedidos from '../gerenciarpedido/gerencial'


// ⚙️ Criação da stack tipada
const Stack = createNativeStackNavigator<RootStackParamList>();

interface RoutesStacksProps {
  onLoginSuccess: (cnpj: string) => void;
}

// 🔧 Wrapper que injeta a função onLoginSuccess no Login
const LoginWrapper: React.FC = () => {
  const handleLoginSuccess = (cnpj: string) => {
    console.log("Login realizado com CNPJ:", cnpj);
    // aqui você pode chamar navegação ou salvar no contexto
  };

  return <Login onLoginSuccess={handleLoginSuccess} />;
};

// 🚀 Exporta a stack com a tipagem aplicada
export default function RoutesStacks({ onLoginSuccess }: RoutesStacksProps) {
  return (
    <Stack.Navigator>
      <Stack.Screen name="login" component={LoginWrapper} options={{freezeOnBlur: true, title: 'LOGIN', headerShown: false,  }} />
      <Stack.Screen name="home"  component={Home}  options={{ headerShown: false, title: 'HOME', }} />
      <Stack.Screen name="listaritens" component={ListarItensPedido} options={({ route }) => ({ freezeOnBlur: true, title: 'PRODUTOS', headerShown: true, 
                                                                                               headerRight: () =>
                                                                                               route.params?.permitirSelecao ? (
                                                                                               <CarrinhoHeader permitirSelecao={true} />
                                                                                                ) : null,
                                                                                             })} />

      <Stack.Screen name="listarcliente" component={ListarClientes} options={{freezeOnBlur: true, title: 'CLIENTES',headerShown: true, }} />
      <Stack.Screen name="listarpagamento" component={ListarPagamento} options={{ freezeOnBlur: true,title: 'FORMA DE PAGAMENTO',headerShown: true, }} />
      <Stack.Screen name="PedidoVenda" component={PedidoVenda}  options={{ freezeOnBlur: true, title: 'PEDIDO', headerShown: true, }} />
      <Stack.Screen name="SyncOptions" component={SyncOptions}  options={{ headerShown: true, title: 'SINCRONIZAR', }} />
      <Stack.Screen name="GerenciarPedidos" component={GerenciarPedidos}  options={{ headerShown: true, title: 'GERENCIAL', }} />
      
    </Stack.Navigator>
  );
}