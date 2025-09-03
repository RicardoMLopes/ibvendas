import React, { useMemo, useState } from 'react';
import { Platform } from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { enableScreens } from 'react-native-screens';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SQLiteProvider, defaultDatabaseDirectory } from 'expo-sqlite';
import RoutesStacks from './src/routes/stacks';
import { Paths } from 'expo-file-system/next';
import { initializedatabase } from './src/database';
import MarcaDagua from './src/theme/marcadagua';

// Habilita react-native-screens para melhorar performance de navegação
enableScreens();

export default function App() {
  const [cnpj, setCnpj] = useState<string | null>(null);

  const lightTheme = {
    ...DefaultTheme,
    colors: {
      ...DefaultTheme.colors,
      background: '#ffffff',
    },
  };

  // Define diretório do banco dependendo da plataforma
  const dbDirectory = useMemo(() => {
    if (Platform.OS === 'ios') {
      return Object.values(Paths.appleSharedContainers)?.[0]?.uri;
    }
    return defaultDatabaseDirectory;
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <NavigationContainer theme={lightTheme}>
          {cnpj ? (
            <SQLiteProvider
              databaseName={`${cnpj}.db`}
              onInit={initializedatabase}
              directory={dbDirectory}
            >
              <RoutesStacks onLoginSuccess={setCnpj} />
            </SQLiteProvider>
          ) : (
            <RoutesStacks onLoginSuccess={setCnpj} />
          )}
          <MarcaDagua />

        </NavigationContainer>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
