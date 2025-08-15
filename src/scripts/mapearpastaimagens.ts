import RNFS from 'react-native-fs';

type ImagemMapeada = {
  [idImagem: string]: string;
};

export async function mapearImagensDaPasta(pasta: string): Promise<ImagemMapeada> {
  const mapeamento: ImagemMapeada = {};

  try {
    const existe = await RNFS.exists(pasta);

    if (!existe) {
      console.warn('📂 Pasta não existe, criando:', pasta);
      await RNFS.mkdir(pasta); // cria a pasta se não existir
    }

    const arquivos = await RNFS.readDir(pasta);

    arquivos.forEach((arquivo) => {
      const ehImagem = /\.(png|jpg|jpeg|webp)$/i.test(arquivo.name);

      if (ehImagem && arquivo.isFile()) {
        const idImagem = arquivo.name.replace(/\.(png|jpg|jpeg|webp)$/i, '');
        mapeamento[idImagem] = 'file://' + arquivo.path;
        // console.log('📷 Mapeado:', idImagem, '→', mapeamento[idImagem]);
      } else {
        console.log('🚫 Ignorado:', arquivo.name, '| isFile:', arquivo.isFile());
      }
    });
  } catch (erro) {
    console.error('❌ Erro ao ler diretório:', erro);
  }

  return mapeamento;
}
