import * as React from 'react';
import { StyleSheet, Text, View, Dimensions, Button } from 'react-native';
import { RNCamera } from 'react-native-camera';
import Slider from '@react-native-community/slider';
import {
  Pose,
  PoseDisplayOptions,
  PoseT,
  Keypoint,
  Dims,
  getModel,
  matchingTargetKeypoints,
} from './Pose';
import Timer from './Timer';
import Overlay from './Overlay';
import Icon from 'react-native-vector-icons/MaterialIcons';

type CameraViewToolbarProps = {
  onZoom: (v: number) => void;
  onFlip: () => void;
};

class CameraViewToolbar extends React.Component<CameraViewToolbarProps, {}> {
  _flipCamera = () => {
    return (
      <Icon.Button
        name="switch-camera"
        onPress={this.props.onFlip}
        borderRadius={0}
        iconStyle={{ marginRight: 5 }}
      />
    );
  };

  _zoomSlider = () => {
    return (
      <Slider
        style={{ width: '80%', height: 25, marginTop: 10 }}
        minimumValue={0}
        maximumValue={1}
        step={0.1}
        onSlidingComplete={this.props.onZoom}
      />
    );
  };

  render() {
    return (
      <View
        style={{
          width: '100%',
          flexDirection: 'row',
          justifyContent: 'space-between',
        }}>
        {this._flipCamera()}
        {this._zoomSlider()}
        {this.props.children}
      </View>
    );
  }
}

type CameraViewProps = {
  startPaused: boolean;
  onCameraRef: (ref: any) => void;
  onPose: (response: any) => void;
  toolbarButtons?: JSX.Element[];
};

type CameraViewState = {
  facingFront: boolean;
  zoom: number;
};

class CameraView extends React.Component<CameraViewProps, CameraViewState> {
  static defaultProps = { startPaused: true };
  state: CameraViewState = {
    facingFront: true,
    zoom: 0,
  };

  _camera = () => {
    // autoFocusPointOfInterest: note that coordinates are in landscape with home to right
    return (
      <View
        style={{
          width: Dimensions.get('window').width,
          height: Dimensions.get('window').width * (4.0 / 3.0),
        }}>
        <RNCamera
          ref={this.props.onCameraRef}
          style={{
            flex: 1,
          }}
          zoom={this.state.zoom}
          type={
            this.state.facingFront ? RNCamera.Constants.Type.front : RNCamera.Constants.Type.back
          }
          defaultVideoQuality={RNCamera.Constants.VideoQuality['4:3']}
          autoFocus={RNCamera.Constants.AutoFocus.on} // TODO: autoFocusPointOfInterest
          ratio="4:3" // default
          modelParams={{
            freqms: 0,
            ...getModel(),
          }}
          onModelProcessed={this.props.onPose}
        />
      </View>
    );
  };

  render() {
    return (
      <View
        style={{
          alignItems: 'center',
          width: '100%',
        }}>
        <View>
          {this._camera()}
          {this.props.children}
        </View>
        <CameraViewToolbar
          onZoom={(v: number) => this.setState({ zoom: v })}
          onFlip={() => this.setState({ facingFront: !this.state.facingFront })}>
          {this.props.toolbarButtons}
        </CameraViewToolbar>
      </View>
    );
  }
}

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
  targetMatch: { keypoints: Keypoint[]; total: number | null };
  recordingTargetPose: RecordingTargetPose;
  viewDims: Dims | null;
  rotation: number;
  timers: { [key in Timers]?: number } | null;
};

type Props = {
  routeKey: string;
  startPaused: boolean;
  registerOnEnter: (key: string, fn: () => void) => void;
  registerOnLeave: (key: string, fn: () => void) => void;
};

