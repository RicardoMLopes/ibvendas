import { SQLiteDatabase, openDatabaseAsync } from 'expo-sqlite';
import * as FileSystem from 'expo-file-system';
import { initializedatabase } from './index';
import { useDatabaseStore } from '../store/databasestore';

type NamedDatabase = SQLiteDatabase & { _dbName: string };

class DatabaseManager {
  private static currentDb: NamedDatabase | null = null;

  private static getDatabasePath(dbName: string): string {
    return `${FileSystem.documentDirectory}SQLite/${dbName}`;
  }

  static async databaseExists(cnpj: string): Promise<boolean> {
    const dbPath = this.getDatabasePath(`${cnpj}.db`);
    const info = await FileSystem.getInfoAsync(dbPath);
    return info.exists;
  }

  static async openDatabase(cnpj: string): Promise<NamedDatabase> {
    const dbName = `${cnpj}.db`;
    const baseAtual = useDatabaseStore.getState().baseAtual;

    if (baseAtual === dbName && this.currentDb) {
      console.log('🛑 Banco já está aberto:', dbName);
      return this.currentDb;
    }

    const db = await openDatabaseAsync(dbName) as NamedDatabase;
    db._dbName = dbName;
    this.currentDb = db;

    console.log(`📂 Banco aberto com sucesso: ${dbName}`);

    await initializedatabase(db);
    console.log('🛠️ Estrutura do banco criada (ou já existia).');

    useDatabaseStore.getState().setBaseAtual(dbName);
    return db;
  }

  static async openDatabaseWithoutInit(cnpj: string): Promise<NamedDatabase> {
    const dbName = `${cnpj}.db`;
    const baseAtual = useDatabaseStore.getState().baseAtual;

    if (baseAtual === dbName && this.currentDb) {
      console.log('🛑 Banco já está aberto (sem init):', dbName);
      return this.currentDb;
    }

    const db = await openDatabaseAsync(dbName) as NamedDatabase;
    db._dbName = dbName;
    this.currentDb = db;

    console.log(`📂 Banco aberto sem init: ${dbName}`);

    useDatabaseStore.getState().setBaseAtual(dbName);
    return db;
  }

  static getCurrentDatabase(): NamedDatabase {
    if (!this.currentDb) {
      throw new Error('Banco de dados não foi inicializado!');
    }
    return this.currentDb;
  }

  static getCurrentDbName(): string {
    if (!this.currentDb) {
      throw new Error('Banco não carregado');
    }
    return this.currentDb._dbName;
  }

  static async hasTables(cnpj: string): Promise<boolean> {
    try {
      const db = await this.openDatabaseWithoutInit(cnpj);
      const result = await db.getAllAsync(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name NOT LIKE 'sqlite_%'
      `);
      return result.length > 0;
    } catch (error) {
      console.error('❌ Erro ao verificar tabelas:', error);
      return false;
    }
  }

  static async deleteDatabaseIfEmpty(cnpj: string): Promise<void> {
    const has = await this.hasTables(cnpj);
    const dbName = `${cnpj}.db`;
    const dbPath = this.getDatabasePath(dbName);

    if (has) {
      console.log(`⚠️ Banco ${dbName} tem tabelas e não será excluído.`);
      return;
    }

    const info = await FileSystem.getInfoAsync(dbPath);
    if (info.exists) {
      await FileSystem.deleteAsync(dbPath, { idempotent: true });
      console.log(`🗑 Banco ${dbName} excluído por estar vazio.`);
    } else {
      console.log(`ℹ️ Banco ${dbName} não encontrado para exclusão.`);
    }
  }

  static async closeCurrentDatabase(): Promise<void> {
    if (this.currentDb) {
      await this.currentDb.closeAsync?.();
      console.log(`🔒 Banco ${this.currentDb._dbName} fechado.`);
      this.currentDb = null;
      useDatabaseStore.getState().limparBase();
    }
  }
}

export default DatabaseManager;
