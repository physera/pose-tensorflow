import * as React from 'react';
import { StyleSheet, Text, View, Switch, Picker } from 'react-native';
// import Slider from '@react-native-community/slider';
// import Overlay from './Overlay';
// import Icon from 'react-native-vector-icons/MaterialIcons';
// import { CameraScreen as colors } from './Colors';
import { ModelName, Models } from './Pose';
import { NavigationStackProp } from 'react-navigation-stack';

export type ModelSettings = {
  name: ModelName;
  useNNAPI: boolean;
  useGpuDelegate: boolean;
  allowFp16Precision: boolean;
  numThreads: number;
};

export const ModelSettingsContext = React.createContext({});

export class ModelSettingsScreen extends React.Component<{ navigation: NavigationStackProp }, {}> {
  static contextType = ModelSettingsContext;

  modelPicker = () => {
    return (
      <Picker
        selectedValue={this.context.name}
        onValueChange={itemValue => this.context.setState({ name: itemValue })}>
        {Object.keys(Models).map(m => {
          return <Picker.Item label={m} value={m} key={m} />;
        })}
      </Picker>
    );
  };

  render() {
    return <View>{this.modelPicker()}</View>;
  }
}
