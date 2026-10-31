# Liveness research

What we know about face liveness detection and how it applies to BotRepel. Started from
*Face Flashing* (Tang et al., NDSS 2018) and traced forward to October 2026. The October 2026 update near the end revises the recommendation. Vendor statistics are
self-reported and unaudited. Items marked unverified in the sources below were not confirmed.
Sources are grouped by section at the end.

## Seed paper: Face Flashing (NDSS 2018)

**Idea.** A challenge-response protocol. The server sends `seed, N`. The client screen flashes N
random challenges: either a solid *background* color or a *lighting* challenge (a band, 1/4 of the
screen tall, in a second color). The front camera records the light reflected from the face.
Reflection happens at the speed of light. A forged response has to be computed and then shown on
the attacker's screen, which costs at least one refresh.

**Physics.** The paper uses the Von Kries diagonal model, `I_c = E_c × R_c`, which gives two results:
- Eq. 1: at a fixed illuminant, the pixel ratio `I(x)/I(y)` equals the reflectance ratio. This
  gives a "midterm" map showing face texture and 3D shape. Screens produce flat maps with strong
  specular highlights, and paper produces flat diffuse maps.
- Eq. 2: at a fixed pixel, the response is proportional to the illuminant. The camera's response
  therefore encodes the challenge.

**Timing check.** The screen refreshes row by row and the camera has a rolling shutter, so a lit
band appears in the captured frame at a predictable region of interest (ROI). The ROI is computed
from the band position, the frame start times and the frame periods (Eqs. 3–4). Four linear
regressions estimate the band center. The check computes `d_i = ŷ_i − center_i` over the frames
and accepts when `mean_d × std_d < exp(Th)`, with `Th = −5`. An attacker who chases the challenge
either shifts the mean or raises the variance, because their screen is not phase-locked. The
allowed slack is about 1/480 s for a 60 Hz screen. Measured: a mirror shows about zero delay,
while a laptop re-displaying its camera feed shows a clear delay.

**Face check.** The midterm map is cut into 20 vertical strips, each fitted with a 20-degree
polynomial, resized to 20×20, and classified by a small 3-layer CNN. The resulting profile looks
like a sideways "H".

**Results.** 174 participants, 2,274 videos, 6 scenarios. Overall accuracy 98.8%, with zero false
accepts on replays from 4 screens. Worst case 97.3% (walking outdoors at night). Vibration hurts
most: about 89% at moderate shake and about 60% at extreme shake. On a phone, CPU face extraction
dominated (29 s for 300 frames). In the cloud, verification ran at about 1 s per second of video.

**Stated limitations (important for us).**
1. It **assumes a trusted front-end**. With a compromised device or an injected camera stream,
   the attacker can learn the challenge and synthesize the response offline. The authors say
   not to rely on smartphone integrity. *This is the core threat on the open web.*
2. Very fast attacker hardware (a 675k fps camera with a 100 kHz display) breaks the timing check.
3. Auto white balance must be off. Darkness causes saturation. Motion degrades accuracy.
4. Silicone masks are out of scope; the authors suggest a multispectral albedo curve as future work.
5. 8 colors × 10 challenges gives a guess probability below 1e-9.
6. Related prior art: Andrew Bud's patent US 9,479,500 (Bud is iProov's founder).

## Modern landscape

### A. Modern ML face anti-spoofing (FAS) and presentation-attack detection (PAD), 2018–2026

**How the field is organized.** These categories come from Yu et al., TPAMI 2022 (arXiv 2106.14948),
and the 2024–25 surveys:
- binary classification;
- pixel-wise auxiliary supervision (depth, reflection, rPPG);
- domain generalization (DG);
- one-class and zero-shot methods for unknown attacks;
- multimodal input (depth, IR);
- vision-language and MLLM methods (2023 onward);
- unified detection of physical and digital attacks (2024 onward).

**Benchmarks are saturated.** OULU-NPU P1 ACER is about 0.2% (CDCN, CVPR 2020). The usual
cross-dataset test trains on three of OULU, CASIA, Replay and MSU and tests on the fourth. Its
average HTER has fallen from 11.3% (SSDG, 2020) to 6.0% (ViT), 3.0% (FLIP, ICCV 2023, CLIP
initialization) and 1.8% (GD-FAS, ICCV 2025). Those four datasets are tiny, about 50 subjects
each, and some papers pick the best epoch on the test set.
- On realistic protocols, error is far higher. Trained on CelebA-Spoof and tested on other data,
  SA-FAS reaches 27–32% HTER and InstructFLIP 30.3% on CASIA-SURF.
- At an operating point that matters (TPR at FPR = 1%), FLIP detects only 66–92%.

**Unified physical + digital detection.**
- UniAttackData (IJCAI 2024): 1,800 subjects, 28.7k videos.
- UniAttackData+ (ICCV 2025 workshop): 2,875 subjects, 54 attack types, about 700k videos.
- Challenge winners reached an ACER of about 2.1–2.3%; the rest of the field ranged up to 33%.
- MLLM approaches add explanations but are slow and unproven on webcams: I-FAS (AAAI 2025),
  FaceShield (2025), the SHIELD benchmark.

**Deepfake detection generalizes poorly to new fakes.**
- DFDC 2020: 82.6% on the public test set, 65.2% on the black-box set.
- DF40 (NeurIPS 2024): an Xception detector trained on FaceForensics++ scores an AUC of about 0.65
  on new forgery types.
