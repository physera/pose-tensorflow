import * as React from 'react';
import { Text, View } from 'react-native';
import { Timer as colors } from './Colors';

type State = {
  secondsLeft: number;
  timers: NodeJS.Timer[];
};

type Props = {
  seconds: number;
  onComplete?: (...args: any[]) => void;
};

export default class Timer extends React.Component<Props, State> {
  static defaultProps = { seconds: 5 };

  constructor(props: Props) {
    super(props);
    this.state = { secondsLeft: props.seconds, timers: [] };
    for (var i = 1; i < props.seconds; i++) {
      const sl = props.seconds - i;
      this.state.timers.push(
        setTimeout(() => {
          this.setState({ secondsLeft: sl });
        }, i * 1000)
      );
    }
    if (props.onComplete) {
      this.state.timers.push(setTimeout(props.onComplete, props.seconds * 1000));
    }
  }

  componentWillUnmount() {
    this.state.timers.map(timer => clearTimeout(timer));
  }

  render() {
    if (this.state.secondsLeft <= 0) {
      return null;
    }
    return (
      <View
        style={{ backgroundColor: colors.background, borderWidth: 2, borderColor: colors.border }}>
        <Text style={{ fontSize: 100, color: colors.text }}>{this.state.secondsLeft}</Text>
      </View>
    );
  }
}
