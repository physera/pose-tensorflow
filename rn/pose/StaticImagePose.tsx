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

let tflite = new Tflite();

type ImageT = { path: string } & Dims;
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
    tflite.loadModel({ model: MODEL_FILE, labels: '' });
  }

  getImageViewDims = (): Dims => {
    // Setting these to %s is weird because the dims are passed
    // on to the Image, and then they apply twice, once relative
    // to the outer container, then relative to the
    // ImageBackground container as well
    const window = Dimensions.get('window');
    return {
      height: window.height * 0.8,
      width: window.width * 0.9,
    };
  };

  handleImagePoseResponse = async res => {
    const poses = await decodePoses('multiple', res);
    this.setState({ poses: poses });
  };

  onSelectImage = () => {
    ImagePicker.launchImageLibrary({}, response => {
      console.log(response);
      if (response.didCancel) {
        this.log('Cancelled');
      } else if (response.error) {
        this.log('Error');
      } else {
        var path = Platform.OS === 'ios' ? response.uri : 'file://' + response.path;
        const [height, width] = response.isVertical
          ? [response.height, response.width]
          : [response.width, response.height];
        this.setState({
          image: { path: path, width: width, height: height },
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
        tflite.runModelOnImageMulti({ path }, async (err, res) => {
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

  getPosesToDisplay = (): PoseT[] | null => {
    if (this.state.image && this.state.poses && this.state.poses.length) {
      return this.state.poses;
    }
  };

  _getSelectButton = () => {
    return (
      <View style={{ margin: 25 }}>
        <Button title="Select Image" onPress={this.onSelectImage} />
      </View>
    );
  };

  _getImageView = () => {
    if (!this.state.image) {
      return null;
    }

    const imageViewDims = this.getImageViewDims();
    const scaledImageDims = getScaledImageDims(this.state.image, imageViewDims);
    console.log([imageViewDims, this.state.image, scaledImageDims]);

    // const poseDebug = this.state.poses ? (
    //   <View style={{ margin: 20, borderWidth: 1, borderColor: 'red' }}>
    //     <HTML html={`<pre>${JSON.stringify(this.state.poses, null, 2)}</pre>`} />
    //   </View>
    // ) : null;

    const posesToDisplay = this.getPosesToDisplay();
    const poseOverlay = posesToDisplay ? (
      <Pose
        poseIn={posesToDisplay[0]}
        imageDims={scaledImageDims}
        modelInputSize={MODEL_INPUT_SIZE}
        rotation={0}
      />
    ) : null;

    const imageView = (
      <View
        style={{
          borderColor: 'blue',
          borderWidth: 2,
        }}>
        <Image
          source={{ uri: this.state.image.path }}
          style={{
            borderColor: 'orange',
            borderWidth: 2,
            ...scaledImageDims,
          }}
          resizeMode="contain"
          resizeMethod="scale"
          onLayout={evt => console.log(evt.nativeEvent)}
        />
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            borderColor: 'red',
            borderWidth: 0,
            ...scaledImageDims,
          }}>
          {poseOverlay}
        </View>
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
      <View>
        {imageView}
        {debugMsg}
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
