import * as React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import ImageScreen from './ImageScreen';
import CameraScreen from './CameraScreen';
import { App as colors } from './Colors';
import { createAppContainer } from 'react-navigation';
import { createMaterialTopTabNavigator } from 'react-navigation-tabs';

const tabNavigator = createMaterialTopTabNavigator(
  {
    Image: {
      screen: ImageScreen,
    },
    Live: {
      screen: CameraScreen,
    },
  },
  {
    initialRouteName: 'Live',
    lazy: true,
    tabBarOptions: {
      showLabel: true,
      style: { backgroundColor: colors.tabView.background },
      indicatorStyle: { backgroundColor: 'white' },
    },
  }
);
const AppContainer = createAppContainer(tabNavigator);
const App = () => {
  const header = (
    <View style={{ alignItems: 'center', backgroundColor: colors.titleBar.background }}>
      <Text style={{ fontSize: 20, color: colors.titleBar.text, margin: 5 }}>Posera</Text>
    </View>
  );
  return (
    <View style={styles.container}>
      {header}
      <AppContainer />
    </View>
  );
};
export default App;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'column',
    backgroundColor: colors.background,
  },
});
