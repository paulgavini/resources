export function rawAudioToAudioData(rawAudio) {
  const data = rawAudio.data || rawAudio.audio || rawAudio.waveform || rawAudio.samples;
  const sampleRate = rawAudio.sample_rate || rawAudio.sampling_rate || rawAudio.sampleRate || 24000;

  if (!data || typeof data.length !== "number") {
    throw new Error("Kokoro returned audio in an unexpected format.");
  }

  return {
    samples: data instanceof Float32Array ? data : Float32Array.from(data),
    sampleRate,
  };
}

export function combineAudioSegments(segments, options) {
  const sampleRate = segments[0]?.sampleRate;

  if (!sampleRate) {
    throw new Error("No generated audio segments were available to combine.");
  }

  for (const segment of segments) {
    if (segment.sampleRate !== sampleRate) {
      throw new Error("Generated audio used different sample rates, so it could not be combined safely.");
    }
  }

  const normalGapSamples = secondsToSamples(options.silenceGapSeconds, sampleRate);
  const pauseGapSamples = secondsToSamples(options.pauseGapSeconds, sampleRate);
  const totalSamples = segments.reduce((total, segment, index) => {
    const gap = index < segments.length - 1 ? (segment.hasPauseTag ? pauseGapSamples : normalGapSamples) : 0;
    return total + segment.samples.length + gap;
  }, 0);

  const combined = new Float32Array(totalSamples);
  let offset = 0;

  segments.forEach((segment, index) => {
    combined.set(segment.samples, offset);
    offset += segment.samples.length;

    if (index < segments.length - 1) {
      offset += segment.hasPauseTag ? pauseGapSamples : normalGapSamples;
    }
  });

  return {
    samples: combined,
    sampleRate,
  };
}

export function encodeWav(samples, sampleRate) {
  const channelCount = 1;
  const bytesPerSample = 2;
  const blockAlign = channelCount * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = samples.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channelCount, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, "data");
  view.setUint32(40, dataSize, true);

  let byteOffset = 44;
  for (const sample of samples) {
    const clamped = Math.max(-1, Math.min(1, sample));
    view.setInt16(byteOffset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
    byteOffset += 2;
  }

  return new Blob([view], { type: "audio/wav" });
}

export function makeWavBlob(segments, options) {
  const combined = combineAudioSegments(segments, options);
  return {
    blob: encodeWav(combined.samples, combined.sampleRate),
    sampleRate: combined.sampleRate,
    durationSeconds: combined.samples.length / combined.sampleRate,
  };
}

function secondsToSamples(seconds, sampleRate) {
  const safeSeconds = Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
  return Math.round(safeSeconds * sampleRate);
}

function writeString(view, offset, string) {
  for (let index = 0; index < string.length; index += 1) {
    view.setUint8(offset + index, string.charCodeAt(index));
  }
}
