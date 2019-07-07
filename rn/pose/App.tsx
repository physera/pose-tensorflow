import * as React from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Platform } from 'react-native';
import Tflite from 'tflite-react-native';
import ImagePicker from 'react-native-image-picker';
import HTML from 'react-native-render-html';

const blue = '#25d5fd';

const modelFile = 'mobilenet_v1_1.0_224.tflite';
const labelsFile = 'mobilenet_v1_1.0_224.txt';

let tflite = new Tflite();

interface Props {}
interface State {
  msg: string | object | null;
}

export default class App extends React.Component<Props, State> {
  state = { msg: null };
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

  log = (msg: string | object) => {
    this.setState({ msg: msg });
  };

  render() {
    return (
      <View style={styles.container}>
        <Text style={{ marginBottom: 25 }}>Tflite demo</Text>
        <TouchableOpacity style={styles.button} onPress={this.onSelectImage}>
          <Text>Select Image</Text>
        </TouchableOpacity>
        {this.state.msg ? (
          <View style={{ margin: 20, borderWidth: 1, borderColor: 'black' }}>
            <HTML html={`<pre>${JSON.stringify([this.state.msg], null, 2)}</pre>`} />
          </View>
        ) : null}
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
