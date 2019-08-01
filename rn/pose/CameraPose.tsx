import * as React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import FillToAspectRatio from './FillToAspectRatio';
import HTML from 'react-native-render-html';
import { RNCamera } from 'react-native-camera';
import { decodeMultiplePoses, Pose as PoseT } from '@tensorflow-models/posenet';
import * as tf from '@tensorflow/tfjs-core';

const modelFile = 'posenet_mv1_075_float_from_checkpoints.tflite';

type State = {
  msg: string | object | null;
  poses: PoseT[] | null;
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

const MODEL_IMAGE_MEAN = 127.5;
const MODEL_IMAGE_STD = 127.5;

export default class CameraPose extends React.Component<{}, State> {
  state = { msg: null, poses: null };

  constructor(props: {}) {
    super(props);
  }

  log = (msg: string | object) => {
    this.setState({ msg: msg });
  };

  handleVideoPoseResponse = async res => {
    const poseData = res.nativeEvent.data;
    const poses = await decodePoses(poseData);
    this.setState({ poses: poses });
  };

  render() {
    // const poseDebug = this.state.poses ? (
    //   <View style={{ margin: 20, borderWidth: 1, borderColor: 'red' }}>
    //     <HTML html={`<pre>${JSON.stringify(this.state.poses, null, 2)}</pre>`} />
    //   </View>
    // ) : null;

    const camera = (
      <View style={{ height: 200, width: 200, margin: 25 }}>
        <FillToAspectRatio>
          <RNCamera
            style={{ flex: 1 }}
            type={RNCamera.Constants.Type.front}
            modelParams={{
              file: modelFile,
              freqms: 10000,
              mean: MODEL_IMAGE_MEAN,
              std: MODEL_IMAGE_STD,
            }}
            onModelProcessed={this.handleVideoPoseResponse}
          />
        </FillToAspectRatio>
      </View>
    );

    const debugMsg = this.state.msg ? (
      <View style={{ margin: 20, borderWidth: 1, borderColor: 'black' }}>
        <HTML html={`<pre>${JSON.stringify([this.state.msg], null, 2)}</pre>`} />
      </View>
    ) : (
      <Text>No msg</Text>
    );

    return (
      <View style={styles.container}>
        {camera}
        {debugMsg}
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'column',
    backgroundColor: 'yellow',
    alignItems: 'center',
  },
});