- Deepfake-Eval-2024: open-source detectors lose about 50% of their AUC on real 2024 content;
  the best AUC was 0.58.
- Real-time face swapping from a single photo is commodity software: Deep-Live-Cam (2024) and
  Sensity "dot" with a virtual camera.

**Independent evaluations of shipped systems.**
- NIST IR 8491 (2023): 82 passive algorithms, none of which caught every attack type. Cropping the
  bezel and hands out of the frame raised errors for all of them, which means they rely on context
  shortcuts. Fusing algorithms helped.
- DHS RIVTD Track 3 (2024, 660 volunteers): active PAD had a bona fide rejection rate (BPCER) of
  6–59%, took 27–40 s, and showed an age penalty (about 20% errors for users over 46).
- In the same test, passive PAD varied widely: worst-case attack acceptance (APCER) ran from 0% to
  100%, and only 2 of 15 systems stopped every attack.
- Academic fairness studies find gaps by gender and occlusion (Fang et al., Pattern Recognition 2024).

**Challenge-response still helps against real-time generators.** GOTCHA (EuroS&P 2024) used
occlusion, deformation and illumination prompts. Occlusion was the strongest; illumination was the
weakest *for its detector*.

**Main takeaway.** Optical PAD, as defined in ISO 30107, does nothing once the camera stream is
injected. Injection is covered by separate standards: CEN/TS 18099:2024 and ISO/IEC 25456 (draft).
No public benchmark exists for PAD on browser webcams.

### B. Light-reflection liveness after Face Flashing (2018–2026)

**Prior art and commercial use.** Andrew Bud's patent US 9,479,500 (2012–2016; Bud founded iProov)
describes the same mechanism earlier:
- the server sends a code of at least 8 bits;
- the screen or flash changes color at about 12 Hz, "faster than local compute can synthesize";
- the server checks the tonal change in the reflection and that it falls where expected on the
  face (cornea, glasses, nose tip);
- the patent explicitly mentions telling humans from bots.

Light-based liveness is now standard industry practice:
- iProov Flashmark: color sequences never reused, cloud deep-learning analysis, the device treated
  as untrusted.
- AWS Rekognition `FaceMovementAndLightChallenge`: runs on the web through Amplify, with server
  `ColorSequences`. AWS states that securing the device is the customer's responsibility.
- Tencent Aurora Guard (marketed as 光线活体, "light liveness").
- Alibaba and Ant, Volcengine (ByteDance): marketed as 炫彩活体, "colorful liveness". Volcengine
  also checks pupil reflections.
- Azure Face: its web mode needs high screen brightness.
- A Chinese industry standard, T/CFEII 0010-2023, defines this category.

**Academic follow-ups.** Each one changes the challenge or the decoder:

| Work | Challenge → decoder | Result | Notes |
|---|---|---|---|
| Chan et al., TIFS 2018 | flash vs no flash, Lambertian texture descriptors | 50 subjects | no randomness and no timing check |
| Aurora Guard (Tencent, 2019 and 2021) | random hue/intensity "light CAPTCHA" → normal cues → multi-task CNN recovers depth and material **and regresses the CAPTCHA back** | deployed to millions; more than 98% pass rate | names "modality spoofing" (forging the reflection) as the attack it targets |
| FaceRevelio (MobiCom 2020) | 4 screen quadrants with orthogonal zero-mean codes → least squares → photometric stereo → depth → DNN | EER 1.4% for photos, 0.15% for video replay, 1 s challenge | needs exposure lock and gamma inversion |
| LiveScreen (INFOCOM 2020) | hidden frame in a video chat → chromatic eigenspace on skin pixels | 97.7% on phones, 94.8% on laptops | aimed specifically at virtual-camera playback |
| Gerstner & Farid (CVPR-W 2022) | isoluminant yellow–magenta hue sweep (avoids triggering auto white balance) → circular correlation | correlation 0.89 / 0.83 / 0.65 / 0.37 / 0.03 at 0–4 frames of delay (30 fps) | the clearest public data on timing; recommends random blank frames |
| Corneal probing: AIME/Y-EYES (2021–22), Guo/Wang/Lyu (ICASSP 2023) | screen pattern → corneal specular reflection | about 200 ms; **a web version exists**; real-time deepfakes cannot reproduce it | needs eye resolution; glasses hurt |
| FaceCloseup (AsiaCCS 2019) | perspective distortion at close range | 99.48% | the only paper found that directly critiques Face Flashing (cloud dependence, privacy) |

No published reproduction or break of Face Flashing was found.

**Related physical signals ("physics as the oracle").**
- **rPPG pulse detection.** TSrPPG cut detection time to about 1 s. However, deepfakes *inherit the
  driving video's pulse* (median r = 0.89 for DeepFaceLive), so pulse alone proves no freshness.
- **Acoustic echo:** EchoPrint (MobiCom 2018) and EchoFace. In a browser this is limited by audio
  latency and voice processing.
- **Motion and IMU checks** were broken by Virtual U (USENIX Security 2016), which built 3D models
  from public photos.
- **Vibration probes** with SFake (2024, mobile only).

**The real attack today: injection plus a color-feedback loop.** Write-ups of the Chinese black
market from 2026 describe tools that:
- capture the screen (MediaProjection, or SurfaceFlinger `captureDisplay`);
- sample the challenge color;
- tint injected deepfake frames to match, relayed over RTMP or TCP.

