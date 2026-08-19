"use strict";

const assert = require("node:assert/strict");
const M = require("./math.js");

function closeTo(actual, expected, tolerance, label) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: expected ${expected}, received ${actual}`);
}

closeTo(M.secondsFromSamples(9600, 48000), 0.2, 1e-12, "sample interval");
closeTo(M.secondsFromSamples(-4800, 48000), 0.1, 1e-12, "absolute sample interval");
closeTo(M.secondsFromSamples(1, 96000), 1 / 96000, 1e-15, "96 kHz sample interval");
closeTo(M.trialSpeed(1.5, 0.009), 333.333333, 1e-5, "trial speed");
closeTo(M.roundTripDistance(1.5, 0.025), 3.05, 1e-12, "round-trip distance with microphone offset");
closeTo(M.trialSpeed(1.5, 0.01, 0.025), 305, 1e-12, "offset-corrected trial speed");
closeTo(M.planeWaveCutoff(0.05, 343), 4017.835, 0.001, "50 mm tube cutoff");
closeTo(M.acceptedSpeed(20), 343.64, 1e-12, "accepted speed");
closeTo(M.percentageDifference(340, 343.64), 1.059247, 1e-5, "percentage difference");
closeTo(M.average([0.009, null, 0.01, NaN]), 0.0095, 1e-12, "valid trial average");
assert.equal(M.sampleFromFraction(0, 100, 1100), 100, "left edge maps to first sample");
assert.equal(M.sampleFromFraction(1, 100, 1100), 1099, "right edge maps inside the view");
assert.equal(M.sampleFromFraction(-1, 100, 1100), 100, "fraction clamps left");
assert.equal(M.sampleFromFraction(2, 100, 1100), 1099, "fraction clamps right");
assert.ok(Number.isNaN(M.trialSpeed(0, 0.01)), "zero tube length is invalid");
assert.ok(Number.isNaN(M.trialSpeed(1, 0)), "zero echo time is invalid");
assert.ok(Number.isNaN(M.roundTripDistance(1, -0.01)), "negative microphone offset is invalid");
assert.ok(Number.isNaN(M.planeWaveCutoff(0, 343)), "zero diameter is invalid");

console.log("All speed-of-sound maths tests passed.");
