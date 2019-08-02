import * as React from 'react';
import { StyleSheet, Text, View, Dimensions } from 'react-native';
import FillToAspectRatio from './FillToAspectRatio';
import HTML from 'react-native-render-html';
import { RNCamera } from 'react-native-camera';
import { Pose, decodePoses, PoseT, Dims } from './Pose';

const modelFile = 'posenet_mv1_075_float_from_checkpoints.tflite';

type State = {
  msg: string | object | null;
  poses: PoseT[] | null;
  cameraView: Dims | null;
};

const MODEL_INPUT_SIZE = 337;
const MODEL_IMAGE_MEAN = 127.5;
const MODEL_IMAGE_STD = 127.5;

export default class CameraPose extends React.Component<{}, State> {
  state = { msg: null, poses: null, cameraView: null };

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
          modelParams={{
            file: modelFile,
            freqms: 0,
            mean: MODEL_IMAGE_MEAN,
            std: MODEL_IMAGE_STD,
          }}
          onModelProcessed={this.handleVideoPoseResponse}
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
          borderWidth: 2,
        }}>
        <Pose
          poseIn={posesToDisplay[0]}
          imageDims={this.state.cameraView}
          viewDims={this.state.cameraView}
          modelInputSize={MODEL_INPUT_SIZE}
        />
      </View>
    ) : null;

    const cameraView = (
      <View
        style={{
          // height: Dimensions.get('window').height,
          width: Dimensions.get('window').width,
          height: '90%',
          borderColor: 'black',
          borderWidth: 5,
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

    return (
      <View style={styles.container}>
        {cameraView}
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