The industry rates 炫彩 as "can be synthesized" without a check on where the stream comes from.
**No one has published the latency of this loop.** That latency is the open question that decides
whether Face Flashing–style timing still holds. Related research: LED rolling-shutter
perturbations (TBDATA 2024), learned relighting attacks (TIFS 2024, CVPR 2025).

**What a browser can and cannot do.**
- **Lock white balance and exposure.** Chrome supports this through the Image Capture API
  (`whiteBalanceMode`, `exposureMode`, `exposureTime`) on Android, Windows, Mac and ChromeOS.
  Firefox does not support it. Safari has `whiteBalanceMode` and torch, but there is no evidence
  of exposure lock on iOS. Many USB webcams ignore these settings, so we must read back
  `getSettings()` and verify empirically.
- **Timing.**
  - `requestVideoFrameCallback` provides `captureTime` and `expectedDisplayTime`, quantized to vsync.
  - JavaScript cannot see compositor or scan-out latency.
  - We must therefore **measure where the challenge lands in the image** (Face Flashing's band
    regression), not trust timestamps. This makes the paper's approach the right one for the web.
  - Rolling-shutter readout on consumer cameras takes about 10–34 ms, so transitions appear as
    bands within a frame.
  - The measured Android glass-to-glass loop is 57–106 ms. An attacker's loop has to beat a
    reflection that arrives *within the same frame*.
- **No camera attestation.** OBS and other virtual cameras look like ordinary devices. Probing
  control behavior can be a weak heuristic for detecting them.
- **Accessibility.** Prefer low-flicker isoluminant hue changes and include a photosensitivity
  notice.

**Open gaps:**
- an independent security analysis of Flashmark;
- the latency of the feedback-loop attack;
- browser support for `captureTime` (Chrome on macOS reports receipt, not exposure; see v1 notes);
- exposure lock on Safari;
- any browser-specific evaluation of light-based liveness.

### C. Threats, standards, industry, law, and the web platform

**Injection is now the dominant attack.**
- Attack volume (vendor telemetry, not audited):
  - iProov, 2023→2024: native virtual-camera attacks up 2,665%, face swaps up 300%.
  - iProov 2026: iOS injection attacks up 1,151% in H2 2025. iProov catalogs 127 swap tools,
    91 virtual cameras, and about 24k sellers.
  - Gartner (2024): by 2026, 30% of enterprises will not trust face IDV "in isolation."
- Tooling:
  - Deep-Live-Cam: about 97k GitHub stars; its README sends output through OBS.
  - ProKYC: about $629/yr, fake ID plus deepfake fed through a virtual camera; beat Bybit.
  - OnlyFake: $15 fake IDs.
  - Sensity (2022): beat 9 of 10 KYC vendors.
  - MITRE ATLAS AML.CS0033 (Dec 2025): a non-rooted Android phone running a face swap, OBS, and a
    virtual camera passed a bank's active liveness check.
- How vendors detect injection: device integrity checks, hooking detection, camera-source
  validation, metadata packed and signed by the client SDK (ID R&D, Innovatrics), frequency and
  generative-AI artifact analysis, behavior signals.
- Research: an ML virtual-camera detector trained on browser capture metadata (arXiv 2512.10653).

**Standards.**
- *ISO/IEC 30107-3* covers presentation attacks only.
- *iBeta* PAD levels:
  - L1: about $30 of materials per attack, 0% allowed penetration.
  - L2: $300 per attack, 1%.
  - L3 (2025): 5%, hyper-realistic masks.
- Injection attacks:
  - *CEN/TS 18099:2024* is the first standard for injection attack detection (IAD).
  - *ISO/IEC 25456* is in draft, built from CEN/TS 18099.
  - *ETSI TS 119 461 v2.1.1* (2025) brings IAD into eIDAS 2.
  - EUDI wallet onboarding requires CEN/TS 18099 lab results.
- *FIDO Face Verification* (2024): measures attack acceptance, FRR/FAR, and requires FRR under 6%
  for every demographic group. Injection protection is reviewed on paper only, not tested.
- *NIST IR 8491* tested passive PAD only, no injection; the program is now closed.

**Vendors.**
- iProov (Flashmark / Dynamic Liveness, cloud).
- FaceTec (3D FaceMap; a $600k spoof bounty that includes a web frame-injection level).
- Jumio ("active illumination").
- Incode Deepsight (4 layers).
- Mitek/ID R&D (IDLive Face Plus with IAD).
- Paravision (passive; says injection is much easier on desktop webcams than on iOS).
- Apple Face ID: IR depth, signed frames in the Secure Enclave. Websites only see it as a WebAuthn
  user-verification flag.
- World ID Orb: iris; 18M people verified; AgentKit lets humans delegate to agents. Regulators
  acted in Bavaria (deletion order), Spain, Portugal, Hong Kong, Kenya, and Indonesia.

**Pricing.**
- Identity-grade verification: about $0.80–$1.89 per check (Veriff, Sumsub). Standalone liveness:
  about $0.10–0.15 (Didit).
- Bot checks: about $0.001 (reCAPTCHA at $1 per 1k, hCaptcha at $0.99 per 1k). Turnstile is free.
- That gap of roughly 100–1000× is the main pricing question for BotRepel.

**Alternatives.** None of these prove a present, unique human:
- Turnstile: proof of work plus browser probes plus Private Access Tokens.
- Private Access Tokens / Privacy Pass (RFC 9576/9577): Apple attests a genuine device, not a person.
- Vercel BotID (built on Kasada).
- Passkeys: synced passkeys carry no attestation.

