import * as React from 'react';
import { StyleSheet, Text, View, Switch, Picker } from 'react-native';
import { ModelName, Models } from './Pose';
import { NavigationStackProp } from 'react-navigation-stack';

export type Settings = {
  name: ModelName;
  useNNAPI: boolean;
  useGpuDelegate: boolean;
  allowFp16Precision: boolean;
  numThreads: number;
};

export const SettingsContext = React.createContext({});

export class SettingsScreen extends React.Component<{ navigation: NavigationStackProp }, {}> {
  static contextType = SettingsContext;

  modelPicker = () => {
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

  numThreadsPicker = () => {
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

  render() {
    return (
      <View>
        {this.modelPicker()}
        <View style={styles.settingsItem}>
          <Text style={styles.settingsHeader}>Flags</Text>
          {this.switch('useNNAPI')}
          {this.switch('useGpuDelegate')}
          {this.switch('allowFp16Precision')}
        </View>
        {this.numThreadsPicker()}
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
