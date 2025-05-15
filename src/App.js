import React, { useState, useEffect, useCallback } from 'react';
import './App.css'; // Assuming you have your styles here

// --- START: Seeded Randomness Utilities ---
// mulberry32 is a simple, small PRNG.
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
  // Create a numeric seed from the hex string for mulberry32
  // This is a simple way; for very long hex strings, more robust hashing might be better
  // but for this purpose, summing char codes (modulo to keep it in int range) works.
  for (let i = 0; i < Math.min(seedHex.length, 16); i++) { // Use a portion of the hex for simplicity
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

// Drand API endpoint
const DRAND_LATEST_URL = "https://api.drand.sh/public/latest"; // Main Drand network

function App() {
  const [allPossibleNames, setAllPossibleNames] = useState([]);
  const [selectedParticipants, setSelectedParticipants] = useState([]);
  const [nameToAdd, setNameToAdd] = useState(''); // Current selection in the dropdown
  
  const [isLoading, setIsLoading] = useState(false);
  const [orderedList, setOrderedList] = useState([]);
  const [error, setError] = useState('');

  // Fetch names from names.txt on component mount
  useEffect(() => {
    fetch(`${process.env.PUBLIC_URL}/names.txt`) // Correct way to fetch from public folder
      .then(response => {
        if (!response.ok) {
          throw new Error(`Failed to load names.txt (status: ${response.status})`);
        }
        return response.text();
      })
      .then(text => {
        const namesArray = text.split('\n')
                               .map(name => name.trim())
                               .filter(name => name); // Remove empty lines
        setAllPossibleNames(namesArray);
        if (namesArray.length > 0) {
          setNameToAdd(namesArray[0]); // Pre-select the first name in dropdown
        }
      })
      .catch(err => {
        console.error("Error fetching names.txt:", err);
        setError(`Could not load predefined names: ${err.message}. Ensure names.txt is in the public folder.`);
      });
  }, []);

  const handleAddParticipantToList = () => {
    if (nameToAdd && !selectedParticipants.includes(nameToAdd)) {
      setSelectedParticipants([...selectedParticipants, nameToAdd]);
    }
    // Optional: Reset dropdown or select next available name
    const nextAvailableName = allPossibleNames.find(n => n !== nameToAdd && !selectedParticipants.includes(n));
    if (nextAvailableName) {
        setNameToAdd(nextAvailableName);
    } else if (allPossibleNames.length > 0 && !selectedParticipants.includes(allPossibleNames[0])) {
        setNameToAdd(allPossibleNames[0]);
    } else {
        // All names added or no names left to add.
        // Clear selection or disable add button if appropriate.
    }
  };

  const handleRemoveParticipant = (nameToRemove) => {
    setSelectedParticipants(selectedParticipants.filter(name => name !== nameToRemove));
  };

  const handleRandomize = useCallback(async () => {
    setError('');
    setOrderedList([]);

    if (selectedParticipants.length === 0) {
      setError('Please add at least one participant to randomize.');
      return;
    }

    setIsLoading(true);

    try {
      // 1. Wait for 4 seconds (as per requirement)
      await new Promise(resolve => setTimeout(resolve, 4000));

      // 2. Get randomness from League of Entropy (Drand)
      const response = await fetch(DRAND_LATEST_URL, { cache: "no-store" }); // prevent caching for latest
      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Failed to fetch randomness from Drand API: ${response.status} ${errText}`);
      }
      
      const drandData = await response.json();
      const seedHex = drandData.randomness;
      
      // 3. Use randomness as seed and randomize the order
      const shuffled = seededShuffle(selectedParticipants, seedHex);
      setOrderedList(shuffled);

    } catch (err) {
      console.error("Randomization error:", err);
      setError(err.message || 'Failed to fetch and randomize names.');
      setOrderedList([]);
    } finally {
      setIsLoading(false);
    }
  }, [selectedParticipants]);

  const copyToClipboard = () => {
    if (orderedList.length === 0) return;

    const listString = orderedList
      .map((name, index) => `${index + 1}. ${name}`)
      .join('\n');
      
    navigator.clipboard.writeText(listString)
      .then(() => {
        alert('List copied to clipboard!');
      })
      .catch(err => {
        console.error('Failed to copy list: ', err);
        alert('Failed to copy list. See console for details.');
      });
  };

  // Filter names for the dropdown: only show names not already selected
  const availableNamesForDropdown = allPossibleNames.filter(
    name => !selectedParticipants.includes(name)
  );

  return (
    <div className="App">
      <header className="App-header">
        <h1>Speaker Order Randomizer</h1>
      </header>
      <main>
        <section className="participants-management">
          <h2>Select Participants:</h2>
          {allPossibleNames.length === 0 && !error && <p>Loading names...</p>}
          {allPossibleNames.length > 0 && (
            <div className="add-participant-controls">
              <select 
                value={nameToAdd} 
                onChange={(e) => setNameToAdd(e.target.value)}
                disabled={availableNamesForDropdown.length === 0}
              >
                {availableNamesForDropdown.length === 0 && selectedParticipants.length > 0 && (
                    <option value="" disabled>All names added</option>
                )}
                {availableNamesForDropdown.map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
              <button 
                type="button" 
                onClick={handleAddParticipantToList} 
                className="add-btn"
                disabled={!nameToAdd || availableNamesForDropdown.length === 0}
               >
                Add to Meeting
              </button>
            </div>
          )}

          {selectedParticipants.length > 0 && (
            <div className="current-participants">
              <h3>Current Participants for this meeting:</h3>
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

        <button 
          onClick={handleRandomize} 
          disabled={isLoading || selectedParticipants.length < 1} // Allow randomizing even 1 person
          className="randomize-btn"
        >
          {isLoading ? 'Randomizing...' : 'Randomize Order'}
        </button>

        {isLoading && (
          <div className="spinner-container">
            <div className="spinner"></div>
            <p>Waiting for new randomness (approx. 4s)...</p>
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
    </div>
  );
}

export default App;