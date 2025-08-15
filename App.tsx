import React, { useMemo, useState } from 'react';
import { SQLiteProvider, defaultDatabaseDirectory } from 'expo-sqlite';
import { Platform } from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import RoutesStacks from './src/routes/stacks';
import { Paths } from 'expo-file-system/next';
import { initializedatabase } from './src/database';


export default function App() {
  const [cnpj, setCnpj] = useState<string | null>(null);

  const lightTheme = {
    ...DefaultTheme,
    colors: {
      ...DefaultTheme.colors,
      background: '#ffffff',
    },
  };

  const dbDirectory = useMemo(() => {
    if (Platform.OS === 'ios') {
      return Object.values(Paths.appleSharedContainers)?.[0]?.uri;
    }
    return defaultDatabaseDirectory;
  }, []);

  const dbName = cnpj ? `db_${cnpj}.db` : undefined;

return (
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
</NavigationContainer>

);
}