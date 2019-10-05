import * as React from 'react';
import { StyleSheet, Text, View, Dimensions, Switch } from 'react-native';
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
import * as MediaLibrary from 'expo-media-library';
import { TemporaryDirectoryPath } from 'react-native-fs';

type CameraViewToolbarProps = {
  disabled: boolean;
  onZoom: (v: number) => void;
  onFlip: () => void;
};

class CameraViewToolbar extends React.Component<CameraViewToolbarProps, {}> {
  static defaultProps = { disabled: false };
  flipCamera = () => {
    return (
      <Icon.Button
        name="switch-camera"
        onPress={this.props.onFlip}
        borderRadius={0}
        iconStyle={{ marginRight: 20, marginLeft: 20 }}
        disabled={this.props.disabled}
      />
    );
  };

  zoomSlider = () => {
    return (
      <Slider
        style={{ minWidth: '30%' }}
        minimumValue={0}
        maximumValue={1}
        step={0.1}
        onSlidingComplete={this.props.onZoom}
        disabled={this.props.disabled}
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
          alignItems: 'center',
          backgroundColor: 'darkgrey',
        }}>
        {this.flipCamera()}
        {this.zoomSlider()}
        {this.props.children}
      </View>
    );
  }
}

type CameraViewProps = {
  startPaused: boolean;
  isRecording: boolean;
  onCameraRef: (ref: any) => void;
  onPose: (response: any) => void;
  toolbarButtons?: JSX.Element[];
};

type CameraViewState = {
  facingFront: boolean;
  zoom: number;
};

class CameraView extends React.Component<CameraViewProps, CameraViewState> {
  static defaultProps = { startPaused: true, isRecording: false };
  state: CameraViewState = {
    facingFront: true,
    zoom: 0,
  };

