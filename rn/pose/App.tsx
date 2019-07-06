import * as React from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import Tflite from 'tflite-react-native';
import ImagePicker from 'react-native-image-picker';

const blue = '#25d5fd';

interface Props {}
interface State {}

export default class App extends React.Component<Props, State> {
  onSelectImage = () => {
    ImagePicker.launchImageLibrary({}, response => {
      if (response.didCancel) {
        console.log('Cancelled');
      } else if (response.error) {
        console.log('Error');
      } else if (response.customButton) {
        console.log('Custom');
      } else {
        console.log(response);
      }
    });
  };

  render() {
    return (
      <View style={styles.container}>
        <Text style={{ marginBottom: 25 }}>Pose/Tflite demo app!</Text>
        <TouchableOpacity style={styles.button} onPress={this.onSelectImage}>
          <Text>Select Image</Text>
        </TouchableOpacity>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  button: {
    width: 200,
    backgroundColor: blue,
    borderRadius: 10,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
});
