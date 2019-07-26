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
import FillToAspectRatio from './FillToAspectRatio';
import HTML from 'react-native-render-html';
import ImagePicker from 'react-native-image-picker';
import Svg, { Circle, Line } from 'react-native-svg';
import Tflite from 'tflite-react-native';
import { RNCamera } from 'react-native-camera';

import {
  decodeMultiplePoses,
  scalePose,
  Keypoint,
  Pose as PoseT,
} from '@tensorflow-models/posenet';
import * as tf from '@tensorflow/tfjs-core';

const modelFile = 'posenet_mv1_075_float_from_checkpoints.tflite';
const labelsFile = '';

let tflite = new Tflite();
type ImageDims = { width: number; height: number };
type ImageT = { path: string } & ImageDims;
type Props = {};
type State = {
  msg: string | object | null;
  image: ImageT | null;
  poses: PoseT[] | null;
};

const reindexPoseByPart = (
  pose: PoseT
): { score: number; keypoints: { [k: string]: Keypoint } } => {
  let reindexedKps = {};
  for (const kp of Object.values(pose.keypoints)) {
    reindexedKps[kp.part] = kp;
  }
  return {
    score: pose.score,
    keypoints: reindexedKps,
  };
};

type Side = 'Left' | 'Right' | 'Across';

const Skeleton: [string, string, Side][] = [
  ['leftShoulder', 'rightShoulder', 'Across'],
  ['leftShoulder', 'leftElbow', 'Left'],
  ['rightShoulder', 'rightElbow', 'Right'],
  ['leftElbow', 'leftWrist', 'Left'],
  ['rightElbow', 'rightWrist', 'Right'],
  ['leftShoulder', 'leftHip', 'Left'],
  ['rightShoulder', 'rightHip', 'Right'],
  ['leftHip', 'leftKnee', 'Left'],
  ['rightHip', 'rightKnee', 'Right'],
  ['leftKnee', 'leftAnkle', 'Left'],
  ['rightKnee', 'rightAnkle', 'Right'],
];

const Pose: React.FunctionComponent<{
  poseIn: PoseT;
  scaledDims: ImageDims;
  imageViewDims: ImageDims;
}> = ({ poseIn, scaledDims, imageViewDims }) => {
  const pose = reindexPoseByPart(poseIn);
  const points = Object.values(pose.keypoints).map((kp: Keypoint) => {
    return <Circle cx={kp.position.x} cy={kp.position.y} r="5" fill="pink" key={kp.part} />;
  });
  const lines = Skeleton.map(([from_part, to_part, side]) => {
    const from_kp = pose.keypoints[from_part];
    const to_kp = pose.keypoints[to_part];
    let strokeColor: string;
    switch (side) {
      case 'Left':
        strokeColor = 'yellow';
        break;
      case 'Right':
        strokeColor = 'green';
        break;
      case 'Across':
        strokeColor = 'red';
        break;
    }
    return (
      <Line
        x1={from_kp.position.x}
        y1={from_kp.position.y}
        x2={to_kp.position.x}
        y2={to_kp.position.y}
        stroke={strokeColor}
        strokeWidth="2"
        key={`${from_part}-${to_part}`}
      />
    );
  });

  // * Scaling considerations
  //
  // We are using ImageBackground with dimensions = getImageViewDims()
  // with resizeMode=contain. This means that the Image will get
  // scaled such that one dimension will be set to the size of the
  // ImageBackground and the other will be scaled proportionally to
  // maintain the right aspect ratio, and will be smaller than the
  // corresponding ImageBackground dimension.
  //
  // These scaled dimensions are computed in getScaledImageDims().
  //
  // Now the Pose needs to get overlaid on this ImageBackground such
  // that it actually sits on top of the Image.
  //
  // To do this, we position the Svg assuming that the scaled Image is
  // centered in both dimensions in the ImageBackground (setting top,
  // left based on this), and then set the Svg's dimensions to be the
  // scaled image dimensions.
  //
  // We then set the viewBox of the Svg to also be the scaled image
  // dimensions, and scale the pose to these dimensions as well.
  //
  // In theory the viewBox could be set to the original image
  // dimensions without scaling the pose, but the size of the
  // circle/lines will then be according to that scale and look tiny
  // in some cases.
  //
  //
  return (
    <Svg
      style={{
        top: (imageViewDims.height - scaledDims.height) / 2,
        left: (imageViewDims.width - scaledDims.width) / 2,
      }}
      width={scaledDims.width}
      height={scaledDims.height}
      viewBox={`0 0 ${scaledDims.width} ${scaledDims.height}`}
      preserveAspectRatio="none">
      {points}
      {lines}
    </Svg>
  );
};

