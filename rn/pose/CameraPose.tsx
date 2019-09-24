import * as React from 'react';
import { StyleSheet, Text, View, Dimensions, Button } from 'react-native';
import FillToAspectRatio from './FillToAspectRatio';
import HTML from 'react-native-render-html';
import { RNCamera } from 'react-native-camera';
import { Pose, PoseT, Dims, MODEL_FILE, MODEL_INPUT_SIZE, MODEL_OUTPUT_STRIDE } from './Pose';

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
  rotation: number;
  facingFront: boolean;
  timers: { [key in Timers]?: number } | null;
};

type Props = {
  routeKey: string;
  startPaused: boolean;
  registerOnEnter: Function;
  registerOnLeave: Function;
};

const MODEL_IMAGE_MEAN = 127.5;
const MODEL_IMAGE_STD = 127.5;

export default class CameraPose extends React.Component<Props, State> {
  static defaultProps = { startPaused: true };
  state = {
    msg: null,
    poses: null,
    cameraView: null,
    timers: null,
    facingFront: true,
    rotation: 0,
  };
  cameraRef: any;

  constructor(props: Props) {
    super(props);
    this.props.registerOnLeave(this.props.routeKey, () => {
      this.cameraRef.pausePreview();
    });
    this.props.registerOnEnter(this.props.routeKey, () => {
      this.cameraRef.resumePreview();
    });
  }

  log = (msg: string | object) => {
    this.setState({ msg: msg });
  };

  handleVideoPoseResponse = async res => {
    const responseReceived = Date.now();
    const evt = res.nativeEvent;
    const poses = evt.data;

    console.log(evt);
    console.log([
      evt.dimensions.rotation,
      evt.dimensions.cameraOrientation,
      evt.dimensions.deviceRotation,
    ]);
    // console.log(this.camera.getAvailablePictureSizes());

    const inferenceTime = evt.timing.inference_ns / 1e6;
    const imageTime = evt.timing.imageTime;
    const inferenceBeginTime = evt.timing.inferenceBeginTime;
    const inferenceEndTime = evt.timing.inferenceEndTime;
    const serializationBeginTime = evt.timing.serializationBeginTime;
    const serializationEndTime = evt.timing.serializationEndTime;

    const width = evt.dimensions.width * evt.scale.scaleX;
    const height = evt.dimensions.height * evt.scale.scaleY;

    this.setState({
      poses: poses,
      cameraView: {
        width: width,
        height: height,
      },
      rotation: evt.dimensions.deviceRotation,

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

  _flipCamera = () => {
    return (
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
        }}>
        <Button
          title="Flip"
          color="#f194ff"
          onPress={() => this.setState({ facingFront: !this.state.facingFront })}
        />
      </View>
    );
  };

  _poseOverlay = () => {
    const posesToDisplay = this.getPosesToDisplay();
    return posesToDisplay && this.state.cameraView ? (
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
          modelInputSize={MODEL_INPUT_SIZE}
          rotation={this.state.rotation}
        />
      </View>
    ) : null;
  };

  _camera = () => {
    // autoFocusPointOfInterest: note that coordinates are in landscape with home to right
    return (
      <FillToAspectRatio>
        <RNCamera
          ref={ref => {
            this.cameraRef = ref;
          }}
          style={{ flex: 1 }}
          type={
            this.state.facingFront ? RNCamera.Constants.Type.front : RNCamera.Constants.Type.back
          }
          defaultVideoQuality={RNCamera.Constants.VideoQuality['4:3']}
          autoFocus={RNCamera.Constants.AutoFocus.on} // TODO: autoFocusPointOfInterest
          ratio="4:3" // default
          zoom={0}
          modelParams={{
            file: MODEL_FILE,
            mean: MODEL_IMAGE_MEAN,
            std: MODEL_IMAGE_STD,
            freqms: 0,
            outputStride: MODEL_OUTPUT_STRIDE,
          }}
          onModelProcessed={this.handleVideoPoseResponse}
        />
      </FillToAspectRatio>
    );
  };

  _lagTimers = () => {
    const timeNow = Date.now();
    return (
      <View>
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
      </View>
    );
  };

  render() {
    const cameraView = (
      <View
        style={{
          width: Dimensions.get('window').width,
          height: Dimensions.get('window').width * (4.0 / 3.0),
          borderColor: 'black',
          borderWidth: 0,
        }}>
        {this._camera()}
        {this._poseOverlay()}
        {this._flipCamera()}
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
        {cameraView}
        {this._lagTimers()}
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
