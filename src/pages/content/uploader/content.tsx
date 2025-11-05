/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable no-self-assign */
import { Button } from "@/components/ui/button";
import { DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FileUploader } from "@/components/ui/file-uploader";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import useAudioPlayer from "@/hooks/use-audio-player";
import { useToast } from "@/hooks/use-toast";
import { SAFEST_MODEL, MAX_FILES, TOAST_STYLE_CONFIG, TOAST_STYLE_CONFIG_INFO } from "@/lib/constants";
import { cn, deleteChatAndCreateNew, detectBrowser, getFileAccept, getSpeechModeKey, removeAllListeners } from "@/lib/utils";
import { ArrowLeft, DownloadCloud, HelpCircleIcon, InfoIcon, Crown, Mic, Volume2, LocateFixed, Search } from "lucide-react";
import { FC, memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PromptProps } from ".";
import Announcements from "./announcements-popup";
import DownloadOrListen from "./download-or-listen-popup";
import FeedbackPopup from "./feedback-popup";
import { InputFormProps } from "./input-popup/input-form";
import InputPopup from "./input-popup/popup";
import PlayerBackup from "./player";
import PresenceConfirmationPopup from "./presence-confirmation-popup";
import Previews from "./previews";
import VoiceSelector from "./voice-selector";
import { usePremiumModal } from "@/context/premium-modal";
import CancelPremiumPopup from "./cancel-premium-popup";
import TimerPopup from "./timer-popup";
import PremiumModal from "./premium-modal";
import { SpeechMode, useSpeechMode } from "../../../context/speech-mode";
import { Label } from "../../../components/ui/label";
import { Switch } from "../../../components/ui/switch";
import useHybridTranscription from "@/hooks/useHybridTranscription";
import MicTranscribeForm from "./input-popup/micTranscribeForm";
import VoiceSelectPopup from "./voice-select-popup";
import useFileReader, { StructuredText, SectionIndex } from "@/hooks/use-file-reader";

interface ContentProps {
    setPrompts: (prompts: PromptProps[]) => void;
    prompts: PromptProps[];
    onOverlayOpenChange: (open: boolean) => void;
    isCancelDownloadConfirmation: boolean;
    setIsCancelDownloadConfirmation: (state: boolean) => void;
    onOpenStartFrom: (args: {
      sections: SectionIndex[];
      source: "pdf" | "docx" | "text";
      onConfirm: (args: { startAt: number; matchLength?: number }) => void;
      fullText: string;
    }) => void;
}

const BROWSER = detectBrowser();

