import { MicVAD } from "@ricky0123/vad-web";

export type SpeechInputSupport = {
  microphone: boolean;
  transcription: boolean;
  vad: boolean;
  vad_engine: "silero-vad" | "browser-analyser" | "none";
};

export type SpeechInputSessionStatus =
  | "idle"
  | "starting"
  | "listening"
  | "hearing"
  | "unsupported"
  | "error";

export type SpeechInputSessionOptions = {
  locale?: string | null;
  transcriptionEnabled?: boolean;
  onStatusChange: (status: SpeechInputSessionStatus) => void;
  onTranscript: (transcript: string) => void;
  onError: (message: string) => void;
  onActivity?: (activity: SpeechInputActivity) => void;
};

export type SpeechInputSession = {
  stop: () => void;
};

export type SpeechInputActivity = {
  level: number;
  hearing: boolean;
};

type SpeechRecognitionAlternativeLike = {
  transcript: string;
};

type SpeechRecognitionResultLike = ArrayLike<SpeechRecognitionAlternativeLike> & {
  isFinal: boolean;
};

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
};

type SpeechRecognitionErrorEventLike = {
  error?: string;
};

type SpeechRecognitionInstance = {
  continuous: boolean;
  interimResults: boolean;
  lang?: string;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

type BrowserSpeechWindow = Window &
  typeof globalThis & {
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitAudioContext?: typeof AudioContext;
  };

type ActivityTracker = {
  stop: () => Promise<void> | void;
};

function getBaseAssetPath(relativePath: string): string {
  const baseUrl = import.meta.env.BASE_URL ?? "/";
  const normalizedBaseUrl = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return `${normalizedBaseUrl}${relativePath}`;
}

const VAD_ASSET_BASE_PATH = getBaseAssetPath("runtime/vad/");
const ONNX_WASM_BASE_PATH = getBaseAssetPath("runtime/onnx/");

function getSpeechRecognitionConstructor(
  sourceWindow: BrowserSpeechWindow,
): SpeechRecognitionConstructor | null {
  if (typeof sourceWindow.SpeechRecognition === "function") {
    return sourceWindow.SpeechRecognition;
  }
  if (typeof sourceWindow.webkitSpeechRecognition === "function") {
    return sourceWindow.webkitSpeechRecognition;
  }
  return null;
}

function getAudioContextConstructor(
  sourceWindow: BrowserSpeechWindow,
): typeof AudioContext | null {
  return sourceWindow.AudioContext ?? sourceWindow.webkitAudioContext ?? null;
}

function formatRecognitionError(errorCode?: string): string {
  if (errorCode === "not-allowed" || errorCode === "service-not-allowed") {
    return "Microphone access was blocked, so speech input cannot start yet.";
  }
  if (errorCode === "audio-capture") {
    return "No usable microphone was available for speech input.";
  }
  if (errorCode === "network") {
    return "Browser speech recognition lost its connection before finishing.";
  }
  return "Speech input stopped before the browser could finish listening.";
}

function formatVadError(error: unknown): string {
  if (error instanceof Error) {
    return `Voice activity detection could not start locally: ${error.message}`;
  }
  return "Voice activity detection could not start locally.";
}

function clampActivityLevel(value: number): number {
  return Number(Math.max(0, Math.min(value, 1)).toFixed(2));
}

async function startAnalyserTracking(
  sourceWindow: BrowserSpeechWindow,
  onActivity: ((activity: SpeechInputActivity) => void) | undefined,
): Promise<ActivityTracker> {
  const AudioContextConstructor = getAudioContextConstructor(sourceWindow);
  if (
    typeof sourceWindow.navigator?.mediaDevices?.getUserMedia !== "function" ||
    AudioContextConstructor === null
  ) {
    return {
      stop: () => {
        onActivity?.({
          level: 0,
          hearing: false,
        });
      },
    };
  }

  const mediaStream = await sourceWindow.navigator.mediaDevices.getUserMedia({
    audio: true,
  });
  const audioContext = new AudioContextConstructor();
  const analyserNode = audioContext.createAnalyser();
  analyserNode.fftSize = 1024;
  analyserNode.smoothingTimeConstant = 0.72;

  const mediaSource = audioContext.createMediaStreamSource(mediaStream);
  mediaSource.connect(analyserNode);

  const sampleBuffer = new Uint8Array(analyserNode.fftSize);
  const activityTimer = sourceWindow.setInterval(() => {
    analyserNode.getByteTimeDomainData(sampleBuffer);
    let sumSquares = 0;
    for (const sample of sampleBuffer) {
      const normalized = (sample - 128) / 128;
      sumSquares += normalized * normalized;
    }
    const rms = Math.sqrt(sumSquares / sampleBuffer.length);
    const level = clampActivityLevel(rms * 8);
    onActivity?.({
      level,
      hearing: level >= 0.08,
    });
  }, 120);

  return {
    stop: async () => {
      sourceWindow.clearInterval(activityTimer);
      mediaSource.disconnect();
      analyserNode.disconnect();
      mediaStream.getTracks().forEach((track) => {
        track.stop();
      });
      await audioContext.close().catch(() => undefined);
      onActivity?.({
        level: 0,
        hearing: false,
      });
    },
  };
}

async function startVadTracking(
  sourceWindow: BrowserSpeechWindow,
  options: SpeechInputSessionOptions,
): Promise<ActivityTracker> {
  let stopped = false;
  const vad = await MicVAD.new({
    model: "v5",
    startOnLoad: false,
    processorType: "ScriptProcessor",
    baseAssetPath: VAD_ASSET_BASE_PATH,
    onnxWASMBasePath: ONNX_WASM_BASE_PATH,
    onFrameProcessed: (probabilities) => {
      if (stopped) {
        return;
      }

      const level = clampActivityLevel(probabilities.isSpeech);
      options.onActivity?.({
        level,
        hearing: probabilities.isSpeech >= 0.55,
      });
    },
    onSpeechStart: () => {
      if (stopped) {
        return;
      }
      options.onStatusChange("hearing");
      options.onActivity?.({
        level: 0.72,
        hearing: true,
      });
    },
    onSpeechRealStart: () => {
      if (stopped) {
        return;
      }
      options.onStatusChange("hearing");
      options.onActivity?.({
        level: 0.86,
        hearing: true,
      });
    },
    onSpeechEnd: () => {
      if (stopped) {
        return;
      }
      options.onStatusChange("listening");
      options.onActivity?.({
        level: 0.08,
        hearing: false,
      });
    },
    onVADMisfire: () => {
      if (stopped) {
        return;
      }
      options.onStatusChange("listening");
      options.onActivity?.({
        level: 0.04,
        hearing: false,
      });
    },
  });

  await vad.start();
  options.onStatusChange("listening");

  return {
    stop: async () => {
      if (stopped) {
        return;
      }
      stopped = true;
      await vad.destroy().catch(() => undefined);
      options.onActivity?.({
        level: 0,
        hearing: false,
      });
    },
  };
}

export function getSpeechInputSupport(
  sourceWindow: BrowserSpeechWindow = window as BrowserSpeechWindow,
): SpeechInputSupport {
  const microphone =
    typeof sourceWindow.navigator?.mediaDevices?.getUserMedia === "function";
  const transcription = getSpeechRecognitionConstructor(sourceWindow) !== null;
  const vad = microphone && getAudioContextConstructor(sourceWindow) !== null;

  return {
    microphone,
    transcription,
    vad,
    vad_engine: vad ? "silero-vad" : microphone ? "browser-analyser" : "none",
  };
}

export async function startSpeechInputSession(
  options: SpeechInputSessionOptions,
  sourceWindow: BrowserSpeechWindow = window as BrowserSpeechWindow,
): Promise<SpeechInputSession> {
  const support = getSpeechInputSupport(sourceWindow);
  if (!support.microphone) {
    options.onStatusChange("unsupported");
    throw new Error("This desktop shell does not expose microphone capture.");
  }

  options.onStatusChange("starting");

  const RecognitionConstructor = getSpeechRecognitionConstructor(sourceWindow);
  const transcriptionEnabled =
    RecognitionConstructor !== null && options.transcriptionEnabled !== false;

  let stopped = false;
  let recognition: SpeechRecognitionInstance | null = null;
  let activityTracker: ActivityTracker | null = null;

  const stopActivityTracking = async () => {
    const activeTracker = activityTracker;
    activityTracker = null;
    await activeTracker?.stop();
  };

  if (support.vad) {
    try {
      activityTracker = await startVadTracking(sourceWindow, options);
    } catch (error) {
      activityTracker = await startAnalyserTracking(
        sourceWindow,
        options.onActivity,
      );
      options.onError(formatVadError(error));
      options.onStatusChange("listening");
    }
  } else {
    activityTracker = await startAnalyserTracking(
      sourceWindow,
      options.onActivity,
    );
    options.onStatusChange("listening");
  }

  if (!transcriptionEnabled) {
    return {
      stop: () => {
        if (stopped) {
          return;
        }
        stopped = true;
        void stopActivityTracking();
        options.onStatusChange("idle");
      },
    };
  }

  recognition = new RecognitionConstructor();
  recognition.continuous = true;
  recognition.interimResults = true;
  if (options.locale) {
    recognition.lang = options.locale;
  }

  recognition.onstart = () => {
    if (!stopped) {
      options.onStatusChange("listening");
    }
  };
  recognition.onresult = (event) => {
    if (stopped) {
      return;
    }

    const finalChunks: string[] = [];
    let heardSomething = false;
    for (let index = event.resultIndex; index < event.results.length; index += 1) {
      const result = event.results[index];
      const transcript = Array.from(result)
        .map((alternative) => alternative.transcript)
        .join(" ")
        .trim();

      if (!transcript) {
        continue;
      }

      heardSomething = true;
      if (result.isFinal) {
        finalChunks.push(transcript);
      }
    }

    options.onStatusChange(heardSomething ? "hearing" : "listening");
    const finalTranscript = finalChunks.join(" ").trim();
    if (finalTranscript) {
      options.onActivity?.({
        level: 1,
        hearing: true,
      });
      options.onTranscript(finalTranscript);
    }
  };
  recognition.onerror = (event) => {
    if (stopped) {
      return;
    }
    options.onStatusChange("error");
    options.onError(formatRecognitionError(event.error));
  };
  recognition.onend = () => {
    if (stopped) {
      return;
    }
    options.onStatusChange("idle");
  };

  recognition.start();

  return {
    stop: () => {
      if (stopped) {
        return;
      }
      stopped = true;
      recognition?.stop();
      void stopActivityTracking();
      options.onStatusChange("idle");
    },
  };
}
