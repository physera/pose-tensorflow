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
import { Pose, decodePoses, scalePose, PoseT, Dims } from './Pose';

const modelFile = 'posenet_mv1_075_float_from_checkpoints.tflite';
const labelsFile = '';

let tflite = new Tflite();

type ImageT = { path: string } & Dims;
type State = {
  msg: string | object | null;
  image: ImageT | null;
  poses: PoseT[] | null;
};

const _scaleDims = (largerDim: number, viewDim: number, smallerDim: number): [number, number] => {
  const scaledLargerDim = Math.min(largerDim, viewDim);
  const scaledSmallerDim = (scaledLargerDim / largerDim) * smallerDim;
  return [scaledLargerDim, scaledSmallerDim];
};

const getScaledDims = (imageDims: Dims, viewDims: Dims): Dims => {
  const heightRatio = viewDims.height / imageDims.height;
  const widthRatio = viewDims.width / imageDims.width;

  let scaledHeight: number;
  let scaledWidth: number;

  if (heightRatio <= widthRatio) {
    [scaledHeight, scaledWidth] = _scaleDims(imageDims.height, viewDims.height, imageDims.width);
  } else {
    [scaledWidth, scaledHeight] = _scaleDims(imageDims.width, viewDims.width, imageDims.height);
  }
  return { height: scaledHeight, width: scaledWidth };
};

const MODEL_INPUT_SIZE = 337;

export default class StaticImagePose extends React.Component<{}, State> {
  state = { msg: null, image: null, poses: null };

  constructor(props: {}) {
    super(props);
    tflite.loadModel({ model: modelFile, labels: labelsFile });
  }

  getImageViewDims = (): Dims => {
    return {
      height: 500,
      width: Dimensions.get('window').width,
    };
  };

  handleImagePoseResponse = async (res, imageViewDims: Dims) => {
    const poses = await decodePoses(res);
    const scaledDims = getScaledDims(this.state.image, imageViewDims);
    const scaledPose = scalePose(
      poses[0],
      scaledDims.height / MODEL_INPUT_SIZE,
      scaledDims.width / MODEL_INPUT_SIZE
    );
    this.setState({ poses: [scaledPose] });
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
            await this.handleImagePoseResponse(res, this.getImageViewDims());
          }
        });
      }
    });
  };

  log = (msg: string | object) => {
    this.setState({ msg: msg });
  };

  handleVideoPoseResponse = async res => {
    const poseData = res.nativeEvent.data;
    const poses = await decodePoses(poseData);
    this.setState({ poses: poses });
  };

  render() {
    const imageViewDims = this.getImageViewDims();

    // const poseDebug = this.state.poses ? (
    //   <View style={{ margin: 20, borderWidth: 1, borderColor: 'red' }}>
    //     <HTML html={`<pre>${JSON.stringify(this.state.poses, null, 2)}</pre>`} />
    //   </View>
    // ) : null;

    const poseImageOverlay = this.state.image ? (
      <ImageBackground
        source={{ uri: this.state.image.path }}
        style={{
          ...imageViewDims,
        }}
        resizeMode="contain"
        resizeMethod="scale">
        {this.state.poses ? (
          <Pose
            poseIn={this.state.poses[0]}
            scaledDims={getScaledDims(this.state.image, imageViewDims)}
            imageViewDims={imageViewDims}
          />
        ) : null}
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
        <View>
          {poseImageOverlay}
          {debugMsg}
        </View>
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
