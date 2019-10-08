import * as React from 'react';
import { Dimensions, View, Text, StyleSheet } from 'react-native';
import { TabView, TabBar } from 'react-native-tab-view';
import StaticImagePose from './StaticImagePose';
import CameraPose from './CameraPose';
import { App as colors } from './Colors';

type State = {
  index: number;
  routes: { key: string; title: string }[];
  onLeave: { [key: string]: Function };
  onEnter: { [key: string]: Function };
};

export default class App extends React.Component<{}, State> {
  state = {
    index: 0,
    routes: [{ key: 'image', title: 'Image' }, { key: 'camera', title: 'Live' }],
    onLeave: {},
    onEnter: {},
  };

  constructor(props: {}) {
    super(props);
  }

  _registerCallback = (stateKey: 'onLeave' | 'onEnter', routeKey: string, fn: Function) => {
    this.setState(prevState => {
      return { ...prevState, [stateKey]: { ...prevState[stateKey], [routeKey]: fn } };
    });
  };

  _registerOnLeaveCallback = (key: string, fn: () => void) => {
    this._registerCallback('onLeave', key, fn);
  };

  _registerOnEnterCallback = (key: string, fn: () => void) => {
    this._registerCallback('onEnter', key, fn);
  };

  _renderScene = ({ route, jumpTo }) => {
    switch (route.key) {
      case 'image':
        return <StaticImagePose />;
      case 'camera':
        return (
          <CameraPose
            routeKey="camera"
            registerOnLeave={this._registerOnLeaveCallback}
            registerOnEnter={this._registerOnEnterCallback}
          />
        );
    }
  };

  _getKeyFromIndex = (idx: number): string => {
    return this.state.routes[idx].key;
  };

  _handleIndexChange = (index: number) => {
    const leaveCb = this.state.onLeave[this._getKeyFromIndex(this.state.index)];
    const enterCb = this.state.onEnter[this._getKeyFromIndex(index)];
    if (leaveCb) {
      leaveCb();
    }
    this.setState({ index });
    if (enterCb) {
      enterCb();
    }
  };

  render() {
    return (
      <View style={styles.container}>
        <View style={{ alignItems: 'center', backgroundColor: colors.titleBar.background }}>
          <Text style={{ fontSize: 20, color: colors.titleBar.text, margin: 5 }}>Posera</Text>
        </View>
        <TabView
          lazy
          navigationState={this.state}
          renderScene={this._renderScene}
          onIndexChange={this._handleIndexChange}
          initialLayout={{ width: Dimensions.get('window').width }}
          renderTabBar={props => (
            <TabBar
              {...props}
              indicatorStyle={{ backgroundColor: 'white' }}
              style={{ backgroundColor: colors.tabView.background }}
            />
          )}
        />
      </View>
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
