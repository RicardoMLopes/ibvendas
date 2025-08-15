// src/services/axios.js
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { obterTokenCNPJ } from '../config/tokenmanager'; // Importando a função para obter o token CNPJ



const api = axios.create({
  baseURL: 'https://servidor-64qt.onrender.com/',
// baseURL: 'http://192.168.100.40:8000/', // Substitua pela sua base URL
//  baseURL: 'http://192.168.0.182:8000/', // Substitua pela sua base URL
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});


// Interceptador de requisição (opcional)
api.interceptors.request.use(
  async config => {
    try {
      const token = await obterTokenCNPJ();

      if (token) {
        // Se o backend espera o token puro (sem "Bearer"), use apenas o token
        config.headers.Authorization = token;

        // Se o backend espera "Bearer <token>", use:
        // config.headers.Authorization = `Bearer ${token}`;
      }

      console.log('🔐 Token aplicado na requisição:', config.headers.Authorization);      
    } catch (error) {
      console.warn('⚠️ Erro ao recuperar token:', error);
    }

    return config;
  },
  error => {
    console.error('❌ Erro ao configurar requisição:', error.message);
    return Promise.reject(error);
  }
);

{/*
api.interceptors.request.use(
  async config => {
    try {
      const token = await obterTokenCNPJ();
      console.log('Token obtido:', token);
      if (token) config.headers.Authorization = `Bearer ${token}`;
    } catch (error) {
      console.warn('Erro ao recuperar token:', error);
    }
    return config;
  },
  error => Promise.reject(error)
);

*/}


// Interceptador de resposta (opcional)
api.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      // ação para sessão expirada, etc.
    }
    return Promise.reject(error);
  }
);

export default api;