Evidence that agents defeat CAPTCHAs:
- reCAPTCHA v2 images solved 100% (ETH, 2024).
- ChatGPT Agent clicked through Cloudflare's checkbox (2025).
- Open CaptchaWorld: o3 40% vs humans 93%.

The "Personhood credentials" paper (OpenAI, Microsoft, MIT, et al., 2024) argues for one credential
per person with unlinkable pseudonyms.

**Law.**
- *GDPR*: Art. 9 applies when processing is *for unique identification*. EDPB 05/2022 suggests that
  analysis without identification may fall outside Art. 9. **Liveness with no template and no
  matching is arguably not Art. 9. "One human, one account" deduplication is Art. 9.**
- *EU AI Act*: biometric verification and systems used purely for cybersecurity are excluded from
  high-risk. Avoid emotion inference.
- *BIPA*: the 2024 amendment counts one violation per person (retroactive per the 7th Cir. in
  2026). Case law is split on whether liveness without identification counts. Plan on written
  consent for Illinois users.
- *Texas CUBI*: Meta paid $1.4B.
- *Washington*: has a security-purpose carve-out.
- Mitigations: process on-device or in memory, store no frames or templates, give just-in-time
  notice, and offer a non-camera fallback.

**Web platform.**
- No standard way to detect virtual cameras. A W3C issue says it is "not possible." Labels and
  capabilities are heuristics only, and can be renamed or sanitized.
- No browser camera attestation (Web Environment Integrity was withdrawn in 2023). Hardware
  integrity checks (App Attest, Play Integrity) exist only in native apps.
- iOS: needs `playsinline`, camera permission doesn't persist, and in-app WebViews have quirks.

## What this means for BotRepel

1. **The camera stream is untrusted, and that cannot be fixed on the web.** Face Flashing's main
   assumption, a trusted front-end, fails in browsers. Every web liveness product has the same
   gap: AWS and Microsoft both push device security onto the customer. BotRepel's security has
   to come from **what is hard to forge quickly**, not from trusting the camera.
2. **Light challenge-response is the right core, as one layer among several.**
   - It defeats replayed media and offline-generated deepfakes. The response cannot exist before
     the server's nonce does, and per-session random color codes are never reused.
   - It forces a live attacker into a screen-capture → tint → inject loop under real-time pressure.
   - Measured delay curves (Gerstner & Farid) and sub-frame rolling-shutter band localization
     (Face Flashing) give a defensible timing bound.
   - Check spatial physics as well as color: shading consistent with surface normals (FaceRevelio,
     Aurora Guard), specular highlights on the nose and forehead, and the corneal reflection of
     the challenge (Guo/Wang/Lyu found real-time deepfakes cannot reproduce it).
   - A simple global tint, as the black-market tools apply, fails the spatial checks. A physically
     correct relight within about one frame is a much harder attack.
3. **Combine signals** (Gartner, NIST: fusion beats any single detector):
   - active light challenge;
   - a passive PAD/deepfake model;
   - capture-metadata and injection heuristics, scored rather than used as a gate;
   - Private Access Tokens / passkeys where available.
   Report BPCER at a fixed APCER, not accuracy.
4. **Position honestly.** The product raises the cost of passing per session from about $0.001
   (CAPTCHA farms, agents) to "build and run a physics-correct real-time relighting injector." It
   will not stop a funded, targeted attacker. That is the right bar for bot defense and the wrong
   bar for KYC. Price between CAPTCHA and IDV.
5. **Privacy by design is a competitive moat.**
   - Liveness only, with no identity matching.
   - Process in memory. Store no frames and no templates.
   - Avoid cross-session deduplication. If uniqueness is ever needed, use Privacy Pass–style
     unlinkable tokens rather than face matching.
   - Keep a non-camera fallback for accessibility and consent.
6. **Browser engineering realities to design around:**
   - Lock white balance and exposure where Chrome allows it, and verify via `getSettings()`.
   - Prefer isoluminant hue sweeps in the yellow–magenta range, which don't trigger AWB.
   - Localize the challenge in the image rather than trusting timestamps.
   - Handle iOS with no exposure lock.
   - Use a photosensitivity-safe design: low flicker and a warning.
   - Darkness, motion, and low screen brightness are the main sources of false rejections.

**Open questions that need our own measurement (no public data):**
- the real latency of a screen-capture → tint → virtual-camera loop on a laptop;
- which browsers populate `captureTime` and honor AWB/exposure locks on common webcams;
- whether band localization works at typical laptop webcam resolution and distance;
- false-rejection rates across skin tones, ages, glasses, and lighting.

## Update (Oct 2026): is face liveness the best human check?

**No, not as the default. It works best as a fallback step-up.** The large platforms that launched
human checks in 2026 chose risk-triggered, camera-free proof first:

- **X (Oct 2026).** Only accounts flagged for automated-looking activity are checked.
  - Options are Face ID/Touch ID or Android biometric unlock, running on the device. X receives
    pass/fail plus a device-integrity signal saying the request came from the unmodified X app.
  - The fallback is a short selfie video. A third party scores it against photos, replays and
    masks, and X receives only a confidence score.
  - A hand-wave check is "coming soon".
  - **Checks run only in the native app.** Web users are sent to the app or an iOS App Clip by QR
    code. No source mentions screen-color flashing.
  - X uses Au10tix for ID checks and Yoti or Grok for age checks.
