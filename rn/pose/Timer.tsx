import * as React from 'react';
import { Text, View } from 'react-native';

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
      <View style={{ backgroundColor: '#f194ff', borderWidth: 2, borderColor: 'red' }}>
        <Text style={{ fontSize: 100, color: 'red' }}>{this.state.secondsLeft}</Text>
      </View>
    );
  }
}
