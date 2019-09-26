import * as React from 'react';
import { StyleSheet, Text, View, Dimensions, Button } from 'react-native';
import FillToAspectRatio from './FillToAspectRatio';
import { RNCamera } from 'react-native-camera';
import { Pose, PoseT, Dims, MODEL_FILE, MODEL_INPUT_SIZE, MODEL_OUTPUT_STRIDE } from './Pose';
import Timer from './Timer';

type Timers =
  | 'responseReceived'
  | 'inference'
  | 'imageTime'
  | 'inferenceBeginTime'
  | 'inferenceEndTime'
  | 'serializationBeginTime'
  | 'serializationEndTime'
  | 'other';

type RecordingTargetPose = 'timer' | 'ready' | 'off';

type State = {
  poses: PoseT[] | null;
  targetPose: PoseT | null;
  recordingTargetPose: RecordingTargetPose;
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
  state: State = {
    poses: null,
    targetPose: null,
    recordingTargetPose: 'off',
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

  _maybeRecordTargetPose = (poses: PoseT[]): void => {
    if (this.state.recordingTargetPose == 'ready') {
      this.setState({ recordingTargetPose: 'off', targetPose: poses[0] });
      this.cameraRef.pausePreview();
      setTimeout(() => {
        this.cameraRef.resumePreview();
      }, 3 * 1000);
    }
  };

  handleVideoPoseResponse = async res => {
    const responseReceived = Date.now();

    const evt = res.nativeEvent;
    const poses = evt.data;
    if (!(poses && poses.length)) {
      return;
    }

    // Lags
    const inferenceTime = evt.timing.inference_ns / 1e6;
    const imageTime = evt.timing.imageTime;
    const inferenceBeginTime = evt.timing.inferenceBeginTime;
    const inferenceEndTime = evt.timing.inferenceEndTime;
    const serializationBeginTime = evt.timing.serializationBeginTime;
    const serializationEndTime = evt.timing.serializationEndTime;

    const width = evt.dimensions.width * evt.scale.scaleX;
    const height = evt.dimensions.height * evt.scale.scaleY;

    this._maybeRecordTargetPose(poses);
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

  _flipCamera = () => {
    return (
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          margin: 5,
        }}>
        <Button
          title="Flip"
          color="pink"
          onPress={() => this.setState({ facingFront: !this.state.facingFront })}
        />
      </View>
    );
  };

  _targetTimer = () => {
    if (this.state.recordingTargetPose == 'timer') {
      return (
        <View
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
          }}>
          <Timer onComplete={() => this.setState({ recordingTargetPose: 'ready' })} />
        </View>
      );
    }
  };

  _targetPoseButton = () => {
    const [title, color] = (() => {
      if (this.state.recordingTargetPose != 'off') {
        return ['Recording', 'orange'];
      } else if (this.state.targetPose) {
        return ['Update target pose', 'brown'];
      } else {
        return ['Record target pose', null];
      }
    })();

    return (
      <Button
        title={title}
        color={color}
        onPress={() => this.setState({ recordingTargetPose: 'timer' })}
      />
    );
  };

  _poseOverlay = ({ pose, opacity }: { pose: PoseT; opacity: number }) => {
    return (
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: this.state.cameraView.width,
          height: this.state.cameraView.height,
          opacity: opacity,
        }}>
        <Pose
          poseIn={pose}
          imageDims={this.state.cameraView}
          modelInputSize={MODEL_INPUT_SIZE}
          rotation={this.state.rotation}
        />
      </View>
    );
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
    if (!__DEV__) {
      return null;
    }
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
        }}>
        {this._camera()}
        {this.state.poses && this.state.cameraView
          ? this._poseOverlay({ pose: this.state.poses[0], opacity: 1.0 })
          : null}
        {this.state.targetPose && this.state.recordingTargetPose == 'off' && this.state.cameraView
          ? this._poseOverlay({ pose: this.state.targetPose, opacity: 0.5 })
          : null}
        {this._flipCamera()}
        {this._targetTimer()}
      </View>
    );

    return (
      <View style={styles.container}>
        {cameraView}
        <View style={{ margin: 10 }}>{this._targetPoseButton()}</View>
        {this._lagTimers()}
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
