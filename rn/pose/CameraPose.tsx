import * as React from 'react';
import { StyleSheet, Text, View, Dimensions } from 'react-native';
import FillToAspectRatio from './FillToAspectRatio';
import HTML from 'react-native-render-html';
import { RNCamera } from 'react-native-camera';
import { Pose, decodePoses, PoseT, Dims, MODEL_FILE, MODEL_INPUT_SIZE } from './Pose';

type Timers =
  | 'responseReceived'
  | 'inference'
  | 'imageTime'
  | 'inferenceBeginTime'
  | 'inferenceEndTime'
  | 'serializationBeginTime'
  | 'serializationEndTime'
  | 'other';

type State = {
  msg: string | object | null;
  poses: PoseT[] | null;
  cameraView: Dims | null;
  timers: { [key in Timers]?: number } | null;
};

const MODEL_IMAGE_MEAN = 127.5;
const MODEL_IMAGE_STD = 127.5;

export default class CameraPose extends React.Component<{}, State> {
  state = { msg: null, poses: null, cameraView: null, timers: null };

  constructor(props: {}) {
    super(props);
  }

  log = (msg: string | object) => {
    this.setState({ msg: msg });
  };

  handleVideoPoseResponse = async res => {
    const responseReceived = Date.now();
    const poseData = res.nativeEvent.data;
    // console.log(this.camera.getAvailablePictureSizes());

    const inferenceTime = res.nativeEvent.timing.inference_ns / 1e6;
    const imageTime = res.nativeEvent.timing.imageTime;
    const inferenceBeginTime = res.nativeEvent.timing.inferenceBeginTime;
    const inferenceEndTime = res.nativeEvent.timing.inferenceEndTime;
    const serializationBeginTime = res.nativeEvent.timing.serializationBeginTime;
    const serializationEndTime = res.nativeEvent.timing.serializationEndTime;
    this.setState({
      poses: poses,
      timers: {
        ...this.state.timers,
        responseReceived,
        inference: inferenceTime,
        imageTime,
        inferenceBeginTime,
        inferenceEndTime,
        serializationEndTime,
        serializationBeginTime,
      },
    });
  };

  getPosesToDisplay = (): PoseT[] | null => {
    if (this.state.poses && this.state.poses.length) {
      return this.state.poses;
    }
  };

  render() {
    // const poseDebug = this.state.poses ? (
    //   <View style={{ margin: 20, borderWidth: 1, borderColor: 'red' }}>
    //     <HTML html={`<pre>${JSON.stringify(this.state.poses, null, 2)}</pre>`} />
    //   </View>
    // ) : null;

    const camera = (
      <FillToAspectRatio>
        <RNCamera
          style={{ flex: 1 }}
          type={RNCamera.Constants.Type.front}
          defaultVideoQuality={RNCamera.Constants.VideoQuality['480p']}
          modelParams={{
            file: MODEL_FILE,
            mean: MODEL_IMAGE_MEAN,
            std: MODEL_IMAGE_STD,
            freqms: 200,
          }}
          onModelProcessed={this.handleVideoPoseResponse}
          useCamera2Api={false}
        />
      </FillToAspectRatio>
    );

    const posesToDisplay = this.getPosesToDisplay();
    const poseOverlay = posesToDisplay ? (
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          borderColor: 'blue',
          borderWidth: 0,
          width: this.state.cameraView.width,
          height: this.state.cameraView.height,
        }}>
        <Pose
          poseIn={posesToDisplay[0]}
          imageDims={this.state.cameraView}
          viewDims={this.state.cameraView}
          modelInputSize={MODEL_INPUT_SIZE}
          radius={5}
          strokeWidth={20}
        />
      </View>
    ) : null;

    const cameraView = (
      <View
        style={{
          // height: Dimensions.get('window').height,
          width: Dimensions.get('window').width,
          height: Dimensions.get('window').width * (4.0 / 3.0),
          borderColor: 'black',
          borderWidth: 0,
        }}
        onLayout={evt => this.setState({ cameraView: evt.nativeEvent.layout })}>
        {camera}
        {poseOverlay}
      </View>
    );

    const debugMsg = this.state.msg ? (
      <View style={{ margin: 20, borderWidth: 1, borderColor: 'black' }}>
        <HTML html={`<pre>${JSON.stringify([this.state.msg], null, 2)}</pre>`} />
      </View>
    ) : (
      <Text>No msg</Text>
    );

    const timeNow = Date.now();
    return (
      <View style={styles.container}>
        {cameraView}
        {this.state.timers && this.state.timers.responseReceived ? (
          <Text>Since response: {timeNow - this.state.timers.responseReceived}ms</Text>
        ) : null}
        {this.state.timers && this.state.timers.inference ? (
          <Text>Inference: {this.state.timers.inference}ms</Text>
        ) : null}
        {this.state.timers && this.state.timers.imageTime ? (
          <Text>Lag-image: {timeNow - this.state.timers.imageTime}ms</Text>
        ) : null}
        {this.state.timers && this.state.timers.inferenceBeginTime ? (
          <Text>Lag-inference-begin: {timeNow - this.state.timers.inferenceBeginTime}ms</Text>
        ) : null}
        {this.state.timers && this.state.timers.inferenceEndTime ? (
          <Text>Lag-inference-end: {timeNow - this.state.timers.inferenceEndTime}ms</Text>
        ) : null}
        {this.state.timers && this.state.timers.serializationBeginTime ? (
          <Text>Lag-serial: {timeNow - this.state.timers.serializationBeginTime}ms</Text>
        ) : null}
        {this.state.timers && this.state.timers.serializationEndTime ? (
          <Text>Lag-serial-end: {timeNow - this.state.timers.serializationEndTime}ms</Text>
        ) : null}
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
