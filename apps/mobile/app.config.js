module.exports = {
  expo: {
    name: 'FitRealm',
    slug: 'fitrealm',
    version: '1.0.0',
    scheme: 'fitrealm',
    orientation: 'portrait',
    icon: './assets/icon.png',
    splash: {
      image: './assets/splash.png',
      backgroundColor: '#ffffff',
    },
    ios: {
      bundleIdentifier: 'com.fitrealm.app',
      googleServicesFile: process.env.GOOGLE_SERVICE_INFO_PLIST ?? './GoogleService-Info.plist',
      supportsTablet: false,
    },
    android: {
      package: 'com.fitrealm.app',
      googleServicesFile: process.env.GOOGLE_SERVICES_JSON ?? './google-services.json',
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#ffffff',
      },
    },
    plugins: [
      'expo-router',
      'expo-secure-store',
      [
        '@react-native-google-signin/google-signin',
        {
          // IN-06: source the Google iOS URL scheme (reversed client ID) from an
          // env var for consistency with the other auth config (web client id /
          // RC keys are also env-sourced). A safe public fallback keeps prebuild
          // working when the var is unset. The value is NOT a secret — Google
          // client IDs are public by design.
          iosUrlScheme:
            process.env.EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME ??
            'com.googleusercontent.apps.617321571117-4b3c5sfr23ac6jbc319u5ftkkggq6urb',
        },
      ],
      'expo-apple-authentication',
      // Phase 2: native GPS + health + build config
      '@rnmapbox/maps',
      [
        'expo-location',
        {
          locationWhenInUsePermission:
            'FitRealm uses your location to track your movement and earn miles for your village.',
        },
      ],
      [
        'react-native-health',
        {
          healthSharePermission:
            'FitRealm reads your movement data to credit miles to your village.',
          healthUpdatePermission:
            'FitRealm logs your movement sessions to Apple Health.',
        },
      ],
      'expo-health-connect',
      [
        'expo-build-properties',
        {
          android: {
            compileSdkVersion: 35,
            targetSdkVersion: 35,
            minSdkVersion: 26,
          },
        },
      ],
    ],
    experiments: {
      typedRoutes: true,
    },
    extra: {
      router: {
        origin: false,
      },
      eas: {
        projectId: '1f7ed172-4901-46d8-a68f-408821a79401',
      },
    },
    owner: 'opxrz',
  },
};
