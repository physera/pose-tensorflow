import * as React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import ImageScreen from './ImageScreen';
import CameraScreen from './CameraScreen';
import { App as colors } from './Colors';
import { createAppContainer, NavigationActions } from 'react-navigation';
import { createMaterialTopTabNavigator } from 'react-navigation-tabs';
import { Settings, SettingsContext, SettingsScreen } from './Settings';
import { createStackNavigator } from 'react-navigation-stack';
import Icon from 'react-native-vector-icons/MaterialIcons';

console.disableYellowBox = true;

import MessageQueue from 'react-native/Libraries/BatchedBridge/MessageQueue.js';

const spyFunction = msg => {
  // only native -> JS
  if (msg.type == 0 && msg.module == 'RCTEventEmitter') {
    const data = msg.args[2];
    if (data && data.timing) {
      console.log([
        Date.now() - data.timing.imageTime,
        Date.now() - data.timing.serializationEndTime,
        data.timing,
      ]);
    }
  }
};

// MessageQueue.spy(spyFunction);

const tabs = createMaterialTopTabNavigator(
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

const settingsStack = createStackNavigator({
  Tabs: {
    screen: tabs,
    navigationOptions: {
      header: null,
    },
  },
  Settings: {
    screen: SettingsScreen,
    navigationOptions: {
      title: 'Settings',
    },
  },
});

const AppContainer = createAppContainer(settingsStack);

export default class App extends React.PureComponent<{}, Settings> {
  static router = settingsStack.router;
  state: Settings = {
    useNNAPI: false,
    useGpuDelegate: true,
    allowFp16Precision: false,
    showBoundingBox: false,
    numThreads: -1,
    name: 'hourglass',
    videoRecordingDuration: 20,
    keypointScoreThreshold: 0.15,
    minMovedThreshold: 4, // fraction of modelInputSize
    matchDistanceThreshold: 25, // fraction of modelInputSize
    joint: null,
  };
  navigator = null;

  settingsButton = () => {
    return (
      <Icon.Button
        name="settings-applications"
        onPress={() =>
          this.navigator.dispatch(NavigationActions.navigate({ routeName: 'Settings' }))
        }
        borderRadius={0}
        iconStyle={{ marginLeft: 20, marginRight: 20 }}
        key="settings"
        backgroundColor={null}
      />
    );
  };

  render() {
    const header = (
      <View
        style={{
          backgroundColor: colors.titleBar.background,
          alignItems: 'center',
          flexDirection: 'row',
          justifyContent: 'space-between',
        }}>
        <View style={{ minWidth: 90 }} />
        <Text
          style={{
            fontSize: 20,
            color: colors.titleBar.text,
          }}>
          Posera
        </Text>
        <View>{this.settingsButton()}</View>
      </View>
    );

    return (
      <SettingsContext.Provider
        value={{
          ...this.state,
          setState: data => {
            // Unclear why, but this cannot be this.setState directly
            this.setState(data);
          },
        }}>
        <View style={styles.container}>
          {header}
          <AppContainer
            ref={nav => {
              this.navigator = nav;
            }}
          />
        </View>
      </SettingsContext.Provider>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'column',
    backgroundColor: colors.background,
  },
});