- **Reddit (Mar 2026).** Only "fishy" accounts are checked, and they verify with a passkey (face,
  fingerprint or PIN). World ID is being explored. Government ID is "least preferred", used only
  where age laws require it. Accounts that don't verify are labeled as an app.
- **Discord (Sep 2026).** Face age estimation runs on the device. Alternatives are a card check,
  app-store age range, Google Wallet ID, and an AgeKey passkey. Over 90% of users are never asked.
  This followed an Oct 2025 vendor breach of about 70k ID photos, and the Death Stranding
  photo-mode bypass of k-ID and Persona.

**Why face liveness lost the default slot:**
- Injection attacks are industrializing.
- Selfie flows have spoofing and breach incidents.
- The open web cannot attest the camera. X avoided the problem entirely by going native.

**Why passive checks alone are failing:**
- Vendor-run benchmarks: Turnstile caught 0% of three LLM browser agents, and hCaptcha 0–16%.
- Vision models solve reCAPTCHA v2 images 28–60% of the time.
- Halligan (USENIX Sec 2025) solved 60.7% across 26 CAPTCHA types.

**New paradigms now available:**

| Paradigm | Proves | Friction | Coverage | Strengths and limits |
|---|---|---|---|---|
| Passkey / device biometric (+ App Attest or Play Integrity in apps) | "a human did something" on a real device | about 1 tap | near-universal | no uniqueness; an agent can borrow a human's tap |
| Digital Credentials API + ZK (Chrome 141+, Safari 26 mdoc only, no Firefox; Google longfellow-zk) | holds a state ID or is over 18, unlinkable | 1 tap plus biometric | patchy: 16 US states plus Apple passport ID; EUDI wallets due Dec 2026, none certified | no camera, so no injection risk; per document, not per human |
| ZK passport (Self, ZKPassport) | unique human per app | app install plus NFC | any NFC passport | strong Sybil resistance; requires an app |
| World ID / AgentKit | unique human; can delegate to agents | Orb visit once | about 18M people | regulatory pushback in several countries |
| Web Bot Auth / signed agents (RFC 9421; OpenAI, Google, Browserbase; Visa TAP, Mastercard Agent Pay) | which operator's agent | none | cooperating agents only | does nothing against agents that hide |
| Privacy Pass / PAT / PST | a vouched-for device | none | mostly Apple | an agent on a real Mac passes |
| Face liveness (light challenge) | a live face is present now | medium | anyone with a camera | web injection risk; biometric law |

**Revised recommendation for BotRepel.** Supersedes the "light challenge as core" framing above.

1. **Agent lane.** Verify Web Bot Auth, card-network agent signals and World AgentKit, then apply
   per-operator policy and quotas.
2. **Passive risk score.** Combine behavior, device signals and Privacy Pass tokens. Use it only
   to decide *who gets challenged*, the way X and Reddit trigger checks.
3. **Step-up, camera-free first.**
   - A passkey with user verification: the Reddit model and the cheapest proof of presence.
   - Digital Credentials API with ZK where available.
   - World ID or Self as optional unique-human providers.
4. **Light-challenge face liveness as the universal fallback** for users without those options.
   Use it for higher-assurance actions; never store frames; offer a QR handoff to a phone.
5. **Assurance matched to the action.** Signup, posting, purchases and voting each get the level
   they need.

BotRepel's lasting value is **orchestration and policy across these lanes**, not one detector.

**Update sources:**
- X liveness checks: https://idtechwire.com/x-adds-device-biometrics-and-selfie-checks-for-suspected-bot-accounts/ and https://www.socialmediatoday.com/news/x-adds-liveness-check-to-counter-bots/832558/ (help page: https://help.x.com/en/using-x/liveness-checks)
- X age assurance: https://www.socialmediatoday.com/news/x-formerly-twitter-adds-new-age-verification-measures/754024/
- Reddit: https://support.reddithelp.com/hc/en-us/articles/50051922501268-How-to-verify-you-re-human-when-asked-by-Reddit and https://www.theverge.com/tech/900363/reddit-human-verification-bots-crackdown
- Discord: https://arstechnica.com/tech-policy/2026/09/discord-age-verification-rolls-out-today-with-changes-spurred-by-user-backlash/ and https://www.theverge.com/news/799274/discord-security-breach-5ca-vendor-blamed-not-hacked
- Death Stranding bypass: https://www.theverge.com/report/714402/uk-age-verification-bypass-death-stranding-reddit-discord
- Digital Credentials API: https://developer.chrome.com/blog/digital-credentials-api-shipped and https://webkit.org/blog/17431/online-identity-verification-with-the-digital-credentials-api/ and https://caniuse.com/wf-digital-credentials
- longfellow-zk: https://github.com/google/longfellow-zk
- Apple Digital ID: https://www.apple.com/newsroom/2025/11/apple-introduces-digital-id-a-new-way-to-create-and-present-an-id-in-apple-wallet/
- EUDI rollout: https://www.biometricupdate.com/202609/eudi-wallet-deadline-nears-as-europes-rollout-picture-remains-uneven
- Self: https://self.xyz/; ZKPassport/TACEO: https://core.taceo.io/articles/partner-zkpassport/
- World AgentKit: https://world.org/blog/announcements/now-available-agentkit-proof-of-human-for-the-agentic-web
- Web Bot Auth / signed agents: https://blog.cloudflare.com/web-bot-auth/ and https://blog.cloudflare.com/signed-agents/
- Visa Trusted Agent Protocol: https://corporate.visa.com/en/sites/visa-perspectives/newsroom/visa-unveils-trusted-agent-protocol-for-ai-commerce.html
- Cloudflare private rate limiting: https://blog.cloudflare.com/private-rate-limiting/
- Agent detection benchmark (vendor-run): https://research.poh.org/bot-benchmarking-2026/
- Halligan: https://www.usenix.org/system/files/usenixsecurity25-teoh.pdf
- Open CaptchaWorld: https://arxiv.org/abs/2505.24878
- Ofcom age assurance report: https://www.ofcom.org.uk/siteassets/resources/documents/online-safety/information-for-industry/age-assurance-report-2026/report-on-the-use-of-age-assurance.pdf?v=422500
- Galaxy Research: https://www.galaxy.com/insights/research/proof-of-humanity-ai-agents-personhood-captcha-delegation-agentic-web

