import * as React from 'react';
import { StyleSheet, View, ScrollView, Platform, Image, Dimensions } from 'react-native';
import ImagePicker from 'react-native-image-picker';
import Tflite from 'tflite-react-native';
import { Pose, decodePoses, PoseT, Dims, getModel } from './Pose';
import Overlay from './Overlay';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { ImageScreen as colors } from './Colors';
import { NavigationTabProp } from 'react-navigation-tabs';
import { SettingsContext } from './Settings';

let tflite = new Tflite();

type ImageT = { path: string; rotation: number } & Dims;

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

type Props = {
  navigation: NavigationTabProp;
};

type State = {
  msg: string | object | null;
  image: ImageT | null;
  poses: PoseT[] | null;
  currentModelName: string | null;
};

export default class ImageScreen extends React.Component<Props, State> {
  state = { msg: null, image: null, poses: null, currentModelName: null };
  static contextType = SettingsContext;

  componentDidMount() {
    this.loadModel();
  }

  componentDidUpdate() {
    if (this.context.name != this.state.currentModelName) {
      this.loadModel();
    }
  }

  loadModel = () => {
    tflite.loadModel({ model: getModel(this.context.name).file });
    this.setState({ currentModelName: this.context.name });
  };

  getImageViewDims = (): Dims => {
    const window = Dimensions.get('window');
    return {
      height: window.height * 0.8,
      width: window.width * 0.9,
    };
  };

  handleImagePoseResponse = async res => {
    const poses = await decodePoses('multiple', getModel(this.context.name), res);
    if (poses && poses.length) {
      this.setState({ poses: poses });
    }
  };

  onSelectImage = () => {
    ImagePicker.launchImageLibrary({}, response => {
      if (response.didCancel) {
        console.log('Cancelled');
      } else if (response.error) {
        console.log('Error');
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
          if (err) console.log(err);
          else {
            await this.handleImagePoseResponse(res);
          }
        });
      }
    });
  };

  _getSelectButton = () => {
    return (
      <View style={{ margin: 25 }}>
        <Icon.Button
          name="camera-roll"
          onPress={this.onSelectImage}
          backgroundColor={colors.button.background}>
          Select image
        </Icon.Button>
      </View>
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
        pose={this.state.poses[0]}
        imageDims={scaledImageDims}
        modelInputSize={getModel(this.context.name).inputSize}
        rotation={0}
        scoreThreshold={0.25}
      />
    ) : null;

    return (
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
          }}>
          {poseOverlay}
        </Overlay>
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
    backgroundColor: colors.background,
    alignItems: 'center',
  },
});
