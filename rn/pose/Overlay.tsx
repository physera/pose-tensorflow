import * as React from 'react';
import { View, Text, ViewProps } from 'react-native';
import { Overlay as colors } from './Colors';

export const Overlay: React.FunctionComponent<ViewProps> = ({ style, children, ...otherProps }) => {
  // Using StyleSheet.absoluteFill specifies both top/bottom and
  // left/right, so things fill the container. https://developer.mozilla.org/en-US/docs/Web/CSS/position
  return (
    <View style={[style, { position: 'absolute' }]} {...otherProps}>
      {children}
    </View>
  );
};

export const BigText: React.FunctionComponent<ViewProps & { textStyle?: any }> = ({
  style,
  children,
  textStyle,
  ...otherProps
}) => {
  return (
    <View
      style={[
        style,
        { backgroundColor: colors.background, borderWidth: 2, borderColor: colors.border },
      ]}
      {...otherProps}>
      <Text style={[textStyle, { fontSize: 100, color: colors.text }]}>{children}</Text>
    </View>
  );
};
