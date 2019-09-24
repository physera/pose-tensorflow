import * as React from 'react';
import {
  decodeMultiplePoses,
  decodeSinglePose,
  Keypoint,
  Pose as PoseT,
} from '@tensorflow-models/posenet';

import * as tf from '@tensorflow/tfjs-core';
import Svg, { Circle, Line, G } from 'react-native-svg';

export type Dims = { width: number; height: number };

export { PoseT };

// export const MODEL_FILE = 'posenet_mv1_075_float_from_checkpoints.tflite';
// export const MODEL_INPUT_SIZE = 337;
// export const MODEL_OUTPUT_STRIDE = 16;

// java.lang.IllegalArgumentException: Cannot convert between a TensorFlowLite buffer with 1088652 bytes and a ByteBuffer with 1495308 bytes.
// export const MODEL_FILE = 'multi_person_mobilenet_v1_075_float.tflite';
// export const MODEL_INPUT_SIZE = 353; // whoops this is actually 353x257
// export const MODEL_OUTPUT_STRIDE = 16;

export const MODEL_FILE = 'posenet_mobilenet_v1_100_257x257_multi_kpt_stripped.tflite';
export const MODEL_INPUT_SIZE = 257;
export const MODEL_OUTPUT_STRIDE = 32;

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

export const Pose: React.FunctionComponent<{
  poseIn: PoseT;
  imageDims: Dims; // the image for which pose is inferred
  modelInputSize: number;
  rotation: number;
}> = ({ poseIn, imageDims, modelInputSize, rotation }) => {
  const pose = reindexPoseByPart(poseIn);
  const strokeWidth = modelInputSize / 100;
  const radius = modelInputSize / 100;

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

  // - transforms get applied last -> first.
  // - we first rotate the (usually square) modelInputSize box about its center, then scale it to the full view size
  const transform = `scale(${imageDims.width / modelInputSize},${imageDims.height /
    modelInputSize}) rotate(${360 - rotation}, ${modelInputSize / 2}, ${modelInputSize / 2}) `;

  return (
    <Svg
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        borderColor: 'red',
        borderWidth: 2,
      }}
      width={imageDims.width}
      height={imageDims.height}
      viewBox={`0 0 ${imageDims.width} ${imageDims.height}`}
      preserveAspectRatio="none">
      <G transform={transform}>
        {points}
        {lines}
      </G>
    </Svg>
  );
};

type DecodingMethod = 'single' | 'multiple';

const decodeSingle = async (res): Promise<PoseT[]> => {
  const [scores, offsets] = res;
  const [scoreTensor, offsetTensor] = await Promise.all([
    tf.tensor(scores).squeeze() as tf.Tensor3D,
    tf.tensor(offsets).squeeze() as tf.Tensor3D,
  ]);
  const pose = await decodeSinglePose(scoreTensor, offsetTensor, MODEL_OUTPUT_STRIDE);
  return [pose];
};

const decodeMulti = async (res): Promise<PoseT[]> => {
  const [scores, offsets, dispFwd, dispBwd] = res;
  const [scoreTensor, offsetTensor, dispFwdTensor, dispBwdTensor] = await Promise.all([
    (tf.tensor(scores).squeeze() as tf.Tensor3D).buffer(),
    (tf.tensor(offsets).squeeze() as tf.Tensor3D).buffer(),
    (tf.tensor(dispFwd).squeeze() as tf.Tensor3D).buffer(),
    (tf.tensor(dispBwd).squeeze() as tf.Tensor3D).buffer(),
  ]);
  return await decodeMultiplePoses(
    scoreTensor,
    offsetTensor,
    dispFwdTensor,
    dispBwdTensor,
    MODEL_OUTPUT_STRIDE,
    1 // numPoses
  );
};

export const decodePoses = async (decodingMethod: DecodingMethod, res): Promise<PoseT[]> => {
  // webgl not available on pixel 3a atleast
  await tf.setBackend('cpu');
  if (decodingMethod == 'single') {
    return decodeSingle(res);
  } else {
    return decodeMulti(res);
  }
};
