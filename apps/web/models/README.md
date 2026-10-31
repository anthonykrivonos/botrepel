# Pose models

The two ONNX models the pose stage runs on the server (`apps/web/lib/liveness/models/`). Both are
committed here, about 6.4 MB together, and shipped with the API function (`includeFiles` in
`vercel.json`). `manifest.json` records each file's SHA-256, provenance, license, and tensor layout;
the runtime refuses a file whose hash differs, and `bun run build` fails on a missing or changed one.

## face-mesh-478.onnx

Google MediaPipe's face landmark model (`face_landmarks_detector.tflite` from the `face_landmarker.task`
v1 float16 bundle), converted to ONNX with tf2onnx by naklitechie on Hugging Face without retraining.
Apache-2.0. Input `input_12`, `[1, 256, 256, 3]` RGB floats in [0, 1]. Outputs `Identity`
(478 landmarks × x, y, z in input pixels; z is depth in the same scale, smaller toward the camera) and
`Identity_1` (a face-presence logit). Landmark indices follow MediaPipe Face Mesh: 1 nose tip, 33 and
263 the outer corners of the person's right and left eyes, 61 and 291 the mouth corners. "Right" and
"left" are the person's own, so in an unmirrored camera frame the right eye sits on the image's left.

## minifasnet-v2-80.onnx

MiniFASNet V2 from minivision-ai's Silent-Face-Anti-Spoofing (`2.7_80x80_MiniFASNetV2.pth`), exported to
ONNX by yakhyo/face-anti-spoofing (release `weights`). Apache-2.0. Input `input`, `[1, 3, 80, 80]`,
BGR floats in [0, 255] with no normalization, a square crop 2.7× the face box, clamped to the frame.
Output `output`, three logits; after softmax, index 1 is the live-face class (the upstream `test.py`
reads `label == 1` as real, as does yakhyo's `onnx_inference.py`). Scores are recorded in
`livenessStat.padLiveE4` and gate nothing until real-device quantiles are known (`GATES.pad`).

## Refreshing a model

1. Download the new file into an empty directory outside the repo and check its SHA-256 against
   the publisher's.
2. Copy it here, update `manifest.json` (hash, bytes, source, I/O), and rerun
   `bun test apps/web/tests/unit/models.test.ts`, which checks the tensor names and shapes.
3. Record the change and the measured scores in `docs/knowledge/liveness-research.md`.
