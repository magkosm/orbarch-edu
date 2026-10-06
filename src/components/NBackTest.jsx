import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { useTranslation } from 'react-i18next';
import ScoreboardService from '../services/ScoreboardService';

import { downloadCSV } from '../utils/csvExport';
import BackgroundService from '../services/BackgroundService';

// Register ChartJS components
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend);

// Debug flag - set to true to disable debug UI and logging
const DEBUG_MODE = false;

// Load N-Back sounds from src/assets/nback-sounds
let nbackSounds = {};
try {
  // Use require.context to dynamically bundle all wav files in language subfolders
  const context = require.context('../assets/nback-sounds', true, /\.wav$/);
  context.keys().forEach((key) => {
    // key is like "./en/C.wav" or "./el/C.wav"
    const parts = key.split('/');
    if (parts.length >= 3) {
      const lang = parts[1];
      const letter = parts[2].replace('.wav', '');
      if (!nbackSounds[lang]) nbackSounds[lang] = {};
      nbackSounds[lang][letter] = context(key);
    }
  });
  console.log('N-Back sounds loaded:', Object.keys(nbackSounds).map(lang => `${lang}: ${Object.keys(nbackSounds[lang]).length}`).join(', '));
} catch (error) {
  console.error('Error loading N-Back sounds:', error);
}

// Helper Functions
function generateDesign(n, dim1targs, dim2targs, bothtargs, trials) {
  // First n trials must be non-targets since they're the memorization phase
  let baseDesign = Array(n).fill([0, 0]);
  const maxPossibleTargets = trials - n;

  // Ensure we don't have more targets than possible positions
  // And make sure the sum of all target types doesn't exceed available trials
  const totalTargetSpace = maxPossibleTargets;

  // Adjust target counts if they exceed available space
  if (dim1targs + dim2targs + bothtargs > totalTargetSpace) {
    // Scale down proportionally
    const scale = totalTargetSpace / (dim1targs + dim2targs + bothtargs);
    dim1targs = Math.floor(dim1targs * scale);
    dim2targs = Math.floor(dim2targs * scale);
    bothtargs = Math.floor(bothtargs * scale);

    // If we're short after rounding, prioritize dual targets, then distribute evenly
    let remaining = totalTargetSpace - (dim1targs + dim2targs + bothtargs);
    while (remaining > 0) {
      if (bothtargs < totalTargetSpace / 3) {
        bothtargs++;
      } else if (dim1targs <= dim2targs) {
        dim1targs++;
      } else {
        dim2targs++;
      }
      remaining--;
    }
  }

  // Create empty slots for the remaining trials
  const remainingTrials = trials - n;
  const restOfDesign = Array(remainingTrials).fill(null);

  if (DEBUG_MODE) {
    console.log(`Generating design with: ${dim1targs} letter targets, ${dim2targs} position targets, ${bothtargs} dual targets`);
  }

  // First, assign positions for dual targets (both dimensions)
  const bothPositions = [];
  for (let i = 0; i < bothtargs; i++) {
    let pos;
    do {
      pos = Math.floor(Math.random() * remainingTrials);
    } while (bothPositions.includes(pos));
    bothPositions.push(pos);
    restOfDesign[pos] = [1, 1];
  }

  // Next, assign positions for dimension 1 (letter) targets
  const dim1Positions = [];
  for (let i = 0; i < dim1targs; i++) {
    let pos;
    do {
      pos = Math.floor(Math.random() * remainingTrials);
    } while (bothPositions.includes(pos) || dim1Positions.includes(pos));
    dim1Positions.push(pos);
    restOfDesign[pos] = [1, 0];
  }

  // Next, assign positions for dimension 2 (position) targets
  const dim2Positions = [];
  for (let i = 0; i < dim2targs; i++) {
    let pos;
    do {
      pos = Math.floor(Math.random() * remainingTrials);
    } while (bothPositions.includes(pos) || dim1Positions.includes(pos) || dim2Positions.includes(pos));
    dim2Positions.push(pos);
    restOfDesign[pos] = [0, 1];
  }

  // Fill remaining positions with non-targets
  for (let i = 0; i < remainingTrials; i++) {
    if (!restOfDesign[i]) {
      restOfDesign[i] = [0, 0];
    }
  }

  // Log the final counts for verification
  if (DEBUG_MODE) {
    const finalDesign = baseDesign.concat(restOfDesign);
    const letterTargets = finalDesign.filter(d => d[0] === 1).length;
    const positionTargets = finalDesign.filter(d => d[1] === 1).length;
    const dualTargets = finalDesign.filter(d => d[0] === 1 && d[1] === 1).length;

    console.log(`Final design has: ${letterTargets} letter targets, ${positionTargets} position targets, ${dualTargets} dual targets`);
  }

  return baseDesign.concat(restOfDesign);
}

function generateStimuliSequence(design, n) {
  const sampset = Array.from({ length: 8 }, (_, i) => i + 1);
  let dim1stim = [];
  let dim2stim = [];

  // Initialize with random samples
  for (let i = 0; i < n; i++) {
    dim1stim.push(sampset[Math.floor(Math.random() * sampset.length)]);
    dim2stim.push(sampset[Math.floor(Math.random() * sampset.length)]);
  }

  // Generate the rest of the stimuli sequence
  for (let i = n; i < design.length; i++) {
    let [dim1match, dim2match] = design[i];
    let dim1val, dim2val;

    if (dim1match === 0) {
      dim1val = sampset.filter(x => x !== dim1stim[i - n])[Math.floor(Math.random() * (sampset.length - 1))];
    } else {
      dim1val = dim1stim[i - n];
    }

    if (dim2match === 0) {
      dim2val = sampset.filter(x => x !== dim2stim[i - n])[Math.floor(Math.random() * (sampset.length - 1))];
    } else {
      dim2val = dim2stim[i - n];
    }

    dim1stim.push(dim1val);
    dim2stim.push(dim2val);
  }

  return [dim1stim, dim2stim];
}

