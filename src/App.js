import React, { useState, useEffect, useCallback } from 'react'; // useEffect might not be strictly needed now
import './App.css';

// --- START: Seeded Randomness Utilities (Unchanged) ---
function mulberry32(seed) {
  return function() {
    var t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
}

function seededShuffle(array, seedHex) {
  const anArray = [...array];
  let seed = 0;
  for (let i = 0; i < Math.min(seedHex.length, 16); i++) {
      seed = (seed + seedHex.charCodeAt(i) * (i+1)) % 2**32;
  }
  const randomFunc = mulberry32(seed);
  let currentIndex = anArray.length, randomIndex;
  while (currentIndex !== 0) {
    randomIndex = Math.floor(randomFunc() * currentIndex);
    currentIndex--;
    [anArray[currentIndex], anArray[randomIndex]] = [
      anArray[randomIndex], anArray[currentIndex]
    ];
  }
  return anArray;
}
// --- END: Seeded Randomness Utilities ---

const DRAND_LATEST_URL = "https://api.drand.sh/public/latest";

function App() {
  const [currentNameInput, setCurrentNameInput] = useState('');
  const [selectedParticipants, setSelectedParticipants] = useState([]);
  
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState(''); // For specific loading messages
  const [orderedList, setOrderedList] = useState([]);
  const [error, setError] = useState('');

  const [waitForNewRandomness, setWaitForNewRandomness] = useState(true);
  const [showHelp, setShowHelp] = useState(false);

  const handleAddNames = () => {
    if (!currentNameInput.trim()) return;

    const namesToAdd = currentNameInput
      .split(',')
      .map(name => name.trim())
      .filter(name => name); // Remove empty strings

    const uniqueNewNames = namesToAdd.filter(name => !selectedParticipants.includes(name));
    
    if (uniqueNewNames.length > 0) {
      setSelectedParticipants([...selectedParticipants, ...uniqueNewNames]);
    }
    setCurrentNameInput(''); // Clear input after adding
  };

  const handleKeyPressAddName = (event) => {
    if (event.key === 'Enter') {
      handleAddNames();
    }
  };

  const handleRemoveParticipant = (nameToRemove) => {
    setSelectedParticipants(selectedParticipants.filter(name => name !== nameToRemove));
  };

  const handleToggleWaitForRandomness = () => {
    setWaitForNewRandomness(!waitForNewRandomness);
  };

  const handleToggleHelp = () => {
    setShowHelp(!showHelp);
  };

  const handleRandomize = useCallback(async () => {
    setError('');
    setOrderedList([]);

    if (selectedParticipants.length === 0) {
      setError('Please add at least one participant to randomize.');
      return;
    }

    setIsLoading(true);
    setLoadingMessage('Preparing to shuffle...');

    try {
      if (waitForNewRandomness) {
        setLoadingMessage('Waiting for fresh randomness (approx. 4s)...');
        await new Promise(resolve => setTimeout(resolve, 4000));
      } else {
        setLoadingMessage('Fetching current randomness...');
      }

      const response = await fetch(DRAND_LATEST_URL, { cache: "no-store" });
      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Failed to fetch randomness from Drand API: ${response.status} ${errText}`);
      }
      
      const drandData = await response.json();
      const seedHex = drandData.randomness;
      
      setLoadingMessage('Shuffling names...');
      // Short delay to allow UI to update message before potential blocking shuffle
      await new Promise(resolve => setTimeout(resolve, 50)); 

      const shuffled = seededShuffle(selectedParticipants, seedHex);
      setOrderedList(shuffled);

    } catch (err) {
      console.error("Randomization error:", err);
      setError(err.message || 'Failed to fetch and randomize names.');
      setOrderedList([]);
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  }, [selectedParticipants, waitForNewRandomness]);

  const copyToClipboard = () => {
    if (orderedList.length === 0) return;
    const listString = orderedList.map((name, index) => `${index + 1}. ${name}`).join('\n');
    navigator.clipboard.writeText(listString)
      .then(() => alert('List copied to clipboard!'))
      .catch(err => {
        console.error('Failed to copy list: ', err);
        alert('Failed to copy list. See console for details.');
      });
  };

  const HelpSection = () => (
    <div className="help-section">
      <h3>What's this all about?</h3>
      <p>This little app helps you randomize the order of speakers for your meetings or any list of names, really! It uses true randomness from the <a href="https://drand.love/" target="_blank" rel="noopener noreferrer">Drand network</a> (a League of Entropy project) to make sure it's fair.</p>
      <h4>How to use:</h4>
      <ol>
        <li><strong>Add Names:</strong> Type a name in the box and click "Add Name(s)" or press Enter. You can also paste a bunch of names separated by commas (e.g., <code>Alice, Bob, Charlie</code>) and then click the button.</li>
        <li><strong>Manage List:</strong> Added names will appear below. Click "Remove" next to any name to take it off the list for this session.</li>
        <li><strong>Randomize:</strong>
          <ul>
            <li>The "Wait for Fresh Randomness" toggle (on by default) means the app will pause for about 4 seconds to grab the very latest random value from the Drand network. This is great for maximum unpredictability!</li>
            <li>If you're in a hurry, toggle it off for an instant shuffle using the most recently available randomness.</li>
          </ul>
          Hit the "Randomize Order" button when you're ready!
        </li>
        <li><strong>Copy:</strong> Once the order is displayed, click "Copy List" to get a nice numbered list for pasting elsewhere.</li>
      </ol>
      <button onClick={handleToggleHelp} className="close-help-btn">Got it!</button>
    </div>
  );

  return (
    <div className="App">
      <header className="App-header">
        <h1>Speaker Order Randomizer</h1>
        <button onClick={handleToggleHelp} className="help-toggle-btn">
          {showHelp ? 'Close Help' : 'Help/About'}
        </button>
      </header>

      {showHelp && <HelpSection />}

      {!showHelp && (
        <main>
          <section className="participants-management">
            <h2>Add Participants:</h2>
            <div className="add-participant-controls">
              <input
                type="text"
                placeholder="Enter name(s), comma-separated..."
                value={currentNameInput}
                onChange={(e) => setCurrentNameInput(e.target.value)}
                onKeyPress={handleKeyPressAddName}
                className="name-input"
              />
              <button 
                type="button" 
                onClick={handleAddNames} 
                className="add-btn"
                disabled={!currentNameInput.trim()}
              >
                Add Name(s)
              </button>
            </div>

            {selectedParticipants.length > 0 && (
              <div className="current-participants">
                <h3>Current Participants ({selectedParticipants.length}):</h3>
                <ul>
                  {selectedParticipants.map((name, index) => (
                    <li key={index}>
                      {name}
                      <button 
                        type="button" 
                        onClick={() => handleRemoveParticipant(name)} 
                        className="remove-btn-small"
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          <section className="controls">
            <div className="toggle-wait-container">
              <label htmlFor="waitToggle">Wait for Fresh Randomness:</label>
              <button
                id="waitToggle"
                onClick={handleToggleWaitForRandomness}
                className={`toggle-btn ${waitForNewRandomness ? 'active' : ''}`}
                aria-pressed={waitForNewRandomness}
              >
                {waitForNewRandomness ? 'ON' : 'OFF'}
              </button>
              <span className="toggle-info">(~4s delay for new entropy if ON)</span>
            </div>

            <button 
              onClick={handleRandomize} 
              disabled={isLoading || selectedParticipants.length < 1}
              className="randomize-btn"
            >
              {isLoading ? 'Randomizing...' : 'Randomize Order!'}
            </button>
          </section>

          {isLoading && (
            <div className="spinner-container">
              <div className="spinner"></div>
              <p>{loadingMessage}</p>
            </div>
          )}

          {error && <p className="error-message">Error: {error}</p>}

          {orderedList.length > 0 && !isLoading && (
            <section className="results">
              <h2>Final Order:</h2>
              <ol>
                {orderedList.map((name, index) => (
                  <li key={index}>{name}</li>
                ))}
              </ol>
              <button onClick={copyToClipboard} className="copy-btn">
                Copy List
              </button>
            </section>
          )}
        </main>
      )}
    </div>
  );
}

export default App;