export default class App extends React.Component<Props, State> {
  state = { msg: null, image: null, poses: null };

  constructor(props: Props) {
    super(props);
    tflite.loadModel({ model: modelFile, labels: labelsFile });
  }

  handlePoseResponse = async res => {
    const [scores, offsets, dispFwd, dispBwd] = res;
    const [scoreTensor, offsetTensor, dispFwdTensor, dispBwdTensor] = await Promise.all([
      (tf.tensor(scores).squeeze() as tf.Tensor3D).buffer(),
      (tf.tensor(offsets).squeeze() as tf.Tensor3D).buffer(),
      (tf.tensor(dispFwd).squeeze() as tf.Tensor3D).buffer(),
      (tf.tensor(dispBwd).squeeze() as tf.Tensor3D).buffer(),
    ]);
    // decodeMultiplePoses works better than decodeSinglePose
    const poses = await decodeMultiplePoses(
      scoreTensor,
      offsetTensor,
      dispFwdTensor,
      dispBwdTensor,
      16, // outputStride, picked by default. TODO: make configurable
      1 // numPoses
    );
    const scaledDims = this.getScaledImageDims(this.getImageViewDims());
    const scaledPose = scalePose(
      poses[0],
      scaledDims.height / 337, // inputResolution that is picked by default. TODO: make configurable
      scaledDims.width / 337
    );
    this.setState({ poses: [scaledPose] });
  };

  getImageViewDims = (): ImageDims => {
    return {
      height: 500,
      width: Dimensions.get('window').width,
    };
  };

  scale = (largerDim: number, viewDim: number, smallerDim: number): [number, number] => {
    const scaledLargerDim = Math.min(largerDim, viewDim);
    const scaledSmallerDim = (scaledLargerDim / largerDim) * smallerDim;
    return [scaledLargerDim, scaledSmallerDim];
  };

  getScaledImageDims = (imageViewDims: ImageDims): ImageDims => {
    const image = this.state.image;
    const heightRatio = imageViewDims.height / image.height;
    const widthRatio = imageViewDims.width / image.width;

    let scaledHeight: number;
    let scaledWidth: number;

    if (heightRatio <= widthRatio) {
      [scaledHeight, scaledWidth] = this.scale(image.height, imageViewDims.height, image.width);
    } else {
      [scaledWidth, scaledHeight] = this.scale(image.width, imageViewDims.width, image.height);
    }
    return { height: scaledHeight, width: scaledWidth };
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
            await this.handlePoseResponse(res);
          }
        });
      }
    });
  };

  log = (msg: string | object) => {
    this.setState({ msg: msg });
  };

  render() {
    const imageViewDims = this.getImageViewDims();

    const poseDebug = this.state.poses ? (
      <View style={{ margin: 20, borderWidth: 1, borderColor: 'red' }}>
        <HTML html={`<pre>${JSON.stringify(this.state.poses, null, 2)}</pre>`} />
      </View>
    ) : null;

    const camera = (
      <View
        style={{
          height: 300,
          margin: 25,
          width: Dimensions.get('window').width,
          backgroundColor: 'green',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <Text>Camera</Text>
        <View style={{ height: 200, width: 200 }}>
          <FillToAspectRatio>
            <RNCamera style={{ flex: 1 }} type={RNCamera.Constants.Type.front} />
          </FillToAspectRatio>
        </View>
      </View>
    );

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
            scaledDims={this.getScaledImageDims(imageViewDims)}
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
      <ScrollView>
        <View style={styles.container}>
          <Text style={{ marginBottom: 25 }}>Pose demo</Text>
          {camera}
          <Button title="Select Image" onPress={this.onSelectImage} />
          <View style={{ margin: 25 }}>
            {poseImageOverlay}
            {poseDebug}
            {debugMsg}
          </View>
        </View>
      </ScrollView>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'column',
    backgroundColor: '#fff',
    alignItems: 'center',
  },
});
