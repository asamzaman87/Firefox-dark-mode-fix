import { useState, useRef, useCallback } from "react";
import useAuthToken from "./use-auth-token";
import { cleanAudioBuffer, encodeWav, transcribeWithFallback } from "@/lib/utils";
import { useToast } from "./use-toast";

const CHUNK_INTERVAL_MS = 20000;
const AUDIO_CHECK_INTERVAL_MS = 50;
const RMS_THRESHOLD = 0.02;
const SILENCE_DURATION_MS = 500;

const useWhisperTranscription = () => {
  const [finalText, setFinalText] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [loading, setLoading] = useState(false);
  const { token } = useAuthToken();
  const { toast } = useToast();

  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  const chunksQueueRef = useRef<Blob[]>([]);
  const isSendingRef = useRef(false);
  const longSilenceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const audioCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const chunkTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastChunkTimeRef = useRef<number>(0);
  const isSpeakingRef = useRef(false);

  const sendAudioToWhisper = useCallback(
    async (blob: Blob) => {
      if (!blob || !token) return;
      setLoading(true);

      let uploadBlob: Blob
      try {
        // 1) decode → clean → encode
        const arrayBuffer = await blob.arrayBuffer();
        const tempCtx = new AudioContext();
        const rawBuf = await tempCtx.decodeAudioData(arrayBuffer);
        tempCtx.close();
        const cleaned = await cleanAudioBuffer(rawBuf);
        if (!cleaned) {
          // nothing but silence at edges—skip this chunk
          console.warn('Audio skipped due to silence')
          setLoading(false);
          return;
        }
        uploadBlob = encodeWav(cleaned)
      } catch (err) {
        console.warn(
          "Partial WebM fragment couldn’t be decoded, falling back to raw blob",
          err
        );
        uploadBlob = blob;
      }

      // ✅ ChatGPT TODO 1: Add clickable link to play original blob
      // const originalUrl1 = URL.createObjectURL(uploadBlob);
      // const originalAudioLink1 = document.createElement("a");
      // originalAudioLink1.href = originalUrl1;
      // originalAudioLink1.download = "original_blob.webm";
      // originalAudioLink1.textContent = "🎧 Play Original Audio";
      // originalAudioLink1.style.display = "block";
      // document.body.appendChild(originalAudioLink1);
      // console.log('after clean', originalAudioLink1.href);

      // 2) Use your fallback routine instead of direct fetch
      try {
        const text = await transcribeWithFallback(
          uploadBlob,
          "live_chunk",
          0,
          token,
          audioContextRef.current!
        );
        if (text) setFinalText((prev) => `${prev} ${text}`.trim());
      } catch (e) {
        console.error("Fallback transcription error", e);
      } finally {
        setLoading(false);
      }
    },
    [token]
  );

  const processQueue = useCallback(async () => {
    if (isSendingRef.current || chunksQueueRef.current.length === 0) return;
    isSendingRef.current = true;
    const blob = chunksQueueRef.current.shift();
    try {
      if (blob) await sendAudioToWhisper(blob);
    } finally {
      isSendingRef.current = false;
    }
    if (chunksQueueRef.current.length > 0) {
      processQueue();
    }
  }, [sendAudioToWhisper]);

  const handleDataAvailable = useCallback(
    (event: BlobEvent) => {
      // as long as we heard speech in this chunk, enqueue **every** dataavailable
      if (token && isSpeakingRef.current) {
        isSpeakingRef.current = false;
        chunksQueueRef.current.push(event.data);
        processQueue();
      }
    },
    [processQueue, token]
  );

  const startChunkTimer = () => {
    if (chunkTimerRef.current) {
      clearTimeout(chunkTimerRef.current);
    }
    chunkTimerRef.current = setTimeout(() => {
      if (mediaRecorderRef.current?.state === "recording") {
        stopMediaRecorder();
      }
    }, CHUNK_INTERVAL_MS);
    lastChunkTimeRef.current = Date.now();
  };

  const stopChunkTimer = () => {
    if (chunkTimerRef.current) {
      clearTimeout(chunkTimerRef.current);
      chunkTimerRef.current = null;
    }
  };

  const startMediaRecorder = async () => {
    if (audioContextRef.current?.state === "suspended") {
      await audioContextRef.current.resume();
    }
    if (mediaRecorderRef.current?.state !== "recording") {
      mediaRecorderRef.current?.start();
      startChunkTimer();
    }
  };

  const stopMediaRecorder = async () => {
    if (audioContextRef.current?.state === "suspended") {
      await audioContextRef.current.resume();
    }
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current?.stop();
    }
    stopChunkTimer();
  };

  const monitorAudioLevel = () => {
    if (!analyserRef.current || !dataArrayRef.current) return;

    analyserRef.current.getByteTimeDomainData(dataArrayRef.current);

    let sum = 0;
    for (let i = 0; i < dataArrayRef.current.length; i++) {
      const value = (dataArrayRef.current[i] - 128) / 128;
      sum += value * value;
    }
    const rms = Math.sqrt(sum / dataArrayRef.current.length);

    if (rms > RMS_THRESHOLD) {
      isSpeakingRef.current = true;
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
      if (longSilenceTimerRef.current) {
        clearTimeout(longSilenceTimerRef.current);
        longSilenceTimerRef.current = null;
      }
    } else {
      if (
        !silenceTimerRef.current &&
        mediaRecorderRef.current?.state === "recording"
      ) {
        silenceTimerRef.current = setTimeout(() => {
          stopMediaRecorder();
        }, SILENCE_DURATION_MS);
      }
      if (
        !longSilenceTimerRef.current &&
        mediaRecorderRef.current?.state === "recording"
      ) {
        longSilenceTimerRef.current = setTimeout(() => {
          stopRecording(); // ⛔ Stop everything if silent > 10s
          toast({
            description:
              "🎤 You have been automatically muted due to inactivity. If you want to continue live transcription, then unmute yourself by clicking on the button again.",
            className:
              "gpt:max-w-lg gpt:rounded-md gpt:z-[1] gpt:text-wrap gpt:break-words gpt:text-left gpt:text-sm gpt:font-medium gpt:p-4 gpt:text-white gpt:dark:text-black gpt:bg-gray-800 gpt:dark:bg-gray-100 gpt:absolute gpt:top-1/2 gpt:right-1/2 gpt:translate-x-1/2 gpt:-translate-y-34 gpt:opacity-100 gpt:transition-all gpt:ease-in-out",
            duration: 10000,
          });
        }, 10000);
      }
    }
  };

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const audioContext = new AudioContext();
      if (audioContext.state === "suspended") {
        toast({
          id: "recording-toast-0",
          description:
            "🎙️ GPT Transcriber is getting your mic ready, please wait a few seconds.",
          className:
            "gpt:max-w-lg gpt:rounded-md gpt:z-[1] gpt:text-wrap gpt:text-justify gpt:text-sm gpt:font-medium gpt:p-4 gpt:text-white gpt:dark:text-black gpt:bg-gray-800 gpt:dark:bg-gray-100 gpt:absolute gpt:top-1/2 gpt:right-1/2 gpt:translate-x-1/2 gpt:-translate-y-34 gpt:inline-flex gpt:justify-center gpt:items-center gpt:gap-2 gpt:opacity-100 gpt:transition-all gpt:ease-in-out",
          duration: 20000,
        });
        await audioContext.resume();
      }
      audioContextRef.current = audioContext;
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      const dataArray = new Uint8Array(analyser.fftSize);
      dataArrayRef.current = dataArray;
      analyserRef.current = analyser;
      source.connect(analyser);

      const mimeType = "audio/webm;codecs=opus";
      mediaRecorderRef.current = new MediaRecorder(stream, { mimeType });

      mediaRecorderRef.current.ondataavailable = handleDataAvailable;
      mediaRecorderRef.current!.onstop = async () => {
        // dataavailable will fire with a *complete* WebM
        await startMediaRecorder();
      };

      // start recording immediately, so we capture the full word
      await startMediaRecorder();
      
      audioCheckIntervalRef.current = setInterval(
        monitorAudioLevel,
        AUDIO_CHECK_INTERVAL_MS
      );

      setIsRecording(true);
      toast({
        id: "recording-toast",
        description:
          "🎙️ Live audio transcription has begun! Your speech is being recorded and will be transcribed each time you pause or some time has passed.",
        className:
          "gpt:max-w-lg gpt:rounded-md gpt:z-[1] gpt:text-wrap gpt:text-justify gpt:text-sm gpt:font-medium gpt:p-4 gpt:text-white gpt:dark:text-black gpt:bg-gray-800 gpt:dark:bg-gray-100 gpt:absolute gpt:top-1/2 gpt:right-1/2 gpt:translate-x-1/2 gpt:-translate-y-34 gpt:inline-flex gpt:justify-center gpt:items-center gpt:gap-2 gpt:opacity-100 gpt:transition-all gpt:ease-in-out",
        duration: 20000,
      });
    } catch (err) {
      console.error("Error starting recording:", err);
      setFinalText("❌ Microphone access denied");
    }
  }, [handleDataAvailable, toast]);

  const stopRecording = useCallback(async () => {
    // if (!isRecording) return;
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.onstop = null;
    }

    toast.dismiss("recording-toast");
    
    isSpeakingRef.current = true;
    stopMediaRecorder();

    if (audioCheckIntervalRef.current) {
      clearInterval(audioCheckIntervalRef.current);
      audioCheckIntervalRef.current = null;
    }

    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (longSilenceTimerRef.current) {
      clearTimeout(longSilenceTimerRef.current);
      longSilenceTimerRef.current = null;
    }

    audioContextRef.current?.close();
    streamRef.current?.getTracks().forEach((track) => track.stop());

    if (chunksQueueRef.current.length > 0) {
      await processQueue();
    }

    setIsRecording(false);
  }, [isRecording, processQueue, toast]);

  const resetRecording = useCallback(() => {
    stopMediaRecorder();

    if (audioCheckIntervalRef.current) {
      clearInterval(audioCheckIntervalRef.current);
      audioCheckIntervalRef.current = null;
    }
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (longSilenceTimerRef.current) {
      clearTimeout(longSilenceTimerRef.current);
      longSilenceTimerRef.current = null;
    }

    // audioContextRef.current?.close();
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      audioContextRef.current.close();
    }
    audioContextRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setFinalText("");
    setIsRecording(false);
    chunksQueueRef.current = [];
    isSendingRef.current = false;
  }, []);

  return {
    isRecording,
    finalText,
    loading,
    start: startRecording,
    stop: stopRecording,
    reset: resetRecording,
  };
};

export default useWhisperTranscription;
