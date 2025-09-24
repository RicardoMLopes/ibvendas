import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Vibration,
  Linking,
  Modal,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import * as Network from 'expo-network';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';

import api from '../config/app';
import Configs from '../config/configs';
import styles from './style';
import DatabaseManager from '../database/databasemanager';
import { useSyncEmpresa } from '../database/sincronizacao';
import { useDatabaseStore } from '../store/databasestore';
import { adicionarValor, recuperarValor } from '../scripts/adicionarourecuperar';
import { validarSenhaExpo } from '../scripts/funcoes';

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

// Modal de sem internet
function NoInternetModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  return (
    <Modal transparent visible={visible} animationType="fade">
      <View style={{ flex:1, justifyContent:'center', alignItems:'center', backgroundColor:'rgba(0,0,0,0.5)' }}>
        <View style={{ width:'80%', backgroundColor:'#fff', borderRadius:12, padding:20, alignItems:'center' }}>
          <Ionicons name="cloud-offline-outline" size={48} color="red" />
          <Text style={{ fontSize:18, fontWeight:'bold', marginVertical:10 }}>Sem conexão</Text>
          <Text style={{ textAlign:'center', marginBottom:20 }}>
            Internet necessária para primeiro acesso. Por favor, conecte-se à rede.
          </Text>
          <TouchableOpacity
            style={{ backgroundColor:'#007bff', paddingHorizontal:20, paddingVertical:10, borderRadius:8 }}
            onPress={onClose}
          >
            <Text style={{ color:'#fff', fontWeight:'bold' }}>Fechar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

export default function Login({ onLoginSuccess }: { onLoginSuccess: (cnpj: string) => void }) {
  const navigation: any = useNavigation();

  const [cpfCnpj, setCpfCnpj] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [empresa, setEmpresa] = useState('');
  const [codigoempresa, setEmpresaCodigo] = useState<number>(0);
  const [usuarioEncontrado, setUsuarioEncontrado] = useState(false);
  const [loading, setLoading] = useState(false);
  const [erroUsuario, setErroUsuario] = useState('');
  const [erroSenha, setErroSenha] = useState('');
  const [loginError, setLoginError] = useState('');
  const [noInternetVisible, setNoInternetVisible] = useState(false);

  const numeroVersao = Constants.expoConfig?.version || '1.0.0';
  const buildNumber = Constants.expoConfig?.ios?.buildNumber || Constants.expoConfig?.android?.versionCode || '1';

  // === LOGIN AUTOMÁTICO AO ABRIR O APP ===
 useEffect(() => {
  async function checkLogin() {
    setLoading(true);
    try {
      const savedCnpj = await recuperarValor('@CNPJ');
      const savedUser = await recuperarValor('@usuario');

      if (savedCnpj && savedUser) {
        // ABRIR BANCO ANTES DE USAR
        const baseExiste = await DatabaseManager.databaseExists(savedCnpj);
        if (baseExiste) {
          const baseAtual = useDatabaseStore.getState().baseAtual;
          if (baseAtual !== `${savedCnpj}.db`) {
            await DatabaseManager.openDatabase(savedCnpj);
          }
        } else {
          console.log('⚠️ Banco não existe. Usuário precisa logar primeiro online.');
          return;
        }

        const savedEmpresa = await recuperarValor('@nomeEmpresa');
        const savedCodigo = await recuperarValor('@empresa');

        setCpfCnpj(savedCnpj);
        setEmpresa(savedEmpresa || '');
        setEmpresaCodigo(Number(savedCodigo || 0));
        setUsername(savedUser);
        setUsuarioEncontrado(true);

        onLoginSuccess(savedCnpj);
        navigation.navigate({ name: 'home', params: { cnpj: savedCnpj } });
      }
    } catch (err) {
      console.log('Erro login automático:', err);
    } finally {
      setLoading(false);
    }
  }
  checkLogin();
}, []);


  // === BUSCA EMPRESA ===
  async function buscarUsuario(
    cpfCnpj: string,
    setEmpresa: (nome: string) => void,
    setEmpresaCodigo: (codigo: number) => void,
    setCpfCnpj: (cnpj: string) => void,
    setUsuarioEncontrado: (encontrado: boolean) => void,
    setLoading: (loading: boolean) => void
  ) {
    if (!cpfCnpj) return;

    const cnpjLimpo = cpfCnpj.replace(/\D/g, '');
    const documento = formatarDocumento(cpfCnpj);

    setLoading(true);
    try {
      const baseExiste = await DatabaseManager.databaseExists(cnpjLimpo);
      let empresaObj: Empresa | null = null;

      const networkState = await Network.getNetworkStateAsync();

      if (baseExiste) {
        const baseAtual = useDatabaseStore.getState().baseAtual;
        if (baseAtual !== `${cnpjLimpo}.db`) await DatabaseManager.openDatabase(cnpjLimpo);

        const sync = await useSyncEmpresa();
        const empresas = await sync.ConsultarEmpresa(documento);

        if (empresas && empresas.length > 0) {
          empresaObj = empresas[0];
          console.log('✅ Empresa encontrada localmente.');
          if (networkState.isConnected && networkState.isInternetReachable) {
            try {
              await sync.sincronizarUsuarios();
              await sync.sincronizarVendedores();
            } catch (err) {
              console.log('⚠️ Erro sincronizando usuários/vendedores:', err);
            }
          }
        }
      }

      if (!baseExiste) {
        if (!networkState.isConnected || !networkState.isInternetReachable) {
          setNoInternetVisible(true);
          return;
        }
        await DatabaseManager.openDatabase(cnpjLimpo);

        const empresaRemota = await buscaRemota(cnpjLimpo);
        if (!empresaRemota) throw new Error('Empresa não encontrada remotamente.');
        empresaObj = empresaRemota;
      }

      if (empresaObj) {
        setEmpresa(empresaObj.nome);
        setEmpresaCodigo(Number(empresaObj.codigo));
        setCpfCnpj(empresaObj.cnpj || cpfCnpj);
        setUsuarioEncontrado(true);
      }
    } catch (error: any) {
      console.log('❌ Erro na busca da empresa:', error.message || error);
      setUsuarioEncontrado(false);
    } finally {
      setLoading(false);
    }
  }

  async function buscaRemota(cnpj: string): Promise<Empresa | null> {
    try {
      const response = await api.get(`/empresa/`);
      if (response.data && response.data.cnpj) {
        const sync = await useSyncEmpresa();
        await sync.sincronizarEmpresas();
        await sync.sincronizarUsuarios();
        await sync.sincronizarVendedores();
        return { cnpj: response.data.cnpj, nome: response.data.nome, codigo: response.data.codigo };
      }
      return null;
    } catch (error) {
      console.log('❌ Erro na busca remota:', error);
      return null;
    }
  }

  const handleBlurBuscar = () => {
    buscarUsuario(cpfCnpj, setEmpresa, setEmpresaCodigo, setCpfCnpj, setUsuarioEncontrado, setLoading);
  };

  // === REALIZAR LOGIN ===
  const realizarLogin = async () => {
    setErroUsuario(''); setErroSenha(''); setLoginError('');

    if (!username.trim()) { setErroUsuario('Preencha o usuário!'); Vibration.vibrate(500); return; }
    if (!password.trim()) { setErroSenha('Preencha a senha!'); Vibration.vibrate(500); return; }
    if (!usuarioEncontrado) { setLoginError('Usuário não identificado.'); Vibration.vibrate(500); return; }

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
        return;
      }

      const cnpjLimpo = cpfCnpj.replace(/\D/g, '');

      // === SALVAR LOGIN PERMANENTE ===
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
      console.log('Erro login:', error);
    } finally { setLoading(false); }
  };

  const limpar = () => {
    setCpfCnpj(''); setEmpresa(''); setEmpresaCodigo(0);
    setUsername(''); setPassword('');
    setUsuarioEncontrado(false); setErroUsuario(''); setErroSenha(''); setLoginError('');
  };

  // === RENDER ===
  if (loading) {
    return (
      <View style={{ flex:1, justifyContent:'center', alignItems:'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <NoInternetModal visible={noInternetVisible} onClose={() => setNoInternetVisible(false)} />

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

          <TouchableOpacity style={styles.button} onPress={realizarLogin} disabled={loading}>
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
