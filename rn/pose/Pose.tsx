import * as React from 'react';
import {
  decodeMultiplePoses,
  scalePose,
  Keypoint,
  Pose as PoseT,
} from '@tensorflow-models/posenet';

import * as tf from '@tensorflow/tfjs-core';
import Svg, { Circle, Line } from 'react-native-svg';

export type Dims = { width: number; height: number };

export { PoseT };

const reindexPoseByPart = (
  pose: PoseT
): { score: number; keypoints: { [k: string]: Keypoint } } => {
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

const _scaleDims = (largerDim: number, viewDim: number, smallerDim: number): [number, number] => {
  const scaledLargerDim = Math.min(largerDim, viewDim);
  const scaledSmallerDim = (scaledLargerDim / largerDim) * smallerDim;
  return [scaledLargerDim, scaledSmallerDim];
};

const getScaledImageDims = (imageDims: Dims, viewDims: Dims): Dims => {
  // We are using ImageBackground with dimensions = getImageViewDims()
  // with resizeMode=contain. This means that the Image will get
  // scaled such that one dimension will be set to the size of the
  // ImageBackground and the other will be scaled proportionally to
  // maintain the right aspect ratio, and will be smaller than the
  // corresponding ImageBackground dimension.
  //
  // These scaled dimensions are computed in getScaledImageDims().
  const heightRatio = viewDims.height / imageDims.height;
  const widthRatio = viewDims.width / imageDims.width;

  let scaledHeight: number;
  let scaledWidth: number;

  if (heightRatio <= widthRatio) {
    [scaledHeight, scaledWidth] = _scaleDims(imageDims.height, viewDims.height, imageDims.width);
  } else {
    [scaledWidth, scaledHeight] = _scaleDims(imageDims.width, viewDims.width, imageDims.height);
  }
  return { height: scaledHeight, width: scaledWidth };
};

// * Scaling considerations
//
// We are using ImageBackground with dimensions = getImageViewDims()
// with resizeMode=contain. This means that the Image will get
// scaled, these scaled dimensions are computed in
// getScaledImageDims() - see for more detail.
//
// Now the Pose needs to get overlaid on this ImageBackground such
// that it actually sits on top of the Image.
//
// To do this, we position the Svg assuming that the scaled Image is
// centered in both dimensions in the ImageBackground (setting top,
// left based on this), and then set the Svg's dimensions to be the
// scaled image dimensions.
//
// We then set the viewBox of the Svg to also be the scaled image
// dimensions, and scale the pose to these dimensions as well.
//
// (In theory the viewBox could be set to the original image
// dimensions without scaling the pose, but the size of the
// circle/lines will then be according to that scale and look tiny
// in some cases.)
//
//

export const Pose: React.FunctionComponent<{
  poseIn: PoseT;
  imageDims: Dims; // the image for which pose is inferred
  viewDims: Dims; // the ImageBackground view in which the image is placed, and scaled to
  modelInputSize: number;
  strokeWidth: number;
  radius: number;
}> = ({ poseIn, imageDims, viewDims, modelInputSize, strokeWidth, radius }) => {
  const scaledImageDims = getScaledImageDims(imageDims, viewDims);
  const scaledPose = scalePose(
    poseIn,
    scaledImageDims.height / modelInputSize,
    scaledImageDims.width / modelInputSize
  );

  const pose = reindexPoseByPart(scaledPose);
  const points = Object.values(pose.keypoints).map((kp: Keypoint) => {
    return <Circle cx={kp.position.x} cy={kp.position.y} r={radius} fill="pink" key={kp.part} />;
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
        x1={from_kp.position.x}
        y1={from_kp.position.y}
        x2={to_kp.position.x}
        y2={to_kp.position.y}
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        key={`${from_part}-${to_part}`}
      />
    );
  });

  return (
    <Svg
      style={{
        position: 'absolute',
        top: (viewDims.height - scaledImageDims.height) / 2,
        left: (viewDims.width - scaledImageDims.width) / 2,
        borderColor: 'red',
        borderWidth: 2,
      }}
      width={scaledImageDims.width}
      height={scaledImageDims.height}
      viewBox={`0 0 ${scaledImageDims.width} ${scaledImageDims.height}`}
      preserveAspectRatio="none">
      {points}
      {lines}
    </Svg>
  );
};

export const decodePoses = async res => {
  const [scores, offsets, dispFwd, dispBwd] = res;
  const [scoreTensor, offsetTensor, dispFwdTensor, dispBwdTensor] = await Promise.all([
    (tf.tensor(scores).squeeze() as tf.Tensor3D).buffer(),
    (tf.tensor(offsets).squeeze() as tf.Tensor3D).buffer(),
    (tf.tensor(dispFwd).squeeze() as tf.Tensor3D).buffer(),
    (tf.tensor(dispBwd).squeeze() as tf.Tensor3D).buffer(),
  ]);
  // decodeMultiplePoses works better than decodeSinglePose
  return await decodeMultiplePoses(
    scoreTensor,
    offsetTensor,
    dispFwdTensor,
    dispBwdTensor,
    16, // outputStride, picked by default. TODO: make configurable
    1 // numPoses
  );
};
