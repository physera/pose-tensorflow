import * as React from 'react';
import { StyleSheet, Text, View, Switch, Picker } from 'react-native';
import { ModelName, Models } from './Pose';
import { NavigationStackProp } from 'react-navigation-stack';
import Slider from '@react-native-community/slider';

export type Settings = {
  name: ModelName;
  useNNAPI: boolean;
  useGpuDelegate: boolean;
  allowFp16Precision: boolean;
  numThreads: number;
  videoRecordingDuration: number;
  keypointScoreThreshold: number;
  minMovedThreshold: number;
  matchDistanceThreshold: number;
};

export const SettingsContext = React.createContext({});

export class SettingsScreen extends React.Component<{ navigation: NavigationStackProp }, {}> {
  static contextType = SettingsContext;

  model = () => {
    return (
      <View style={styles.settingsItem}>
        <Text style={styles.settingsHeader}>Model</Text>
        <Picker
          selectedValue={this.context.name}
          onValueChange={itemValue => this.context.setState({ name: itemValue })}>
          {Object.keys(Models).map(m => {
            return <Picker.Item label={m} value={m} key={m} />;
          })}
        </Picker>
      </View>
    );
  };

  switch = (stateKey: string) => {
    return (
      <View style={[styles.row]}>
        <Text>{stateKey}</Text>
        <Switch
          key={stateKey}
          onValueChange={(v: boolean) => this.context.setState({ [stateKey]: v })}
          value={this.context[stateKey]}></Switch>
      </View>
    );
  };

  numThreads = () => {
    return (
      <View style={styles.settingsItem}>
        <Text style={styles.settingsHeader}>numThreads</Text>
        <Picker
          selectedValue={this.context.numThreads}
          onValueChange={itemValue => this.context.setState({ numThreads: itemValue })}>
          {[-1, 1, 2, 4, 8].map(m => {
            return <Picker.Item label={`${m}`} value={m} key={m} />;
          })}
        </Picker>
      </View>
    );
  };

  slider = (key: string, min: number, max: number, step: number, unit: string) => {
    return (
      <View style={styles.settingsItem}>
        <Text style={styles.settingsHeader}>
          {key} ({this.context[key]}
          {unit})
        </Text>
        <Slider
          style={{ marginTop: 10 }}
          minimumValue={min}
          maximumValue={max}
          value={this.context[key]}
          step={step}
          onSlidingComplete={(v: number) => this.context.setState({ [key]: v })}
        />
      </View>
    );
  };

  render() {
    return (
      <View>
        {this.model()}
        {this.slider('videoRecordingDuration', 5, 60, 5, 's')}
        {this.slider('keypointScoreThreshold', 0, 1, 0.05, '')}
        {this.slider('minMovedThreshold', 0, 10, 1, '%')}
        {this.slider('matchDistanceThreshold', 0, 100, 5, '%')}
        <View style={styles.settingsItem}>
          <Text style={styles.settingsHeader}>Flags</Text>
          {this.switch('useNNAPI')}
          {this.switch('useGpuDelegate')}
          {this.switch('allowFp16Precision')}
        </View>
        {this.numThreads()}
      </View>
    );
  }
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginLeft: 10,
    marginRight: 10,
  },
  settingsItem: {
    marginTop: 10,
    marginBottom: 10,
  },
  settingsHeader: { backgroundColor: 'lightgray', paddingLeft: 3, paddingTop: 3, paddingBottom: 3 },
});
