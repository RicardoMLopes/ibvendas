import * as Sharing from 'expo-sharing';
import RNFS from 'react-native-fs';
import { Alert } from 'react-native';
import { getCaminhoImagens } from '../scripts/criarpasta';

export async function getCatalogoPDF() {
  try {
    console.log('🔹 Iniciando compartilhamento do catálogo...');

    const pastaImagens = await getCaminhoImagens();
    console.log('📂 Caminho da pasta de imagens:', pastaImagens);

    const caminhoPdf = `${pastaImagens}/catalogo.pdf`;
    console.log('📄 Caminho esperado do PDF:', caminhoPdf);

    const existe = await RNFS.exists(caminhoPdf);
    console.log('✅ PDF existe?', existe);

    if (!existe) {
      Alert.alert(
        'Catálogo não encontrado',
        'Realize a sincronização das imagens para gerar o catálogo.'
      );
      return;
    }

    // Expo Sharing precisa do prefixo file://
    const uri = `file://${caminhoPdf}`;
    console.log('🔗 URI final para compartilhar:', uri);

    const podeCompartilhar = await Sharing.isAvailableAsync();
    console.log('📤 Compartilhamento disponível?', podeCompartilhar);

    if (!podeCompartilhar) {
      Alert.alert('PDF disponível', `O catálogo está em: ${uri}`);
      return;
    }

    console.log('🚀 Abrindo compartilhamento...');
    await Sharing.shareAsync(uri);
    console.log('✅ Compartilhamento concluído!');
  } catch (error) {
    console.error('❌ Erro ao abrir catálogo:', error);
    Alert.alert('Erro', 'Ocorreu um erro ao acessar o catálogo.');
  }
}
