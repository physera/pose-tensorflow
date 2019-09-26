import * as React from 'react';
import { StyleSheet, Text, View } from 'react-native';

type State = {
  secondsLeft: number;
};

type Props = {
  seconds: number;
  onComplete: (...args: any[]) => void;
};

export default class Timer extends React.Component<Props, State> {
  static defaultProps = { seconds: 5 };

  constructor(props: Props) {
    super(props);
    this.state = { secondsLeft: props.seconds };
    for (var i = 1; i < props.seconds; i++) {
      const sl = props.seconds - i;
      setTimeout(() => {
        this.setState({ secondsLeft: sl });
      }, i * 1000);
    }
    setTimeout(props.onComplete, props.seconds * 1000);
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

const styles = StyleSheet.create({});
