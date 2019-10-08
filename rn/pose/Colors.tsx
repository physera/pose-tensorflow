const base = {
  button: { background: '#5a81fa' },
};

export const App = {
  ...base,
  background: '#fff',
  tabView: { background: '#2c295b' },
  titleBar: { text: '#dbe3f6', background: '#2c295b' },
};

export const StaticImagePose = {
  ...base,
  background: '#dbe3f6',
};

export const CameraPose = {
  ...base,
  toolbar: {
    background: '#f3f6fd',
  },
  captureTargetButton: {
    capturing: 'red',
    hasTarget: 'green',
  },
  targetPose: '#f3f6fd',
  background: '#dbe3f6',
};

export const Pose = {
  defaultPoseColor: '#2a2e8d',
  defaultBoundingBoxColor: 'purple',
  keypoint: {
    default: '#f33b98b3',
    highlighted: 'green',
  },
};

export const Timer = {
  text: '#f354b4',
  border: '#f354b4',
  background: '#dbe3f6',
};
