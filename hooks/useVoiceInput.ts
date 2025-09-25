import { useState, useCallback, useRef, useEffect } from 'react';

interface UseVoiceInputProps {
  onResult: (transcript: string) => void;
  language: 'en' | 'ja';
}

interface UseVoiceInputReturn {
  isListening: boolean;
  isSupported: boolean;
  error: string | null;
  transcript: string;
  startListening: () => void;
  stopListening: () => void;
}

export function useVoiceInput({
  onResult,
  language
}: UseVoiceInputProps): UseVoiceInputReturn {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState('');

  const recognitionRef = useRef<any>(null);
  const shouldRestartRef = useRef(false);
  const restartTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Check if SpeechRecognition is supported
    const SpeechRecognition = window.SpeechRecognition || (window as any).webkitSpeechRecognition;

    console.log('Speech Recognition supported:', !!SpeechRecognition);

    if (SpeechRecognition) {
      setIsSupported(true);

      const recognition = new SpeechRecognition();
      recognition.continuous = true;  // Allow continuous listening
      recognition.interimResults = true;  // Get interim results
      recognition.lang = language === 'en' ? 'en-US' : 'ja-JP';
      recognition.maxAlternatives = 1;
      
      // Android-specific optimizations
      const isAndroid = /Android/i.test(navigator.userAgent);
      if (isAndroid) {
        // On Android, use shorter timeout to prevent early stopping
        recognition.continuous = false; // Android works better with non-continuous mode
        recognition.interimResults = false; // Reduce processing overhead on mobile
      }

      console.log('Setting up speech recognition for language:', recognition.lang);

      recognition.onstart = () => {
        console.log('Speech recognition started');
        setIsListening(true);
        setError(null);
        setTranscript('');
      };

      recognition.onresult = (event: any) => {
        console.log('Speech recognition result received');
        let finalTranscript = '';
        let interimTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) {
            finalTranscript += result[0].transcript;
          } else {
            interimTranscript += result[0].transcript;
          }
        }

        const currentTranscript = finalTranscript || interimTranscript;
        console.log('Transcript:', currentTranscript);
        setTranscript(currentTranscript);

        // Handle Android differently - it tends to give final results more quickly
        const isAndroid = /Android/i.test(navigator.userAgent);
        if (isAndroid) {
          // On Android, use any substantial transcript (final or interim)
          if (currentTranscript.trim().length > 2) {
            onResult(currentTranscript.trim());
            recognition.stop();
          }
        } else {
          // On other platforms, wait for final results
          if (finalTranscript.trim()) {
            onResult(finalTranscript.trim());
            recognition.stop();
          }
        }
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        const errorMessage = language === 'en'
          ? `Speech recognition error: ${event.error}`
          : `音声認識エラー: ${event.error}`;
        setError(errorMessage);
        setIsListening(false);
      };

      recognition.onend = () => {
        console.log('Speech recognition ended');
        
        // On Android, if we have a transcript but no final result was processed, use it
        const isAndroid = /Android/i.test(navigator.userAgent);
        if (isAndroid && transcript.trim() && transcript.trim().length > 2) {
          console.log('Android: Using transcript from onend:', transcript);
          onResult(transcript.trim());
          setIsListening(false);
          shouldRestartRef.current = false;
        } else if (shouldRestartRef.current && isAndroid) {
          // Restart recognition on Android to continue listening
          console.log('Android: Restarting recognition for continuous listening');
          restartTimeoutRef.current = setTimeout(() => {
            if (shouldRestartRef.current && recognitionRef.current) {
              try {
                recognitionRef.current.start();
              } catch (err) {
                console.error('Failed to restart recognition:', err);
                setIsListening(false);
                shouldRestartRef.current = false;
              }
            }
          }, 100);
        } else {
          setIsListening(false);
          shouldRestartRef.current = false;
        }
      };

      recognitionRef.current = recognition;
    } else {
      setIsSupported(false);
      const errorMessage = language === 'en'
        ? 'Voice recognition is not supported in this browser'
        : 'お使いのブラウザは音声認識に対応していません';
      setError(errorMessage);
    }

    return () => {
      shouldRestartRef.current = false;
      if (restartTimeoutRef.current) {
        clearTimeout(restartTimeoutRef.current);
      }
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, [language, onResult]);

  const startListening = useCallback(async () => {
    console.log('Attempting to start speech recognition...');

    // Check microphone permissions first
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      console.log('Microphone permission granted');
      // Stop the stream immediately as we only need permission
      stream.getTracks().forEach(track => track.stop());
    } catch (permissionError) {
      console.error('Microphone permission denied:', permissionError);
      const errorMessage = language === 'en'
        ? 'Microphone permission is required for voice input. Please allow microphone access and try again.'
        : 'マイクへのアクセス許可が必要です。マイクへのアクセスを許可して再度お試しください。';
      setError(errorMessage);
      return;
    }

    if (recognitionRef.current && !isListening) {
      try {
        // Reset any previous errors
        setError(null);
        setTranscript('');
        
        // Set restart flag for Android continuous listening
        const isAndroid = /Android/i.test(navigator.userAgent);
        shouldRestartRef.current = isAndroid;
        
        recognitionRef.current.start();
        console.log('Speech recognition start() called successfully');
      } catch (err) {
        console.error('Failed to start speech recognition:', err);
        const errorMessage = language === 'en'
          ? `Could not start voice recognition: ${err}`
          : `音声認識を開始できませんでした: ${err}`;
        setError(errorMessage);
        setIsListening(false);
        shouldRestartRef.current = false;
      }
    } else if (!recognitionRef.current) {
      const errorMessage = language === 'en'
        ? 'Speech recognition not initialized'
        : '音声認識が初期化されていません';
      setError(errorMessage);
    } else if (isListening) {
      console.log('Speech recognition is already listening');
    }
  }, [isListening, language]);

  const stopListening = useCallback(() => {
    shouldRestartRef.current = false;
    if (restartTimeoutRef.current) {
      clearTimeout(restartTimeoutRef.current);
      restartTimeoutRef.current = null;
    }
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
    }
  }, [isListening]);

  return {
    isListening,
    isSupported,
    error,
    transcript,
    startListening,
    stopListening,
  };
}

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}