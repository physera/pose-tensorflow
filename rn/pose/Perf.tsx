import isEqual from 'react-fast-compare';

export const ifDiff = (a, b) => {
  return isEqual(a, b) ? a : b;
};