## v1 implementation notes (Oct 2026)

What shipped, and what still needs work before anyone relies on it.

- **Flash check** (`apps/web/lib/liveness/`).
  - The schedule:
    - one-time, 2 s long, in OKLCH at constant lightness;
    - hue and chroma move on independent random waves below 2.5 Hz;
    - one or two dark dips ramped over 80 ms;
    - WCAG 2.3.1-safe; the unit tests check this.
  - Analysis compares each camera channel with the same emitted channel (the diagonal model), in
    linear light. Both the camera's pixels and the schedule's colors are sRGB-decoded first,
    because screen and room light only add up linearly. In gamma-encoded values a real face's
    reflectance read blue-heavy (blue 0.27–0.46 of the total) and failed the skin check. Comparing
    luminance or chroma ratios instead of channels gave about 2% false rejects even on clean
    synthetic data.
  - Face regions are found per capture, not assumed from the oval (`face.ts`). The mask keeps 4×4
    blocks that are at least 55% as bright as the center (dropping hair, clothing, shadow) and
    respond to the screen at least 35% as strongly (dropping backgrounds, since the light falls off
    with distance). It takes the connected patch at the center and drops the patch's edge ring,
    whose blocks straddle the background and would fake 3D variation on a flat print. It then cuts
    the patch's bounding box into a 3×3 grid. Selection uses response size, never correlation, so
    it can't flatter a replay.
  - The lag is calibrated per run. The face's brightness is matched against the dark dips over
    −100 to 400 ms in 5 ms steps. The color channels may then refine that lag by ±30 ms.
  - Before correlating, the analysis drops frames captured before the light could arrive, since
    those still show the screen from before the check. It also removes a quadratic trend from
    every series to cancel auto-exposure drift.
  - Checks:
    - channel correlation of at least 0.85, on the whole face pooled; single grid cells are too
      noisy when room light swamps the screen's;
    - brightness correlation with the dips of at least 0.8;
    - a lag of −30 to 250 ms;
    - gain spread across face regions (flat media is uniform);
    - "explained" modulation depth of at least 0.015 (linear);
    - skin-colored reflectance, measured with the screen as a known illuminant.
  - **First real-face measurements** (Oct 2026: a MacBook Pro's built-in camera, Chrome, full
    brightness, 12 attempts by one person, half with a bright window behind them):
    - Lag is 120–160 ms on every run. `captureTime` is present but lands only ~3 ms before the
      frame callback. It marks when Chrome received the frame, so display scan-out and sensor
      exposure show up as lag.
    - White balance and exposure don't lock, and the image brightens steadily over the 2 s.
    - With the current analysis, 11 of 12 pass. Channel correlation is 0.78–0.94, the dips 0.92+,
      linear depth 0.024–0.094, and gain spread 0.15–1.15. A bright window halves the depth.
    - Fixed face boxes missed the face whenever it sat higher or closer in the oval.
    - The original window (−3 to +2 frames, searched only to ±4) rejected every real attempt.
      Its synthetic model assumed zero latency.
  - Synthetic results:
    - Faces with realistic sensor noise, timestamp jitter, exposure drift, head sway, and 0–5
      frames of latency all pass (100/100).
    - 0 of 400 replays of a different schedule pass, with channel correlation p99 0.74.
    - 0 of 200 flat prints pass, including prints framed inside the crop (gain spread at most
      0.005 against 0.02). Reflections more than 250 ms late fail.
  - **Security trade-off.** A relighting injector now has up to ~250 ms, minus the real
    pipeline's latency, to sample the light and tint its frames. Before, it had about one frame.
    That loop's latency is still unpublished (see "Open gaps"). Tighten `maxLagMs` once
    `livenessStat` shows real latencies across devices.
  - Thresholds come from synthetic data and one real device. `livenessStat` keeps only scalar
    scores (now including the lag in ms) for calibration on more devices.
- **Capture** uses an oval guide and a fixed center crop, not face landmarks; the server finds the face within the crop. v1 therefore proves
  "a real, skin-colored 3D surface reflecting this one-time light in real time". It does not prove
  a face specifically, and a physically correct real-time relighting injector would pass. Adding
  MediaPipe landmarks (about 10 MB; telemetry unverified) is the next step.
- **The schedule is delivered up front.** The browser renders it, so a code-level attacker can
  read it. P3b should stream it just in time and add sub-frame rolling-shutter band timing.