const Content: FC<ContentProps> = ({ setPrompts, prompts, onOverlayOpenChange, isCancelDownloadConfirmation, setIsCancelDownloadConfirmation, onOpenStartFrom }) => {
    const { toast } = useToast();
    const [openVoicePopup, setOpenVoicePopup] = useState<boolean>(false);
    const [isDownload, setIsDownload] = useState<boolean>(false);
    const [files, setFiles] = useState<File[]>([]);
    const [title, setTitle] = useState<string>();
    const [pastedText, setPastedText] = useState<string>();
    const [showDownloadOrListen, setShowDownloadOrListen] = useState<boolean>(false);
    const [inputPopupOpen, setInputPopupOpen] = useState<boolean>(false);
    const [fileExtractedText, setFileExtractedText] = useState<string>(); //ToDo: to find a better way to handle this
    const [showDownloadCancelConfirmation, setShowDownloadCancelConfirmation] = useState<boolean>(false);
    const [isDownloadConfirmationOpen, setIsDownloadConfirmationOpen] = useState<boolean>(false);
    const [highlightChars, setHighlightChars] = useState<string | null>(null);
    // NEW: alphanum count before the needle (for disambiguation)
    const [highlightAlphaBefore, setHighlightAlphaBefore] = useState<number | null>(null);

    // Transcriber-specific state
    const [showMicOnlyView, setShowMicOnlyView] = useState(false);
    const [isViewingText, setIsViewingText] = useState(false);
    
    const { blobs, isTypeAACSupported, replay, partialChunkCompletedPlaying, showInfoToast, playTimeDuration, currentPlayTime, onScrub, handleVolumeChange, volume, onForward, onRewind, downloadPreviewText, progress, setProgress, downloadCombinedFile, isFetching, isPresenceModalOpen, setIsPresenceModalOpen, isBackPressed, setIsBackPressed, pause, play, extractText, splitAndSendPrompt, text, isPlaying, isLoading, reset, isPaused, playRate, handlePlayRateChange, voices, setVoices, hasCompletePlaying, setHasCompletePlaying, isVoiceLoading, reStartChunkProcess, chunks, transcribeChunks, cancelTranscription, setText, downloadPreviewHtml, setPreviewHtmlSource, getChunkAtTime, getChunkStartTime, getChunkStartOffset } = useAudioPlayer(isDownload);
    const { setOpen: setUpgradeModalOpen, isSubscribed, setReason, open: upgradeModalOpen } = usePremiumModal();
    const [timerPopupOpen, setTimerPopupOpen] = useState<boolean>(false);
    const [timerComplete, setTimerComplete] = useState<boolean>(false);
    const [timerLeft, setTimerLeft] = useState<number>(0); 
    // const [downloadDelay, setDownloadDelay] = useState<number>(0);
    const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const {isTextToSpeech, setMode} = useSpeechMode();
    const activatingWebReader = useRef(false);

    const { reset: resetMic, stop: stopMic } = useHybridTranscription();
    
    const logo = chrome.runtime.getURL(isTextToSpeech ? 'logo-128.png' : 't-logo-128.png');
    const extName = chrome.i18n.getMessage(isTextToSpeech ? "gpt_reader" : "gpt_transcriber");
    const extAlt = chrome.i18n.getMessage(isTextToSpeech ? "gpt_reader_logo" : "gpt_transcriber_logo");
    const usingGPTReader = useRef(false);

    const [structured, setStructured] = useState<StructuredText | null>(null);
    const [lastInputWasFile, setLastInputWasFile] = useState<boolean>(false);
    const [scrollToOffset, setScrollToOffset] = useState<number | null>(null);
    const fileReader = useFileReader();

    const [highlightLen, setHighlightLen] = useState<number>(0);
    const [highlightActive, setHighlightActive] = useState<boolean>(false);
    const lastActionRef = useRef<"LISTEN" | "DOWNLOAD">("LISTEN");
    // Auto-highlight bookkeeping
    const lastTimeRef = useRef<number>(0);
    const lastChunkRef = useRef<number>(0);
    const inZoneRef = useRef<boolean>(false);
    const inZoneChunkRef = useRef<number | null>(null);
    // Base (global) offset for this listening session (set when user chooses "Start from")
    const sessionBaseOffsetRef = useRef<number>(0);
    // add near other state
    const [highlightPulse, setHighlightPulse] = useState(0);
    // session's first chunk index (1-based in the current TTS session)
    const sessionFirstChunkRef = useRef<number | null>(null); 
    // whether we've visited any chunk other than the session's first
    const hasLeftSessionFirstChunkRef = useRef(false);
    const [pendingSelectedText, setPendingSelectedText] = useState<string>(""); // local buffer

    // --- Locate audio + search state ---
    const [locateCtaOpen, setLocateCtaOpen] = useState<boolean>(false);    // shows "Search for text"
    const [locateSearchMode, setLocateSearchMode] = useState<boolean>(false); // shows full search UI
    const [locateOpen, setLocateOpen] = useState<boolean>(false); // internal (popover open when CTA or search is visible)
    const [searchQuery, setSearchQuery] = useState<string>("");
    const [searchMatches, setSearchMatches] = useState<number[]>([]);
    const [searchSel, setSearchSel] = useState<number>(0);
    const lastLocateOffsetRef = useRef<number | null>(null);
    const ctaTimerRef = useRef<NodeJS.Timeout | null>(null);

    // Clean up tooltip timer on unmount
    useEffect(() => {
      return () => {
        if (ctaTimerRef.current) clearTimeout(ctaTimerRef.current);
      };
    }, []);


    // Plain full text source we highlight against (same logic used elsewhere)
    const sourcePlain = structured?.fullText ?? fileExtractedText ?? pastedText ?? text ?? "";

    const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

    const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    const applyHighlightAt = (offset: number, len: number) => {
      if (!Number.isFinite(offset) || offset < 0) return;

      if (structured?.source === "pdf") {
        // PDF path uses absolute offset + length
        setScrollToOffset(offset);
        setHighlightLen(Math.max(0, len));
        setHighlightChars(null);
        setHighlightAlphaBefore(null);
      } else {
        // DOCX/TXT path uses a needle + alphanum-before disambiguator
        const snippet = sourcePlain.slice(offset, offset + Math.max(1, len));
        setScrollToOffset(null);
        setHighlightLen(0);
        setHighlightChars(snippet || null);
        setHighlightAlphaBefore(countAlnumUpTo(sourcePlain, offset));
      }

      setHighlightActive(true);
      setHighlightPulse((x) => x + 1); // flash again even if same spot
    };

    // Always highlight a 200-char window starting 25 left of `center` and 175 right
    const applyLocateWindowAtCenter = (center: number) => {
      const total = sourcePlain.length;
      if (!total) return;

      const start = Math.max(0, center - 25);
      const maxLen = Math.min(200, Math.max(0, total - start));

      applyHighlightAt(start, maxLen);
    };

    const locateNow = useCallback(() => {
      if (!chunks.length) {
        toast({
          description: "Nothing is playing yet. You can still search in the text.",
          style: TOAST_STYLE_CONFIG_INFO,
          duration: 3500,
        });
        // No auto-open; user must click again to open the search
        return;
      }

      const n = getChunkAtTime(currentPlayTime); // 1-based
      const tStart = getChunkStartTime(n);
      let tEnd = n < chunks.length ? getChunkStartTime(n + 1) : playTimeDuration;
      if (!Number.isFinite(tEnd) || tEnd <= tStart) tEnd = tStart + 1;

      const body = chunks[n - 1]?.text ?? "";
      const chunkLen = body.length || 0;

      const p = clamp01((currentPlayTime - tStart) / Math.max(0.001, tEnd - tStart));
      const posInChunk = Math.min(chunkLen, Math.max(0, Math.round(p * chunkLen)));

      // Center is the precise doc offset where we think the audio is
      const centerOffset = sessionBaseOffsetRef.current + getChunkStartOffset(n) + posInChunk;

      lastLocateOffsetRef.current = centerOffset;
      applyLocateWindowAtCenter(centerOffset);
    }, [
      chunks,
      currentPlayTime,
      getChunkAtTime,
      getChunkStartTime,
      getChunkStartOffset,
      playTimeDuration,
      applyLocateWindowAtCenter,
    ]);

    const onLocateClick = useCallback(() => {
      // Always perform the locate highlight
      locateNow();

      // If user is already in search mode, keep that open and do nothing else
      if (locateSearchMode) {
        setLocateOpen(true);
        return;
      }

      // Show CTA ("Search for text") and keep it for the same window the highlight is visible
      setLocateCtaOpen(true);
      setLocateOpen(true);
      if (ctaTimerRef.current) clearTimeout(ctaTimerRef.current);
      ctaTimerRef.current = setTimeout(() => {
        setLocateCtaOpen(false);
        // Close popover only if search hasn't been opened
        setLocateOpen((prev) => (locateSearchMode ? true : false));
      }, 4000); // keep in sync with your highlight lifetime
    }, [locateNow, locateSearchMode]);



    // Recompute matches whenever query or text changes (only when popover is open)
    useEffect(() => {
      if (!locateOpen) return;
      const q = searchQuery.trim();
      if (!q) {
        setSearchMatches([]);
        setSearchSel(0);
        return;
      }
      const re = new RegExp(escapeRegExp(q), "gi");
      const idxs: number[] = [];
      for (let m = re.exec(sourcePlain); m; m = re.exec(sourcePlain)) {
        idxs.push(m.index);
        // Avoid infinite loops on zero-length matches
        if (m.index === re.lastIndex) re.lastIndex++;
      }
      setSearchMatches(idxs);

      // Prefer first match after last located offset; else first match
      if (idxs.length) {
        const anchor = lastLocateOffsetRef.current ?? 0;
        let i = idxs.findIndex((x) => x >= anchor);
        if (i < 0) i = 0;
        setSearchSel(i);
      } else {
        setSearchSel(0);
      }
    }, [searchQuery, sourcePlain, locateOpen]);

    const jumpToMatch = useCallback(
      (nextIdx: number) => {
        if (!searchMatches.length) return;
        const L = searchMatches.length;
        const norm = ((nextIdx % L) + L) % L;
        const at = searchMatches[norm];
        const len = Math.max(1, searchQuery.trim().length);
        applyHighlightAt(at, len);
        setSearchSel(norm);
      },
      [searchMatches, searchQuery, applyHighlightAt]
    );

    const nextMatch = useCallback(() => jumpToMatch(searchSel + 1), [jumpToMatch, searchSel]);
    const prevMatch = useCallback(() => jumpToMatch(searchSel - 1), [jumpToMatch, searchSel]);

    // helper: length = first sentence OR max 120 chars
    const lenOneSentenceOr120 = (s: string): number => {
      const takeOne = s.match(/^[\s\S]*?[.!?]["')\]]?(?:\s|$)/);
      const len = takeOne ? takeOne[0].length : Math.min(120, s.length);
      return Math.min(len, 120);
    };

    const countAlnumUpTo = (plain: string, endExclusive: number) => {
      const lim = Math.max(0, Math.min(endExclusive, plain.length));
      let k = 0;
      for (let i = 0; i < lim; i++) {
        const ch = plain[i];
        if (/\p{L}|\p{N}/u.test(ch)) k++;
      }
      return k;
    };

    // Auto-highlight at chunk start — PDF uses offset/length; DOCX/TXT use needle (alphanum)
    useEffect(() => {
      // Only in Text-to-Speech listening view; not during download preview
      if (!isTextToSpeech || isDownload || !chunks.length) { return; }

      const now = currentPlayTime;
      const chunk = getChunkAtTime(now);       // 1-based
      // We don't know the session's first chunk yet, so set it to *whatever* chunk we first observe
      if (sessionFirstChunkRef.current == null) {
        sessionFirstChunkRef.current = chunk;
      }
      if (chunk !== sessionFirstChunkRef.current) {
        hasLeftSessionFirstChunkRef.current = true;
      }
      const startS = getChunkStartTime(chunk); // seconds
      const within3sOfStart = now >= startS && (now - startS) <= 3;
      const dt = now - lastTimeRef.current;    // + = forward, - = backward
      const jumpedForwardFar = dt > 3;         // “skip too ahead” via seek bar or big forward step
      const jumpedForwardChunks = chunk - lastChunkRef.current > 1;
      const suppress = (jumpedForwardFar || jumpedForwardChunks) && dt > 0;
      if (within3sOfStart && hasLeftSessionFirstChunkRef.current) {
        const enteringNewZone = !inZoneRef.current || inZoneChunkRef.current !== chunk;
        if (enteringNewZone && !suppress) {
          inZoneRef.current = true;
          inZoneChunkRef.current = chunk;

          const body = chunks[chunk - 1]?.text ?? "";
          const len = lenOneSentenceOr120(body);

          let leadingTrim = (body.match(/^\s+/)?.[0].length ?? 0);
          if (structured?.source === "pdf") leadingTrim = 0;
          const localStart = getChunkStartOffset(chunk) + leadingTrim;
          const base = sessionBaseOffsetRef.current;
          const globalStart = base + Math.max(0, localStart);

          const sourcePlain =
            structured?.fullText ?? fileExtractedText ?? pastedText ?? text ?? "";

          if (structured?.source === "pdf") {
            // Drive PdfViewer via offset/len; bump the pulse so we re-flash even if offset repeats.
            setHighlightChars(null);
            setHighlightAlphaBefore(null);
            setScrollToOffset(globalStart);
            setHighlightLen(Math.max(0, len));
            setHighlightActive(true);
          } else {
            // DOCX/TXT will be handled by DocumentViewer via needle mode
            const needle = body.slice(0, len);
            setScrollToOffset(null);
            setHighlightLen(0);
            setHighlightChars(needle || null);
            setHighlightAlphaBefore(needle ? countAlnumUpTo(sourcePlain, globalStart) : null);
            setHighlightActive(Boolean(needle));
          }
          setHighlightPulse((x) => x + 1);
        }
      } else {
        // Left the zone
        inZoneRef.current = false;
        inZoneChunkRef.current = null;
      }

      lastChunkRef.current = chunk;
      lastTimeRef.current = now;
    }, [
      currentPlayTime,
      isTextToSpeech,
      isDownload,
      chunks,
      getChunkAtTime,
      getChunkStartTime,
      getChunkStartOffset,
      structured?.source, // make sure effect updates per source type
    ]);
   
    useMemo(() => {
        if (isCancelDownloadConfirmation) setShowDownloadCancelConfirmation(true);
    }, [isCancelDownloadConfirmation])

    const resetDownloader = () => {
        setIsDownload(false);
        setIsCancelDownloadConfirmation(false)
        setShowDownloadCancelConfirmation(false)
        setProgress(0);
        if (!isTextToSpeech) {
          cancelTranscription();
        }
        setIsBackPressed(true); //to avoid unnecessary audio play on cancel download
        localStorage.removeItem("gptr/download");
    }

    const resetter = (isBackPressed: boolean = false) => {
        reset(true, undefined, isBackPressed);
        try { fileReader.revokeStructuredObjectURLs(structured!); } catch {}
        usingGPTReader.current = false;
        activatingWebReader.current = false;
        sessionFirstChunkRef.current = null;
        hasLeftSessionFirstChunkRef.current = false;
        setHighlightChars(null);
        setHighlightAlphaBefore(null);
        setFiles([]);
        setPrompts([]);
        setTitle(undefined);
        setScrollToOffset(null);
        setHighlightActive(false);
        setHighlightLen(0);
        resetDownloader();
        if (!isTextToSpeech) {
          setText("");
          cancelTranscription();
          stopMic();
          resetMic();
        }
        setPastedText(undefined);
        setFileExtractedText(undefined);
        setShowMicOnlyView(false);
        setIsViewingText(false);
        setPreviewHtmlSource(undefined);   
        sessionBaseOffsetRef.current = 0;           
    }


    const onBackClick = async () => {
        if (isTextToSpeech) {
            if (isDownload && localStorage.getItem("gptr/download") === "true") return setShowDownloadCancelConfirmation(true);
            // delete the old ChatGPT conversation if we have one
            toast({ description: 'Fix this Alert: Clicking on the back button will trigger a refresh and the extension will be opened automatically afterwards. Make sure to confirm the above browser pop-up!', style: TOAST_STYLE_CONFIG_INFO });
            localStorage.setItem("gptr/reloadDone", "true");
            await new Promise(resolve => setTimeout(resolve, 400));
            window.location.href = `${window.location.origin}/?model=${SAFEST_MODEL}`;
        } else {
            // Transcriber mode back button logic
            cancelTranscription();

            if (isDownload && localStorage.getItem("gptr/download") === "true")
                return setShowDownloadCancelConfirmation(true);
            // delete the old ChatGPT conversation if we have one
            removeAllListeners();
            setIsViewingText(false);
            stopMic();
            resetMic();
            localStorage.setItem("gptr/reloadDone", "true");
            if (showMicOnlyView) {
                setTimeout(() => {
                    setShowMicOnlyView(false);
                    resetter(true);
                }, 100);
            } else {
                resetter(true);
            }
            window.history.back();
            setIsBackPressed(true);
        }
    }
    const getSelectedText = useCallback(async () => {
      return await chrome.storage.local.get("selectedText");
    }, []);

    const handleExistingText = useCallback(async () => {
      const existingText = await getSelectedText();
      if (existingText?.selectedText?.length) {
        const text = String(existingText.selectedText);

        const persisted =
          (localStorage.getItem("gptr/ext-mode") as
            | "text-to-speech"
            | "speech-to-text"
            | null) ?? (isTextToSpeech ? "text-to-speech" : "speech-to-text");

        if (persisted !== "text-to-speech") {
          setMode("text-to-speech");
          window.location.href = `${window.location.origin}/?model=${SAFEST_MODEL}`;
          return;
        }

        if (usingGPTReader.current) {
          usingGPTReader.current = false;
          window.location.href = `${window.location.origin}/?model=${SAFEST_MODEL}`;
          return;
        }

        setPendingSelectedText(text);
        await chrome.storage.local.remove(["selectedText"]);
        await chrome.storage.local.set({ iswebreader: 0 });
        setOpenVoicePopup(true);
      }
      activatingWebReader.current = false;
    }, [isTextToSpeech]);

    
    // keep the same function identity so removeListener works
    const onMessage = useCallback((message: any) => {
      if (message.type === "HAS_SELECTED_TEXT" && !activatingWebReader.current) {
        activatingWebReader.current = true;
        handleExistingText();
      }
    }, [handleExistingText]); // ok if handleExistingText is stable (useCallback) or use a ref

    useEffect(() => {
      chrome.runtime.onMessage.addListener(onMessage);

      return () => {
        chrome.runtime.onMessage.removeListener(onMessage);
      };
    }, [onMessage]);

    const onSave = (files: File[]) => {
        if (!files?.length) return toast({ description: chrome.i18n.getMessage("no_files_selected"), style: TOAST_STYLE_CONFIG });
        if (isBackPressed) setIsBackPressed(false) //reseting back pressed state if the file is added
        setFiles(files);
        
        if (isTextToSpeech) {
            setLastInputWasFile(true);
            const f = files[0];
            const type = f.type;

          const setup = (st: StructuredText) => {
            setTitle(f.name);
            setStructured(st);
            setFileExtractedText(st.fullText);
            setShowDownloadOrListen(true);
            setPreviewHtmlSource(st.fullHtml ?? undefined);
          };

          (async () => {
            try {
              if (type === "application/pdf" || /\.pdf$/i.test(f.name)) {
                const st = await fileReader.pdfToStructured(f);
                setup(st);
              } else if (
                type === "application/msword" ||
                type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              ) {
                const st = await fileReader.docxToStructured(f);
                setup(st);
              } else if (
                type === "application/epub+zip" ||
                /\.epub$/i.test(f.name)       
              ) {
                const st = await fileReader.epubToStructured(f); 
                setup(st);
              } else if (type === "text/plain" || type === "text/rtf") {
                const text = await fileReader.textPlainToText(f);
                const st = fileReader.textToStructured(text);
                setup(st);
              } else {
                // fallback: keep old extraction, then structure
                const text = await extractText(f);
                const st = fileReader.textToStructured(String(text ?? ""));
                setup(st);
              }
            } catch (e: any) {
              toast({ description: e?.message || "Failed to read file", style: TOAST_STYLE_CONFIG });
              resetter();
            }
          })();
        } else {
          // Transcriber mode
          setIsDownload(true);
          setTitle(files[0].name);
          onDownloadSubmit(files[0]);
        }
    }

    const onDownloadSubmit = async (file: File) => {
        localStorage.setItem("gptr/download", "true");
        setText("⏳ Transcribing...");
        setIsDownload(true);
        setIsViewingText(true);
        await transcribeChunks(file);
    };

    useMemo(() => {
        if (text?.trim()?.length && !isDownload) {
            setPrompts([{ text }])
        } else {
            setPrompts([])
        }
    }, [text])

    const onFormSubmit: InputFormProps["onSubmit"] = (values) => {
      setLastInputWasFile(false);
      if (isBackPressed) setIsBackPressed(false);
      const t = values.title?.trim().length ? values.title + ".txt" : chrome.i18n.getMessage("untitled_file");
      setTitle(t);

      const raw = values.text ?? "";
      const st = fileReader.textToStructured(raw);
      setStructured(st);
      setPastedText(raw);
      setFileExtractedText(st.fullText);
      setShowDownloadOrListen(true);
      setPreviewHtmlSource(st.fullHtml ?? undefined);  
    };

    const listenOrDownloadAudioFrom = useCallback(async (startAt: number) => {
      sessionBaseOffsetRef.current = Math.max(0, startAt);
      const payload = (fileExtractedText ?? pastedText ?? ""); // keep as-is to preserve indices
      if (!payload) return;
      const sliced = startAt > 0 ? payload.slice(startAt) : payload;

      if (structured?.source === "pdf") {
        setScrollToOffset(startAt);
      } else {
        setScrollToOffset(null);
      }

      // Re-arm preview HTML (important for EPUB)
      setPreviewHtmlSource(structured?.fullHtml ?? undefined);

      usingGPTReader.current = true;
      return splitAndSendPrompt(sliced).finally(() => {
        setShowDownloadOrListen(false);
      });
    }, [fileExtractedText, pastedText, splitAndSendPrompt, setShowDownloadOrListen]);

    const onDownloadOrListenSubmit = useCallback(async (value: "DOWNLOAD" | "LISTEN") => {
      if (value === "DOWNLOAD") {
        setIsDownload(true);
        localStorage.setItem("gptr/download", "true");
      } else {
        setIsDownload(false);
        localStorage.setItem("gptr/download", "false");
      }
      lastActionRef.current = value;

      // Only show the page picker for **uploaded files** (not pasted/typed text)
      if (lastInputWasFile && structured && structured.sections.length > 0) {
        // Ask parent (index.tsx) to open the StartFromPopUp
        onOpenStartFrom({
          sections: structured.sections,
          source: structured.source,
          fullText: structured.fullText,
          onConfirm: ({ startAt, matchLength }) => {
            const shouldFlash =
              lastActionRef.current === "LISTEN" &&
              (startAt > 0 || (matchLength ?? 0) > 0);

            if (structured.source === "pdf") {
              // PDF uses absolute selection path
              setHighlightActive(shouldFlash);
              setHighlightLen(Math.max(0, matchLength ?? 0));
              // scroll handled inside listenOrDownloadAudioFrom for PDFs
            } else {
              // DOCX/TXT/EPUB → use robust needle mode (alnum-based)
              const bodyTail = structured.fullText.slice(startAt) || "";
              const needleLen = Math.max(1, matchLength ?? lenOneSentenceOr120(bodyTail));
              // Use the existing helper that sets needle + alphaBefore for non-PDF sources
              applyHighlightAt(startAt, needleLen);
            }

            listenOrDownloadAudioFrom(startAt);
            sessionFirstChunkRef.current = null; // unknown until we actually see a chunk
            hasLeftSessionFirstChunkRef.current = false;
          },
        });
      } else {
        // No structure available; just start at 0
        listenOrDownloadAudioFrom(0);
      }
    }, [lastInputWasFile, structured, onOpenStartFrom, listenOrDownloadAudioFrom]);

    // free-user download delay: 1 s per 100 chars, min 5 s, max 60 s

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const startTimerOnce = useCallback(() => {
        if (timerIntervalRef.current) return;

        const charsPerSecond = 100;
        const maxDelay = 180; // seconds

        // sum characters in only as many chunks as we've fetched blobs for
        const totalChars = chunks
            .slice(0, blobs.length)
            .reduce((sum, chunk) => sum + chunk.text.length, 0);

        // compute raw secs (1 s/100 chars), then clamp between min and max delay
        const raw = Math.ceil(totalChars / charsPerSecond);
        const duration = Math.min(Math.max(raw, 30), maxDelay);
        // setDownloadDelay(duration);
        setTimerLeft(duration);

        timerIntervalRef.current = setInterval(() => {
            setTimerLeft((prev) => {
                if (prev <= 1) {
                    clearInterval(timerIntervalRef.current!);
                    timerIntervalRef.current = null;
                    setTimerComplete(true);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    }, [blobs, chunks]);

    const handleDownload = useCallback(() => {
      if (isTextToSpeech) {
        // Timer completed, proceed with download
        const fileName = title ?? "fix-this-audio.aac";
        downloadCombinedFile(fileName);
      }
    }, [isSubscribed, timerComplete, title, blobs, isTextToSpeech]);

    //handles the yes button click to resume the player
    const handleYes = useCallback(() => {
        if (isTextToSpeech) {
            reStartChunkProcess(true);
        }
    }, [reStartChunkProcess, isTextToSpeech]);

    //resets the player on click of presence confirmation popup no button
    const handleNo = useCallback(() => {
        resetter();
        onOverlayOpenChange(false);
    }, [onOverlayOpenChange, resetter]);

    const onDownloadCancel = useCallback(async () => {
        if (isTextToSpeech) {
            if (!isCancelDownloadConfirmation) {
                toast({ description: 'Fix this Alert: Clicking on the cancel button will trigger a refresh and the extension will be opened automatically afterwards. Make sure to confirm the above browser pop-up!', style: TOAST_STYLE_CONFIG_INFO });
                await new Promise(resolve => setTimeout(resolve, 400));
                localStorage.setItem("gptr/reloadDone", "true");
                window.location.href = `${window.location.origin}/?model=${SAFEST_MODEL}`;
            } else {
                localStorage.setItem("gptr/reloadDone", "false");
                window.location.href = `${window.location.origin}/?model=${SAFEST_MODEL}`;
            }
        } else {
            // Transcriber mode cancel
            localStorage.setItem("gptr/reloadDone", "true");
            setText("");
            setIsDownload(false);
            setIsViewingText(false);

            if (isCancelDownloadConfirmation) {
                setIsCancelDownloadConfirmation(false);
                onOverlayOpenChange(false);
            }
            setShowDownloadCancelConfirmation(false);
            resetter();
        }
    }, [resetter, setShowDownloadCancelConfirmation, isTextToSpeech, isCancelDownloadConfirmation, onOverlayOpenChange])

    const onContinueDownload = useCallback((state: boolean) => {
        if (!state) setIsCancelDownloadConfirmation(state); //resetting the state if user clicks on no after triggering the confirmation by the close button
        setShowDownloadCancelConfirmation(state);
    }, [resetter])

    const onClosePremiumModal = (open: boolean) => {
      if (!open) {
        setUpgradeModalOpen(open);
        setShowDownloadOrListen(open);
        setInputPopupOpen(open);
      }
    };

    const triggerPremium = (
        e: React.MouseEvent<HTMLElement, MouseEvent>,
        customMessage?: string
    ) => {
        if (!isSubscribed) {
            setReason(
                customMessage ??
                "Free users do not have the ability to download while listening. This is a premium only feature, please subscribe to use it."
            );
            setUpgradeModalOpen(true);
            e.preventDefault();
        }
    };

    const havingIssueHandler = useCallback(() => {
      if (isTextToSpeech) {
        chrome.runtime.sendMessage({ type: "OPEN_FAQ_VIDEO" });
      } else {
        toast({
          description:
            "If you are having trouble using Fix this, then refresh your page, re-open the extension, and try again.",
          duration: 6000,
          variant: "default",
          style: TOAST_STYLE_CONFIG_INFO,
        });
      }
    }, [isTextToSpeech]);

    const handleToggle = (checked: boolean) => {
      setMode(checked ? "text-to-speech" : "speech-to-text");
      setShowMicOnlyView(false);
      setIsViewingText(false);
    };   

    const showToggle = !prompts.length && !isDownload && !showMicOnlyView

    return (
      <>
        <DialogHeader
          className={cn("gpt:h-max", { "gpt:sr-only": isDownload })}
        >
          <DialogTitle
            className={
              "gpt:inline-flex gpt:flex-col gpt:justify-center gpt:items-center gpt:gap-2"
            }
          >
            {/* Mode Toggle - Prominently placed at top center */}
            {showToggle && (
              <div className="gpt:flex gpt:items-center gpt:justify-center gpt:gap-4 gpt:bg-transparent gpt:border gpt:border-gray-500 dark:border-gray-700 dark:bg-gray-800 gpt:rounded-xl gpt:p-3 gpt:mt-10 gpt:mb-2 gpt:shadow-md">
                <div className="gpt:flex gpt:items-center gpt:gap-3">
                  <Mic
                    className={`gpt:w-5 gpt:h-5 ${
                      !isTextToSpeech
                        ? "gpt:text-blue-400"
                        : "gpt:text-gray-500"
                    }`}
                  />
                  <Label
                    htmlFor="mode-toggle"
                    className={`gpt:text-sm gpt:font-medium ${
                      !isTextToSpeech ? "gpt:text-blue-400" : "text-gray-500"
                    }`}
                  >
                    Speech to Text
                  </Label>
                </div>

                <Switch
                  id="mode-toggle"
                  checked={isTextToSpeech}
                  onCheckedChange={handleToggle}
                  className="gpt:data-[state=checked]:bg-green-600 gpt:data-[state=unchecked]:bg-blue-600"
                  thumbClassName="gpt:bg-white dark:bg-gray-100"
                />

                <div className="gpt:flex gpt:items-center gpt:gap-3">
                  <Label
                    htmlFor="mode-toggle"
                    className={`gpt:text-sm gpt:font-medium ${
                      isTextToSpeech
                        ? "gpt:text-green-400"
                        : "gpt:text-gray-500"
                    }`}
                  >
                    Text to Speech
                  </Label>
                  <Volume2
                    className={`gpt:w-5 gpt:h-5 ${
                      isTextToSpeech
                        ? "gpt:text-green-400"
                        : "gpt:text-gray-500"
                    }`}
                  />
                </div>
              </div>
            )}
            {title ? (
              <div className="gpt:inline-flex gpt:justify-center gpt:w-full gpt:items-center gpt:gap-3">
                <p className="gpt:truncate gpt:max-w-[20dvw]">{title}</p>
                <Popover
                  onOpenChange={setIsDownloadConfirmationOpen}
                  open={isDownloadConfirmationOpen}
                  modal
                >
                  {isTextToSpeech && (
                    <PopoverTrigger asChild>
                      <div
                        onClick={(e) => triggerPremium(e)}
                        className="gpt:relative gpt:size-10 gpt:hover:scale-115 gpt:active:scale-105 gpt:transition-all gpt:cursor-pointer"
                      >
                        <Button
                          disabled={!isPaused && !isPlaying}
                          variant="ghost"
                          size={"icon"}
                          className="gpt:absolute gpt:top-1/2 gpt:start-1/2 gpt:transform gpt:-translate-y-1/2 gpt:-translate-x-1/2 gpt:rounded-full gpt:[&_svg]:size-6"
                        >
                          <DownloadCloud />
                        </Button>
                        <svg
                          className="gpt:size-full gpt:-rotate-90"
                          viewBox="0 0 36 36"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <circle
                            cx="18"
                            cy="18"
                            r="16"
                            fill="none"
                            className="gpt:transition-all gpt:ease-in-out gpt:stroke-current gpt:text-gray-800 dark:text-gray-100"
                            strokeWidth="2"
                          ></circle>
                          <circle
                            cx="18"
                            cy="18"
                            r="16"
                            fill="none"
                            className="gpt:transition-all gpt:ease-in-out gpt:stroke-current gpt:text-gray-100 dark:text-gray-700"
                            strokeWidth="2"
                            strokeDasharray="100"
                            strokeDashoffset={progress}
                            strokeLinecap="square"
                          ></circle>
                        </svg>
                      </div>
                    </PopoverTrigger>
                  )}
                  <PopoverContent className="gpt:bg-gray-100 dark:bg-gray-800 gpt:border gpt:border-gray-200 dark:border-gray-700">
                    <div className="gpt:flex gpt:flex-col gpt:gap-2">
                      <p className="gpt:text-wrap">
                        {chrome.i18n.getMessage("download_confirm")}
                      </p>
                      <div className="gpt:flex gpt:gap-4 gpt:w-full gpt:justify-center gpt:flex-wrap">
                        <Button
                          variant="ghost"
                          className="gpt:flex-auto gpt:border gpt:border-gray-200 dark:border-gray-700 gpt:bg-gray-50 dark:bg-gray-800 gpt:[&_svg]:size-6 gpt:transition-all"
                          onClick={() => {
                            handleDownload();
                            setIsDownloadConfirmationOpen(false);
                          }}
                        >
                          {chrome.i18n.getMessage("yes")}
                        </Button>
                        <Button
                          variant="ghost"
                          className="gpt:flex-auto gpt:border gpt:border-gray-200 dark:border-gray-700 gpt:bg-gray-50 dark:bg-gray-800 gpt:[&_svg]:size-6 gpt:transition-all"
                          onClick={() => setIsDownloadConfirmationOpen(false)}
                        >
                          {chrome.i18n.getMessage("no")}
                        </Button>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            ) : (
              <>
                {!prompts.length && (
                  <img src={logo} alt={extAlt} className="gpt:size-10" />
                )}{" "}
                {extName}
              </>
            )}
          </DialogTitle>
          <DialogDescription className="gpt:sr-only">
            {chrome.i18n.getMessage("simplify_reading")}
          </DialogDescription>
        </DialogHeader>
        <div className="gpt:flex gpt:size-full gpt:flex-col gpt:justify-center gpt:gap-6 gpt:overflow-hidden">
          <div
            className={cn(
              "gpt:absolute gpt:top-4 gpt:left-4 gpt:size-max gpt:flex gpt:gap-2 gpt:items-center gpt:justify-center",
              {
                "gpt:translate-x-12 gpt:transition-transform":
                  prompts.length > 0 || isDownload || showMicOnlyView,
              }
            )}
          >
            <ThemeToggle />
            <FeedbackPopup />
            <Announcements />
          </div>
          <div
            className={cn("gpt:absolute gpt:top-4 gpt:right-16 gpt:size-max")}
          >
            <div className="gpt:flex gpt:gap-2 gpt:items-center">
              <Button
                variant="ghost"
                onClick={havingIssueHandler}
                className="gpt:rounded-full gpt:border gpt:border-gray-200 dark:border-gray-700 gpt:bg-gray-50 dark:bg-gray-800 gpt:[&_svg]:size-6 gpt:transition-all"
              >
                <HelpCircleIcon /> {chrome.i18n.getMessage("having_issues")}
              </Button>
              {!isSubscribed && (
                <Button
                  variant="ghost"
                  onClick={(e) =>
                    triggerPremium(
                      e,
                      "Consider upgrading your membership to enjoy premium features now!"
                    )
                  }
                  className="gpt:rounded-full gpt:border gpt:border-gray-200 dark:border-gray-700 gpt:bg-gray-50 dark:bg-gray-800 gpt:[&_svg]:size-6 gpt:transition-all"
                  aria-haspopup="dialog"
                >
                  <Crown /> Upgrade Membership
                </Button>
              )}
              <CancelPremiumPopup isSubscribed={isSubscribed} />
            </div>
          </div>

          <PresenceConfirmationPopup
            loading={false}
            handleYes={handleYes}
            handleNo={handleNo}
            open={isPresenceModalOpen}
            setOpen={setIsPresenceModalOpen}
          />
          {isTextToSpeech && (
            <DownloadOrListen
              onSubmit={onDownloadOrListenSubmit}
              open={showDownloadOrListen}
              onOpenChange={(state) => {
                if (!state) resetter();
                setShowDownloadOrListen(state);
              }}
            />
          )}

          {prompts.length === 0 && !isDownload && isTextToSpeech ? (
            <VoiceSelector
              voice={voices}
              setVoices={setVoices}
              disabled={isVoiceLoading}
              loading={isVoiceLoading}
            />
          ) : null}

          {(prompts.length > 0 || isDownload || showMicOnlyView) && (
            <Button
              title={chrome.i18n.getMessage("back")}
              size={"icon"}
              onClick={onBackClick}
              className="gpt:hover:scale-115 gpt:active:scale-105 gpt:transition-all gpt:font-medium gpt:absolute gpt:top-4 gpt:left-4 gpt:rounded-full gpt:border gpt:border-gray-200 dark:border-gray-700 gpt:bg-gray-50 dark:bg-gray-800 gpt:[&_svg]:size-6"
            >
              <ArrowLeft />
              <span className="gpt:sr-only">
                {chrome.i18n.getMessage("back")}
              </span>
            </Button>
          )}
          <div className="gpt:flex gpt:size-full gpt:flex-col gpt:flex-1 gpt:gap-6 gpt:overflow-hidden">
            {isViewingText || prompts.length > 0 || isDownload ? (
              <Previews
                setDownloadCancelConfirmation={onContinueDownload}
                downloadCancelConfirmation={showDownloadCancelConfirmation}
                downloadPreviewText={isTextToSpeech ? downloadPreviewText : text}
                content={structured?.fullText ?? text}
                contentHtml={structured?.fullHtml}
                scrollToOffset={scrollToOffset ?? undefined}
                sections={structured?.sections}
                highlightLength={highlightLen}
                highlightActive={highlightActive}
                onDownload={handleDownload}
                onDownloadCancel={onDownloadCancel}
                file={files[0]}
                isDowloading={isDownload}
                progress={progress}
                downloadPreviewHtml={isTextToSpeech ? downloadPreviewHtml : undefined}
                highlightCharacters={highlightChars ?? undefined}
                highlightAlphaBefore={highlightAlphaBefore ?? undefined}
                highlightPulse={highlightPulse}
              />
            ) : (
              !showMicOnlyView && (
                <div className="gpt:flex gpt:flex-1">
                  <FileUploader
                    value={files}
                    disabled={isPlaying || isFetching}
                    accept={getFileAccept(isTextToSpeech)}
                    maxFileCount={MAX_FILES}
                    onValueChange={onSave}
                  />
                </div>
              )
            )}

            {/* Text-to-Speech Player */}
            {isTextToSpeech && (
              <PlayerBackup
                areSeekControlsAvailable={
                  isTypeAACSupported || BROWSER === "firefox"
                }
                replay={replay}
                partialChunkCompletedPlaying={partialChunkCompletedPlaying}
                setPlaybackEnded={setHasCompletePlaying}
                showControls={prompts.length > 0}
                playRate={playRate}
                handlePlayRateChange={handlePlayRateChange}
                playbackEnded={hasCompletePlaying}
                isPaused={isPaused}
                isLoading={isLoading || isFetching}
                volume={volume}
                handleVolumeChange={handleVolumeChange}
                onScrub={onScrub}
                play={play}
                pause={pause}
                currentTime={currentPlayTime}
                duration={playTimeDuration}
                isPlaying={isPlaying}
                onForward={onForward}
                onRewind={onRewind}
              />
            )}

            {/* Input Popup for Text-to-Speech */}
            {!prompts?.length && !isDownload && isTextToSpeech ? (
              <div className="gpt:flex gpt:flex-1">
                <InputPopup
                  open={inputPopupOpen}
                  onOpenChange={setInputPopupOpen}
                  disabled={isPlaying || isFetching}
                  onSubmit={onFormSubmit}
                />
              </div>
            ) : null}

            {/* Transcriber Input Popup */}
            {!prompts?.length &&
              !isDownload &&
              !showMicOnlyView &&
              !isTextToSpeech && (
                <div className="gpt:flex gpt:flex-1">
                  <InputPopup
                    disabled={true}
                    onOpenChange={(open) => {
                      if (open) {
                        setShowMicOnlyView(true);
                      }
                    }}
                  />
                </div>
              )}
          </div>

          {/* Mic Transcribe Form for Speech-to-Text */}
          {showMicOnlyView && !isTextToSpeech && (
            <MicTranscribeForm disabled={false} />
          )}

          {prompts.length > 0 && !isDownload && (
            <div className="gpt:z-[51] gpt:absolute gpt:bottom-4 gpt:right-4 gpt:flex gpt:items-center gpt:gap-3">
              {/* Locate (left of Info) */}
              <Popover
                modal={locateSearchMode}
                open={locateOpen}
                onOpenChange={(o) => {
                  if (!o) {
                    setLocateOpen(false);
                    setLocateCtaOpen(false);
                    setLocateSearchMode(false);
                    if (ctaTimerRef.current) {
                      clearTimeout(ctaTimerRef.current);
                      ctaTimerRef.current = null;
                    }
                  }
                }}
              >
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    onPointerDown={(e) => e.preventDefault()} // stops Radix from toggling
                    onClick={onLocateClick}
                    className="gpt:rounded-full gpt:border gpt:border-gray-200 dark:border-gray-700 gpt:bg-gray-50 dark:bg-gray-800 gpt:px-2 gpt:py-2 gpt:text-sm gpt:leading-none gpt:transition-all"
                    title="Locate Audio"
                  >
                    <LocateFixed className="gpt:mr-0.5 gpt:h-7 gpt:w-7" />
                    Locate Audio
                  </Button>
                </PopoverTrigger>

                <PopoverContent
                  align="end"
                  className="gpt:bg-gray-100 dark:bg-gray-800 gpt:border gpt:border-gray-200 dark:border-gray-700 gpt:w-auto gpt:min-w-0 gpt:px-2 gpt:py-2"
                  onInteractOutside={() => {           
                    setLocateOpen(false);
                    setLocateCtaOpen(false);
                    setLocateSearchMode(false);
                    if (ctaTimerRef.current) {
                      clearTimeout(ctaTimerRef.current);
                      ctaTimerRef.current = null;
                    }
                  }}
                >
                  {/* CTA (when not in search mode) */}
                  {!locateSearchMode && locateCtaOpen ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        // Enter full search ONLY via this CTA
                        setLocateSearchMode(true);
                        setLocateCtaOpen(false);
                        if (ctaTimerRef.current) {
                          clearTimeout(ctaTimerRef.current);
                          ctaTimerRef.current = null;
                        }
                      }}
                      className="gpt:h-7 gpt:px-1.5 gpt:py-0.5 gpt:text-[11px] gpt:leading-none gpt:gap-1 gpt:whitespace-nowrap gpt:rounded"
                    >
                      <Search className="gpt:w-4 gpt:h-4" />
                      Search for text
                    </Button>
                  ) : (
                    <div className="gpt:flex gpt:flex-col gpt:gap-3">
                      <div className="gpt:flex gpt:items-center gpt:gap-2">
                        <input
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              nextMatch();
                            } else if (e.key === "Enter" && e.shiftKey) {
                              e.preventDefault();
                              prevMatch();
                            } else if (e.key === "Escape") {
                              setLocateOpen(false);
                              setLocateSearchMode(false);
                            }
                          }}
                          placeholder="Search text…"
                          className="gpt:flex-1 gpt:rounded-md gpt:border gpt:border-gray-300 dark:border-gray-600 gpt:bg-white dark:bg-gray-900 gpt:px-3 gpt:py-2 gpt:text-sm gpt:outline-none focus:gpt:ring-2 focus:gpt:ring-blue-500"
                        />
                        <Button variant="ghost" onClick={prevMatch} className="gpt:px-3">Prev</Button>
                        <Button variant="ghost" onClick={nextMatch} className="gpt:px-3">Next</Button>
                      </div>

                      <div className="gpt:flex gpt:items-center gpt:justify-between gpt:text-xs gpt:text-gray-600 dark:text-gray-300">
                        <span>
                          {searchMatches.length ? `${searchSel + 1} / ${searchMatches.length}` : "0 / 0"}
                        </span>
                        <div className="gpt:flex gpt:gap-2">
                          <Button
                            variant="ghost"
                            className="gpt:px-2"
                            onClick={() => { locateNow(); }}
                          >
                            Go to Audio
                          </Button>
                          <Button variant="ghost" className="gpt:px-2" onClick={() => { setLocateOpen(false); setLocateSearchMode(false); }}>
                            Close
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </PopoverContent>
              </Popover>

              {/* Info (to the right) */}
              <InfoIcon
                onClick={() => showInfoToast(5000)}
                className="gpt:hover:cursor-pointer gpt:rounded-full gpt:hover:scale-115 gpt:active:scale-105 gpt:transition-all gpt:size-6"
              />
            </div>
          )}

          {!isSubscribed && timerPopupOpen && (
            <TimerPopup
              open={timerPopupOpen}
              onClose={() => setTimerPopupOpen(false)}
              timeLeft={timerLeft}
            />
          )}

          {/* Premium Modal  */}
          {upgradeModalOpen && (
            <PremiumModal
              open={upgradeModalOpen}
              onOpenChange={onClosePremiumModal}
            />
          )}
                {openVoicePopup && <VoiceSelectPopup voices={voices} setVoices={setVoices} isVoiceLoading={isVoiceLoading} open={openVoicePopup} onClose={async() => {
                  setOpenVoicePopup(false);
                  setPendingSelectedText("");
                }} onVoiceSelect={async() => {
                    if (pendingSelectedText) { 
                        setOpenVoicePopup(false);
                        onFormSubmit({text: pendingSelectedText});
                        setPendingSelectedText("");
                    }
                }} />}
        </div>
      </>
    );
}

export default memo(Content, (p, n) => p.isCancelDownloadConfirmation === n.isCancelDownloadConfirmation && p.prompts === n.prompts);