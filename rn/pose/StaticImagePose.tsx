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
import Svg, { Circle, Line } from 'react-native-svg';
import Tflite from 'tflite-react-native';

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
type Dims = { width: number; height: number };
type ImageT = { path: string } & Dims;
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
  scaledDims: Dims;
  imageViewDims: Dims;
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
  // These scaled dimensions are computed in getScaledDims().
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

const decodePoses = async res => {
  const [scores, offsets, dispFwd, dispBwd] = res;
  const [scoreTensor, offsetTensor, dispFwdTensor, dispBwdTensor] = await Promise.all([
    (tf.tensor(scores).squeeze() as tf.Tensor3D).buffer(),
    (tf.tensor(offsets).squeeze() as tf.Tensor3D).buffer(),
    (tf.tensor(dispFwd).squeeze() as tf.Tensor3D).buffer(),
    (tf.tensor(dispBwd).squeeze() as tf.Tensor3D).buffer(),
  ]);
  // decodeMultiplePoses works better than decodeSinglePose
  return await decodeMultiplePoses(
    scoreTensor,
    offsetTensor,
    dispFwdTensor,
    dispBwdTensor,
    16, // outputStride, picked by default. TODO: make configurable
    1 // numPoses
  );
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
