import * as React from 'react';
import {
  decodeMultiplePoses,
  decodeSinglePose,
  scalePose,
  getBoundingBox,
  Keypoint,
  Pose as PoseT,
} from '@tensorflow-models/posenet';
import * as tf from '@tensorflow/tfjs-core';
import Svg, { Circle, Line, G, Rect } from 'react-native-svg';
import { Pose as colors } from './Colors';

export type Dims = { width: number; height: number };

export { PoseT, Keypoint };

type OutputStride = 32 | 16 | 8;

// copied from posenet_model.d.ts, PoseNetInputResolution because it is not exported
type InputResolution =
  | 161
  | 192
  | 193
  | 257
  | 289
  | 321
  | 337 // <- added
  | 353
  | 385
  | 417
  | 449
  | 481
  | 513
  | 801
  | 1217;

type Model = {
  file: string;
  inputSize: InputResolution;
  outputStride: OutputStride;
  mean: number;
  std: number;
  type: 'posenet' | 'cpm' | 'hourglass';
};

const commonModelParams = {
  mean: 128.0,
  std: 128.0,
};

export type ModelName = 'posenet337' | 'cpm' | 'hourglass' | 'posenet257' | 'posenet353';
export const Models: Record<ModelName, Model> = {
  posenet337: {
    file: 'posenet_mv1_075_float_from_checkpoints.tflite',
    inputSize: 337,
    outputStride: 16,
    type: 'posenet',
    ...commonModelParams,
  },
  cpm: {
    file: 'edvardhua_cpm.tflite',
    inputSize: 192,
    outputStride: 16, // unknown. output is 96x96
    type: 'cpm',
    ...commonModelParams,
  },
  hourglass: {
    file: 'edvardhua_hourglass.tflite',
    inputSize: 192,
    outputStride: 16, // unknown. output is 48x48
    type: 'hourglass',
    ...commonModelParams,
  },
  posenet257: {
    file: 'posenet_mobilenet_v1_100_257x257_multi_kpt_stripped.tflite',
    inputSize: 257,
    outputStride: 32,
    type: 'posenet',
    ...commonModelParams,
  },
  // DOES NOT WORK: java.lang.IllegalArgumentException: Cannot convert
  // between a TensorFlowLite buffer with 1088652 bytes and a
  // ByteBuffer with 1495308 bytes.  this one works on the gpu?
  posenet353: {
    file: 'multi_person_mobilenet_v1_075_float.tflite',
    inputSize: 353, // whoops this is actually 353x257
    outputStride: 16,
    type: 'posenet',
    ...commonModelParams,
  },
};

export const getModel = (name: ModelName): Model => {
  return Models[name];
};

type IndexedPoseT = { score: number; keypoints: { [k: string]: Keypoint } };

export const indexPoseByPart = (pose: PoseT): IndexedPoseT => {
  let indexedKps = {};
  for (const kp of pose.keypoints) {
    indexedKps[kp.part] = kp;
  }
  return {
    score: pose.score,
    keypoints: indexedKps,
  };
};

type Part = string;
type Limb = [Part, Part];
type Angle = [Part, Part, Part];
type Structure = {
  Parts: Part[];
  Skeleton: Limb[];
  Angles: Angle[];
};

export const PoseNetStructure: Structure = {
  Parts: [
    'nose',
    'leftEye',
    'rightEye',
    'leftEar',
    'rightEar',
    'leftShoulder',
    'rightShoulder',
    'leftElbow',
    'rightElbow',
    'leftWrist',
    'rightWrist',
    'leftHip',
    'rightHip',
    'leftKnee',
    'rightKnee',
    'leftAnkle',
    'rightAnkle',
  ],
  Skeleton: [
    ['leftShoulder', 'rightShoulder'],
    ['leftShoulder', 'leftElbow'],
    ['rightShoulder', 'rightElbow'],
    ['leftElbow', 'leftWrist'],
    ['rightElbow', 'rightWrist'],
    ['leftShoulder', 'leftHip'],
    ['rightShoulder', 'rightHip'],
    ['leftHip', 'leftKnee'],
    ['rightHip', 'rightKnee'],
    ['leftKnee', 'leftAnkle'],
    ['rightKnee', 'rightAnkle'],
  ],
  Angles: [
    ['leftHip', 'leftShoulder', 'leftElbow'],
    ['rightHip', 'rightShoulder', 'rightElbow'],
    ['rightShoulder', 'rightElbow', 'rightWrist'],
    ['leftShoulder', 'leftElbow', 'leftWrist'],
    ['leftKnee', 'leftHip', 'leftShoulder'],
    ['rightKnee', 'rightHip', 'rightShoulder'],
    ['leftAnkle', 'leftKnee', 'leftHip'],
    ['rightAnkle', 'rightKnee', 'rightHip'],
  ],
};

