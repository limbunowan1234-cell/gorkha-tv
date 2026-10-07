import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import FeedScreen from '../screens/FeedScreen';
import ChartScreen from '../screens/ChartScreen';
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

export default function AppNavigation() {
  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator screenOptions={headerOptions}>
        <Stack.Screen name="Feed" component={FeedScreen} options={{ title: APP_NAME }} />
        <Stack.Screen name="Chart" component={ChartScreen} options={{ title: 'Top 100 Hills Hits' }} />
        <Stack.Screen name="Video" component={VideoScreen} options={{ title: '' }} />
        <Stack.Screen name="Creator" component={CreatorScreen} options={{ title: '' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
