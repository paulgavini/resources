(function attachSoundMath(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SoundMath = api;
}(typeof globalThis !== "undefined" ? globalThis : this, function createSoundMath() {
  "use strict";

  function isFiniteNumber(value) {
    return typeof value === "number" && Number.isFinite(value);
  }

  function average(values) {
    const valid = values.filter((value) => isFiniteNumber(value));
    if (!valid.length) return NaN;
    return valid.reduce((sum, value) => sum + value, 0) / valid.length;
  }

  function secondsFromSamples(sampleDifference, sampleRate) {
    if (!isFiniteNumber(sampleDifference) || !isFiniteNumber(sampleRate) || sampleRate <= 0) return NaN;
    return Math.abs(sampleDifference) / sampleRate;
  }

  function roundTripDistance(tubeLengthMetres, microphoneOffsetMetres) {
    const offset = microphoneOffsetMetres === undefined ? 0 : microphoneOffsetMetres;
    if (!isFiniteNumber(tubeLengthMetres) || tubeLengthMetres <= 0 || !isFiniteNumber(offset) || offset < 0) return NaN;
    return 2 * (tubeLengthMetres + offset);
  }

  function trialSpeed(tubeLengthMetres, echoTimeSeconds, microphoneOffsetMetres) {
    const distance = roundTripDistance(tubeLengthMetres, microphoneOffsetMetres);
    if (!isFiniteNumber(distance) || !isFiniteNumber(echoTimeSeconds) || echoTimeSeconds <= 0) return NaN;
    return distance / echoTimeSeconds;
  }

  function planeWaveCutoff(diameterMetres, soundSpeedMetresPerSecond) {
    if (!isFiniteNumber(diameterMetres) || diameterMetres <= 0 || !isFiniteNumber(soundSpeedMetresPerSecond) || soundSpeedMetresPerSecond <= 0) return NaN;
    return (1.84 * soundSpeedMetresPerSecond) / (Math.PI * diameterMetres);
  }

  function acceptedSpeed(temperatureCelsius) {
    if (!isFiniteNumber(temperatureCelsius)) return NaN;
    return 331.5 + (0.607 * temperatureCelsius);
  }

  function percentageDifference(experimental, accepted) {
    if (!isFiniteNumber(experimental) || !isFiniteNumber(accepted) || accepted === 0) return NaN;
    return (Math.abs(experimental - accepted) / Math.abs(accepted)) * 100;
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function sampleFromFraction(fraction, startSample, endSample) {
    if (!isFiniteNumber(fraction) || !isFiniteNumber(startSample) || !isFiniteNumber(endSample) || endSample <= startSample) return NaN;
    const bounded = clamp(fraction, 0, 1);
    return Math.round(startSample + bounded * (endSample - startSample - 1));
  }

  return {
    acceptedSpeed,
    average,
    clamp,
    percentageDifference,
    planeWaveCutoff,
    roundTripDistance,
    sampleFromFraction,
    secondsFromSamples,
    trialSpeed,
  };
}));
