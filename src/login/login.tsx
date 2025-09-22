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
import * as Network from 'expo-network';

import api from '../config/app';
import Configs from '../config/configs';
import styles from './style';
import { salvarTokenCNPJ } from '../config/tokenmanager';
import DatabaseManager from '../database/databasemanager';
import { useSyncEmpresa } from '../database/sincronizacao';
import { useDatabaseStore } from '../store/databasestore';
import { adicionarValor } from '../scripts/adicionarourecuperar';
import { validarSenhaExpo } from '../scripts/funcoes';
import Constants from 'expo-constants';

type Empresa = {
  codigo: string;
  nome: string;
  cnpj?: string;
};

const formatarDocumento = (doc: string) => {
  const clean = doc.replace(/\D/g, '');
  if (clean.length === 11) return clean.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  if (clean.length === 14) return clean.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
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
  const numeroVersao = Constants.expoConfig?.version || '1.0.0';
  const buildNumber = Constants.expoConfig?.ios?.buildNumber || Constants.expoConfig?.android?.versionCode || '1';

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

    setLoading(true);
    try {
      const hash = await salvarTokenCNPJ(cnpjLimpo, Configs.SECRET_KEY);
      console.log('🔐 Hash gerado:', hash);

      const baseExiste = await DatabaseManager.databaseExists(cnpjLimpo);
      let empresaObj: Empresa | null = null;

      if (baseExiste) {
        const baseAtual = useDatabaseStore.getState().baseAtual;
        if (baseAtual !== `${cnpjLimpo}.db`) await DatabaseManager.openDatabase(cnpjLimpo);

        // Cria o objeto sync uma vez
        const sync = await useSyncEmpresa();
        const empresas = await sync.ConsultarEmpresa(documento);

        if (empresas && empresas.length > 0) {
          empresaObj = empresas[0];
          console.log('✅ Empresa encontrada localmente.');

          // Sincronização só se houver internet
          const networkState = await Network.getNetworkStateAsync();
          if (networkState.isConnected && networkState.isInternetReachable) {
            try {
              await sync.sincronizarUsuarios();
              await sync.sincronizarVendedores();
              console.log('✅ Usuários e vendedores sincronizados com a internet.');
            } catch (err) {
              console.log('⚠️ Erro ao sincronizar usuários/vendedores:', err);
            }
          } else {
            console.log('⚠️ Sem internet, sincronização de usuários/vendedores pulada.');
          }

          setEmpresa(empresaObj.nome);
          setEmpresaCodigo(Number(empresaObj.codigo));
          setCpfCnpj(empresaObj.cnpj || cpfCnpj);
          setUsuarioEncontrado(true);
          console.log('✅ Empresa pronta para uso:', empresaObj.nome);
        }
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

  const realizarLogin = async () => {
    setErroUsuario('');
    setErroSenha('');
    setLoginError('');

    if (!username.trim()) {
      setErroUsuario('Preencha o usuário!');
      Vibration.vibrate(500);
      setTimeout(() => setErroUsuario(''), 3000);
      return;
    }

    if (!password.trim()) {
      setErroSenha('Preencha a senha!');
      Vibration.vibrate(500);
      setTimeout(() => setErroSenha(''), 3000);
      return;
    }

    if (!usuarioEncontrado) {
      setLoginError('Usuário não identificado.');
      Vibration.vibrate(500);
      setTimeout(() => setLoginError(''), 3000);
      return;
    }

    setLoading(true);
    try {
      const { validarUsuarioLocal } = await useSyncEmpresa();
      const usuarioUpper = username.trim().toUpperCase();
      const senhaUpper = password.trim().toUpperCase();

      const resultado = await validarUsuarioLocal(codigoempresa, usuarioUpper);
      const senhaParaValidar = resultado.novaSenha?.trim() || resultado.senhaantiga || '';
      const senhaCorreta = await validarSenhaExpo(senhaUpper, senhaParaValidar);

      if (!senhaCorreta) {
        setLoginError('Usuário ou senha inválidos.');
        Vibration.vibrate(500);
        setTimeout(() => setLoginError(''), 3000);
        return;
      }

      const cnpjLimpo = cpfCnpj.replace(/\D/g, '');
      await adicionarValor('@IDUSER', resultado.id?.toString() || '0');
      await adicionarValor('@CNPJ', cnpjLimpo);
      await adicionarValor('@empresa', codigoempresa.toString());
      await adicionarValor('@nomeEmpresa', empresa);
      await adicionarValor('@usuario', usuarioUpper);

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

  const handleBlurBuscar = () => {
    buscarUsuario(cpfCnpj, setEmpresa, setEmpresaCodigo, setCpfCnpj, setUsuarioEncontrado, setLoading);
  };

  return (
    <View style={styles.container}>
      {!usuarioEncontrado ? (
        <>
          <View style={{ alignItems: 'center', marginBottom: 8 }}>
            <Text style={{ fontSize: 12, color: '#888' }}>
             Versão {numeroVersao} (Build {buildNumber})
            </Text>
          </View>
          <Text style={styles.fraseReflexiva}>
            Uma pessoa erra, todos erram.  
            Se uma pessoa acerta, nem todos estão certos.
          </Text>

          <Text style={styles.label}>CPF ou CNPJ</Text>
          <TextInput
            style={styles.campoDocumento}
            value={cpfCnpj}
            onChangeText={(text) => setCpfCnpj(text.replace(/[^0-9]/g, ''))}
            keyboardType="numeric"
            placeholder="Digite CPF ou CNPJ"
            maxLength={14}
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
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Entrar</Text>}
          </TouchableOpacity>

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 }}>
            <TouchableOpacity onPress={() => Linking.openURL('https://smv.inf.br/cadusuarios/')}>
              <Text style={{ color: 'blue', fontWeight: 'bold' }}>Cadastrar usuário</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );
}
