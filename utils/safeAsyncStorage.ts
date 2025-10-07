// utils/safeAsyncStorage.ts
import AsyncStorage from '@react-native-async-storage/async-storage';

// Prevent "window is not defined" during SSR or static export
const SafeAsyncStorage =
  typeof window !== 'undefined' ? AsyncStorage : {
    getItem: async () => null,
    setItem: async () => {},
    removeItem: async () => {},
  };

export default SafeAsyncStorage;