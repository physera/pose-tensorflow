import * as React from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Platform } from 'react-native';
import Tflite from 'tflite-react-native';
import ImagePicker from 'react-native-image-picker';

const blue = '#25d5fd';

const modelFile = 'mobilenet_v1_1.0_224.tflite';
const labelsFile = 'mobilenet_v1_1.0_224.txt';

let tflite = new Tflite();

interface Props {}
interface State {
  msg: string | null;
}

export default class App extends React.Component<Props, State> {
  state = { msg: '' };
  constructor(props: Props) {
    super(props);
    tflite.loadModel({ model: modelFile, labels: labelsFile });
  }

  onSelectImage = () => {
    ImagePicker.launchImageLibrary({}, response => {
      if (response.didCancel) {
        this.log('Cancelled');
      } else if (response.error) {
        this.log('Error');
      } else if (response.customButton) {
        this.log('Custom');
      } else {
        var path = Platform.OS === 'ios' ? response.uri : 'file://' + response.path;
        tflite.runModelOnImage(
          {
            path,
            imageMean: 128.0,
            imageStd: 128.0,
            numResults: 3,
            threshold: 0.05,
          },
          (err, res) => {
            if (err) this.log(err);
            else this.log(res);
          }
        );
      }
    });
  };

  log = msg => {
    this.setState({ msg: msg });
  };

  render() {
    return (
      <View style={styles.container}>
        <Text style={{ marginBottom: 25 }}>Pose/Tflite demo app!</Text>
        <TouchableOpacity style={styles.button} onPress={this.onSelectImage}>
          <Text>Select Image</Text>
        </TouchableOpacity>
        <Text style={styles.pre}>{JSON.stringify({ msg: this.state.msg })}</Text>
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
  pre: {
    fontFamily: 'monospace',
    maxWidth: '100%',
  },
});
