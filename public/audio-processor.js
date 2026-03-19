class AudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._queue = [];
    this.port.onmessage = (event) => {
      const msg = event.data;
      if (msg && msg.type === 'clear') {
        this._queue = [];
        return;
      }
      // Receive Int16Array from the main thread
      this._queue.push(new Int16Array(event.data));
    };
  }

  process(inputs, outputs, parameters) {
    const output = outputs[0][0];
    if (!output) return true;

    let samplesNeeded = output.length;
    let offset = 0;

    while (samplesNeeded > 0 && this._queue.length > 0) {
      const buffer = this._queue[0];
      const samplesToCopy = Math.min(samplesNeeded, buffer.length);
      
      for (let i = 0; i < samplesToCopy; i++) {
        output[offset + i] = buffer[i] / 32768.0;
      }

      if (samplesToCopy === buffer.length) {
        this._queue.shift();
      } else {
        this._queue[0] = buffer.slice(samplesToCopy);
      }

      samplesNeeded -= samplesToCopy;
      offset += samplesToCopy;
    }

    // Fill remaining with silence
    for (let i = offset; i < output.length; i++) {
      output[i] = 0;
    }

    return true;
  }
}

registerProcessor('audio-processor', AudioProcessor);
