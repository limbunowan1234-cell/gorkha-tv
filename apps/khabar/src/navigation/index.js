import { Text } from 'react-native';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import TopScreen from '../screens/TopScreen';
import TownsScreen from '../screens/TownsScreen';
import SavedScreen from '../screens/SavedScreen';
import StoryScreen from '../screens/StoryScreen';
import SourceScreen from '../screens/SourceScreen';
import { colors } from '../theme';

const Stack = createNativeStackNavigator();
const Tabs = createBottomTabNavigator();

const navTheme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: colors.night, card: colors.night, text: colors.snow, border: 'transparent', primary: colors.brand },
};

const icon = (glyph) => ({ tabBarIcon: ({ focused }) => <Text style={{ fontSize: 19, opacity: focused ? 1 : 0.5 }}>{glyph}</Text> });

function Home() {
  return (
    <Tabs.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: colors.night, borderTopColor: 'rgba(244,241,234,0.08)', height: 58, paddingBottom: 6, paddingTop: 4 },
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.mist,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '800', letterSpacing: 0.4 },
      }}
    >
      <Tabs.Screen name="Top" component={TopScreen} options={icon('📰')} />
      <Tabs.Screen name="Towns" component={TownsScreen} options={icon('📍')} />
      <Tabs.Screen name="Saved" component={SavedScreen} options={icon('🔖')} />
    </Tabs.Navigator>
  );
}

const headerOptions = {
  headerStyle: { backgroundColor: colors.night },
  headerTintColor: colors.snow,
  headerShadowVisible: false,
  title: '',
};

export default function AppNavigation() {
  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator screenOptions={headerOptions}>
        <Stack.Screen name="Tabs" component={Home} options={{ headerShown: false }} />
        <Stack.Screen name="Story" component={StoryScreen} />
        <Stack.Screen name="Source" component={SourceScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
