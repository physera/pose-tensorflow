import * as React from 'react';
import { View, ViewProps } from 'react-native';

const Overlay: React.FunctionComponent<ViewProps> = ({ style, children, ...otherProps }) => {
  // Using StyleSheet.absoluteFill specifies both top/bottom and
  // left/right, so things fill the container. https://developer.mozilla.org/en-US/docs/Web/CSS/position
  return (
    <View style={[style, { position: 'absolute' }]} {...otherProps}>
      {children}
    </View>
  );
};
export default Overlay;