export type PoseDisplayOptions = {
  scoreThreshold?: number;
  showBoundingBox?: boolean;
  boundingBoxColor?: string;
  poseColor?: string;
};

export const Pose: React.FunctionComponent<
  {
    pose: PoseT;
    imageDims: Dims; // the image for which pose is inferred
    modelInputSize: number;
    rotation: number;
    highlightParts?: { [k: string]: boolean };
  } & PoseDisplayOptions
> = ({
  pose,
  imageDims,
  modelInputSize,
  rotation,
  scoreThreshold = 0.25,
  showBoundingBox = false,
  boundingBoxColor = colors.defaultBoundingBoxColor,
  poseColor = colors.defaultPoseColor,
  highlightParts = true,
}) => {
  const indexedPose = indexPoseByPart(filterPoseByScore(pose, scoreThreshold));
  const strokeWidth = modelInputSize / 50;
  const radius = modelInputSize / 80;
  const points = Object.values(indexedPose.keypoints).map((kp: Keypoint) => {
    const color =
      highlightParts && highlightParts[kp.part]
        ? colors.keypoint.highlighted
        : colors.keypoint.default;
    return (
      <G key={kp.part}>
        <Circle cx={kp.position.x} cy={kp.position.y} r={radius} fill={color} />
      </G>
    );
  });

  const lines = PoseNetStructure.Skeleton.map(([from_part, to_part]) => {
    const from_kp = indexedPose.keypoints[from_part];
    const to_kp = indexedPose.keypoints[to_part];
    if (from_kp && to_kp) {
      return (
        <Line
          x1={from_kp.position.x}
          y1={from_kp.position.y}
          x2={to_kp.position.x}
          y2={to_kp.position.y}
          stroke={poseColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          key={`${from_part}-${to_part}`}
        />
      );
    }
  });

  var boundingBoxRect = null;
  if (showBoundingBox) {
    const boundingBox = getBoundingBox(pose.keypoints);
    boundingBoxRect = (
      <Rect
        x={boundingBox.minX * 0.8}
        width={boundingBox.maxX * 1.2 - boundingBox.minX * 0.8 + 1}
        y={boundingBox.minY * 0.8}
        height={boundingBox.maxY * 1.2 - boundingBox.minY * 0.8 + 1}
        stroke={boundingBoxColor}
        strokeWidth={2}
        fill={boundingBoxColor}
      />
    );
  }
  // - transforms get applied last -> first.
  // - we first rotate the (usually square) modelInputSize box about its center, then scale it to the full view size
  const transform = `scale(${imageDims.width / modelInputSize},${imageDims.height /
    modelInputSize}) rotate(${360 - rotation}, ${modelInputSize / 2}, ${modelInputSize / 2}) `;
  // console.log([modelInputSize, transform]);
  return (
    <Svg
      key={`${modelInputSize}-svg`}
      style={{ borderColor: 'red', borderWidth: 1 }}
      width={imageDims.width}
      height={imageDims.height}
      viewBox={`0 0 ${imageDims.width} ${imageDims.height}`}
      preserveAspectRatio="none">
      <G transform={transform}>
        {boundingBoxRect}
        {lines}
        {points}
      </G>
    </Svg>
  );
};

type DecodingMethod = 'single' | 'multiple';

const decodeSingle = async (model: Model, res): Promise<PoseT[]> => {
  const [scores, offsets] = res;
  const [scoreTensor, offsetTensor] = await Promise.all([
    tf.tensor(scores).squeeze() as tf.Tensor3D,
    tf.tensor(offsets).squeeze() as tf.Tensor3D,
  ]);
  const pose = await decodeSinglePose(scoreTensor, offsetTensor, model.outputStride);
  return [pose];
};

const decodeMulti = async (model: Model, res): Promise<PoseT[]> => {
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
    model.outputStride,
    1 // numPoses
  );
};

