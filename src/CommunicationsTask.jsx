/**
 * CommunicationsTask — the Communications task of MATB-II.
 *
 * Plays radio call-outs; the operator must act only on messages addressed to
 * their own callsign by tuning the requested radio to the requested frequency.
 * Correct/incorrect/missed responses feed the shared System Health gauge.
 *
 * Part of the Orbital Architecture project. MIT License — see LICENSE.
 */
import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { useTranslation } from 'react-i18next';
import { useAutoScroll } from './hooks/useAutoScroll';
import { downloadCSV } from './utils/csvExport';
import { COMM_CONFIG } from './config/simulationConfig';

// ---------------------------------------------------------------------------
// 1) Dynamically import all .wav files
// ---------------------------------------------------------------------------
// Add a fallback array for audio files in case the dynamic import fails
let audioFiles = [];

// Define a function to manually load the audio files if the dynamic import fails
const loadAudioFilesFallback = () => {
  console.log('Using manual audio files fallback');

  // Use external MP3 files instead of local WAV files
  // These are reliable external MP3 files that should work in any browser
  return [
    { file: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3', callsign: 'OTHER', radio: 'COM1', frequency: '118.325' },
    { file: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3', callsign: 'OTHER', radio: 'COM1', frequency: '120.825' },
    { file: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3', callsign: 'OTHER', radio: 'COM1', frequency: '124.350' },
    { file: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3', callsign: 'OTHER', radio: 'COM1', frequency: '126.175' },
    { file: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3', callsign: 'OTHER', radio: 'COM1', frequency: '127.725' },
    { file: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3', callsign: 'OWN', radio: 'COM1', frequency: '126.450' },
    { file: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-7.mp3', callsign: 'OWN', radio: 'COM1', frequency: '126.525' },
    { file: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3', callsign: 'OWN', radio: 'COM1', frequency: '127.500' },
    { file: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-9.mp3', callsign: 'OWN', radio: 'COM2', frequency: '124.450' },
    { file: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-10.mp3', callsign: 'OWN', radio: 'COM2', frequency: '125.500' }
  ];
};

try {
  // Update to handle potential file path issues - enable recursive search for language subfolders
  const modules = require.context('./assets/sounds', true, /\.(wav|mp3)$/);
  console.log('Sound files available in require.context:', modules.keys());

  audioFiles = modules.keys().map((filename) => {
    try {
      const fileUrl = modules(filename);
      // filename is like "./en/OWN_COM1_126-450.wav" or "./el/OWN_COM1_126-450.wav"
      const { callsign, radio, frequency, language } = parseFilename(filename);
      console.log(`Loaded audio file: ${filename} (${language}) => ${fileUrl}`);

      // Ensure uppercase callsign for consistent filtering
      return {
        file: fileUrl,
        callsign: callsign.toUpperCase(), // Force uppercase for filtering
        radio,
        frequency,
        language
      };
    } catch (error) {
      console.error(`Error processing file ${filename}:`, error);
      return null;
    }
  }).filter(file => file !== null);

  console.log(`Successfully loaded ${audioFiles.length} audio files dynamically`);

  // Extra verification for debugging
  console.log('Verifying OWN files:', audioFiles.filter(file => file.callsign === 'OWN').length);
  console.log('Verifying OTHER files:', audioFiles.filter(file => file.callsign !== 'OWN').length);

  // If no audio files were loaded from webpack, use fallback
  if (audioFiles.length === 0) {
    console.warn('No audio files were loaded dynamically, using fallback');
    audioFiles = loadAudioFilesFallback();
  }
} catch (error) {
  console.error('Error loading audio files dynamically:', error);
  audioFiles = loadAudioFilesFallback();
  console.log(`Loaded ${audioFiles.length} fallback audio files`);
}

// If we still have zero audio files, create some dummy ones for testing
if (audioFiles.length === 0) {
  console.error('Critical error: No audio files loaded with either method. Creating dummy files for testing.');
  audioFiles = [
    { file: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3', callsign: 'OWN', radio: 'COM1', frequency: '126.450' },
    { file: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3', callsign: 'OTHER', radio: 'COM1', frequency: '126.175' }
  ];
  console.log('Created dummy audio files as a last resort:', audioFiles);
}

/** Parse filename like "./en/OWN_COM2_125-500.wav" => { callsign:'OWN', radio:'COM2', frequency:'125.500', language:'en' } */
function parseFilename(filename) {
  // Remove ./ prefix
  const cleanPath = filename.replace(/^\.\//, '');

  // Extract language folder if present (e.g., "en/" or "el/")
  const parts = cleanPath.split('/');

  let language = 'en'; // Default to english if no folder structure
  let filePart = cleanPath;

  if (parts.length > 1) {
    language = parts[0];
    filePart = parts[parts.length - 1]; // Get the actual filename
  }

  const base = filePart.replace('.wav', '').replace('.mp3', '');
  const nameParts = base.split('_'); // e.g., ["OWN", "COM2", "125-500"]

  const callsign = nameParts[0];
  const radio = nameParts[1];
  const freqRaw = nameParts[2];
  const frequency = freqRaw ? freqRaw.replace('-', '.') : '000.000'; // "125.500"

  return { callsign, radio, frequency, language };
}

// The radios in order for up/down arrow cycling
const radioOrder = ['NAV1', 'NAV2', 'COM1', 'COM2'];

// Constants for ramp-up levels
const LEVEL1_INTERVAL = COMM_CONFIG.CONTROLS.LEVEL1_INTERVAL_MS;
const LEVEL2_INTERVAL = COMM_CONFIG.CONTROLS.LEVEL2_INTERVAL_MS;
const LEVEL2_DELAY = COMM_CONFIG.CONTROLS.LEVEL2_DELAY_MS;

// Add these constants near the top, after other constants
const INITIAL_STATE = {
  frequencies: { ...COMM_CONFIG.DEFAULT_FREQUENCIES },
  selectedRadio: 'NAV1',
};

const CommunicationsTask = forwardRef(({
  eventsPerMinute = 2,
  showLog = false,
  onLogUpdate,
  onMetricsUpdate,
  autoEvents = false,
  onPenalty
}, ref) => {
  const { t, i18n } = useTranslation();
  const ownCallSign = 'ESA504';

  // -------------------------------------------------------------------------
  // 2) States and Refs
  // -------------------------------------------------------------------------
  const [selectedRadio, setSelectedRadio] = useState('NAV1');
  const [frequencies, setFrequencies] = useState({
    NAV1: '113.000',
    NAV2: '113.000',
    COM1: '127.000',
    COM2: '127.000',
  });

  // Add difficulty state
  const [difficulty, setDifficultyState] = useState(5);

  const [messageQueue, setMessageQueue] = useState([]);
  const [activeMessage, setActiveMessage] = useState(null);
  const [commLog, setCommLog] = useState([]);
  // Add state to track if tasks are paused
  const [isPaused, setIsPaused] = useState(false);

  const audioRef = useRef(null);
  const startTimeRef = useRef(Date.now());
  const messageIndexRef = useRef(0);

  // Refs to hold timer IDs for frequency ramps
  const freqButtonRampRef = useRef(null);
  const arrowRampRef = useRef(null);
  const level2TimeoutRef = useRef(null);
  const level2ArrowTimeoutRef = useRef(null);

  // Refs to hold latest frequencies and selectedRadio
  const frequenciesRef = useRef(frequencies);
  const selectedRadioRef = useRef(selectedRadio);

  const freqRampTimeoutRef = useRef(null);
  const freqRampIntervalRef = useRef(null);

  // Add new states for health and load metrics
  const [healthImpact, setHealthImpact] = useState(0);
  const [systemLoad, setSystemLoad] = useState(0);

  // -------------------------------------------------------------------------
  // Add a helper function to better randomize message selection
  // -------------------------------------------------------------------------

  // Keep track of recently used files to avoid repetition
  const [recentlyUsedFiles, setRecentlyUsedFiles] = useState([]);

  // Function to select a random file with improved randomization
  const getRandomAudioFile = (callsignType) => {
    console.log(`getRandomAudioFile called with callsignType: ${callsignType}`);

    // Normalize callsignType to lowercase to handle case differences
    const normalizedCallType = callsignType.toLowerCase();

    // Filter by callsign type (own or other)
    const isOwnCall = normalizedCallType === 'own';

    console.log(`Looking for ${isOwnCall ? 'OWN' : 'OTHER'} callsign type`);

    // First, check if we have any files at all
    if (audioFiles.length === 0) {
      console.error('No audio files available at all!');
      return null;
    }

    // Log all available audio files for debugging
    console.log('All available audio files:');
    audioFiles.forEach((file, index) => {
      console.log(`${index}: ${file.file}, callsign: ${file.callsign}, radio: ${file.radio}, freq: ${file.frequency}`);
    });

    // Filter messages by own/other callsign
    let eligibleFiles = audioFiles.filter(file =>
      isOwnCall ? file.callsign === 'OWN' : file.callsign !== 'OWN'
    );

    // Filter by current language, fallback to English
    const currentLang = (i18n.language || 'en').split('-')[0];
    const languageFiles = eligibleFiles.filter(file => file.language === currentLang);

    if (languageFiles.length > 0) {
      eligibleFiles = languageFiles;
    } else {
      // Fallback to English if no files found for current language
      eligibleFiles = eligibleFiles.filter(file => file.language === 'en');
    }

    console.log(`Found ${eligibleFiles.length} eligible files for ${isOwnCall ? 'OWN' : 'OTHER'} callsign`);

    if (eligibleFiles.length === 0) {
      console.error(`No eligible audio files found for ${callsignType} callsign`);

      // As a fallback, just use any available audio file
      console.log('Using fallback: selecting any random audio file');
      const randomIndex = Math.floor(Math.random() * audioFiles.length);
      return audioFiles[randomIndex];
    }

    // Try to find files that haven't been used recently
    const unusedFiles = eligibleFiles.filter(file =>
      !recentlyUsedFiles.some(usedFile => usedFile.file === file.file)
    );

    console.log(`${unusedFiles.length} unused files available`);

    let selectedFile;

    if (unusedFiles.length > 0) {
      // Pick a random file from unused ones
      const randomIndex = Math.floor(Math.random() * unusedFiles.length);
      selectedFile = unusedFiles[randomIndex];
      console.log(`Selected unused audio file: ${selectedFile.file}`);
    } else {
      // If all have been used recently, shuffle and pick one
      const shuffleIndex = Math.floor(Math.random() * eligibleFiles.length);
      selectedFile = eligibleFiles[shuffleIndex];
      console.log(`All files recently used, selected: ${selectedFile.file}`);
    }

    console.log(`Selected audio file: ${selectedFile.file} (${callsignType} callsign)`);

    // Update recently used files list (keep last 5)
    setRecentlyUsedFiles(prev => {
      const newList = [selectedFile, ...prev].slice(0, 5);
      return newList;
    });

    return selectedFile;
  };

  useEffect(() => {
    frequenciesRef.current = frequencies;
  }, [frequencies]);

  useEffect(() => {
    selectedRadioRef.current = selectedRadio;
  }, [selectedRadio]);

  // Add a new state variable to track initialization
  const [isInitialMount, setIsInitialMount] = useState(true);

  // -------------------------------------------------------------------------
  // 3) Scheduling Messages
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (isInitialMount || !autoEvents || isPaused) return;

    console.log("Communications Task: Auto events enabled, scheduling messages");

    let timeoutId = null;

    const scheduleNextMessage = () => {
      // Use configured EPM default if not provided
      const targetEPM = eventsPerMinute || COMM_CONFIG.DEFAULT_EPM;
      const baseIntervalMs = 60000 / targetEPM;

      // Tunable jitter from config
      const minJitter = COMM_CONFIG.SCHEDULING.JITTER_MIN;
      const jitterVar = COMM_CONFIG.SCHEDULING.JITTER_VAR;

      const jitter = minJitter + Math.random() * jitterVar;
      const waitTime = Math.max(COMM_CONFIG.SCHEDULING.MIN_DELAY_MS, baseIntervalMs * jitter);

      console.log(`Communications Task: Next message scheduled in ${Math.round(waitTime / 1000)}s`);

      timeoutId = setTimeout(() => {
        // If the system is now paused, exit early
        if (isPaused) return;

        // If there's no active message, trigger a new one
        if (!activeMessage) {
          // Call our existing function to enqueue a random message
          enqueueRandomMessage();
        }

        // Schedule the next message regardless
        scheduleNextMessage();
      }, waitTime);
    };

    // Start scheduling
    scheduleNextMessage();

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [isInitialMount, autoEvents, eventsPerMinute, activeMessage, isPaused]);

  const enqueueRandomMessage = () => {
    // Choose randomly between own and other callsigns
    // Formula from Config: Base - (Diff * Scaler)
    const baseChance = COMM_CONFIG.CONTENT.OWN_CALL_BASE_CHANCE;
    const diffScaler = COMM_CONFIG.CONTENT.OWN_CALL_DIFF_SCALER;
    const minChance = COMM_CONFIG.CONTENT.MIN_OWN_CALL_CHANCE;

    const ownCallChance = Math.max(minChance, baseChance - (difficulty * diffScaler));
    const callsignType = Math.random() < ownCallChance ? 'own' : 'other';

    // Use our improved random file selection helper
    const audioFile = getRandomAudioFile(callsignType);

    // If no audio file could be found, exit
    if (!audioFile) {
      console.error('Failed to find a suitable audio file');
      return;
    }

    // Set consistent timestamp and response window
    const now = Date.now();
    // Response window gets shorter with higher difficulty
    const baseWindow = COMM_CONFIG.RESPONSE_WINDOW.BASE_WINDOW_MS;
    const windowScaler = COMM_CONFIG.RESPONSE_WINDOW.DIFFICULTY_SCALER;
    const minWindow = COMM_CONFIG.RESPONSE_WINDOW.MIN_WINDOW_MS;

    const responseWindow = Math.max(minWindow, baseWindow - (difficulty * windowScaler));

    // Create message object with all necessary fields including snapshots array
    const messageId = `msg-${now}-${Math.floor(Math.random() * 10000)}`;
    const msg = {
      id: messageId,
      file: audioFile.file,
      callsign: audioFile.callsign,
      radio: audioFile.radio,
      frequency: audioFile.frequency,
      timestamp: now,
      snapshots: [], // Initialize the snapshots array
      startTime: now,
      responseRequired: audioFile.callsign === 'OWN' || Math.random() > 0.3,
      ownCallsign: audioFile.callsign === 'OWN',
      responseDeadline: now + responseWindow,
      responseWindow: responseWindow, // Store the window duration for reference
      responseTime: null,
      responded: false,
      missed: false,
      queued: true,
      finalized: false
    };

    console.log(`Communications Task: Enqueueing new message: ${msg.id}, type: ${msg.ownCallsign ? 'OWN' : 'OTHER'}, deadline in ${responseWindow / 1000}s`);

    // Add to queue
    setMessageQueue(prev => [...prev, msg]);
  };

  // -------------------------------------------------------------------------
  // 4) Playing Messages
  // -------------------------------------------------------------------------
  useEffect(() => {
    // Skip message processing during initial mount
    if (isInitialMount || isPaused || activeMessage || messageQueue.length === 0) return;

    const [msg, ...rest] = messageQueue;
    setMessageQueue(rest);
    setActiveMessage(msg);
    playMessage(msg);
  }, [isInitialMount, activeMessage, messageQueue, isPaused]);

  const playMessage = (msg) => {
    if (!msg || !msg.file) {
      console.error('[AUDIO] Cannot play null message or message without file');
      setActiveMessage(null);
      return false; // Return false to indicate failure
    }

    try {
      // Create Audio object
      // Simplify path handling - if it's a URL use it directly, otherwise use the file as is
      const audioPath = msg.file.startsWith('http')
        ? msg.file  // Use URL as is
        : msg.file; // Use file path from webpack without modifications

      // Log file details for debugging 
      let fileExtension = 'unknown';
      if (typeof msg.file === 'string') {
        const match = msg.file.match(/\.([^.]+)$/);
        fileExtension = match ? match[1].toLowerCase() : 'unknown';
      }
      console.log(`[AUDIO] File details - Type: ${fileExtension}, ` +
        `URL type: ${msg.file.startsWith('http') ? 'external' : 'local'}, ` +
        `Length: ${msg.file.length}`);

      console.log(`[AUDIO] Creating audio with path: ${audioPath} for message: ${msg.id}`);

      // Close any existing audio
      if (audioRef.current) {
        try {
          audioRef.current.pause();
          audioRef.current.src = ''; // Clear the source
          audioRef.current.load(); // Reset the audio element
          audioRef.current = null;
        } catch (err) {
          console.warn('Error closing previous audio:', err);
        }
      }

      // Create a new audio element
      audioRef.current = new Audio();

      // Initialize missing properties if needed
      if (!msg.startTime) msg.startTime = Date.now();
      if (!msg.snapshots) msg.snapshots = [];

      // Set up error handling
      audioRef.current.onerror = (e) => {
        console.error(`[AUDIO ERROR] Could not play ${audioPath} for message: ${msg.id}:`, e);

        // Try to provide more diagnostic information
        const error = audioRef.current.error;
        if (error) {
          console.error(`[AUDIO ERROR] Code: ${error.code}, Message: ${error.message}`);
        }

        // Only try fallback if we haven't successfully started playing
        // and we're not already using a fallback
        if (!msg.audioStarted && !msg.usingFallback) {
          // Use a reliable fallback MP3 file
          const fallbackFile = 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3';
          console.log(`[AUDIO] Trying fallback file: ${fallbackFile} for message: ${msg.id}`);

          // Try playing fallback after a short delay
          setTimeout(() => {
            try {
              const fallbackAudio = new Audio(fallbackFile);
              // Set a short duration for the fallback sound to avoid long delays
              fallbackAudio.currentTime = 0;
              
              // Helper to stop after 2 seconds
              const stopAfterDuration = () => {
                setTimeout(() => {
                  try {
                    fallbackAudio.pause();
                    // Manually trigger ended event
                    if (fallbackAudio.onended) fallbackAudio.onended();
                  } catch (e) {
                    console.warn('Error stopping fallback audio:', e);
                  }
                }, 2000);
              };

              fallbackAudio.onplay = stopAfterDuration;
              
              fallbackAudio.play()
                .then(() => {
                  console.log(`[AUDIO] Fallback audio playing for message: ${msg.id}`);
                  // Mark that we're using fallback so we don't double-play
                  msg.usingFallback = true;
                })
                .catch(err => console.error('[AUDIO] Fallback audio failed:', err));
            } catch (err) {
              console.error('[AUDIO] Error creating fallback audio:', err);
            }
          }, 100);
        } else if (msg.audioStarted) {
          console.log('[AUDIO] Error occurred but audio already started playing, skipping fallback');
        } else if (msg.usingFallback) {
          console.log('[AUDIO] Already using fallback, not attempting another one');
        }

        // Even if audio fails, we still want to proceed with the event
        recordSnapshot(msg);
        setSystemLoad(msg.callsign === 'OWN' ? 20 : 10);

        // Keep moving, set a timer to finalize this message
        if (!msg.audioErrorTimer) {
          msg.audioErrorTimer = setTimeout(() => {
            if (!msg.finalized) {
              console.log(`[AUDIO ERROR] Finalizing message after audio error: ${msg.id}`);
              finalizeMessage(msg);
            }
          }, 5000); // Give 5 seconds before finalizing
        }
      };

      // Record initial snapshot
      recordSnapshot(msg);

      // Add event listener for when audio ends
      audioRef.current.onended = () => {
        msg.endTime = Date.now();
        console.log(`[AUDIO] Ended: ${msg.id}`);

        // Calculate remaining time until responseDeadline
        let timeUntilDeadline = 0;
        if (msg.responseDeadline) {
          timeUntilDeadline = Math.max(0, msg.responseDeadline - Date.now());
          console.log(`[TIMER] Response window remaining: ${timeUntilDeadline}ms for message: ${msg.id}`);
        } else {
          // If no responseDeadline set, use a reasonable default (10s)
          timeUntilDeadline = 10000;
          msg.responseDeadline = Date.now() + timeUntilDeadline;
          console.log(`[TIMER] No response deadline, setting default: ${timeUntilDeadline}ms for message: ${msg.id}`);
        }

        // Start a timer for finalization based on the response window
        msg.postAudioTimer = setTimeout(() => {
          console.log(`[TIMER] Response window ended => ${msg.id}`);
          setSystemLoad(0);
          onMetricsUpdate?.({ healthImpact, systemLoad: 0 });
          if (!msg.finalized) finalizeMessage(msg);
        }, timeUntilDeadline);
      };

      // Set source after all event handlers are established
      audioRef.current.src = audioPath;
      audioRef.current.preload = 'auto';

      // Preload the audio
      audioRef.current.load();

      // Short delay to ensure audio is ready to play
      setTimeout(() => {
        // Try to play the audio
        audioRef.current.play()
          .then(() => {
            console.log(`[AUDIO] Playing: ${msg.id}`);
            // Set load when audio starts playing
            const loadValue = msg.callsign === 'OWN' ? 20 : 10;
            setSystemLoad(loadValue);
            onMetricsUpdate?.({ healthImpact, systemLoad: loadValue });

            // Flag that audio started successfully to avoid playing fallback
            msg.audioStarted = true;
          })
          .catch((err) => {
            console.error(`[AUDIO] Failed to play: ${msg.id}`, err);

            // Try to provide more diagnostic information
            if (err.name) {
              console.error(`[AUDIO] Error name: ${err.name}`);
            }

            // Only try fallback if we haven't successfully started playing
            if (!msg.audioStarted && !msg.usingFallback) {
              // If it's an AbortError, NotSupportedError, or similar browser-specific issue
              // Try a reliable external audio source
              if (err.name === 'AbortError' || err.name === 'NotSupportedError' ||
                err.message?.includes('NS_BINDING_ABORTED')) {
                console.log(`[AUDIO] Trying external reliable audio source for message: ${msg.id}`);
                const reliableUrl = 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3';

                try {
                  const reliableAudio = new Audio(reliableUrl);
                  reliableAudio.play()
                    .then(() => {
                      console.log(`[AUDIO] Reliable external audio playing for message: ${msg.id}`);
                      msg.usingFallback = true;
                    })
                    .catch(extErr => console.error('[AUDIO] Even reliable audio failed:', extErr));
                } catch (createErr) {
                  console.error('[AUDIO] Error creating reliable audio:', createErr);
                }
              }
            } else if (msg.usingFallback) {
              console.log('[AUDIO] Already using fallback, not attempting another one');
            }

            // Keep track of this error in the message
            msg.audioError = err.message || "Unknown error";

            // Keep the flow going - set system load even if audio fails
            const loadValue = msg.callsign === 'OWN' ? 20 : 10;
            setSystemLoad(loadValue);
            onMetricsUpdate?.({ healthImpact, systemLoad: loadValue });

            // Keep moving, set a timer to finalize this message
            if (!msg.audioErrorTimer) {
              msg.audioErrorTimer = setTimeout(() => {
                if (!msg.finalized) {
                  console.log(`[AUDIO ERROR] Finalizing message after audio play failure: ${msg.id}`);
                  finalizeMessage(msg);
                }
              }, 5000); // Give 5 seconds before finalizing
            }
          });
      }, 50);

      return true; // Return true to indicate successful initiation
    } catch (error) {
      console.error('[PLAY] Error in playMessage:', error);
      setActiveMessage(null);
      return false; // Return false to indicate failure
    }
  };

  // Helper function to try fallback audio
  const tryFallbackAudio = (msg) => {
    console.log('[AUDIO] Trying reliable fallback audio source');

    // Always use a known reliable audio source as fallback
    const fallbackUrl = 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3';

    // Keep the original message details, just change the file
    const fallbackMsg = {
      ...msg,
      id: `fallback-${Date.now()}`,
      file: fallbackUrl
    };

    console.log(`[AUDIO] Created fallback message: ${fallbackMsg.id}`);

    // Set as new active message
    setActiveMessage(fallbackMsg);

    // Create a new audio element directly for the fallback
    const fallbackAudio = new Audio(fallbackUrl);

    // Set up basic events
    fallbackAudio.onended = () => {
      console.log(`[AUDIO] Fallback ended: ${fallbackMsg.id}`);
      finalizeMessage(fallbackMsg);
    };

    fallbackAudio.onerror = (e) => {
      console.error('[AUDIO] Even fallback audio failed:', e);
      finalizeWithError(fallbackMsg, new Error('Fallback audio failed'));
    };

    // Try to play
    fallbackAudio.play()
      .then(() => {
        console.log('[AUDIO] Fallback audio playing successfully');
        // Set system load
        const loadValue = fallbackMsg.callsign === 'OWN' ? 20 : 10;
        setSystemLoad(loadValue);
        onMetricsUpdate?.({ healthImpact, systemLoad: loadValue });
      })
      .catch(err => {
        console.error('[AUDIO] Fallback audio play failed:', err);
        finalizeWithError(fallbackMsg, err);
      });
  };

  // Helper to finalize a message with error
  const finalizeWithError = (msg, error) => {
    // Keep track of this error in the message
    if (msg) {
      msg.audioError = error.message || "Unknown error";

      // Set a timer to finalize this message
      if (!msg.audioErrorTimer) {
        msg.audioErrorTimer = setTimeout(() => {
          if (!msg.finalized) {
            console.log(`[AUDIO ERROR] Finalizing message after audio play failure`);
            finalizeMessage(msg);
          }
        }, 5000); // Give 5 seconds before finalizing
      }
    } else {
      // If no message, just reset the active message
      setActiveMessage(null);
    }
  };

  // -------------------------------------------------------------------------
  // 5) Recording Snapshots
  //    (Called on every frequency or radio change)
  // -------------------------------------------------------------------------
  const recordSnapshot = (msg) => {
    // Ensure msg exists and has required properties
    if (!msg) {
      console.error('Cannot record snapshot for null message');
      return;
    }

    // Don't recursively call for the active message - that's a mistake that would cause infinite recursion

    if (!msg.snapshots) {
      console.warn(`Message ${msg.id} has no snapshots array, initializing it`);
      msg.snapshots = [];
    }

    if (!msg.startTime) {
      console.warn(`Message ${msg.id} has no startTime, using current time`);
      msg.startTime = Date.now();
    }

    const dt = Date.now() - msg.startTime;
    const snap = {
      t: dt,
      selectedRadio: selectedRadioRef.current,
      frequencies: { ...frequenciesRef.current },
    };

    msg.snapshots.push(snap);
    console.log(
      `[SNAPSHOT] ${msg.id} @${dt}ms selRadio=${snap.selectedRadio} freq=${JSON.stringify(
        snap.frequencies
      )}`
    );
  };

  // -------------------------------------------------------------------------
  // 6) Finalizing Messages
  // -------------------------------------------------------------------------
  const finalizeMessage = (msg) => {
    // Add checks to prevent errors
    if (!msg) {
      console.error(`Cannot finalize: message is null or undefined`);
      setActiveMessage(null);
      return;
    }

    if (msg.finalized) {
      console.log(`Message ${msg.id || 'unknown'} already finalized, skipping`);
      setActiveMessage(null);
      return;
    }

    console.log(`Finalizing message ${msg.id || 'unknown'}`);
    msg.finalized = true;

    // Clear any existing post-audio timer
    if (msg.postAudioTimer) {
      clearTimeout(msg.postAudioTimer);
      msg.postAudioTimer = null;
    }

    // Ensure snapshots array exists
    if (!msg.snapshots) msg.snapshots = [];

    // Record one last snapshot to capture the final state
    recordSnapshot(msg);

    // Check if the response deadline has passed or if we're finalizing early
    const now = Date.now();
    const deadlinePassed = !msg.responseDeadline || now >= msg.responseDeadline;

    if (!deadlinePassed) {
      console.log(`Finalizing message ${msg.id || 'unknown'} before deadline (${Math.round((msg.responseDeadline - now) / 1000)}s remaining)`);
    }

    // Analyze response based on snapshots
    let responseType = 'MISS';
    let responseTime = null;
    let impact = 0; // Initialize health impact

    if (msg.callsign === 'OWN') {
      // Own ship message - look for correct radio and frequency
      let correctResponse = false;

      for (let i = 0; i < msg.snapshots.length; i++) {
        const snap = msg.snapshots[i];
        if (snap.selectedRadio === msg.radio &&
          snap.frequencies[msg.radio] === msg.frequency) {
          responseType = 'HIT';
          responseTime = snap.t / 1000;
          impact = 10; // +10 for hits
          correctResponse = true;
          break;
        }
      }

      // Only count as a miss if the deadline has passed and no correct response
      if (!correctResponse) {
        if (deadlinePassed) {
          responseType = 'MISS';
          impact = -5; // -5 for misses
        } else {
          // If we're finalizing early but the deadline hasn't passed, don't count as a miss
          responseType = 'EARLY';
          impact = 0;
        }
      }
    } else {
      // Other ship message - check for any changes
      const hasChanges = msg.snapshots.length > 1 && msg.snapshots.some((snap, i) => {
        if (i === 0) return false;
        const prevSnap = msg.snapshots[i - 1];
        return (
          snap.selectedRadio !== prevSnap.selectedRadio ||
          Object.keys(snap.frequencies).some(
            radio => snap.frequencies[radio] !== prevSnap.frequencies[radio]
          )
        );
      });

      if (hasChanges) {
        responseType = 'FA'; // False alarm (changed controls for other ship)
        impact = -10;
      } else {
        responseType = 'CR'; // Correct rejection (no changes for other ship)
        impact = 5;
      }
    }

    // Prepare the log entry before setting state
    const logEntry = {
      index: msg.index || messageIndexRef.current++,
      Time: new Date().toISOString(),
      Ship: msg.callsign || 'Unknown',
      Radio_T: msg.radio || 'Unknown',
      Freq_T: msg.frequency || 'Unknown',
      Radio_S: selectedRadioRef.current,
      Freq_S: frequenciesRef.current[selectedRadioRef.current],
      RT: responseTime || (msg.endTime ? (msg.endTime - msg.startTime) / 1000 : 0),
      Remarks: responseType,
      Deadline: msg.responseDeadline ? new Date(msg.responseDeadline).toISOString().substring(11, 19) : 'Unknown',
      MessageID: msg.id || 'unknown' // Add message ID to the log
    };

    // Update health impact using the next state pattern to avoid React warnings
    // Apply discrete penalty/bonus via parent callback
    if (impact !== 0 && typeof onPenalty === 'function') {
      console.log(`Applying discrete penalty/bonus: ${impact} for response type: ${responseType}`);
      onPenalty(impact);
    }

    // We no longer rely on continuous healthImpact for discrete events
    // setHealthImpact(impact);

    // Use the callback version of setState to update the commLog
    setCommLog(prev => {
      const newLog = [...prev, logEntry];
      // Use setTimeout to avoid immediate state updates during render
      setTimeout(() => {
        if (onLogUpdate) onLogUpdate(newLog);
      }, 0);
      return newLog;
    });

    // Wrap the activeMessage clear in setTimeout to avoid state updates during render
    setTimeout(() => {
      setActiveMessage(null);
    }, 0);
  };

  const logRow = (row) => {
    if (!row || Object.keys(row).length === 0) return;
    setCommLog((prev) => {
      const newLog = [...prev, row];
      onLogUpdate?.(newLog);
      return newLog;
    });
  };

  // -------------------------------------------------------------------------
  // 7) Handling Radio and Frequency Changes
  //    (Immediate snapshots upon changes)
  // -------------------------------------------------------------------------

  // Helper to check for immediate success on OWN call
  const checkImmediateSuccess = (currentRadio, currentFreqs) => {
    if (!activeMessage || activeMessage.finalized || !activeMessage.ownCallsign) return;

    // Check if current settings match the target
    if (currentRadio === activeMessage.radio &&
      currentFreqs[currentRadio] === activeMessage.frequency) {

      console.log(`[IMMEDIATE SUCCESS] Correct frequency dialed for ${activeMessage.id}`);

      // Initial success logic
      const dt = Date.now() - activeMessage.startTime;

      // Update message status
      /* 
       We use a specific standardized structure for the log entry:
       - index: message sequence number
       - Time: ISO timestamp
       - Ship: Call sign (OWN or OTHER)
       - Radio_T: Target Radio
       - Freq_T: Target Frequency
       - Radio_S: Selected Radio
       - Freq_S: Selected Frequency
       - RT: Response Time in seconds
       - Remarks: HIT, MISS, FA, etc.
       - Deadline: Time when response window would have closed
       - MessageID: Internal ID
      */

      const logEntry = {
        index: activeMessage.index || messageIndexRef.current++,
        Time: new Date().toISOString(),
        Ship: activeMessage.callsign || 'Unknown',
        Radio_T: activeMessage.radio || 'Unknown',
        Freq_T: activeMessage.frequency || 'Unknown',
        Radio_S: currentRadio,
        Freq_S: currentFreqs[currentRadio],
        RT: dt / 1000,
        Remarks: 'HIT',
        Deadline: activeMessage.responseDeadline ? new Date(activeMessage.responseDeadline).toISOString().substring(11, 19) : 'Unknown',
        MessageID: activeMessage.id || 'unknown'
      };

      // Mark message as finalized
      activeMessage.finalized = true;

      // Clear timers
      if (activeMessage.postAudioTimer) {
        clearTimeout(activeMessage.postAudioTimer);
        activeMessage.postAudioTimer = null;
      }

      // Apply immediate bonus
      if (typeof onPenalty === 'function') {
        console.log('Applying immediate bonus: +10');
        onPenalty(10);
      }

      // Update logs
      setCommLog(prev => {
        const newLog = [...prev, logEntry];
        setTimeout(() => {
          if (onLogUpdate) onLogUpdate(newLog);
        }, 0);
        return newLog;
      });

      // Clear active message after short delay
      setTimeout(() => {
        setActiveMessage(null);
        setSystemLoad(0);
        onMetricsUpdate?.({ healthImpact: 0, systemLoad: 0 });
      }, 500);
    }
  };

  const handleRadioSelect = (r) => {
    // Stop any ongoing frequency ramps
    stopArrowFreqRamp();
    stopFreqButtonRamp();

    setSelectedRadio(r);
    // Use the NEW value for check, but existing refs/state might be one step behind if we don't pass it explicitly
    // So passing 'r' as currentRadio
    if (activeMessage && !activeMessage.finalized) {
      recordSnapshot(activeMessage); // This uses ref, which is updated via effect, so wait... actually recordSnapshot uses refs.
      // We need to update refs manually or rely on state update cycle. 
      // safer to pass explicit values to checkImmediateSuccess
      checkImmediateSuccess(r, frequencies);
    }
  };

  const handleFrequencyChange = (r, newVal) => {
    setFrequencies((prev) => {
      const updated = { ...prev, [r]: newVal };
      if (activeMessage && !activeMessage.finalized) {
        recordSnapshot(activeMessage);
        checkImmediateSuccess(selectedRadio, updated);
      }
      return updated;
    });
  };

  // -------------------------------------------------------------------------
  // 8) Frequency +/- Buttons with Two-Level Ramp-Up
  // -------------------------------------------------------------------------
  const handleFreqButtonDown = (r, direction, isDouble = false) => {
    stopArrowFreqRamp();
    startFreqRamp(r, direction, 'button', isDouble);
  };

  const handleFreqButtonUp = () => {
    stopFreqButtonRamp();
  };

  // -------------------------------------------------------------------------
  // 9) Arrow Key Ramp-Up with Two Levels
  // -------------------------------------------------------------------------
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ignore if typing in input fields
      if (e.target.tagName === 'INPUT') return;

      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          // Stop any ongoing ramps
          stopArrowFreqRamp();
          stopFreqButtonRamp();
          cycleRadio(-1);
          break;
        case 'ArrowDown':
          e.preventDefault();
          // Stop any ongoing ramps
          stopArrowFreqRamp();
          stopFreqButtonRamp();
          cycleRadio(+1);
          break;
        case 'ArrowLeft':
          e.preventDefault();
          // Stop any ongoing ramps
          stopArrowFreqRamp();
          stopFreqButtonRamp();
          // Start Level 1 ramp for decreasing frequency
          startFreqRamp(selectedRadioRef.current, -1, 'arrow');
          break;
        case 'ArrowRight':
          e.preventDefault();
          // Stop any ongoing ramps
          stopArrowFreqRamp();
          stopFreqButtonRamp();
          // Start Level 1 ramp for increasing frequency
          startFreqRamp(selectedRadioRef.current, +1, 'arrow');
          break;
        default:
          break;
      }
    };

    const handleKeyUp = (e) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        // Stop arrow frequency ramp when key is released
        stopArrowFreqRamp();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [selectedRadio, activeMessage, frequencies]);

  // Helper function to cycle radio selection
  const cycleRadio = (delta) => {
    const idx = radioOrder.indexOf(selectedRadioRef.current);
    let newIdx = idx + delta;
    if (newIdx < 0) newIdx = radioOrder.length - 1;
    if (newIdx >= radioOrder.length) newIdx = 0;
    handleRadioSelect(radioOrder[newIdx]);
  };

  // -------------------------------------------------------------------------
  // 10) Two-Level Frequency Ramp-Up Function
  // -------------------------------------------------------------------------
  const startFreqRamp = (radio, direction, source, isDouble = false) => {
    const initialDelay = 500;
    const rampUpDelay = 100;

    // Initial change
    setFrequencies(prev => {
      const currentFreq = Number(prev[radio]);
      let newFreq;

      if (isDouble) {
        // For whole number steps
        newFreq = Math.floor(currentFreq) + direction;
      } else {
        // For small steps (0.025)
        if (direction > 0) {
          // Going up: find next 0.025 increment
          newFreq = Math.floor(currentFreq * 40) / 40 + 0.025;
        } else {
          // Going down: find previous 0.025 increment
          newFreq = Math.ceil(currentFreq * 40) / 40 - 0.025;
        }
      }

      const newFreqStr = newFreq.toFixed(3);
      const updated = {
        ...prev,
        [radio]: newFreqStr
      };

      // Check for success on initial change
      // Note: we can't reliably check here because we don't have the updated state yet in the outer scope
      // But we can check inside the setter or after
      // However, checkImmediateSuccess needs the full frequencies object.
      // So we do it here conceptually, but we can't call checking logic inside the state setter easily if it depends on other state.
      // Actually checkImmediateSuccess depends on activeMessage which is in scope.

      // We'll trust the effect hooks or subsequent updates, OR pass the constructed object.
      // But since this is inside a stat setter, we must be careful not to trigger side effects that set state synchronously.
      // checkImmediateSuccess calls setCommLog and onPenalty. onPenalty is safe. setCommLog is safe.
      // But finalizeMessage modifies activeMessage object properties directly (mutation) then sets state.

      // Better approach: use a ref for the latest frequencies to avoid these issues, OR
      // just rely on the fact that the interval will catch it quickly, OR
      // call checkImmediateSuccess outside.

      // Let's call it via a timeout to break the cycle
      setTimeout(() => {
        checkImmediateSuccess(selectedRadioRef.current, updated);
      }, 0);

      return updated;
    });

    // Set initial timeout
    freqRampTimeoutRef.current = setTimeout(() => {
      // Start rapid changes
      freqRampIntervalRef.current = setInterval(() => {
        setFrequencies(prev => {
          const currentFreq = Number(prev[radio]);
          let newFreq;

          if (isDouble) {
            newFreq = Math.floor(currentFreq) + direction;
          } else {
            if (direction > 0) {
              newFreq = Math.floor(currentFreq * 40) / 40 + 0.025;
            } else {
              newFreq = Math.ceil(currentFreq * 40) / 40 - 0.025;
            }
          }

          const newFreqStr = newFreq.toFixed(3);
          const updated = {
            ...prev,
            [radio]: newFreqStr
          };

          // Check for success during ramp
          checkImmediateSuccess(selectedRadioRef.current, updated);

          return updated;
        });
      }, rampUpDelay);
    }, initialDelay);
  };

  const stopFreqRamp = (rampType) => {
    // Clear the common ramp refs
    if (freqRampTimeoutRef.current) {
      clearTimeout(freqRampTimeoutRef.current);
      freqRampTimeoutRef.current = null;
    }
    if (freqRampIntervalRef.current) {
      clearInterval(freqRampIntervalRef.current);
      freqRampIntervalRef.current = null;
    }

    // Clear type-specific refs
    if (rampType === 'button') {
      if (freqButtonRampRef.current) {
        clearTimeout(freqButtonRampRef.current);
        freqButtonRampRef.current = null;
      }
      if (level2TimeoutRef.current) {
        clearTimeout(level2TimeoutRef.current);
        level2TimeoutRef.current = null;
      }
    } else if (rampType === 'arrow') {
      if (arrowRampRef.current) {
        clearTimeout(arrowRampRef.current);
        arrowRampRef.current = null;
      }
      if (level2ArrowTimeoutRef.current) {
        clearTimeout(level2ArrowTimeoutRef.current);
        level2ArrowTimeoutRef.current = null;
      }
    }
  };

  const stopArrowFreqRamp = () => {
    stopFreqRamp('arrow');
  };

  const stopFreqButtonRamp = () => {
    stopFreqRamp('button');
  };

  const handleExport = () => {
    downloadCSV(commLog, 'communications-log');
  };

  // Add a new method to forcibly reset the active message state
  const clearActiveMessage = () => {
    console.log('Forcibly clearing active message state');

    // Stop any playing audio
    if (audioRef.current) {
      try {
        audioRef.current.pause();
        audioRef.current = null;
      } catch (err) {
        console.warn('Error stopping audio:', err);
      }
    }

    // Clear any timers
    if (activeMessage && activeMessage.postAudioTimer) {
      clearTimeout(activeMessage.postAudioTimer);
    }

    // Reset state
    setActiveMessage(null);
    setSystemLoad(0);
    onMetricsUpdate?.({ healthImpact, systemLoad: 0 });
  };

  // Modify the reset task function to ensure it properly clears everything
  const resetTask = () => {
    // Clear any pending audio error timers
    if (activeMessage && activeMessage.audioErrorTimer) {
      clearTimeout(activeMessage.audioErrorTimer);
    }

    // Use the clearActiveMessage function for consistency
    clearActiveMessage();

    // Reset all other state
    setSelectedRadio(INITIAL_STATE.selectedRadio);
    setFrequencies(INITIAL_STATE.frequencies);
    setMessageQueue([]);
    setCommLog([]);
    messageIndexRef.current = 0;
  };

  // Add a function to toggle pause state
  const togglePause = () => {
    const newPausedState = !isPaused;
    console.log(`CommunicationsTask: ${newPausedState ? 'Pausing' : 'Resuming'} all activity`);

    // If pausing, clear any active message and empty the queue
    if (newPausedState) {
      clearActiveMessage();
      setMessageQueue([]);
    }

    setIsPaused(newPausedState);
  };

  // Expose methods to parent components
  useImperativeHandle(ref, () => ({
    // Trigger a call with the given configuration
    triggerCall: (config) => {
      // Don't allow new calls if paused
      if (isPaused) {
        console.log('CommunicationsTask: System is paused, ignoring triggerCall');
        return false;
      }

      console.log('CommunicationsTask: triggerCall called with config:', config);

      // Check if there's already an active message
      if (activeMessage) {
        const messageAge = Date.now() - activeMessage.startTime;
        console.log(`CommunicationsTask: Active message exists (age: ${messageAge}ms)`);

        // If the message is old (> 15 seconds), clear it automatically
        if (messageAge > 15000) {
          console.log('CommunicationsTask: Clearing stale active message');
          clearActiveMessage();
        } else {
          console.log('CommunicationsTask: Cannot trigger new call while active message exists');
          return false;
        }
      }

      // Use external audio files if specified
      if (config.useExternalAudio) {
        console.log('CommunicationsTask: Using external audio files');
        return triggerExternalAudio(config.callType);
      }

      // Proceed with normal call trigger
      const eligible = getEligibleFiles(config.callType);
      console.log(`CommunicationsTask: Found ${eligible.length} eligible audio files for call type: ${config.callType}`);

      if (eligible.length === 0) {
        console.error('CommunicationsTask: No eligible audio files found for call type:', config.callType);
        return false;
      }

      const randomIndex = Math.floor(Math.random() * eligible.length);
      const selectedFile = eligible[randomIndex];

      console.log('CommunicationsTask: Selected audio file:', selectedFile);

      // Create a proper message object
      const messageId = `msg-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
      // Handle response window: check if it's already in ms (large value) or seconds (small value)
      // If config.responseWindow is undefined/null, default to 10000ms
      // If < 1000, assume seconds and multiply
      // If >= 1000, assume milliseconds and use as is
      const rawWindow = config.responseWindow !== undefined ? config.responseWindow : 10000;
      const responseWindow = rawWindow < 1000 ? rawWindow * 1000 : rawWindow;

      const msg = {
        id: messageId,
        file: selectedFile.file,
        callsign: selectedFile.callsign,
        radio: selectedFile.radio,
        frequency: selectedFile.frequency,
        timestamp: Date.now(),
        snapshots: [],
        startTime: Date.now(),
        responseRequired: selectedFile.callsign === 'OWN',
        ownCallsign: selectedFile.callsign === 'OWN',
        responseDeadline: Date.now() + responseWindow,
        responseWindow: responseWindow,
        responseTime: null,
        responded: false,
        missed: false,
        queued: false,
        finalized: false
      };

      console.log(`CommunicationsTask: Created message object with ID: ${msg.id}`);

      // Set as active message first, then play
      setActiveMessage(msg);

      // Play the message and return the result
      return playMessage(msg);
    },

    // Clear any active message
    clearActiveMessage: () => {
      console.log('CommunicationsTask: Clearing active message');
      clearActiveMessage();
      return true;
    },

    // Check if there's an active message
    isActiveMessage: () => {
      return !!activeMessage;
    },

    // Get the age of the active message in ms
    getActiveMessageAge: () => {
      if (!activeMessage) return 0;
      return Date.now() - activeMessage.startTime;
    },

    // Test function to play a specific type of audio
    testAudio: (callType = 'own') => {
      // Don't allow test audio if paused
      if (isPaused) {
        console.log('CommunicationsTask: System is paused, ignoring testAudio');
        return false;
      }

      console.log(`CommunicationsTask: Test audio function called for type: ${callType}`);
      clearActiveMessage();

      // Determine whether to use local audio or external audio
      // First try with local audio if we have eligible files
      const eligible = getEligibleFiles(callType);
      console.log(`CommunicationsTask: Found ${eligible.length} eligible local files for test audio`);

      if (eligible.length > 0) {
        // We have local audio files, use those
        const randomIndex = Math.floor(Math.random() * eligible.length);
        const selectedFile = eligible[randomIndex];

        console.log('CommunicationsTask: Using local audio file for test:', selectedFile);

        // Create a proper message object
        const messageId = `test-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
        const responseWindow = 10000; // Default 10s for test

        const msg = {
          id: messageId,
          file: selectedFile.file,
          callsign: selectedFile.callsign,
          radio: selectedFile.radio,
          frequency: selectedFile.frequency,
          timestamp: Date.now(),
          snapshots: [],
          startTime: Date.now(),
          responseRequired: selectedFile.callsign === 'OWN',
          ownCallsign: selectedFile.callsign === 'OWN',
          responseDeadline: Date.now() + responseWindow,
          responseWindow: responseWindow,
          responseTime: null,
          responded: false,
          missed: false,
          queued: false,
          finalized: false,
          isTest: true // Mark as a test message
        };

        console.log(`CommunicationsTask: Created test message object with ID: ${msg.id}`);

        // Set as active message first, then play
        setActiveMessage(msg);

        // Play the message and return the result
        return playMessage(msg);
      } else {
        // Fallback to external audio if no local files are available
        console.log('CommunicationsTask: No local audio files available, using external fallback');
        return triggerExternalAudio(callType);
      }
    },

    // New method to toggle pause state
    togglePause: () => {
      togglePause();
      return isPaused;
    },

    // New method to check pause state
    isPaused: () => isPaused,

    // Debug info
    getDebugInfo: () => {
      return {
        audioFilesLoaded: audioFiles.length,
        hasActiveMessage: !!activeMessage,
        activeMessageAge: activeMessage ? Date.now() - activeMessage.startTime : 0,
        systemLoad,
        autoEvents,
        isPaused
      };
    },
    setDifficulty: (value) => {
      console.log('CommunicationsTask: Setting difficulty to', value);
      setDifficultyState(value);
    }
  }), [audioFiles, activeMessage, systemLoad, autoEvents, isPaused]);

  // Add useEffect to reset health impact after a short delay
  useEffect(() => {
    if (healthImpact !== 0) {
      const timer = setTimeout(() => {
        setHealthImpact(0);
      }, 250); // Match monitoring task's 250ms reset time
      return () => clearTimeout(timer);
    }
  }, [healthImpact]);

  // Remove the old 1000ms reset timer
  useEffect(() => {
    if (isPaused) {
      onMetricsUpdate?.({ healthImpact: 0, systemLoad: 0 });
      return;
    }
    // Only update metrics when health impact changes
    onMetricsUpdate?.({ healthImpact, systemLoad });
  }, [healthImpact, systemLoad, isPaused, onMetricsUpdate]);

  // Add getMetrics function to expose current health and load values
  const getMetrics = () => ({
    healthImpact,
    systemLoad
  });

  // -------------------------------------------------------------------------
  // Add a debug helper function to verify that audio files are properly loaded
  // -------------------------------------------------------------------------
  useEffect(() => {
    // Debug log to check if audio files are loaded
    console.log(`Communications Task: Loaded ${audioFiles.length} audio files`);
    if (audioFiles.length === 0) {
      console.error("No audio files were loaded! Communications task won't work properly.");
    } else {
      // Log a sample of files to verify their structure
      console.log("Sample audio files:",
        audioFiles.slice(0, 3).map(file => ({
          callsign: file.callsign,
          radio: file.radio,
          frequency: file.frequency
        }))
      );
    }

    // Log when auto events are enabled/disabled
    console.log(`Communications Task: Auto events ${autoEvents ? 'enabled' : 'disabled'}`);

    // Initialize audio context when component mounts
    // We're commenting this out because it was causing audio to play on startup
    /*
    try {
      // Create a short silent audio context to enable audio
      const silentAudio = new Audio("data:audio/mp3;base64,//uQxAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAACcQCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA//////////////////////////////////////////////////////////////////8AAAA5TEFNRTMuMTAwA8MAAAAAAAAAABQgJAUHQQAB9AAAAnGMHkkIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA//sQxAADwAABpAAAACAAADSAAAAETEFNRTMuMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVU=");
      silentAudio.play().catch(e => console.log("Silent audio play prevented:", e));
    } catch (e) {
      console.warn("Could not initialize audio context:", e);
    }
    */
  }, [autoEvents, audioFiles.length]);

  const triggerCallForTesting = (forceCallType = null) => {
    try {
      // Choose a call type if not forced
      const callType = forceCallType || (Math.random() < 0.3 ? 'own' : 'other');

      // Only use direct URL audio files for testing to avoid browser compatibility issues
      const testAudioFiles = [
        { file: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3', callsign: 'OWN', radio: 'COM1', frequency: '126.450' },
        { file: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3', callsign: 'OTHER', radio: 'COM1', frequency: '126.175' }
      ];

      console.log(`[TEST] Testing with reliable audio files for ${callType} calls`);

      // Select file based on callType
      const selectedFile = callType === 'own' ? testAudioFiles[0] : testAudioFiles[1];
      console.log(`[TEST] Selected file for testing: ${selectedFile.file}`);

      // Get the audio path (already a URL)
      const audioPath = selectedFile.file;

      console.log(`[TEST] Using audio path: ${audioPath}`);

      // First check if the file exists using fetch
      console.log(`[TEST] Checking if file exists: ${audioPath}`);
      fetch(audioPath)
        .then(response => {
          if (!response.ok) {
            console.error(`[TEST] File not found or inaccessible: ${audioPath}`);
            testFallbackAudio();
          } else {
            console.log(`[TEST] File exists at ${audioPath}, attempting to play`);
            // Create a test message
            const testMsg = {
              id: `test-${Date.now()}`,
              file: selectedFile.file,
              callsign: selectedFile.callsign,
              radio: selectedFile.radio,
              frequency: selectedFile.frequency,
              timestamp: Date.now(),
              snapshots: [],
              startTime: Date.now()
            };

            // Try to play the audio
            const audio = new Audio(audioPath);
            audio.volume = 0.1; // Low volume for testing

            audio.oncanplaythrough = () => {
              console.log(`[TEST] Audio can play through: ${testMsg.callsign}_${testMsg.radio}_${testMsg.frequency}`);
              audio.pause();
            };

            audio.onerror = (e) => {
              console.error(`[TEST] Audio error:`, e);

              // Try to provide more diagnostic information
              const error = audio.error;
              if (error) {
                console.error(`[TEST] Audio error code: ${error.code}, message: ${error.message}`);
              }

              // Try a fallback
              testFallbackAudio();
            };

            audio.play()
              .then(() => console.log(`[TEST] Audio playback started`))
              .catch(e => {
                console.error(`[TEST] Audio playback failed:`, e);
                testFallbackAudio();
              });
          }
        })
        .catch(err => {
          console.error(`[TEST] Network error checking file: ${err.message}`);
          testFallbackAudio();
        });

      return true;
    } catch (error) {
      console.error('[TEST] Error in test function:', error);
      return false;
    }
  };

  // Update the fallback audio test to use a reliable source
  const testFallbackAudio = () => {
    console.log('[TEST] Trying fallback audio file (external URL)');
    const fallbackUrl = 'https://bigsoundbank.com/UPLOAD/mp3/0001.mp3';

    const audio = new Audio(fallbackUrl);
    audio.volume = 0.1; // Low volume for testing

    audio.oncanplaythrough = () => {
      console.log(`[TEST] Fallback audio can play through`);
      audio.pause();
    };

    audio.onerror = (e) => {
      console.error(`[TEST] Fallback audio error:`, e);
      const error = audio.error;
      if (error) {
        console.error(`[TEST] Fallback audio error code: ${error.code}, message: ${error.message}`);
      }
    };

    audio.play()
      .then(() => console.log(`[TEST] Fallback audio playback started`))
      .catch(e => console.error(`[TEST] Fallback audio playback failed:`, e));
  };

  // Helper function to get eligible audio files for a particular call type
  const getEligibleFiles = (callType) => {
    if (!audioFiles || audioFiles.length === 0) {
      console.warn('CommunicationsTask: No audio files available');
      return [];
    }

    const normalizedCallType = callType.toLowerCase();
    const isOwnCall = normalizedCallType === 'own';

    // Filter files based on callType (OWN or OTHER)
    let eligible = audioFiles.filter(file =>
      isOwnCall ? file.callsign === 'OWN' : file.callsign !== 'OWN'
    );

    // Filter by current language, fallback to English
    // i18n.language might be "en-US", so we take the base "en"
    const currentLang = (i18n.language || 'en').split('-')[0];
    let languageFiles = eligible.filter(file => file.language === currentLang);

    if (languageFiles.length > 0) {
      eligible = languageFiles;
    } else {
      // Fallback to English if no files found for current language
      console.log(`CommunicationsTask: No ${currentLang} files found for ${callType}, falling back to English`);
      eligible = eligible.filter(file => file.language === 'en');
    }

    console.log(`CommunicationsTask: Found ${eligible.length} eligible ${callType} files in language: ${eligible[0]?.language || 'unknown'}`);

    // If we still have no eligible files, log details for debugging
    if (eligible.length === 0 && audioFiles.length > 0) {
      console.warn(`CommunicationsTask: No eligible files found for type ${callType} and language ${currentLang} (even after fallback)`);
    }

    return eligible;
  };

  // Function to trigger external audio playback (more reliable across browsers)
  const triggerExternalAudio = (callType) => {
    console.log(`CommunicationsTask: Triggering external audio for type ${callType}`);

    // Remove the initialization check so manual triggers always work
    // Only auto events should be affected by initialization state

    // Define reliable external audio sources - using .mp3 files which are more widely supported
    const externalAudioFiles = [
      {
        file: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
        callsign: 'OWN',
        radio: 'COM1',
        frequency: '126.450'
      },
      {
        file: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
        callsign: 'OTHER',
        radio: 'COM1',
        frequency: '126.175'
      },
      {
        file: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
        callsign: 'OWN',
        radio: 'COM2',
        frequency: '124.850'
      }
    ];

    // Preload the audio files
    externalAudioFiles.forEach(audio => {
      try {
        const preloadAudio = new Audio();
        preloadAudio.src = audio.file;
        preloadAudio.preload = 'auto';
        preloadAudio.load();
        console.log(`Pre-cached audio file: ${audio.file}`);
      } catch (e) {
        console.warn(`Failed to pre-cache audio: ${audio.file}`, e);
      }
    });

    // Select appropriate audio file based on call type
    let selectedFile;
    if (callType.toLowerCase() === 'own') {
      // Random selection between the two "own" external files
      selectedFile = Math.random() < 0.5 ? externalAudioFiles[0] : externalAudioFiles[2];
    } else {
      // Use the "other" external file
      selectedFile = externalAudioFiles[1];
    }

    console.log('CommunicationsTask: Selected external audio file:', selectedFile);

    // Default response window (30 seconds)
    const responseWindow = 30000;

    // Create message object - using file instead of path
    const messageId = `external-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const newMessage = {
      id: messageId,
      file: selectedFile.file, // Using file instead of path
      callsign: selectedFile.callsign,
      radio: selectedFile.radio,
      frequency: selectedFile.frequency,
      timestamp: Date.now(),
      snapshots: [],
      responseRequired: selectedFile.callsign === 'OWN',
      ownCallsign: selectedFile.callsign === 'OWN',
      responseDeadline: Date.now() + responseWindow,
      responseWindow: responseWindow,
      responseTime: null,
      responded: false,
      missed: false,
      finalized: false,
      startTime: Date.now(),
      queued: false,
      isExternal: true // Mark as external audio
    };

    console.log(`CommunicationsTask: Created external audio message with ID: ${messageId}, type: ${newMessage.callsign}`);

    // Set as active message and play it
    setActiveMessage(newMessage);
    return playMessage(newMessage);
  };

  // Modified useEffect for initialization
  useEffect(() => {
    console.log('CommunicationsTask: Initializing component...');

    // Create an initialization flag
    let initAttempted = false;

    // Helper function to signal when initialization is complete
    const completeInitialization = () => {
      console.log('CommunicationsTask: Initialization complete');

      // Debug output of initialized state
      console.log('CommunicationsTask initialized with:', {
        audioFilesCount: audioFiles.length,
        autoEvents
      });

      // Mark initialization as complete after a small delay to prevent immediate audio playback
      setTimeout(() => {
        setIsInitialMount(false);
        console.log('CommunicationsTask: Now ready to process audio events');
      }, 1000); // 1 second delay
    };

    // Skip if already attempted initialization
    if (initAttempted) return;
    initAttempted = true;

    // Immediately try to initialize audio context with a silent buffer
    // This helps with the autoplay policy in browsers
    try {
      const silentContext = new (window.AudioContext || window.webkitAudioContext)();
      // Create a silent buffer
      const silentBuffer = silentContext.createBuffer(1, 44100, 44100);
      const source = silentContext.createBufferSource();
      source.buffer = silentBuffer;
      source.connect(silentContext.destination);

      // Don't actually play the silent audio buffer, just initialize the context
      // source.start();
      // source.stop(0.001); // Schedule to stop immediately

      console.log('CommunicationsTask: Audio context initialized with silent buffer');
    } catch (e) {
      console.warn('CommunicationsTask: Could not initialize audio context:', e);
    }

    // Helper function to check if audio is completely initialized
    const checkAudioInitialization = () => {
      // Check if we have audio files loaded
      const hasAudioFiles = audioFiles && audioFiles.length > 0;

      if (hasAudioFiles) {
        console.log(`CommunicationsTask: ${audioFiles.length} audio files are loaded and ready.`);

        // Print some example audio files for debugging
        if (audioFiles.length > 0) {
          console.log('Sample audio files:', audioFiles.slice(0, 3).map(file => ({
            file: file.file,
            callsign: file.callsign,
            radio: file.radio
          })));
        }

        completeInitialization();
      } else {
        console.warn('CommunicationsTask: No audio files loaded yet. Will try fallback loading.');

        // Set a timeout to load fallback audio if dynamic loading fails
        setTimeout(() => {
          if (audioFiles.length === 0) {
            console.log('CommunicationsTask: Loading fallback audio files...');
            loadAudioFilesFallback();
            // Check again in a moment
            setTimeout(checkAudioInitialization, 500);
          }
        }, 1000);
      }
    };

    // Debug: log when audio files are loaded or changed
    if (audioFiles) {
      console.log(`CommunicationsTask: Audio files array updated, now has ${audioFiles.length} files.`);
      checkAudioInitialization();
    } else {
      console.log('CommunicationsTask: Audio files array is not initialized yet.');
      // Will be checked when audioFiles updates
    }

    // Cleanup function
    return () => {
      console.log('CommunicationsTask: Component unmounting, cleaning up...');
      // Cleanup code
    };
    // Use an empty dependency array as we only want this to run once at mount
  }, []);

  // -------------------------------------------------------------------------
  // 11) Render
  // -------------------------------------------------------------------------
  return (
    <div style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      maxWidth: '100%',
      margin: '0 auto'
    }}>
      {/* Title Bar with Pause Button */}
      <div style={{
        padding: '0.5rem',
        background: 'blue',
        color: 'white',
        textAlign: 'center',
        fontWeight: 'bold',
        flexShrink: 0,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div style={{ width: '80px' }}></div> {/* Empty div for balance */}
        <div>{t('tasks.communications.title')}</div>
        <div style={{ width: '80px' }}></div> {/* Empty div for balance */}
      </div>

      {/* Main Content Container */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        padding: '0.5rem',
        gap: '0.5rem',
        overflow: 'hidden',
        minHeight: 0
      }}>
        {/* Call Sign */}
        <div style={{
          textAlign: 'center',
          fontSize: '1.2rem',
          padding: '0.5rem',
          flexShrink: 0
        }}>
          <strong>{t('tasks.communications.callsign')}:</strong> {ownCallSign}
        </div>

        {/* Radios Container */}
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: '1%',
          overflow: 'hidden',
          minHeight: 0,
          padding: '1%'
        }}>
          {radioOrder.map((r) => (
            <div key={r} style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10%',
              padding: '0.5%',
              backgroundColor: '#f5f5f5',
              borderRadius: '4px',
              height: 'min(8vh, 60px)'
            }}>
              {/* Radio Selection */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5vw',
                width: '15%',
                flexShrink: 0
              }}>
                <input
                  type="radio"
                  name="radioSelect"
                  checked={selectedRadio === r}
                  onChange={() => handleRadioSelect(r)}
                  style={{
                    width: '2.5vh',
                    height: '2.5vh',
                    cursor: 'pointer'
                  }}
                />
                <span style={{
                  fontWeight: 'bold',
                  color: 'blue',
                  fontSize: 'clamp(0.7rem, 1.8vh, 1.2rem)'
                }}>
                  {r}
                </span>
              </div>

              {/* Frequency Controls */}
              <div style={{
                display: 'flex',
                flex: 1,
                gap: '1%',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <button
                  style={{
                    width: '15%',
                    height: '3%',
                    fontSize: 'clamp(0.8rem, 2vh, 1.2rem)',
                    background: '#e0e0e0',
                    border: '1px solid #999',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                  onMouseDown={() => handleFreqButtonDown(r, -1, true)}
                  onMouseUp={handleFreqButtonUp}
                  onMouseLeave={handleFreqButtonUp}
                >
                  --
                </button>
                <button
                  style={{
                    width: '10%',
                    height: '3%',
                    fontSize: 'clamp(0.8rem, 2vh, 1.2rem)',
                    background: '#e0e0e0',
                    border: '1px solid #999',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                  onMouseDown={() => handleFreqButtonDown(r, -0.25)}
                  onMouseUp={handleFreqButtonUp}
                  onMouseLeave={handleFreqButtonUp}
                >
                  -
                </button>

                <input
                  type="text"
                  style={{
                    width: '30%',
                    height: '20%',
                    fontSize: 'clamp(1rem, 2vh, 1.5rem)',
                    textAlign: 'center',
                    border: '1px solid #999',
                    borderRadius: '4px'
                  }}
                  value={frequencies[r]}
                  onChange={(e) => handleFrequencyChange(r, e.target.value)}
                />

                <button
                  style={{
                    width: '10%',
                    height: '3%',
                    fontSize: 'clamp(0.8rem, 2vh, 1.2rem)',
                    background: '#e0e0e0',
                    border: '1px solid #999',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                  onMouseDown={() => handleFreqButtonDown(r, +0.25)}
                  onMouseUp={handleFreqButtonUp}
                  onMouseLeave={handleFreqButtonUp}
                >
                  +
                </button>
                <button
                  style={{
                    width: '15%',
                    height: '3%',
                    fontSize: 'clamp(0.8rem, 2vh, 1.2rem)',
                    background: '#e0e0e0',
                    border: '1px solid #999',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                  onMouseDown={() => handleFreqButtonDown(r, +1, true)}
                  onMouseUp={handleFreqButtonUp}
                  onMouseLeave={handleFreqButtonUp}
                >
                  ++
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});

// Add Log component as a separate component
const Log = ({ commLog }) => {
  const { t } = useTranslation();
  const scrollRef = useAutoScroll();

  const handleExport = () => {
    downloadCSV(commLog, 'communications-log');
  };

  // Get last 50 entries for display only
  const recentLogs = commLog.slice(-50);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.5rem' }}>
        <button
          onClick={handleExport}
          style={{
            padding: '0.25rem 0.5rem',
            background: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Export CSV
        </button>
      </div>
      <div ref={scrollRef} style={{ width: '100%', overflowX: 'auto', maxHeight: '300px', overflowY: 'auto' }}>
        <table style={{ width: '100%', fontSize: '0.75rem', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #ccc' }}>
              <th style={{ padding: '0.5rem' }}>Index</th>
              <th style={{ padding: '0.5rem' }}>{t('scoreboard.time')}</th>
              <th style={{ padding: '0.5rem' }}>{t('scoreboard.date')}</th>
              <th style={{ padding: '0.5rem' }}>{t('tasks.communications.radio')} (T)</th>
              <th style={{ padding: '0.5rem' }}>{t('tasks.communications.frequency')} (T)</th>
              <th style={{ padding: '0.5rem' }}>{t('tasks.communications.radio')} (S)</th>
              <th style={{ padding: '0.5rem' }}>{t('tasks.communications.frequency')} (S)</th>
              <th style={{ padding: '0.5rem' }}>RT</th>
              <th style={{ padding: '0.5rem' }}>Result</th>
            </tr>
          </thead>
          <tbody>
            {recentLogs.map((row, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '0.5rem', textAlign: 'center' }}>{row.index}</td>
                <td style={{ padding: '0.5rem', textAlign: 'center' }}>{row.Time}</td>
                <td style={{ padding: '0.5rem', textAlign: 'center' }}>{row.Ship}</td>
                <td style={{ padding: '0.5rem', textAlign: 'center' }}>{row.Radio_T}</td>
                <td style={{ padding: '0.5rem', textAlign: 'center' }}>{row.Freq_T}</td>
                <td style={{ padding: '0.5rem', textAlign: 'center' }}>{row.Radio_S}</td>
                <td style={{ padding: '0.5rem', textAlign: 'center' }}>{row.Freq_S}</td>
                <td style={{ padding: '0.5rem', textAlign: 'center' }}>{row.RT}</td>
                <td style={{ padding: '0.5rem', textAlign: 'center' }}>{row.Remarks}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// Attach Log component to CommunicationsTask
CommunicationsTask.Log = Log;

// Add static method to get default metrics
CommunicationsTask.getDefaultMetrics = () => ({
  healthImpact: 0,
  systemLoad: 0
});

export default CommunicationsTask;

