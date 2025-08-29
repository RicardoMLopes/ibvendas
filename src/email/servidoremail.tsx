import { tentarRequisicao } from "../scripts/funcoes";
import api from '../config/app';

interface SendEmailParams {
  to?: string[];         // lista de strings opcional
  subject: string;
  message: string;
  jsonData?: Record<string, any>;
}

export async function EnviarEmail({
  to,
  subject,
  message,
  jsonData,
}: SendEmailParams): Promise<boolean> {
  try {
    // Garante que 'to' seja undefined se estiver vazio
    const toField = to && to.length > 0 ? to : undefined;

    // Monta o payload para enviar ao backend
    const payload = {
      assunto: subject,   // renomeia para o que o FastAPI espera
      mensagem: message,  // renomeia para o que o FastAPI espera
      jsonData: jsonData || undefined,
      to: toField,
    };

    // URL do endpoint do seu backend
    const url = '/enviar-email';

    // Faz a requisição com retry, definindo Content-Type corretamente
    const sucesso = await tentarRequisicao(
      () => api.post(url, payload, { headers: { 'Content-Type': 'application/json' } }),
      3,
      2000
    );

    if (sucesso) {
      console.log('📧 E-mail enviado com sucesso!');
      return true;
    } else {
      console.error('❌ Falha ao enviar e-mail após tentativas.');
      return false;
    }
  } catch (error) {
    console.error('❌ Erro enviar e-mail:', error);
    return false;
  }
}