export const decodePoses = async (
  decodingMethod: DecodingMethod,
  model: Model,
  res
): Promise<PoseT[]> => {
  // webgl not available on pixel 3a atleast
  await tf.setBackend('cpu');
  if (decodingMethod == 'single') {
    return decodeSingle(model, res);
  } else {
    return decodeMulti(model, res);
  }
};

const scaleBoundingBox = (pose: PoseT, modelInputSize: number): PoseT => {
  const bbox = getBoundingBox(pose.keypoints);
  const scaleX = modelInputSize / (bbox.maxX - bbox.minX + 1);
  const scaleY = modelInputSize / (bbox.maxY - bbox.minY + 1);
  return scalePose(scalePose(pose, 1.0, 1.0, -1 * bbox.minY, -1 * bbox.minX), scaleY, scaleX);
};

export const scaleForMatch = (
  pose: PoseT,
  scoreThreshold: number,
  modelInputSize: number,
  target?: PoseT
): PoseT => {
  const filteredPose = target
    ? filterPoseByTargetAndScore(pose, target, scoreThreshold)
    : filterPoseByScore(pose, scoreThreshold);
  return scaleBoundingBox(filterByPart(filteredPose), modelInputSize);
};

const filterByPart = (
  pose: PoseT,
  ignoreParts = { leftEye: true, rightEye: true, leftEar: true, rightEar: true }
): PoseT => {
  return {
    score: pose.score,
    keypoints: pose.keypoints.filter(kp => !ignoreParts[kp.part]),
  };
};

const filterPoseByTargetAndScore = (pose: PoseT, target: PoseT, threshold: number): PoseT => {
  const targetPose = indexPoseByPart(filterPoseByScore(target, threshold));
  return {
    score: pose.score,
    keypoints: pose.keypoints.filter(kp => kp.score >= threshold && targetPose.keypoints[kp.part]),
  };
};

const filterPoseByScore = (pose: PoseT, threshold: number): PoseT => {
  return {
    score: pose.score,
    keypoints: pose.keypoints.filter(kp => kp.score >= threshold),
  };
};

export const matchingTargetKeypoints = (
  target: PoseT,
  candidate: PoseT,
  scoreThreshold: number,
  distanceThreshold: number,
  modelInputSize: number
): [Keypoint[], number] => {
  const targetPose = indexPoseByPart(scaleForMatch(target, scoreThreshold, modelInputSize));
  const pose = indexPoseByPart(scaleForMatch(candidate, scoreThreshold, modelInputSize, target));
  const matchingKeypoints = Object.values(targetPose.keypoints).filter((tkp: Keypoint): boolean => {
    const pkp = pose.keypoints[tkp.part];
    if (!pkp) {
      return false;
    }
    const distance = keypointDistance(tkp, pkp);
    return distance <= distanceThreshold * modelInputSize;
  });
  return [
    matchingKeypoints,
    // all matching?
    Object.values(targetPose.keypoints).length,
  ];
};

export const keypointDistance = (a: Keypoint, b: Keypoint): number => {
  return Math.sqrt((b.position.y - a.position.y) ** 2 + (b.position.x - a.position.x) ** 2);
};

export const jointAngle = (angle: Angle, pose: PoseT, scoreThreshold: number): number | null => {
  const [left, pivot, right] = angle;
  const indexedPose = indexPoseByPart(filterPoseByScore(pose, scoreThreshold));

  const [leftKp, pivotKp, rightKp] = [
    indexedPose.keypoints[left],
    indexedPose.keypoints[pivot],
    indexedPose.keypoints[right],
  ];
  if (!leftKp || !pivotKp || !rightKp) {
    return null;
  }

  const a = keypointDistance(leftKp, pivotKp);
  const b = keypointDistance(leftKp, rightKp);
  const c = keypointDistance(pivotKp, rightKp);
  return Math.round((180 * Math.acos((a ** 2 + c ** 2 - b ** 2) / (2 * a * c))) / Math.PI);
};