- **Human Pass.** A BotRepel-wide passkey with a random user handle and per-site HMAC pseudonyms.
  - Creating one requires a stricter flash pass, and happens in a first-party popup (Safari can't
    create passkeys in a cross-origin frame).
  - Limits: 10 assertions per hour. A pass younger than 1 hour counts only on risk-free visits.
  - A pass is burned when 3 sites at least a week old report it within 30 days.
  - Software authenticators can still automate user verification. Requiring the liveness anchor
    to create a pass is what keeps a farm from minting passes for free.
- **Risk signals** raise the requirement and never lower it. A DevTools connection alone stays
  below the step-up line so developers can test their own forms. "Offloaded" proof of work is
  judged by hash rate (nonce ÷ time), not by solve time, because an early lucky nonce is common.
  The datacenter-ASN signal is not built: the dataset's license is unresolved.

## Sources

### Seed paper and prior art

- Face Flashing (NDSS 2018): https://arxiv.org/abs/1801.01949
- US 9,479,500 (Bud / iProov): https://patents.google.com/patent/US9479500B2/en
- GB2543117A: https://patents.google.com/patent/GB2543117A/en

### Modern FAS/PAD

- Yu et al. survey (TPAMI): https://arxiv.org/abs/2106.14948
- CelebA-Spoof (dataset comparison): https://arxiv.org/abs/2007.12342
- Auxiliary supervision (CVPR 2018): https://openaccess.thecvf.com/content_cvpr_2018/html/Liu_Learning_Deep_Models_CVPR_2018_paper.html
- CDCN (CVPR 2020): https://openaccess.thecvf.com/content_CVPR_2020/html/Yu_Searching_Central_Difference_Convolutional_Networks_for_Face_Anti-Spoofing_CVPR_2020_paper.html
- SSDG (CVPR 2020): https://openaccess.thecvf.com/content_CVPR_2020/html/Jia_Single-Side_Domain_Generalization_for_Face_Anti-Spoofing_CVPR_2020_paper.html
- SA-FAS (CVPR 2023): https://openaccess.thecvf.com/content/CVPR2023/html/Sun_Rethinking_Domain_Generalization_for_Face_Anti-Spoofing_Separability_and_Alignment_CVPR_2023_paper.html
- FLIP (ICCV 2023): https://arxiv.org/abs/2309.16649
- GD-FAS (ICCV 2025): https://arxiv.org/abs/2507.04006
- InstructFLIP: https://arxiv.org/abs/2507.12060
- I-FAS (AAAI 2025): https://ojs.aaai.org/index.php/AAAI/article/view/33073
- FaceShield: https://arxiv.org/abs/2505.09415
- UniAttackData (IJCAI 2024): https://www.ijcai.org/proceedings/2024/83
- CVPR 2024 unified attack challenge: https://openaccess.thecvf.com/content/CVPR2024W/FAS2024/papers/Yuan_Unified_Physical-Digital_Attack_Detection_Challenge_CVPRW_2024_paper.pdf
- UniAttackData+ (ICCV 2025 workshop): https://openaccess.thecvf.com/content/ICCV2025W/FAS2025/papers/Ma_UniAttackData_Unified_Physical-Digital_Attack_Detection_Challenge_ICCVW_2025_paper.pdf
- DFDC results: https://ai.meta.com/blog/deepfake-detection-challenge-results-an-open-initiative-to-advance-ai/
- DF40 (NeurIPS 2024): https://proceedings.neurips.cc/paper_files/paper/2024/file/34239f60eca7ce9bee5280aaf81362d8-Paper-Datasets_and_Benchmarks_Track.pdf
- Deepfake-Eval-2024: https://arxiv.org/abs/2503.02857
- GOTCHA: https://arxiv.org/abs/2210.06186
- NIST IR 8491: https://nvlpubs.nist.gov/nistpubs/ir/2023/NIST.IR.8491.pdf
- DHS RIVTD Track 3: https://mdtf.org/rivtd/Results2023
- Fairness in face PAD: https://arxiv.org/abs/2209.09035

### Light-reflection lineage

- Chan et al. (TIFS 2018): https://doi.org/10.1109/tifs.2017.2758748
- Aurora Guard: https://arxiv.org/abs/1902.10311 and https://arxiv.org/abs/2102.00713
- FaceRevelio (MobiCom 2020): https://habiba-farrukh.github.io/files/FaceRevelio.pdf
- LiveScreen (INFOCOM 2020): https://doi.org/10.1109/infocom41043.2020.9155400
- Gerstner & Farid (CVPR-W 2022): https://openaccess.thecvf.com/content/CVPR2022W/WMF/papers/Gerstner_Detecting_Real-Time_Deep-Fake_Videos_Using_Active_Illumination_CVPRW_2022_paper.pdf
- Corneal probing (ICASSP 2023): https://arxiv.org/abs/2210.14153
- AIME (IoT-J 2022): https://doi.org/10.1109/jiot.2022.3215916
- FaceCloseup (AsiaCCS 2019): https://ink.library.smu.edu.sg/cgi/viewcontent.cgi?article=5516&context=sis_research
- Deepfakes inherit pulse: https://www.frontiersin.org/journals/imaging/articles/10.3389/fimag.2025.1504551/full
- EchoPrint (MobiCom 2018): https://dl.acm.org/doi/10.1145/3241539.3241575
- Virtual U (USENIX Security 2016): https://www.usenix.org/system/files/conference/usenixsecurity16/sec16_paper_xu.pdf
- SFake: https://arxiv.org/abs/2409.10889