  camera = () => {
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
          captureAudio={false}
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
          {this.camera()}
          {this.props.children}
        </View>
        <Overlay style={{ bottom: 0, left: 0, right: 0 }}>
          <CameraViewToolbar
            disabled={this.props.isRecording}
            onZoom={(v: number) => this.setState({ zoom: v })}
            onFlip={() => this.setState({ facingFront: !this.state.facingFront })}>
            {this.props.toolbarButtons}
          </CameraViewToolbar>
        </Overlay>
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

type CapturingTargetPose = 'timer' | 'ready' | 'off';

type State = {
  poses: PoseT[] | null;
  targetPose: PoseT | null;
  targetMatch: {
    keypoints: Keypoint[];
    total: number | null;
    success: boolean;
    triggerVideoRecording: boolean;
  };
  capturingTargetPose: CapturingTargetPose;
  isRecordingVideo: boolean;
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
  static VIDEO_RECORDING_DURATION = 20;
  static KEYPOINT_SCORE_THRESHOLD = 0.25;
  static MATCH_DISTANCE_THRESHOLD = 0.25;
  static ALBUM_NAME = 'posera';

  state: State = {
    poses: null,
    targetPose: null,
    capturingTargetPose: 'off',
    targetMatch: { keypoints: [], total: null, success: false, triggerVideoRecording: false },
    isRecordingVideo: false,
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

  maybeCaptureTargetPose = (pose: PoseT): void => {
    if (this.state.capturingTargetPose == 'ready') {
      this.setState({
        capturingTargetPose: 'off',
        targetPose: pose,
        targetMatch: { keypoints: [], total: null, success: false, triggerVideoRecording: false },
      });
    }
  };

  maybeCompareToTargetPose = async (pose: PoseT) => {
    if (this.state.capturingTargetPose == 'off' && this.state.targetPose) {
      const [keypoints, total] = matchingTargetKeypoints(
        this.state.targetPose,
        pose,
        CameraPose.KEYPOINT_SCORE_THRESHOLD,
        CameraPose.MATCH_DISTANCE_THRESHOLD,
        getModel().inputSize
      );
      const success = keypoints.length == total;
      if (success && this.state.targetMatch.triggerVideoRecording && !this.state.isRecordingVideo) {
        await this.beginVideoRecording();
      }
      this.setState({ targetMatch: { ...this.state.targetMatch, keypoints, total, success } });
    }
  };

  handleVideoPoseResponse = async (res: { nativeEvent: any }) => {
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

    this.maybeCaptureTargetPose(poses[0]);
    await this.maybeCompareToTargetPose(poses[0]);
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

  captureTargetTimer = () => {
    if (this.state.capturingTargetPose == 'timer') {
      return (
        <Overlay
          style={{
            top: 0,
            right: 0,
          }}>
          <Timer onComplete={() => this.setState({ capturingTargetPose: 'ready' })} seconds={3} />
        </Overlay>
      );
    }
  };

  recordingVideoTimer = () => {
    if (this.state.isRecordingVideo) {
      return (
        <Overlay
          style={{
            top: 0,
            right: 0,
          }}>
          <Timer seconds={CameraPose.VIDEO_RECORDING_DURATION} />
        </Overlay>
      );
    }
  };

  captureTargetButton = () => {
    const color = (() => {
      if (this.state.capturingTargetPose != 'off') {
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
        onPress={() => this.setState({ capturingTargetPose: 'timer' })}
        borderRadius={0}
        key="target-pose-button"
        backgroundColor={color}
        iconStyle={{ marginRight: 20, marginLeft: 20 }}
        disabled={this.state.isRecordingVideo}
      />
    );
  };

  poseOverlay = ({
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
          scoreThreshold={CameraPose.KEYPOINT_SCORE_THRESHOLD}
          highlightParts={partsToHighlight}
          {...displayOptions}
        />
      </Overlay>
    );
  };

  lagTimers = () => {
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

  matchLevel = () => {
    const matchFraction = this.state.targetMatch.keypoints.length / this.state.targetMatch.total;
    return !this.state.isRecordingVideo &&
      this.state.capturingTargetPose == 'off' &&
      this.state.targetMatch.total ? (
      <Overlay
        style={{
          top: 0,
          left: 0,
          right: 0,
          height: 50,
          width: `${matchFraction * 100}%`,
          backgroundColor: `hsl(${matchFraction * 120}, 100%, 50%)`,
          borderColor: 'red',
          borderWidth: matchFraction == 1 ? 20 : 0,
        }}
      />
    ) : null;
  };

  stopVideoRecording = () => {
    if (this.state.isRecordingVideo) {
      // this will resolve the promise
      this.cameraRef.stopRecording();
    }
  };

  markNotRecordingVideo = () => {
    this.setState({
      isRecordingVideo: false,
      targetMatch: { ...this.state.targetMatch, triggerVideoRecording: false },
    });
  };

  beginVideoRecording = async () => {
    await MediaLibrary.requestPermissionsAsync();
    this.setState({ isRecordingVideo: true });

    const path = TemporaryDirectoryPath + `/posera-${Date.now()}.mp4`;
    const { uri } = await this.cameraRef.recordAsync({
      maxDuration: CameraPose.VIDEO_RECORDING_DURATION,
      quality: RNCamera.Constants.VideoQuality['4:3'],
      mute: true,
      path,
    });

    this.markNotRecordingVideo();

    // Pose detection (I guess preview images stop) stops during recording
    this.cameraRef.resumePreview();
    await this.handleRecordedVideo(uri);
  };

  handleRecordedVideo = async (cacheUri: string) => {
    // This puts it on external storage from the cache folder
    const asset = await MediaLibrary.createAssetAsync(cacheUri);

    // Put in app-specific album: Broken on Android 10
    // const albums = await MediaLibrary.getAlbumAsync(CameraPose.ALBUM_NAME);
    // if (album) {
    // await MediaLibrary.addAssetsToAlbumAsync([asset], album);
    // } else {
    //   await MediaLibrary.createAlbumAsync(CameraPose.ALBUM_NAME, asset);
    // }
  };

  recordVideoButton = () => {
    const [name, onPress] = this.state.isRecordingVideo
      ? ['stop', this.stopVideoRecording]
      : ['videocam', this.beginVideoRecording];
    return (
      <Icon.Button
        name={name}
        onPress={onPress}
        borderRadius={0}
        iconStyle={{ marginLeft: 20, marginRight: 20 }}
        key="record-video"
      />
    );
  };

  triggerOnTargetMatchSwitch = () => {
    return (
      <Switch
        key="trigger-video"
        onValueChange={(v: boolean) =>
          this.setState({ targetMatch: { ...this.state.targetMatch, triggerVideoRecording: v } })
        }
        value={this.state.targetMatch.triggerVideoRecording}
        disabled={this.state.isRecordingVideo}
      />
    );
  };

  pose = () => {
    return !this.state.isRecordingVideo && this.state.poses && this.state.viewDims
      ? this.poseOverlay({ pose: this.state.poses[0], showBoundingBox: false, opacity: 0.8 })
      : null;
  };

  targetPose = () => {
    return !this.state.isRecordingVideo &&
      this.state.targetPose &&
      this.state.capturingTargetPose == 'off' &&
      this.state.viewDims
      ? this.poseOverlay({
          pose: this.state.targetPose,
          opacity: 0.5,
          highlightParts: false,
          showBoundingBox: false,
          poseColor: 'white',
        })
      : null;
  };

  render() {
    return (
      <View style={styles.container}>
        <CameraView
          startPaused={this.props.startPaused}
          onPose={this.handleVideoPoseResponse}
          isRecording={this.state.isRecordingVideo}
          onCameraRef={ref => {
            this.cameraRef = ref;
          }}
          toolbarButtons={[
            this.captureTargetButton(),
            this.recordVideoButton(),
            this.triggerOnTargetMatchSwitch(),
          ]}>
          {this.pose()}
          {this.targetPose()}
          {this.captureTargetTimer()}
          {this.recordingVideoTimer()}
          {this.matchLevel()}
        </CameraView>
        <View style={{ marginTop: 10 }}>{this.lagTimers()}</View>
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