export default class CameraPose extends React.Component<Props, State> {
  static defaultProps = { startPaused: true };
  state: State = {
    poses: null,
    targetPose: null,
    recordingTargetPose: 'off',
    targetMatch: { keypoints: [], total: null },
    viewDims: null,
    timers: null,
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

  _maybeRecordTargetPose = (pose: PoseT): void => {
    if (this.state.recordingTargetPose == 'ready') {
      this.setState({
        recordingTargetPose: 'off',
        targetPose: pose,
        targetMatch: { total: null, keypoints: [] },
      });
    }
  };

  _maybeCompareToTargetPose = (pose: PoseT): void => {
    if (this.state.recordingTargetPose == 'off' && this.state.targetPose) {
      const [keypoints, total] = matchingTargetKeypoints(
        this.state.targetPose,
        pose,
        0.25, // scoreThreshold
        0.25, // distanceThreshold
        getModel().inputSize
      );
      this.setState({ targetMatch: { keypoints, total } });
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

    this._maybeRecordTargetPose(poses[0]);
    this._maybeCompareToTargetPose(poses[0]);
    this.setState({
      poses: poses,
      viewDims: {
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

  _targetTimer = () => {
    if (this.state.recordingTargetPose == 'timer') {
      return (
        <Overlay
          style={{
            top: 0,
            right: 0,
          }}>
          <Timer onComplete={() => this.setState({ recordingTargetPose: 'ready' })} seconds={3} />
        </Overlay>
      );
    }
  };

  _targetPoseButton = () => {
    const color = (() => {
      if (this.state.recordingTargetPose != 'off') {
        return 'red';
      } else if (this.state.targetPose) {
        return 'green';
      } else {
        return '#007AFF';
      }
    })();

    return (
      <Icon.Button
        name="accessibility"
        onPress={() => this.setState({ recordingTargetPose: 'timer' })}
        borderRadius={0}
        key="target-pose-button"
        backgroundColor={color}
        iconStyle={{ marginRight: 0 }}
      />
    );
  };

  _poseOverlay = ({
    pose,
    opacity = 1.0,
    highlightParts = true,
    ...displayOptions
  }: {
    pose: PoseT;
    opacity?: number | null;
    highlightParts?: boolean;
  } & PoseDisplayOptions) => {
    const partsToHighlight = highlightParts
      ? this.state.targetMatch.keypoints.reduce(
          (result: { [key: string]: boolean }, kp: Keypoint) => {
            result[kp.part] = true;
            return result;
          },
          {}
        )
      : {};

    return (
      <Overlay
        style={{
          top: 0,
          left: 0,
          opacity: opacity,
        }}>
        <Pose
          poseIn={pose}
          imageDims={this.state.viewDims}
          modelInputSize={getModel().inputSize}
          rotation={this.state.rotation}
          scoreThreshold={0.25}
          highlightParts={partsToHighlight}
          {...displayOptions}
        />
      </Overlay>
    );
  };

  _lagTimers = () => {
    if (__DEV__) {
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
    }
  };

  _matchLevel = () => {
    const matchFraction = this.state.targetMatch.keypoints.length / this.state.targetMatch.total;
    return this.state.targetMatch.total ? (
      <Overlay
        style={{
          bottom: 0,
          left: 0,
          height: 50,
          width: `${matchFraction * 100}%`,
          backgroundColor: `hsl(${matchFraction * 120}, 100%, 50%)`,
          borderColor: 'red',
          borderWidth: matchFraction == 1 ? 20 : 0,
        }}
      />
    ) : null;
  };

  render() {
    const pose =
      this.state.poses && this.state.viewDims
        ? this._poseOverlay({ pose: this.state.poses[0], showBoundingBox: false, opacity: 0.8 })
        : null;

    const targetPose =
      this.state.targetPose && this.state.recordingTargetPose == 'off' && this.state.viewDims
        ? this._poseOverlay({
            pose: this.state.targetPose,
            opacity: 0.5,
            highlightParts: false,
            showBoundingBox: false,
            poseColor: 'white',
          })
        : null;

    return (
      <View style={styles.container}>
        <CameraView
          startPaused={this.props.startPaused}
          onPose={this.handleVideoPoseResponse}
          onCameraRef={ref => {
            this.cameraRef = ref;
          }}
          toolbarButtons={[this._targetPoseButton()]}>
          {pose}
          {targetPose}
          {this._targetTimer()}
          {this._matchLevel()}
        </CameraView>
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