### Commercial light liveness

- iProov Flashmark: https://www.iproov.com/biometric-encyclopedia/flashmark
- AWS Face Liveness: https://docs.aws.amazon.com/rekognition/latest/dg/face-liveness.html
- AWS shared responsibility: https://docs.aws.amazon.com/rekognition/latest/dg/face-liveness-shared-responsibility-model.html
- Azure Face liveness: https://learn.microsoft.com/en-us/azure/ai-services/face/concept-face-liveness-detection
- Alibaba Cloud ID verification: https://www.alibabacloud.com/help/doc-detail/2979674.html
- Color-feedback injection tooling (2026, Chinese): https://cn-sec.com/archives/5446539.html and http://www.yxfzedu.com/article/13354

### Browser platform

- Image Capture: https://www.w3.org/TR/image-capture/
- Image Capture implementation status: https://github.com/w3c/mediacapture-image/blob/main/implementation-status.md
- requestVideoFrameCallback: https://wicg.github.io/video-rvfc/
- Safari 18.4 notes: https://webkit.org/blog/16574/webkit-features-in-safari-18-4/
- Virtual camera detection not possible (W3C): https://github.com/w3c/mediacapture-main/issues/896
- Rolling shutter measurement: https://joancharmant.com/blog/measuring-rolling-shutter-with-a-strobing-led/
- Web Environment Integrity (withdrawn): https://github.com/explainers-by-googlers/Web-Environment-Integrity

### Threats, standards, vendors

- iProov threat reports: https://www.iproov.com/press/annual-identity-verification-threat-intelligence-report and https://www.iproov.com/press/iproov-issues-annual-threat-intelligence-report
- MITRE ATLAS case: https://www.iproov.com/press/mitre-atlas-publishes-critical-vulnerability-in-the-kyc-identity-process
- Gartner prediction: https://www.gartner.com/en/newsroom/press-releases/2024-02-01-gartner-predicts-30-percent-of-enterprises-will-consider-identity-verification-and-authentication-solutions-unreliable-in-isolation-due-to-deepfakes-by-2026
- Sensity KYC test: https://sensity.ai/blog/deepfakes-vs-kyc-biometric-verification/
- Deep-Live-Cam: https://github.com/hacksider/deep-live-cam
- ProKYC: https://www.catonetworks.com/blog/prokyc-selling-deepfake-tool-for-account-fraud-attacks/
- Virtual camera detection via metadata: https://arxiv.org/abs/2512.10653
- CEN/TS 18099: https://knowledge.bsigroup.com/products/biometric-data-injection-attack-detection
- ISO/IEC 25456: https://www.iso.org/standard/90473.html
- iBeta PAD levels: https://www.ibeta.com/iso-30107-3-presentation-attack-detection-confirmation-letters/
- FIDO Face Verification: https://fidoalliance.org/certification/identity-verification/face-verification/
- FIDO biometric requirements v4.1: https://fidoalliance.org/specs/biometric/requirements/Biometrics-Requirements-v4.1-fd-20250106.pdf
- ETSI TS 119 461: https://www.etsi.org/deliver/etsi_ts/119400_119499/119461/02.01.01_60/ts_119461v020101p.pdf
- FaceTec security report: https://www.facetec.com/FaceTec_Liveness_Security_Report.pdf
- Incode Deepsight: https://www.incode.com/products/deepsight/
- ID R&D IDLive Face Plus: https://docs.idrnd.net/idlivefaceplus/
- Apple biometric security: https://support.apple.com/guide/security-pdf/biometric-security-sec067eb0c9e/web
- World ID: https://world.org/blog/announcements/world-id-full-stack-proof-of-human
- Pricing: https://www.veriff.com/pricing, https://sumsub.com/pricing/, https://www.hcaptcha.com/pricing, https://cloud.google.com/recaptcha-enterprise/docs/compare-tiers

### Bot detection and personhood

- Turnstile: https://blog.cloudflare.com/turnstile-private-captcha-alternative/
- Privacy Pass: https://www.rfc-editor.org/rfc/rfc9576 and https://www.rfc-editor.org/rfc/rfc9577
- Vercel BotID: https://vercel.com/docs/botid
- Personhood credentials: https://arxiv.org/abs/2408.07892
- ChatGPT Agent passes Cloudflare checkbox: https://arstechnica.com/information-technology/2025/07/openais-chatgpt-agent-casually-clicks-through-i-am-not-a-robot-verification-test/

### Law

- ICO biometric guidance: https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/lawful-basis/biometric-data-guidance-biometric-recognition/biometric-recognition/
- EDPB 05/2022: https://www.edpb.europa.eu/system/files/2023-05/edpb_guidelines_202304_frtlawenforcement_v2_en.pdf
- EU AI Act: https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32024R1689
- BIPA amendment: https://www.reuters.com/legal/government/illinois-governor-approves-business-friendly-overhaul-biometric-privacy-law-2024-08-05/
- BIPA retroactivity (7th Cir.): https://www.paulhastings.com/insights/ph-privacy/7th-circuit-confirms-bipa-amendment-has-retroactive-application
- Texas CUBI / Meta settlement: https://www.texasattorneygeneral.gov/news/releases/attorney-general-ken-paxton-secures-14-billion-settlement-meta-over-its-unauthorized-capture
- Washington RCW 19.375: https://app.leg.wa.gov/RCW/default.aspx?cite=19.375&full=true
