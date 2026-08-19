class ExactRecorderProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const requested = options.processorOptions && options.processorOptions.sampleLimit;
    this.sampleLimit = Math.max(1, Math.floor(requested || sampleRate * 2));
    this.samples = new Float32Array(this.sampleLimit);
    this.offset = 0;
    this.finished = false;
  }

  process(inputs) {
    if (this.finished) return false;
    const channel = inputs[0] && inputs[0][0];
    if (!channel || channel.length === 0) return true;

    const remaining = this.sampleLimit - this.offset;
    const count = Math.min(remaining, channel.length);
    this.samples.set(channel.subarray(0, count), this.offset);
    this.offset += count;

    if (this.offset >= this.sampleLimit) {
      this.finished = true;
      this.port.postMessage({ type: "complete", samples: this.samples.buffer }, [this.samples.buffer]);
      return false;
    }
    return true;
  }
}

registerProcessor("exact-recorder", ExactRecorderProcessor);
