import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import FeedScreen from '../screens/FeedScreen';
import VideoScreen from '../screens/VideoScreen';
import CreatorScreen from '../screens/CreatorScreen';
import { colors, APP_NAME } from '../theme';

const Stack = createNativeStackNavigator();

const navTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.background,
    card: colors.background,
    text: colors.text,
    border: colors.border,
    primary: colors.brand,
  },
};

const headerOptions = {
  headerStyle: { backgroundColor: colors.background },
  headerTintColor: colors.text,
  headerShadowVisible: false,
};

// No Chart screen here — that's SWARA-only (Top 100 Hills Hits has no CHIMAL
// equivalent).
export default function AppNavigation() {
  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator screenOptions={headerOptions}>
        <Stack.Screen name="Feed" component={FeedScreen} options={{ title: APP_NAME }} />
        <Stack.Screen name="Video" component={VideoScreen} options={{ title: '' }} />
        <Stack.Screen name="Creator" component={CreatorScreen} options={{ title: '' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
