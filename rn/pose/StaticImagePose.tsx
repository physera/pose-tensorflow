import * as React from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Platform,
  Button,
  Image,
  Dimensions,
} from 'react-native';
import HTML from 'react-native-render-html';
import ImagePicker from 'react-native-image-picker';
import Tflite from 'tflite-react-native';
import { Pose, decodePoses, PoseT, Dims, MODEL_FILE, MODEL_INPUT_SIZE } from './Pose';
import Overlay from './Overlay';

let tflite = new Tflite();

type ImageT = { path: string; rotation: number } & Dims;
type State = {
  msg: string | object | null;
  image: ImageT | null;
  poses: PoseT[] | null;
};

const getScaledImageDims = (imageDims: Dims, viewDims: Dims): Dims => {
  const isTallerThanView = imageDims.height > viewDims.height;
  const isWiderThanView = imageDims.width > viewDims.width;
  const aspectRatio = imageDims.height / imageDims.width;

  const pinHeightToViewDims = {
    height: viewDims.height,
    width: (1 / aspectRatio) * viewDims.height,
  };
  const pinWidthToViewDims = {
    width: viewDims.width,
    height: aspectRatio * viewDims.width,
  };

  if (isTallerThanView && isWiderThanView) {
    if (imageDims.height / viewDims.height > imageDims.width / viewDims.width) {
      return pinHeightToViewDims;
    } else {
      return pinWidthToViewDims;
    }
  } else if (isTallerThanView) {
    return pinHeightToViewDims;
  } else if (isWiderThanView) {
    return pinWidthToViewDims;
  } else {
    return imageDims;
  }
};

export default class StaticImagePose extends React.Component<{}, State> {
  state = { msg: null, image: null, poses: null };

  constructor(props: {}) {
    super(props);
    tflite.loadModel({ model: MODEL_FILE });
  }

  getImageViewDims = (): Dims => {
    const window = Dimensions.get('window');
    return {
      height: window.height * 0.8,
      width: window.width * 0.9,
    };
  };

  handleImagePoseResponse = async res => {
    const poses = await decodePoses('multiple', res);
    if (poses && poses.length) {
      this.setState({ poses: poses });
    }
  };

  onSelectImage = () => {
    ImagePicker.launchImageLibrary({}, response => {
      if (response.didCancel) {
        this.log('Cancelled');
      } else if (response.error) {
        this.log('Error');
      } else {
        var path = Platform.OS === 'ios' ? response.uri : 'file://' + response.path;
        const [height, width] = response.isVertical
          ? [response.height, response.width]
          : [response.width, response.height];

        // @ts-ignore (the type is incorrect)
        const rotation = response.originalRotation;
        this.setState({
          image: { path, rotation, width: width, height: height },
        });
        tflite.runModelOnImageMulti({ path, rotation }, async (err, res) => {
          if (err) this.log(err);
          else {
            await this.handleImagePoseResponse(res);
          }
        });
      }
    });
  };

  log = (msg: string | object) => {
    this.setState({ msg: msg });
  };

  _getSelectButton = () => {
    return (
      <View style={{ margin: 25 }}>
        <Button title="Select Image" onPress={this.onSelectImage} />
      </View>
    );
  };

  _debugMsg = () => {
    if (!__DEV__) {
      return null;
    }
    return this.state.msg ? (
      <View style={{ margin: 20 }}>
        <HTML html={`<pre>${JSON.stringify([this.state.msg], null, 2)}</pre>`} />
      </View>
    ) : (
      <Text>No msg</Text>
    );
  };

  _getImageView = () => {
    if (!this.state.image) {
      return null;
    }

    const imageViewDims = this.getImageViewDims();
    const scaledImageDims = getScaledImageDims(this.state.image, imageViewDims);

    const poseOverlay = this.state.poses ? (
      <Pose
        poseIn={this.state.poses[0]}
        imageDims={scaledImageDims}
        modelInputSize={MODEL_INPUT_SIZE}
        rotation={0}
        scoreThreshold={0.25}
      />
    ) : null;

    const imageView = (
      <View>
        <Image
          source={{ uri: this.state.image.path }}
          style={{
            ...scaledImageDims,
          }}
          resizeMode="contain"
          resizeMethod="scale"
        />
        <Overlay
          style={{
            top: 0,
            left: 0,
            ...scaledImageDims,
          }}>
          {poseOverlay}
        </Overlay>
      </View>
    );

    return (
      <View>
        {imageView}
        {this._debugMsg()}
      </View>
    );
  };

  render() {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        {this._getSelectButton()}
        {this._getImageView()}
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
