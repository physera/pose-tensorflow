import * as React from 'react';
import { StyleSheet, Text, View, ScrollView, Platform, Button } from 'react-native';
import Tflite from 'tflite-react-native';
import ImagePicker from 'react-native-image-picker';
import HTML from 'react-native-render-html';
import Svg, { Circle, Line } from 'react-native-svg';
import ImageOverlay from 'react-native-image-overlay';
import { RNCamera } from 'react-native-camera';
import FillToAspectRatio from './FillToAspectRatio';

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

type ImageT = { path: string; width: number; height: number };
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

const Pose: React.FunctionComponent<{ poseIn: PoseT; image: ImageT }> = ({ poseIn, image }) => {
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

  return (
    <Svg
      width="100%"
      height="100%"
      viewBox={`0 0 ${image.width} ${image.height}`}
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
      16, // outputStride, picked by default
      1 // numPoses
    );
    const scaledPose = scalePose(
      poses[0],
      this.state.image.height / 337, // inputResolution that is picked by default
      this.state.image.width / 337
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
        tflite.runModelOnImageMulti(
          {
            path,
          },
          async (err, res) => {
            if (err) this.log(err);
            else {
              await this.handlePoseResponse(res);
            }
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
      <ScrollView>
        <View style={styles.container}>
          <Text style={{ marginBottom: 25 }}>Pose demo</Text>
          <Button title="Select Image" onPress={this.onSelectImage} />
          <View style={{ margin: 25 }}>
            <View
              style={{
                height: 400,
                width: 400,
                backgroundColor: 'red',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <Text>Camera</Text>
              <View style={{ height: 300, width: 300 }}>
                <FillToAspectRatio>
                  <RNCamera style={{ flex: 1 }} type={RNCamera.Constants.Type.back} />
                </FillToAspectRatio>
              </View>
            </View>
            {this.state.image ? (
              <ImageOverlay
                height={this.state.image.height}
                source={{ uri: this.state.image.path }}
                contentPosition="top">
                {this.state.poses ? (
                  <Pose poseIn={this.state.poses[0]} image={this.state.image} />
                ) : null}
              </ImageOverlay>
            ) : null}
            {this.state.poses ? (
              <View style={{ margin: 20, borderWidth: 1, borderColor: 'red' }}>
                <HTML html={`<pre>${JSON.stringify(this.state.poses, null, 2)}</pre>`} />
              </View>
            ) : null}
            {this.state.msg ? (
              <View style={{ margin: 20, borderWidth: 1, borderColor: 'black' }}>
                <HTML html={`<pre>${JSON.stringify([this.state.msg], null, 2)}</pre>`} />
              </View>
            ) : (
              <Text>No msg</Text>
            )}
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
