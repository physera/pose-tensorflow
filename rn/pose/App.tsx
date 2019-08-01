import * as React from 'react';
import { Dimensions, View, Text, StyleSheet } from 'react-native';
import { TabView, SceneMap } from 'react-native-tab-view';
import StaticImagePose from './StaticImagePose';
import CameraPose from './CameraPose';

type State = {
  index: number;
  routes: { key: string; title: string }[];
};

export default class App extends React.Component<{}, State> {
  state = {
    index: 0,
    routes: [{ key: 'image', title: 'Image' }, { key: 'camera', title: 'Live' }],
  };

  constructor(props: {}) {
    super(props);
  }

  render() {
    const sceneMap = SceneMap({
      image: StaticImagePose,
      camera: CameraPose,
    });
    return (
      <View style={styles.container}>
        <View style={{ alignItems: 'center' }}>
          <Text>Pose Demo</Text>
        </View>
        <TabView
          navigationState={this.state}
          renderScene={sceneMap}
          onIndexChange={index => this.setState({ index })}
          initialLayout={{ width: Dimensions.get('window').width }}
        />
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'column',
    backgroundColor: '#fff',
  },
});
