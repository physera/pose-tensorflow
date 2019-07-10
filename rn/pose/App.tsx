import * as React from 'react';
import { StyleSheet, Text, View, ScrollView, Platform, Button } from 'react-native';
import Tflite from 'tflite-react-native';
import ImagePicker from 'react-native-image-picker';
import HTML from 'react-native-render-html';
import Svg, { Circle, Line } from 'react-native-svg';
import ImageOverlay from 'react-native-image-overlay';

const modelFile = 'posenet_mv1_075_float_from_checkpoints.tflite';
const labelsFile = '';

let tflite = new Tflite();

type Keypoint = {
  x: number,
  y: number,
  part: string,
  score: number,
};
type PoseT = {
  score: number,
  keypoints: {
    [k: string]: Keypoint,
  },
};
type ImageT = { path: string, width: number, height: number };
type Props = {};
type State = {
  msg: string | object | null,
  image: ImageT | null,
  poses: [PoseT] | null,
};

const reindexPoseByPart = (pose: PoseT): PoseT => {
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

const Pose: React.FunctionComponent<{ pose: PoseT, image: ImageT }> = ({ pose, image }) => {
  pose = reindexPoseByPart(pose);
  const points = Object.values(pose.keypoints).map((kp: Keypoint) => {
    return (
      <Circle cx={kp.x * image.width} cy={kp.y * image.height} r="5" fill="pink" key={kp.part} />
    );
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
        x1={from_kp.x * image.width}
        y1={from_kp.y * image.height}
        x2={to_kp.x * image.width}
        y2={to_kp.y * image.height}
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

  onSelectImage = () => {
    ImagePicker.launchImageLibrary({}, response => {
      if (response.didCancel) {
        this.log('Cancelled');
      } else if (response.error) {
        this.log('Error');
      } else {
        var path = Platform.OS === 'ios' ? response.uri : 'file://' + response.path;
        this.setState({ image: { path: path, width: response.width, height: response.height } });
        tflite.runPoseNetOnImage(
          {
            path,
            threshold: 0.3,
          },
          (err, res) => {
            if (err) this.log(err);
            else this.setState({ poses: res });
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
          <View style={{ marginTop: 25 }}>
            {this.state.image ? (
              <ImageOverlay
                height={this.state.image.height}
                source={{ uri: this.state.image.path }}
                contentPosition="top">
                {this.state.poses ? (
                  <Pose pose={this.state.poses[0]} image={this.state.image} />
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
            ) : null}
          </View>
        </View>
      </ScrollView>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
