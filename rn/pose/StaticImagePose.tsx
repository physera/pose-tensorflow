import * as React from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Platform,
  Button,
  ImageBackground,
  Dimensions,
} from 'react-native';
import HTML from 'react-native-render-html';
import ImagePicker from 'react-native-image-picker';
import Tflite from 'tflite-react-native';
import { Pose, decodePoses, PoseT, Dims, MODEL_FILE, MODEL_INPUT_SIZE } from './Pose';

let tflite = new Tflite();

type ImageT = { path: string } & Dims;
type State = {
  msg: string | object | null;
  image: ImageT | null;
  poses: PoseT[] | null;
};

export default class StaticImagePose extends React.Component<{}, State> {
  state = { msg: null, image: null, poses: null };

  constructor(props: {}) {
    super(props);
    tflite.loadModel({ model: MODEL_FILE, labels: '' });
  }

  getImageViewDims = (): Dims => {
    // Setting these to %s is weird because the dims are passed
    // on to the Image, and then they apply twice, once relative
    // to the outer container, then relative to the
    // ImageBackground container as well
    const window = Dimensions.get('window');
    return {
      height: window.height * 0.8,
      width: window.width,
    };
  };

  handleImagePoseResponse = async res => {
    const poses = await decodePoses('multiple', res);
    this.setState({ poses: poses });
  };

  onSelectImage = () => {
    ImagePicker.launchImageLibrary({}, response => {
      if (response.didCancel) {
        this.log('Cancelled');
      } else if (response.error) {
        this.log('Error');
      } else {
        var path = Platform.OS === 'ios' ? response.uri : 'file://' + response.path;
        this.setState({
          image: { path: path, width: response.width, height: response.height },
        });
        // tflite.runPoseNetOnImage(
        //   {
        //     path,
        //     threshold: 0.3,
        //   },
        //   (err, res) => {
        //     if (err) this.log(err);
        //     else this.setState({ poses: res });
        //   }
        // );
        tflite.runModelOnImageMulti({ path }, async (err, res) => {
          if (err) this.log(err);
          else {
            await this.handleImagePoseResponse(res);
          }
        });
      }
    });
  };

  log = (msg: string | object) => {
    this.setState({ msg: msg });
  };

  getPosesToDisplay = (): PoseT[] | null => {
    if (this.state.image && this.state.poses && this.state.poses.length) {
      return this.state.poses;
    }
  };

  render() {
    const imageViewDims = this.getImageViewDims();

    // const poseDebug = this.state.poses ? (
    //   <View style={{ margin: 20, borderWidth: 1, borderColor: 'red' }}>
    //     <HTML html={`<pre>${JSON.stringify(this.state.poses, null, 2)}</pre>`} />
    //   </View>
    // ) : null;

    const posesToDisplay = this.getPosesToDisplay();
    const poseOverlay = posesToDisplay ? (
      <Pose
        poseIn={posesToDisplay[0]}
        imageDims={this.state.image}
        viewDims={imageViewDims}
        modelInputSize={MODEL_INPUT_SIZE}
        rotation={0}
      />
    ) : null;

    const imageView = this.state.image ? (
      <ImageBackground
        source={{ uri: this.state.image.path }}
        style={{
          ...imageViewDims,
          borderColor: 'orange',
          borderWidth: 2,
        }}
        resizeMode="contain"
        resizeMethod="auto">
        {poseOverlay}
      </ImageBackground>
    ) : null;

    const debugMsg = this.state.msg ? (
      <View style={{ margin: 20, borderWidth: 1, borderColor: 'black' }}>
        <HTML html={`<pre>${JSON.stringify([this.state.msg], null, 2)}</pre>`} />
      </View>
    ) : (
      <Text>No msg</Text>
    );

    return (
      <ScrollView contentContainerStyle={styles.container}>
        <View style={{ margin: 25 }}>
          <Button title="Select Image" onPress={this.onSelectImage} />
        </View>
        {imageView}
        {debugMsg}
      </ScrollView>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'column',
    backgroundColor: 'green',
    alignItems: 'center',
  },
});