const NBackTest = ({
  trials = 20,
  n = 2,
  dim1targets = 4,
  dim2targets = 4,
  bothTargets = 2,
  tickTime = 3000, // 3 seconds per stimulus
  onFinish,
  onReturn,
  audioEnabled = true,
  isSuite = false
}) => {
  const { t, i18n } = useTranslation();

  // Audio state - allow internal toggle if audioEnabled prop is true
  // If audioEnabled prop is false (like in quick start), it stays false
  const [isAudioActive, setIsAudioActive] = useState(audioEnabled);

  // Sync with prop changes, but only if prop turns it off or on explicitly
  useEffect(() => {
    setIsAudioActive(audioEnabled);
  }, [audioEnabled]);

  // Sync background on mount
  useEffect(() => {
    const currentBackground = BackgroundService.getCurrentBackground();
    const style = BackgroundService.getBackgroundStyle(currentBackground);
    document.body.style.backgroundImage = style.backgroundImage || 'none';
    document.body.style.backgroundColor = style.backgroundColor || '';
    document.body.style.backgroundSize = style.backgroundSize || '';
    document.body.style.backgroundPosition = style.backgroundPosition || '';
    document.body.style.backgroundRepeat = style.backgroundRepeat || '';
  }, []);

  // Game state
  const [testStarted, setTestStarted] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [currentStimulus, setCurrentStimulus] = useState(0);
  const [design, setDesign] = useState([]);
  const [stimuli, setStimuli] = useState([[], []]);
  const [responses, setResponses] = useState([]);

  // Grid state
  const [gridSquares, setGridSquares] = useState(Array(9).fill('white'));
  const [activeLetter, setActiveLetter] = useState('');

  // Response feedback
  const [buttonClassA, setButtonClassA] = useState('');
  const [buttonClassL, setButtonClassL] = useState('');

  // Results
  const [results, setResults] = useState({
    dim1: { hits: 0, misses: 0, correctRejections: 0, falseAlarms: 0 },
    dim2: { hits: 0, misses: 0, correctRejections: 0, falseAlarms: 0 }
  });

  // Score saving state
  const [playerName, setPlayerName] = useState('');
  const [scoreSaved, setScoreSaved] = useState(false);
  const [showSaveForm, setShowSaveForm] = useState(false);

  // Refs
  const timerRef = useRef(null);
  const isMountedRef = useRef(true);
  const finishedRef = useRef(false); // Guard against multiple endTest calls
  const stimuliRef = useRef([[], []]);
  const designRef = useRef([]); // Store design in ref for reliable access
  const audioRef = useRef(null);
  // Add a ref to track current audio state for intervals/timeouts
  const audioActiveRef = useRef(audioEnabled);
  const stimulusTimestampRef = useRef(0);

  // Available letters for nBack
  const nBackLetters = ['C', 'H', 'K', 'N', 'R', 'W', 'X', 'Y'];

  // Sync with prop changes
  useEffect(() => {
    setIsAudioActive(audioEnabled);
    audioActiveRef.current = audioEnabled;
  }, [audioEnabled]);

  // Sync ref with local state changes
  useEffect(() => {
    audioActiveRef.current = isAudioActive;
  }, [isAudioActive]);
  useEffect(() => {
    isMountedRef.current = true;
    // Create a single shared audio element
    audioRef.current = new Audio();

    return () => {
      isMountedRef.current = false;
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      // Stop any playing audio
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
    };
  }, []);

  // Play a letter sound using the shared audio element
  const playLetterSound = (letter) => {
    // Use the ref here instead of state to ensure we always have the latest value
    // inside the interval callback closure
    if (!audioActiveRef.current || !audioRef.current) return;

    try {
      // Reset the audio element
      audioRef.current.pause();
      audioRef.current.currentTime = 0;

      // Determine current language
      const currentLang = (i18n.language || 'en').split('-')[0];

      // Get sound from bundled assets
      let soundUrl = null;
      if (nbackSounds[currentLang] && nbackSounds[currentLang][letter]) {
        soundUrl = nbackSounds[currentLang][letter];
      } else if (nbackSounds['en'] && nbackSounds['en'][letter]) {
        // Fallback to English
        soundUrl = nbackSounds['en'][letter];
      }

      if (soundUrl) {
        audioRef.current.src = soundUrl;
        audioRef.current.play().catch(err => {
          console.error(`Warning playing bundled sound: ${err.message}`);
        });
      } else {
        console.error(`No sound found for letter ${letter} in lang ${currentLang} or en fallback`);
      }
    } catch (err) {
      console.error(`Error in playLetterSound: ${err.message}`);
    }
  };


  // Return to main menu (memoized)
  const handleMainMenuReturn = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (onReturn) {
      onReturn();
    }
  }, [onReturn]);

  // Handle response to stimulus (memoized)
  const handleNBackResponse = useCallback((dimension) => {
    if (!testStarted || currentStimulus < n) return;

    const currentDesign = design[currentStimulus];
    if (!currentDesign) return;

    const isMatch = currentDesign[dimension] === 1;

    if (DEBUG_MODE) {
      console.log(`User response: dimension ${dimension}, stimulus ${currentStimulus}, isMatch: ${isMatch}`);
    }

    // Visual feedback
    if (dimension === 0) {
      setButtonClassL(isMatch ? 'correct' : 'incorrect');
      setTimeout(() => setButtonClassL(''), 500);
    } else {
      setButtonClassA(isMatch ? 'correct' : 'incorrect');
      setTimeout(() => setButtonClassA(''), 500);
    }

    // Record response only - actual metrics are calculated at the end
    setResponses(prev => [
      ...prev,
      {
        dimension,
        correct: isMatch,
        stimulusIndex: currentStimulus,
        rt: Date.now() - stimulusTimestampRef.current
      }
    ]);
  }, [testStarted, currentStimulus, n, design]);

  // Set up keyboard listener for responses
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ctrl+Q to exit to main menu
      if (e.ctrlKey && e.key === 'q') {
        e.preventDefault();
        if (DEBUG_MODE) console.log('Ctrl+Q pressed - returning to main menu');
        handleMainMenuReturn();
        return; // Make sure to return early after handling Ctrl+Q
      }

      // Only process other keys if test is started and past memorization phase
      if (testStarted && currentStimulus >= n) {
        if (e.key === 'l' || e.key === 'L') {
          handleNBackResponse(0); // Letter dimension
        } else if (e.key === 'a' || e.key === 'A') {
          handleNBackResponse(1); // Position dimension
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [testStarted, currentStimulus, n, handleNBackResponse, handleMainMenuReturn]);

  // Start the n-back test
  const startNBackTest = () => {
    // Generate design and stimuli
    const newDesign = generateDesign(n, dim1targets, dim2targets, bothTargets, trials);
    const newStimuli = generateStimuliSequence(newDesign, n);

    // Clear all state for a fresh start
    // Store in ref for immediate access
    stimuliRef.current = newStimuli;

    // Reset state and refs
    setDesign(newDesign);
    designRef.current = newDesign; // Store in ref for reliable access
    setStimuli(newStimuli);
    setCurrentStimulus(0);
    setResponses([]);
    setIsFinished(false);
    setScoreSaved(false);
    setShowSaveForm(false);

    // Reset results - explicitly set every counter to zero
    setResults({
      dim1: {
        hits: 0,
        misses: 0,
        correctRejections: 0,
        falseAlarms: 0
      },
      dim2: {
        hits: 0,
        misses: 0,
        correctRejections: 0,
        falseAlarms: 0
      }
    });

    // Start the test
    setTestStarted(true);

    // Start scheduler with a delay to ensure everything is initialized
    setTimeout(() => {
      // Present the first stimulus directly with the newly generated stimuli
      presentStimulusDirect(0, newStimuli);

      // Set up interval for subsequent stimuli
      timerRef.current = setInterval(() => {
        setCurrentStimulus(prev => {
          const next = prev + 1;
          if (next >= trials) {
            // End the test after a slight delay to allow final responses
            setTimeout(() => endTest(), 500);
            return prev;
          }
          // Use the ref data instead of relying on state updates
          presentStimulusDirect(next, stimuliRef.current);
          return next;
        });
      }, tickTime);
    }, 2000);
  };

  // Present a stimulus using direct stimuli data
  const presentStimulusDirect = (stimulusIndex, stimuliData) => {
    if (!stimuliData[0][stimulusIndex] || !stimuliData[1][stimulusIndex]) {
      console.error(`Invalid stimulus at index ${stimulusIndex}`);
      return;
    }

    // Clear previous stimulus
    setGridSquares(Array(9).fill('white'));
    setActiveLetter('');

    // Set letter (1-indexed to 0-indexed)
    const letterIndex = stimuliData[0][stimulusIndex] - 1;
    if (letterIndex < 0 || letterIndex >= nBackLetters.length) {
      console.error(`Invalid letter index: ${letterIndex}`);
      return;
    }

    const letter = nBackLetters[letterIndex];
    setActiveLetter(letter);

    // Set position (1-indexed to 0-indexed, excluding center)
    const positionIndex = stimuliData[1][stimulusIndex] - 1;
    const positionMapping = [0, 1, 2, 3, 5, 6, 7, 8]; // Skip center (4)
    if (positionIndex < 0 || positionIndex >= positionMapping.length) {
      console.error(`Invalid position index: ${positionIndex}`);
      return;
    }

    const position = positionMapping[positionIndex];

    // Update grid
    setGridSquares(prev => {
      const newGrid = [...prev];
      newGrid[position] = 'green';
      return newGrid;
    });

    // Play letter sound using the shared function
    playLetterSound(letter);

    // Record timestamp
    stimulusTimestampRef.current = Date.now();
  };

  // presentStimulus removed as use of presentStimulusDirect is preferred to avoid audio glitching

  // Do not auto-record responses for each stimulus change - this creates problems with counting
  // Instead, we'll process all metrics at the end of the test
  useEffect(() => {
    if (!testStarted || currentStimulus < n) return;

    // Process the PREVIOUS stimulus (currentStimulus-1) when a new stimulus appears
    // This prevents race conditions with responses
    if (currentStimulus > n) {
      const previousIndex = currentStimulus - 1;

      if (DEBUG_MODE) {
        console.log(`Processing response for stimulus ${previousIndex}`);
      }
    }
  }, [currentStimulus, testStarted, n]);

  // End the test
  const endTest = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (finishedRef.current) return;
    finishedRef.current = true;

    // Process all results when the test ends
    if (DEBUG_MODE) {
      console.log("Test ended, calculating final results");
      console.log("Current responses:", responses);
      console.log("Current design:", design);
    }

    // Move to the finished state if not in suite mode
    setTestStarted(false);
    if (!isSuite) {
      setIsFinished(true);
    }

    if (onFinish) {
      const finalResults = calculateFinalResults();
      const trialLogs = generateExportData();

      // Calculate accuracy - handle case where there are no targets
      const totalTargets = finalResults.dim1.hits + finalResults.dim1.misses +
        finalResults.dim2.hits + finalResults.dim2.misses;
      const totalCorrect = finalResults.dim1.hits + finalResults.dim2.hits;
      const totalIncorrect = finalResults.dim1.misses + finalResults.dim1.falseAlarms +
        finalResults.dim2.misses + finalResults.dim2.falseAlarms;

      // Accuracy = correct / (correct + incorrect) when there are responses
      // If no targets exist, accuracy is undefined/0
      let accuracy = 0;
      if (totalTargets > 0) {
        accuracy = (totalCorrect / totalTargets) * 100;
      } else if (totalCorrect + totalIncorrect > 0) {
        // If there are responses but no targets, calculate based on all responses
        accuracy = (totalCorrect / (totalCorrect + totalIncorrect)) * 100;
      }

      console.log('NBackTest: Finishing with results:', {
        n,
        totalTargets,
        totalCorrect,
        totalIncorrect,
        accuracy,
        trialLogsCount: trialLogs.length,
        designLength: design.length,
        responsesCount: responses.length
      });

      onFinish({
        ...finalResults,
        n: n,
        accuracy: accuracy,
        correct: totalCorrect,
        incorrect: totalIncorrect,
        trialLogs: trialLogs
      });
    }
  };

  // Calculate final results directly when needed (not using state updates)
  const calculateFinalResults = () => {
    if (DEBUG_MODE) {
      console.log("Calculating final results with:", {
        responses: responses.length,
        design: design.length,
        trials
      });
    }

    // Create a fresh results object
    const newResults = {
      dim1: { hits: 0, misses: 0, correctRejections: 0, falseAlarms: 0, totalRT: 0, hitCount: 0 },
      dim2: { hits: 0, misses: 0, correctRejections: 0, falseAlarms: 0, totalRT: 0, hitCount: 0 }
    };

    // Counters for design targets
    let dim1TargetCount = 0;
    let dim2TargetCount = 0;

    // Process each effective trial (after memorization phase)
    for (let i = n; i < trials; i++) {
      if (!design[i]) {
        if (DEBUG_MODE) console.log(`Missing design for trial ${i}`);
        continue;
      }

      // Get the design for this trial
      const [dim1Target, dim2Target] = design[i];

      if (DEBUG_MODE) {
        console.log(`Processing trial ${i}: Letter target=${dim1Target}, Position target=${dim2Target}`);
      }

      // Keep track of targets in design
      if (dim1Target === 1) dim1TargetCount++;
      if (dim2Target === 1) dim2TargetCount++;

      // Process letter dimension
      const dim1Response = responses.find(r => r.dimension === 0 && r.stimulusIndex === i);

      if (dim1Target === 1) {
        // Target was present for letter dimension
        if (dim1Response) {
          // User responded - HIT
          newResults.dim1.hits++;
          newResults.dim1.totalRT += dim1Response.rt;
          newResults.dim1.hitCount++;
          if (DEBUG_MODE) console.log(`Letter HIT at trial ${i}`);
        } else {
          // User did not respond - MISS
          newResults.dim1.misses++;
          if (DEBUG_MODE) console.log(`Letter MISS at trial ${i}`);
        }
      } else {
        // Target was absent for letter dimension
        if (dim1Response) {
          // User responded - FALSE ALARM
          newResults.dim1.falseAlarms++;
          if (DEBUG_MODE) console.log(`Letter FALSE ALARM at trial ${i}`);
        } else {
          // User did not respond - CORRECT REJECTION
          newResults.dim1.correctRejections++;
          if (DEBUG_MODE) console.log(`Letter CORRECT REJECTION at trial ${i}`);
        }
      }

      // Process position dimension
      const dim2Response = responses.find(r => r.dimension === 1 && r.stimulusIndex === i);

      if (dim2Target === 1) {
        // Target was present for position dimension
        if (dim2Response) {
          // User responded - HIT
          newResults.dim2.hits++;
          newResults.dim2.totalRT += dim2Response.rt;
          newResults.dim2.hitCount++;
          if (DEBUG_MODE) console.log(`Position HIT at trial ${i}`);
        } else {
          // User did not respond - MISS
          newResults.dim2.misses++;
          if (DEBUG_MODE) console.log(`Position MISS at trial ${i}`);
        }
      } else {
        // Target was absent for position dimension
        if (dim2Response) {
          // User responded - FALSE ALARM
          newResults.dim2.falseAlarms++;
          if (DEBUG_MODE) console.log(`Position FALSE ALARM at trial ${i}`);
        } else {
          // User did not respond - CORRECT REJECTION
          newResults.dim2.correctRejections++;
          if (DEBUG_MODE) console.log(`Position CORRECT REJECTION at trial ${i}`);
        }
      }
    }

    // Calculate average RT
    const dim1AvgRT = newResults.dim1.hitCount > 0 ? newResults.dim1.totalRT / newResults.dim1.hitCount : 0;
    const dim2AvgRT = newResults.dim2.hitCount > 0 ? newResults.dim2.totalRT / newResults.dim2.hitCount : 0;

    // Add to results
    newResults.dim1.avgRT = dim1AvgRT;
    newResults.dim2.avgRT = dim2AvgRT;

    if (DEBUG_MODE) {
      console.log('Final metrics:');
      console.log('Letter dimension:', newResults.dim1);
      console.log('Position dimension:', newResults.dim2);
      console.log(`Design targets: Letter=${dim1TargetCount}, Position=${dim2TargetCount}`);
    }

    // Return the calculated results directly instead of using setState
    return newResults;
  };

  // Save score to scoreboard
  const handleSaveScore = (calculatedResults) => {
    if (!playerName.trim()) return;

    // Get performance metrics including d'
    const metrics = calculatePerformanceMetrics(calculatedResults);

    // Use the scaled d-prime as the primary score
    // This provides a more standardized cognitive measure than simple accuracy
    const overallScore = parseFloat(metrics.overallDPrimeScaled);

    const scoreDetails = {
      n: n,
      // Include traditional accuracy measures
      dim1Accuracy: metrics.dim1Accuracy,
      dim2Accuracy: metrics.dim2Accuracy,
      overallAccuracy: metrics.overallAccuracy,
      // Include d-prime measures
      dim1DPrime: metrics.dim1DPrime,
      dim2DPrime: metrics.dim2DPrime,
      overallDPrime: metrics.overallDPrime,
      // Include raw counts for completeness
      dim1Hits: calculatedResults.dim1.hits,
      dim1Misses: calculatedResults.dim1.misses,
      dim1FalseAlarms: calculatedResults.dim1.falseAlarms,
      dim1CorrectRejections: calculatedResults.dim1.correctRejections,
      dim2Hits: calculatedResults.dim2.hits,
      dim2Misses: calculatedResults.dim2.misses,
      dim2FalseAlarms: calculatedResults.dim2.falseAlarms,
      dim2CorrectRejections: calculatedResults.dim2.correctRejections,
      nValue: n // Make sure n is included in a consistent format
    };

    // Save to scoreboard with correct parameter order: (mode, score, playerName, details)
    ScoreboardService.saveScore('nback', overallScore, playerName, scoreDetails);
    setScoreSaved(true);
    setShowSaveForm(false);
  };

  // Calculate performance metrics including d-prime
  const calculatePerformanceMetrics = (calculatedResults) => {
    // Use provided results or fall back to the state if not provided
    const resultsToUse = calculatedResults || results;

    // Calculate traditional accuracy
    const dim1Total = resultsToUse.dim1.hits + resultsToUse.dim1.misses +
      resultsToUse.dim1.correctRejections + resultsToUse.dim1.falseAlarms;
    const dim2Total = resultsToUse.dim2.hits + resultsToUse.dim2.misses +
      resultsToUse.dim2.correctRejections + resultsToUse.dim2.falseAlarms;

    const dim1Correct = resultsToUse.dim1.hits + resultsToUse.dim1.correctRejections;
    const dim2Correct = resultsToUse.dim2.hits + resultsToUse.dim2.correctRejections;

    const dim1Accuracy = dim1Total > 0 ? (dim1Correct / dim1Total) * 100 : 0;
    const dim2Accuracy = dim2Total > 0 ? (dim2Correct / dim2Total) * 100 : 0;

    // Traditional overall accuracy
    const overallAccuracy = parseFloat(((dim1Accuracy + dim2Accuracy) / 2).toFixed(2));

    // Calculate d-prime for each dimension
    // d' = Z(hit rate) - Z(false alarm rate)

    // Helper function to calculate Z-score (Normal inverse cumulative distribution function)
    const calculateZ = (p) => {
      // Handle undefined or invalid probabilities
      if (typeof p !== 'number' || isNaN(p) || p < 0 || p > 1) {
        if (DEBUG_MODE) console.log(`Invalid probability for Z-score: ${p}`);
        return 0;
      }

      // Adjust extreme values to prevent Infinity
      // These adjustments are standard in signal detection theory
      if (p <= 0.01) p = 0.01; // floor
      if (p >= 0.99) p = 0.99; // ceiling

      try {
        // Approximation of the normal inverse CDF
        // Source: Numerical Recipes in C (2nd ed.)
        const q = 1 - p;
        if (p >= q) {
          const r = Math.sqrt(-Math.log(q));
          return 2.326419 + r * (1.591864 + r * (0.7649 + r * 0.2260));
        } else {
          const r = Math.sqrt(-Math.log(p));
          return -(2.326419 + r * (1.591864 + r * (0.7649 + r * 0.2260)));
        }
      } catch (err) {
        console.error(`Error calculating Z-score for p=${p}: ${err.message}`);
        return 0;
      }
    };

    // Calculate target and non-target trials directly from the results
    // This is more reliable than trying to count from the design after the fact
    const dim1Targets = resultsToUse.dim1.hits + resultsToUse.dim1.misses;
    const dim1NonTargets = resultsToUse.dim1.correctRejections + resultsToUse.dim1.falseAlarms;
    const dim2Targets = resultsToUse.dim2.hits + resultsToUse.dim2.misses;
    const dim2NonTargets = resultsToUse.dim2.correctRejections + resultsToUse.dim2.falseAlarms;

    // Calculate hit rates and false alarm rates
    // Use default values if no targets/non-targets to avoid division by zero
    // A hit rate is the proportion of targets correctly identified (hits / total targets)
    // When no targets, use 0.5 (chance level)
    // When no non-targets, use 0.01 (very low false alarm rate)
    let dim1HitRate = 0.5;
    let dim1FaRate = 0.01;
    let dim2HitRate = 0.5;
    let dim2FaRate = 0.01;

    // Only calculate rates if we have data
    if (dim1Targets > 0) {
      dim1HitRate = resultsToUse.dim1.hits / dim1Targets;
    }

    if (dim1NonTargets > 0) {
      dim1FaRate = resultsToUse.dim1.falseAlarms / dim1NonTargets;
    }

    if (dim2Targets > 0) {
      dim2HitRate = resultsToUse.dim2.hits / dim2Targets;
    }

    if (dim2NonTargets > 0) {
      dim2FaRate = resultsToUse.dim2.falseAlarms / dim2NonTargets;
    }

    if (DEBUG_MODE) {
      console.log('Performance calculation:');
      console.log(`Letter: ${dim1Targets} targets, ${dim1NonTargets} non-targets`);
      console.log(`Letter hit rate: ${dim1HitRate}, FA rate: ${dim1FaRate}`);
      console.log(`Position: ${dim2Targets} targets, ${dim2NonTargets} non-targets`);
      console.log(`Position hit rate: ${dim2HitRate}, FA rate: ${dim2FaRate}`);
    }

    // Calculate d' for each dimension
    // If there are no targets or responses, use a default value
    let dim1DPrime = 0;
    let dim2DPrime = 0;

    // Only calculate d' if we have valid data
    if (dim1Targets > 0 || dim1NonTargets > 0) {
      dim1DPrime = calculateZ(dim1HitRate) - calculateZ(dim1FaRate);
    }

    if (dim2Targets > 0 || dim2NonTargets > 0) {
      dim2DPrime = calculateZ(dim2HitRate) - calculateZ(dim2FaRate);
    }

    // Average d' across dimensions
    const overallDPrime = (dim1DPrime + dim2DPrime) / 2;

    // Scale d' to a more user-friendly range (typically d' ranges from 0 to 4-5)
    // We'll scale it to 0-100 similar to traditional accuracy
    // d' of 4 is considered excellent performance, so map 4 to 100
    const dim1DPrimeScaled = Math.max(0, Math.min(100, (dim1DPrime / 4) * 100)).toFixed(2);
    const dim2DPrimeScaled = Math.max(0, Math.min(100, (dim2DPrime / 4) * 100)).toFixed(2);
    const overallDPrimeScaled = Math.max(0, Math.min(100, (overallDPrime / 4) * 100)).toFixed(2);

    return {
      // Trial counts (for debugging)
      dim1Targets,
      dim1NonTargets,
      dim2Targets,
      dim2NonTargets,

      // Traditional accuracy
      dim1Accuracy: dim1Accuracy.toFixed(2),
      dim2Accuracy: dim2Accuracy.toFixed(2),
      overallAccuracy: overallAccuracy.toFixed(2),

      // Raw d' values
      dim1DPrime: dim1DPrime.toFixed(2),
      dim2DPrime: dim2DPrime.toFixed(2),
      overallDPrime: overallDPrime.toFixed(2),

      // Scaled d' values (0-100)
      dim1DPrimeScaled: dim1DPrimeScaled,
      dim2DPrimeScaled: dim2DPrimeScaled,
      overallDPrimeScaled: overallDPrimeScaled,

      // Hit rates and false alarm rates
      dim1HitRate: dim1HitRate.toFixed(2),
      dim1FaRate: dim1FaRate.toFixed(2),
      dim2HitRate: dim2HitRate.toFixed(2),
      dim2FaRate: dim2FaRate.toFixed(2),

      // Reaction Times
      dim1AvgRT: calculatedResults.dim1.avgRT.toFixed(0),
      dim2AvgRT: calculatedResults.dim2.avgRT.toFixed(0)
    };
  };

  // Helper function to restore the original Bar chart functionality
  function getBarData(calculatedResults) {
    // Use provided results or fall back to the state if not provided
    const resultsToUse = calculatedResults || results;

    return {
      labels: [
        t('nbackTest.hits', 'Hits'),
        t('nbackTest.misses', 'Misses'),
        t('nbackTest.correctRejections', 'Correct Rejections'),
        t('nbackTest.falseAlarms', 'False Alarms')
      ],
      datasets: [
        {
          label: t('nbackTest.letterDimension', 'Letter Dimension'),
          data: [
            resultsToUse.dim1.hits,
            resultsToUse.dim1.misses,
            resultsToUse.dim1.correctRejections,
            resultsToUse.dim1.falseAlarms
          ],
          backgroundColor: 'rgba(75, 192, 192, 0.6)',
          borderColor: 'rgba(75, 192, 192, 1)',
          borderWidth: 1
        },
        {
          label: t('nbackTest.positionDimension', 'Position Dimension'),
          data: [
            resultsToUse.dim2.hits,
            resultsToUse.dim2.misses,
            resultsToUse.dim2.correctRejections,
            resultsToUse.dim2.falseAlarms
          ],
          backgroundColor: 'rgba(153, 102, 255, 0.6)',
          borderColor: 'rgba(153, 102, 255, 1)',
          borderWidth: 1
        }
      ]
    };
  }

  // Helper function to create bar chart options
  function getBarOptions() {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top',
          labels: { color: 'white' }
        },
        title: {
          display: true,
          text: t('nbackTest.performance', 'Performance by Category'),
          color: 'white'
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: t('nbackTest.count', 'Count'),
            color: 'white'
          },
          ticks: { color: 'white' }
        },
        x: {
          ticks: { color: 'white' }
        }
      }
    };
  }

  // Add CSS styles for the results display
  const styles = {
    nbackResults: {
      textAlign: 'center',
      color: 'white',
    },
    resultsSection: {
      backgroundColor: 'rgba(255,255,255,0.1)',
      padding: '20px',
      marginBottom: '20px',
      borderRadius: '8px',
    },
    resultsTable: {
      width: '100%',
      borderCollapse: 'collapse',
      marginTop: '10px',
    },
    tableRow: {
      borderBottom: '1px solid rgba(255,255,255,0.1)',
    },
    tableCell: {
      padding: '8px',
      textAlign: 'left',
    },
    overallScore: {
      fontWeight: 'bold',
      fontSize: '1.1em',
      backgroundColor: 'rgba(255,255,255,0.05)',
    },
    dPrimeExplanation: {
      fontSize: '0.9em',
      fontStyle: 'italic',
      marginBottom: '10px',
      opacity: '0.8',
    },
    statsContainer: {
      display: 'flex',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: '20px',
    },
    dimensionStats: {
      flex: '1',
      minWidth: '200px',
      backgroundColor: 'rgba(255,255,255,0.05)',
      padding: '15px',
      borderRadius: '5px',
    },
    saveScoreSection: {
      marginTop: '20px',
      marginBottom: '20px',
    },
    saveForm: {
      backgroundColor: 'rgba(255,255,255,0.1)',
      padding: '20px',
      borderRadius: '8px',
      marginBottom: '20px',
    },
    input: {
      padding: '10px',
      width: '80%',
      maxWidth: '300px',
      fontSize: '16px',
      borderRadius: '4px',
      border: 'none',
      marginRight: '10px',
      marginBottom: '10px',
    },
    button: {
      backgroundColor: '#4CAF50',
      color: 'white',
      padding: '10px 20px',
      fontSize: '16px',
      margin: '0 5px',
      border: 'none',
      borderRadius: '4px',
      cursor: 'pointer',
    },
    cancelButton: {
      backgroundColor: '#6c757d',
    },
    scoreSavedMessage: {
      backgroundColor: '#d4edda',
      color: '#155724',
      padding: '15px',
      marginBottom: '20px',
      borderRadius: '8px',
      textAlign: 'center',
    },
    resultsActions: {
      display: 'flex',
      justifyContent: 'center',
      gap: '15px',
      marginTop: '20px',
    },
    chartContainer: {
      height: '300px',
      marginBottom: '30px',
      background: 'rgba(255,255,255,0.05)',
      padding: '10px',
      borderRadius: '8px',
    }
  };

  // Render the grid
  const renderGrid = () => {
    return (
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 100px)',
        gridTemplateRows: 'repeat(3, 100px)',
        gap: '10px',
        margin: '20px auto',
        position: 'relative'
      }}>
        {Array(9).fill().map((_, i) => (
          <div
            key={i}
            style={{
              width: '100px',
              height: '100px',
              backgroundColor: gridSquares[i],
              border: '2px solid #333',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              position: 'relative',
              fontSize: '48px',
              fontWeight: 'bold'
            }}
          >
            {i === 4 && (
              <div style={{
                position: 'absolute',
                zIndex: 10,
                color: '#000',
                textShadow: '2px 2px 4px rgba(255, 255, 255, 0.8)',
                fontSize: '60px',
                fontWeight: 'bold'
              }}>
                {activeLetter}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  const generateExportData = () => {
    // Generate row-by-row data for export
    const exportData = [];

    // Process each trial
    for (let i = 0; i < trials; i++) {
      const trialData = {
        trial: i + 1,
        isMemorization: i < n,
        letter: '---',
        position: '---',
        targetLetter: false,
        targetPosition: false,
        responseLetter: false,
        responsePosition: false,
        correctLetter: 'N/A',
        correctPosition: 'N/A'
      };

      // Get stimulus data if available
      if (stimuliRef.current[0][i] && stimuliRef.current[1][i]) {
        const letterIndex = stimuliRef.current[0][i] - 1;
        const positionIndex = stimuliRef.current[1][i] - 1;
        const positionMapping = [0, 1, 2, 3, 5, 6, 7, 8];

        if (letterIndex >= 0 && letterIndex < nBackLetters.length) {
          trialData.letter = nBackLetters[letterIndex];
        }

        if (positionIndex >= 0 && positionIndex < positionMapping.length) {
          trialData.position = positionMapping[positionIndex];
        }
      }

      // Get target status from design - use ref for reliable access
      const currentDesign = designRef.current.length > 0 ? designRef.current : design;
      if (i >= n && currentDesign[i]) {
        trialData.targetLetter = currentDesign[i][0] === 1;
        trialData.targetPosition = currentDesign[i][1] === 1;
      }

      // Get user responses
      const letterResponse = responses.find(r => r.dimension === 0 && r.stimulusIndex === i);
      const positionResponse = responses.find(r => r.dimension === 1 && r.stimulusIndex === i);

      trialData.responseLetter = !!letterResponse;
      trialData.responsePosition = !!positionResponse;

      // Add RT to export
      trialData.letterRT = letterResponse ? letterResponse.rt : '';
      trialData.positionRT = positionResponse ? positionResponse.rt : '';

      // Determine correctness
      if (i >= n) {
        if (trialData.targetLetter) {
          trialData.correctLetter = trialData.responseLetter ? 'HIT' : 'MISS';
        } else {
          trialData.correctLetter = trialData.responseLetter ? 'FA' : 'CR';
        }

        if (trialData.targetPosition) {
          trialData.correctPosition = trialData.responsePosition ? 'HIT' : 'MISS';
        } else {
          trialData.correctPosition = trialData.responsePosition ? 'FA' : 'CR';
        }
      }

      exportData.push(trialData);
    }
    return exportData;
  };

  const handleExportData = () => {
    const exportData = generateExportData();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    downloadCSV(exportData, `nback_results_${timestamp}`);
  };

  // Display for test results
  const renderTestResults = () => {
    // Calculate results directly instead of using the results state
    const calculatedResults = calculateFinalResults();
    const metrics = calculatePerformanceMetrics(calculatedResults);

    // Debug validation for metrics
    const debugMetrics = () => {
      if (!DEBUG_MODE) return null;

      // Calculate expected totals
      const totalTrials = trials;
      const effectiveTrials = totalTrials - n; // Trials where responses could be made

      // Each dimension should have a consistent number of events
      const dim1Total = calculatedResults.dim1.hits + calculatedResults.dim1.misses +
        calculatedResults.dim1.correctRejections + calculatedResults.dim1.falseAlarms;
      const dim2Total = calculatedResults.dim2.hits + calculatedResults.dim2.misses +
        calculatedResults.dim2.correctRejections + calculatedResults.dim2.falseAlarms;

      // Each dimension should have a consistent number of targets
      const dim1Targets = calculatedResults.dim1.hits + calculatedResults.dim1.misses;
      const dim2Targets = calculatedResults.dim2.hits + calculatedResults.dim2.misses;

      // Count expected number of targets from design
      let expectedDim1Targets = 0;
      let expectedDim2Targets = 0;

      // Only count trials after n (the first n trials are memorization)
      for (let i = n; i < design.length; i++) {
        if (design[i] && design[i][0] === 1) expectedDim1Targets++;
        if (design[i] && design[i][1] === 1) expectedDim2Targets++;
      }

      // Verify all recorded responses are within valid range
      const validResponses = responses.filter(r =>
        r.stimulusIndex >= n && r.stimulusIndex < trials
      );

      const allEventsValid = dim1Total === effectiveTrials && dim2Total === effectiveTrials;
      const targetsValid = dim1Targets === expectedDim1Targets && dim2Targets === expectedDim2Targets;

      return (
        <div style={{
          backgroundColor: allEventsValid && targetsValid ? 'rgba(0, 255, 0, 0.1)' : 'rgba(255, 0, 0, 0.1)',
          padding: '15px',
          marginTop: '15px',
          border: `1px solid ${allEventsValid && targetsValid ? 'green' : 'red'}`,
          borderRadius: '5px',
          textAlign: 'left'
        }}>
          <h3>Metrics Validation {allEventsValid && targetsValid ? '✓' : '✗'}</h3>

          <h4>Trial Counts</h4>
          <p>Total Trials: {totalTrials}</p>
          <p>Effective Trials (excluding memorization): {effectiveTrials}</p>

          <h4>Dimension Events {dim1Total === effectiveTrials && dim2Total === effectiveTrials ? '✓' : '✗'}</h4>
          <p>Letter Dimension Total Events: {dim1Total} {dim1Total === effectiveTrials ? '✓' : `(Expected: ${effectiveTrials})`}</p>
          <p>Position Dimension Total Events: {dim2Total} {dim2Total === effectiveTrials ? '✓' : `(Expected: ${effectiveTrials})`}</p>

          <h4>Target Counts {targetsValid ? '✓' : '✗'}</h4>
          <p>Letter Targets: {dim1Targets} {dim1Targets === expectedDim1Targets ? '✓' : `(Expected: ${expectedDim1Targets})`}</p>
          <p>Position Targets: {dim2Targets} {dim2Targets === expectedDim2Targets ? '✓' : `(Expected: ${expectedDim2Targets})`}</p>

          <h4>Detailed Event Distribution</h4>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px' }}>
            <thead>
              <tr>
                <th style={{ border: '1px solid white', padding: '5px', textAlign: 'left' }}>Category</th>
                <th style={{ border: '1px solid white', padding: '5px', textAlign: 'center' }}>Letter</th>
                <th style={{ border: '1px solid white', padding: '5px', textAlign: 'center' }}>Position</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ border: '1px solid white', padding: '5px' }}>Hits</td>
                <td style={{ border: '1px solid white', padding: '5px', textAlign: 'center' }}>{calculatedResults.dim1.hits}</td>
                <td style={{ border: '1px solid white', padding: '5px', textAlign: 'center' }}>{calculatedResults.dim2.hits}</td>
              </tr>
              <tr>
                <td style={{ border: '1px solid white', padding: '5px' }}>Misses</td>
                <td style={{ border: '1px solid white', padding: '5px', textAlign: 'center' }}>{calculatedResults.dim1.misses}</td>
                <td style={{ border: '1px solid white', padding: '5px', textAlign: 'center' }}>{calculatedResults.dim2.misses}</td>
              </tr>
              <tr>
                <td style={{ border: '1px solid white', padding: '5px' }}>Correct Rejections</td>
                <td style={{ border: '1px solid white', padding: '5px', textAlign: 'center' }}>{calculatedResults.dim1.correctRejections}</td>
                <td style={{ border: '1px solid white', padding: '5px', textAlign: 'center' }}>{calculatedResults.dim2.correctRejections}</td>
              </tr>
              <tr>
                <td style={{ border: '1px solid white', padding: '5px' }}>False Alarms</td>
                <td style={{ border: '1px solid white', padding: '5px', textAlign: 'center' }}>{calculatedResults.dim1.falseAlarms}</td>
                <td style={{ border: '1px solid white', padding: '5px', textAlign: 'center' }}>{calculatedResults.dim2.falseAlarms}</td>
              </tr>
            </tbody>
          </table>

          <h4>Response Distribution</h4>
          <p>Total Responses Recorded: {responses.length} (Valid: {validResponses.length})</p>
          <p>Letter Responses: {responses.filter(r => r.dimension === 0).length}</p>
          <p>Position Responses: {responses.filter(r => r.dimension === 1).length}</p>
        </div>
      );
    };

    return (
      <div style={styles.nbackResults}>
        <h2>{t('nbackTest.results', 'N-Back Test Results')}</h2>
        <p>{t('nbackTest.completedWithN', 'Test completed with N = {{n}}', { n })}</p>

        <div style={styles.resultsSection}>
          <h3>{t('nbackTest.traditionalAccuracy', 'Traditional Accuracy')}</h3>
          <table style={styles.resultsTable}>
            <tbody>
              <tr style={styles.tableRow}>
                <td style={styles.tableCell}>{t('nbackTest.letterAccuracy', 'Letter Accuracy')}:</td>
                <td style={styles.tableCell}>{metrics.dim1Accuracy}%</td>
              </tr>
              <tr style={styles.tableRow}>
                <td style={styles.tableCell}>{t('nbackTest.positionAccuracy', 'Position Accuracy')}:</td>
                <td style={styles.tableCell}>{metrics.dim2Accuracy}%</td>
              </tr>
              <tr style={styles.tableRow}>
                <td style={styles.tableCell}>{t('nbackTest.letterAvgRt', 'Letter Average RT')}:</td>
                <td style={styles.tableCell}>{metrics.dim1AvgRT} ms</td>
              </tr>
              <tr style={styles.tableRow}>
                <td style={styles.tableCell}>{t('nbackTest.positionAvgRt', 'Position Average RT')}:</td>
                <td style={styles.tableCell}>{metrics.dim2AvgRT} ms</td>
              </tr>
              <tr style={{ ...styles.tableRow, ...styles.overallScore }}>
                <td style={styles.tableCell}>{t('nbackTest.overallAccuracy', 'Overall Accuracy')}:</td>
                <td style={styles.tableCell}>{metrics.overallAccuracy}%</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div style={styles.resultsSection}>
          <h3>{t('nbackTest.signalDetection', "Signal Detection (d')")}</h3>
          <p style={styles.dPrimeExplanation}>{t('nbackTest.dPrimeExplanation', "d' is a more sensitive measure of performance that accounts for response bias")}</p>
          <table style={styles.resultsTable}>
            <tbody>
              <tr style={styles.tableRow}>
                <td style={styles.tableCell}>{t('nbackTest.letterDPrime', "Letter d'")}:</td>
                <td style={styles.tableCell}>{metrics.dim1DPrime} (scaled: {metrics.dim1DPrimeScaled})</td>
              </tr>
              <tr style={styles.tableRow}>
                <td style={styles.tableCell}>{t('nbackTest.positionDPrime', "Position d'")}:</td>
                <td style={styles.tableCell}>{metrics.dim2DPrime} (scaled: {metrics.dim2DPrimeScaled})</td>
              </tr>
              <tr style={{ ...styles.tableRow, ...styles.overallScore }}>
                <td style={styles.tableCell}>{t('nbackTest.overallDPrime', "Overall d'")}:</td>
                <td style={styles.tableCell}>{metrics.overallDPrime} (scaled: {metrics.overallDPrimeScaled})</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div style={styles.chartContainer}>
          <Bar data={getBarData(calculatedResults)} options={getBarOptions()} />
        </div>

        <div style={styles.resultsSection}>
          <h3>{t('nbackTest.detailedStats', 'Detailed Statistics')}</h3>
          <div style={styles.statsContainer}>
            <div style={styles.dimensionStats}>
              <h4>{t('nbackTest.letterDimension', 'Letter Dimension')}</h4>
              <p>{t('nbackTest.hits', 'Hits')}: {calculatedResults.dim1.hits}</p>
              <p>{t('nbackTest.misses', 'Misses')}: {calculatedResults.dim1.misses}</p>
              <p>{t('nbackTest.correctRejections', 'Correct Rejections')}: {calculatedResults.dim1.correctRejections}</p>
              <p>{t('nbackTest.falseAlarms', 'False Alarms')}: {calculatedResults.dim1.falseAlarms}</p>
              <p>{t('nbackTest.hitRate', 'Hit Rate')}: {metrics.dim1HitRate}</p>
              <p>{t('nbackTest.faRate', 'False Alarm Rate')}: {metrics.dim1FaRate}</p>
            </div>
            <div style={styles.dimensionStats}>
              <h4>{t('nbackTest.positionDimension', 'Position Dimension')}</h4>
              <p>{t('nbackTest.hits', 'Hits')}: {calculatedResults.dim2.hits}</p>
              <p>{t('nbackTest.misses', 'Misses')}: {calculatedResults.dim2.misses}</p>
              <p>{t('nbackTest.correctRejections', 'Correct Rejections')}: {calculatedResults.dim2.correctRejections}</p>
              <p>{t('nbackTest.falseAlarms', 'False Alarms')}: {calculatedResults.dim2.falseAlarms}</p>
              <p>{t('nbackTest.hitRate', 'Hit Rate')}: {metrics.dim2HitRate}</p>
              <p>{t('nbackTest.faRate', 'False Alarm Rate')}: {metrics.dim2FaRate}</p>
            </div>
          </div>

          {/* Add debug validation when DEBUG_MODE is true */}
          {debugMetrics()}
        </div>

        {!scoreSaved && (
          <div style={styles.saveScoreSection}>
            <button
              style={styles.button}
              onClick={() => setShowSaveForm(true)}
            >
              {t('gameOver.submit', 'Save Score')}
            </button>
          </div>
        )}

        {showSaveForm && (
          <div style={styles.saveForm}>
            <h3>{t('nbackTest.saveScore', 'Save your score')}</h3>
            <input
              style={styles.input}
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder={t('gameOver.enterName', 'Enter your name')}
            />
            <button
              style={styles.button}
              onClick={() => handleSaveScore(calculatedResults)}
            >
              {t('gameOver.submit')}
            </button>
            <button
              style={{ ...styles.button, ...styles.cancelButton }}
              onClick={() => setShowSaveForm(false)}
            >
              {t('common.cancel')}
            </button>
          </div>
        )}

        {scoreSaved && (
          <div style={styles.scoreSavedMessage}>
            <p>{t('scoreboard.scoreSaved', 'Score saved!')}</p>
          </div>
        )}

        <div style={styles.resultsActions}>
          <button
            style={{ ...styles.button, backgroundColor: '#17a2b8' }}
            onClick={handleExportData}
          >
            {t('nbackTest.exportData', 'Export data')}
          </button>
          <button
            style={styles.button}
            onClick={startNBackTest}
          >
            {t('nbackTest.restartTest', 'Restart Test')}
          </button>
          <button
            style={{ ...styles.button, backgroundColor: '#007BFF' }}
            onClick={handleMainMenuReturn}
          >
            {t('common.returnToMenu')}
          </button>
        </div>

        <div style={{
          marginTop: '20px',
          background: 'rgba(255,255,255,0.1)',
          padding: '10px',
          borderRadius: '5px',
          display: 'inline-block'
        }}>
          <KeyboardShortcut keys={['Ctrl', 'Q']} description={t('nbackTest.returnToMenu', 'Return to main menu')} onClick={handleMainMenuReturn} />
        </div>
      </div>
    );
  };

  // Main render function
  if (isFinished) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '20px',
        minHeight: '100vh',
        backgroundColor: 'rgba(26, 42, 58, 0.85)',
        color: 'white',
        overflow: 'auto'
      }}>
        <div style={{
          background: 'rgba(0,0,0,0.7)',
          padding: '40px',
          borderRadius: '10px',
          width: '90%',
          maxWidth: '900px',
          marginBottom: '30px'
        }}>
          {renderTestResults()}
        </div>
      </div>
    );
  }

  if (testStarted) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '20px',
        minHeight: '100vh',
        backgroundColor: 'rgba(26, 42, 58, 0.85)',
        color: 'white'
      }}>
        <div style={{
          position: 'absolute',
          top: '20px',
          right: '20px',
          background: 'rgba(0,0,0,0.7)',
          padding: '10px',
          borderRadius: '5px',
          boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
          textAlign: 'right'
        }}>
          <p style={{ margin: '0 0 5px 0' }}>{t('nbackTest.progress', 'Progress')}: {currentStimulus + 1}/{trials}</p>
          <p style={{ margin: '0 0 5px 0' }}>{t('nbackTest.level', 'Level')}: {n}-back</p>

          <button
            onClick={() => setIsAudioActive(!isAudioActive)}
            style={{
              background: isAudioActive ? '#28a745' : '#dc3545',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              padding: '5px 10px',
              fontSize: '12px',
              cursor: 'pointer',
              marginTop: '5px'
            }}
          >
            {isAudioActive ? '🔊 ' + t('nbackTest.audioOn', 'Audio ON') : '🔇 ' + t('nbackTest.audioOff', 'Audio OFF')}
          </button>
        </div>

        <h2>{t('nbackTest.title', 'N-Back Test')}</h2>

        <div style={{
          background: 'rgba(0,0,0,0.7)',
          padding: '30px',
          borderRadius: '10px',
          marginBottom: '20px'
        }}>
          {renderGrid()}
        </div>

        <div style={{ marginTop: '20px', textAlign: 'center' }}>
          <p>{t('nbackTest.matchInstructions', 'Press L for letter match, A for position match')}</p>

          {/* Always show buttons, but with different message if still in memorization phase */}
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '20px' }}>
            <button
              onClick={() => handleNBackResponse(1)}
              disabled={currentStimulus < n}
              style={{
                padding: '15px 30px',
                margin: '0 10px',
                fontSize: '18px',
                backgroundColor: buttonClassA === 'correct' ? '#4CAF50' :
                  buttonClassA === 'incorrect' ? '#f44336' : '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: currentStimulus < n ? 'not-allowed' : 'pointer',
                opacity: currentStimulus < n ? 0.7 : 1
              }}
            >
              A - {t('nbackTest.position', 'Position')}
            </button>
            <button
              onClick={() => handleNBackResponse(0)}
              disabled={currentStimulus < n}
              style={{
                padding: '15px 30px',
                margin: '0 10px',
                fontSize: '18px',
                backgroundColor: buttonClassL === 'correct' ? '#4CAF50' :
                  buttonClassL === 'incorrect' ? '#f44336' : '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: currentStimulus < n ? 'not-allowed' : 'pointer',
                opacity: currentStimulus < n ? 0.7 : 1
              }}
            >
              L - {t('nbackTest.letter', 'Letter')}
            </button>
          </div>

          {currentStimulus < n && (
            <p style={{ marginTop: '10px' }}>
              {t('nbackTest.memorizeFirst', 'Memorize the first {{n}} items...', { n })}
            </p>
          )}
        </div>

        <div style={{
          marginTop: '20px',
          background: 'rgba(0,0,0,0.5)',
          padding: '10px',
          borderRadius: '5px'
        }}>
          <KeyboardShortcut keys={['Ctrl', 'Q']} description={t('nbackTest.returnToMenu', 'Return to main menu')} onClick={handleMainMenuReturn} />
        </div>
      </div>
    );
  }

  // Initial setup screen
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      overflow: 'auto',
      padding: '20px',
      textAlign: 'center',
      backgroundColor: 'rgba(26, 42, 58, 0.85)',
      color: 'white'
    }}>
      <div style={{
        background: 'rgba(0,0,0,0.7)',
        padding: '40px',
        borderRadius: '10px',
        maxWidth: '600px',
        width: '80%'
      }}>
        <h1>{t('nbackTest.title', 'N-Back Test')}</h1>

        <p>{t('nbackTest.instructions', 'This is a dual n-back test with audio-visual and visuospatial components.')}</p>
        <p>{t('nbackTest.letterInstructions', 'Press L if the current letter matches the letter from {{n}} steps ago.', { n })}</p>
        <p>{t('nbackTest.positionInstructions', 'Press A if the current square position matches the position from {{n}} steps ago.', { n })}</p>
        <p>{t('nbackTest.testDetails', 'The test will consist of {{trials}} stimuli presented for {{time}} seconds each.', { trials, time: tickTime / 1000 })}</p>

        <button
          onClick={startNBackTest}
          style={{
            backgroundColor: '#4CAF50',
            color: 'white',
            padding: '15px 32px',
            fontSize: '16px',
            margin: '20px 0',
            cursor: 'pointer',
            border: 'none',
            borderRadius: '4px'
          }}
        >
          {t('nbackTest.startTest', 'Start Test')}
        </button>

        <button
          onClick={handleMainMenuReturn}
          style={{
            backgroundColor: '#6c757d',
            color: 'white',
            padding: '10px 20px',
            fontSize: '16px',
            margin: '10px 0',
            cursor: 'pointer',
            border: 'none',
            borderRadius: '4px'
          }}
        >
          {t('common.returnToMenu', 'Return to Main Menu')}
        </button>

        <div style={{
          marginTop: '20px',
          background: 'rgba(255,255,255,0.1)',
          padding: '10px',
          borderRadius: '5px'
        }}>
          <KeyboardShortcut keys={['Ctrl', 'Q']} description={t('nbackTest.returnToMenu', 'Return to main menu')} onClick={handleMainMenuReturn} />
        </div>
      </div>
    </div>
  );
};

// Helper component for showing keyboard shortcuts
const KeyboardShortcut = ({ keys, description, onClick }) => {
  const { t } = useTranslation();
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        margin: '5px 0',
        fontSize: '14px',
        opacity: '0.9',
        cursor: onClick ? 'pointer' : 'default'
      }}
      onClick={onClick}
      title={onClick ? t('common.clickToExecute', 'Click to execute this command') : ''}
    >
      <span style={{ marginRight: '8px' }}>{description}:</span>
      {keys.map((key, index) => (
        <React.Fragment key={index}>
          {index > 0 && <span style={{ margin: '0 4px' }}>+</span>}
          <span style={{
            backgroundColor: 'rgba(255,255,255,0.2)',
            padding: '2px 6px',
            borderRadius: '4px',
            fontFamily: 'monospace'
          }}>{key}</span>
        </React.Fragment>
      ))}
    </div>
  );
};

export default NBackTest; 