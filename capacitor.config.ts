import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'sa.org.ico.sammha',
  appName: 'سمّها',
  webDir: 'dist',
  // the WebView origin is https://localhost: the API must list it (and capacitor://localhost for iOS) in Cors:Origins
  server: { androidScheme: 'https' },
  plugins: {
    SplashScreen: { launchShowDuration: 800, backgroundColor: '#00513B', showSpinner: false },
    StatusBar: { style: 'DARK', backgroundColor: '#00513B', overlaysWebView: false },
    Keyboard: { resize: 'body' },
  },
}

export default config
