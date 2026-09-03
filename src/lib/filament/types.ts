export type FieldStatus = "idle" | "listening" | "processing";

export type SttWord = {
  text: string;
  start: number;
  end: number;
  speaker?: number;
};

export type CatchRecord = {
  id: string;
  at: number;
  text: string;
  rawText: string;
  register: string | null;
  language: string;
  duration: number;
  caught: string[];
  words: SttWord[];
  source: "mic" | "file" | "sample";
};

export type FieldSettings = {
  dialect: boolean;
  fillers: boolean;
  diarize: boolean;
};

export type AudioBus = {
  energy: number;
  listening: boolean;
  processing: boolean;
  bins: Uint8Array<ArrayBuffer> | null;
};

export type TranscribeOk = {
  ok: true;
  text: string;
  rawText: string;
  language: string;
  duration: number;
  words: SttWord[];
  register: string | null;
  caught: string[];
};

export type TranscribeErr = {
  ok: false;
  error: string;
};

export type TranscribeResult = TranscribeOk | TranscribeErr;
