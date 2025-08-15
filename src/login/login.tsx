import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Linking,
  Vibration,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import api from '../config/app';
import Configs from '../config/configs';
import styles from './style';
import { salvarTokenCNPJ } from '../config/tokenmanager';
import DatabaseManager from '../database/databasemanager';
//import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncEmpresa } from '../database/sincronizacao';
import { useDatabaseStore } from '../store/databasestore';
import { adicionarValor } from '../scripts/adicionarourecuperar';
import { gerarHashSenhaExpo, validarSenhaExpo } from '../scripts/funcoes';

type Empresa = {
  codigo: string;
  nome: string;
  cnpj?: string;
};

const formatarDocumento = (doc: string) => {
  const clean = doc.replace(/\D/g, '');
  if (clean.length === 11) {
    return clean.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  } else if (clean.length === 14) {
    return clean.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  }
  return doc;
};

export default function Login({ onLoginSuccess }: { onLoginSuccess: (cnpj: string) => void }) {
  const navigation: any = useNavigation();
  const [cpfCnpj, setCpfCnpj] = useState('');
  const [password, setPassword] = useState('');
  const [empresa, setEmpresa] = useState('');
  const [codigoempresa, setEmpresaCodigo] = useState<number>(0);
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [usuarioEncontrado, setUsuarioEncontrado] = useState(false);
  const [erroUsuario, setErroUsuario] = useState('');
  const [erroSenha, setErroSenha] = useState('');
  const [loginError, setLoginError] = useState('');

  async function buscarUsuario(
    cpfCnpj: string,
    setEmpresa: (nome: string) => void,
    setEmpresaCodigo: (codigo: number) => void,
    setCpfCnpj: (cnpj: string) => void,
    setUsuarioEncontrado: (encontrado: boolean) => void,
    setLoading: (loading: boolean) => void
  ): Promise<void> {
    if (!cpfCnpj) return;

    const cnpjLimpo = cpfCnpj.replace(/\D/g, '');
    const documento = formatarDocumento(cpfCnpj);

    try {
      setLoading(true);
      const hash = await salvarTokenCNPJ(cnpjLimpo, Configs.SECRET_KEY);
      console.log('🔐 Hash gerado:', hash);

      const baseExiste = await DatabaseManager.databaseExists(cnpjLimpo);
      let empresaObj: Empresa | null = null;

      if (baseExiste) {
        const baseAtual = useDatabaseStore.getState().baseAtual;
        if (baseAtual !== `${cnpjLimpo}.db`) {
          await DatabaseManager.openDatabase(cnpjLimpo);
        }

        const sync = await useSyncEmpresa();
        const empresas = await sync.ConsultarEmpresa(documento);

        if (empresas && empresas.length > 0) {
          empresaObj = empresas[0];
          console.log('✅ Empresa encontrada localmente.');
        }
      }

      if (!empresaObj) {
        console.log('🌐 Tentando buscar empresa remotamente...');
        const empresaRemota = await buscaRemota(cnpjLimpo);
        if (empresaRemota) {
          empresaObj = empresaRemota;
        } else {
          throw new Error('Empresa não encontrada localmente nem remotamente.');
        }
      }

      if (empresaObj) {
        setEmpresa(empresaObj.nome);
        setEmpresaCodigo(Number(empresaObj.codigo));
        setCpfCnpj(empresaObj.cnpj || cpfCnpj);
        setUsuarioEncontrado(true);
        console.log('✅ Empresa pronta para uso:', empresaObj.nome);
      }
    } catch (error: any) {
      console.log('❌ Erro na busca da empresa:', error.message || error);
      Alert.alert(
        'Empresa não encontrada',
        `Não conseguimos localizar a empresa. Verifique o CNPJ informado: ${documento}`
      );
      setUsuarioEncontrado(false);
    } finally {
      setLoading(false);
    }
  }

  async function buscaRemota(cnpj: string): Promise<Empresa | null> {
    try {
      const response = await api.get(`/empresa/`);
      if (response.data && response.data.cnpj) {
        console.log('🔍 Empresa encontrada via API:', response.data.nome);

        await DatabaseManager.openDatabase(cnpj);
        const sync = await useSyncEmpresa();
        await sync.sincronizarEmpresas();
        await sync.sincronizarUsuarios();
        await sync.sincronizarVendedores();

        return {
          cnpj: response.data.cnpj,
          nome: response.data.nome,
          codigo: response.data.codigo,
        };
      } else {
        console.log('⚠️ API não retornou empresa.');
        return null;
      }
    } catch (error) {
      console.log('❌ Erro na busca remota:', error);
      return null;
    }
  }

  const realizarLogin = async () => {
    // Reset das mensagens
    setErroUsuario('');
    setErroSenha('');
    setLoginError('');  
     

    if (!username.trim()) {
      setErroUsuario('Preencha o usuário!');
      Vibration.vibrate(500);
      setTimeout(() => setErroUsuario(''), 3000);
      return; // não continua
    }

    if (!password.trim()) {
      setErroSenha('Preencha a senha!');
      Vibration.vibrate(500);
      setTimeout(() => setErroSenha(''), 3000);
      return; // não continua
    }

    if (!usuarioEncontrado) {
      setLoginError('Usuário não identificado.');
      Vibration.vibrate(500);
      setTimeout(() => setLoginError(''), 3000);
      return;
    }

    setLoading(true);
    try {
      const { validarUsuarioLocal, sincronizarUsuarios, sincronizarVendedores } = await useSyncEmpresa();
    //  console.log('🔍 Exibe a senha normal:', password);
      
   //   console.log('🔍 Validando usuário local:', username, 'para a empresa:', codigoempresa);
      const resultado = await validarUsuarioLocal(codigoempresa, username.toString());

    //  console.log('🔍 Resultado da senha:', resultado)  ;
      console.log('🔍 Senha digitada:', password);


      // Determina a senha a ser validada
      const senhaParaValidar = (resultado.novaSenha && resultado.novaSenha.trim() !== '')
        ? resultado.novaSenha
        : (resultado.senhaantiga ?? ''); // garante sempre uma string

      // Valida a senha usando a função de hash / comparação
       console.log('🔍 Senha para validar:', senhaParaValidar);
      const senhaCorreta = await validarSenhaExpo(password, senhaParaValidar);

      if (!senhaCorreta) {
        setLoginError('Usuário ou senha inválidos.');
        Vibration.vibrate(500);
        setTimeout(() => setLoginError(''), 3000);
        await sincronizarUsuarios();
        await sincronizarVendedores();
        return; // interrompe o fluxo de login
      }

      console.log('🔍 teste: ', resultado);
      // Se a senha estiver correta, prossegue com o login
      const cnpjLimpo = cpfCnpj.replace(/\D/g, '');
      await adicionarValor('@IDUSER', resultado.id?.toString() || '0');
      await adicionarValor('@CNPJ', cnpjLimpo);
      await adicionarValor('@empresa', codigoempresa.toString());      
      await adicionarValor("@nomeEmpresa", empresa);

      onLoginSuccess(cnpjLimpo);
      navigation.navigate({ name: 'home', params: { cnpj: cnpjLimpo } });
    } catch (error) {
      setLoginError('Erro ao acessar banco local.');
      Vibration.vibrate(500);
      setTimeout(() => setLoginError(''), 3000);
      console.log('Erro ao validar login local:', error);
    } finally {
      setLoading(false);
    }
  };

  const limpar = () => {
    setCpfCnpj('');
    setEmpresa('');
    setEmpresaCodigo(0);
    setUsername('');
    setPassword('');
    setUsuarioEncontrado(false);
    setErroUsuario('');
    setErroSenha('');
    setLoginError('');
  };

  function GerarCatalago(): void {
    const url = 'http://192.168.100.40:8000/';
    Linking.canOpenURL(url)
      .then((supported) => {
        if (supported) Linking.openURL(url);
        else Alert.alert('Erro', 'Não foi possível abrir o link.');
      })
      .catch(() => Alert.alert('Erro', 'Ocorreu um erro ao tentar abrir o link.'));
  }

  const handleBlurBuscar = () => {
    buscarUsuario(cpfCnpj, setEmpresa, setEmpresaCodigo, setCpfCnpj, setUsuarioEncontrado, setLoading);
  };

  return (
    <View style={styles.container}>
      {!usuarioEncontrado ? (
        <>
          <Text style={styles.fraseReflexiva}>
            Uma pessoa erra, todos erram.  
            Se uma pessoa acerta, nem todos estão certos.
          </Text>

          <Text style={styles.label}>CPF ou CNPJ</Text>
          <TextInput
            style={styles.campoDocumento}
            value={cpfCnpj}
            onChangeText={setCpfCnpj}
            keyboardType="numeric"
            placeholder="Digite CPF ou CNPJ"
            onBlur={handleBlurBuscar}
          />
        </>
      ) : (
        <View style={styles.card}>
          <Text style={styles.empresaNome}>{empresa}</Text>
          <Text style={styles.documento}>{formatarDocumento(cpfCnpj)}</Text>
          <TouchableOpacity onPress={limpar}>
            <Text style={styles.trocarTexto}>Novo acesso</Text>
          </TouchableOpacity>
        </View>
      )}

      {usuarioEncontrado && (
        <>
          <Text style={styles.label}>Usuário</Text>
          <TextInput
            style={styles.input}
            autoCorrect={false}
            spellCheck={false}
            autoComplete="off"
            autoCapitalize="none"
            value={username}
            onChangeText={text => setUsername(text.trim())}
            placeholder="Digite o usuário"
          />
          {erroUsuario ? <Text style={{ color: 'red', marginBottom: 4 }}>{erroUsuario}</Text> : null}

          <Text style={styles.label}>Senha</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={text => setPassword(text.trim())}
            secureTextEntry
            placeholder="Digite sua senha"
          />
          {erroSenha ? <Text style={{ color: 'red', marginBottom: 4 }}>{erroSenha}</Text> : null}

          {loginError ? <Text style={{ color: 'red', marginBottom: 8 }}>{loginError}</Text> : null}

          <TouchableOpacity
            style={styles.button}
            onPress={realizarLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Entrar</Text>
            )}
          </TouchableOpacity>

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 }}>
            <TouchableOpacity onPress={() => GerarCatalago()}>
              <Text style={{ color: 'orange', fontWeight: 'bold' }}>Catálogo</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => Linking.openURL('https://servidor-64qt.onrender.com/')}>
              <Text style={{ color: 'blue', fontWeight: 'bold' }}>Cadastrar usuário</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );
}
