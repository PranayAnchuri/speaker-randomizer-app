import React, { useState, useCallback } from 'react';
// Removed old './App.css' import, MUI will handle styling primarily

// Material-UI Imports
import {
  Container, Box, AppBar, Toolbar, Typography, Button, TextField,
  List, ListItem, ListItemText, IconButton, Switch, FormControlLabel,
  CircularProgress, Alert, Dialog, DialogActions, DialogContent,
  DialogContentText, DialogTitle, CssBaseline, createTheme, ThemeProvider, Link
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';

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

// A basic theme can be defined here if needed, or use default
const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2', // Example: classic Material Blue
    },
    secondary: {
      main: '#dc004e', // Example: Material Pink
    },
  },
});

function App() {
  const [currentNameInput, setCurrentNameInput] = useState('');
  const [selectedParticipants, setSelectedParticipants] = useState([]);
  
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [orderedList, setOrderedList] = useState([]);
  const [error, setError] = useState('');

  const [waitForNewRandomness, setWaitForNewRandomness] = useState(true);
  const [showHelp, setShowHelp] = useState(false);
  const [copySuccess, setCopySuccess] = useState('');


  const handleAddNames = () => {
    if (!currentNameInput.trim()) return;
    const namesToAdd = currentNameInput.split(',').map(name => name.trim()).filter(name => name);
    const uniqueNewNames = namesToAdd.filter(name => !selectedParticipants.includes(name));
    if (uniqueNewNames.length > 0) {
      setSelectedParticipants([...selectedParticipants, ...uniqueNewNames]);
    }
    setCurrentNameInput('');
  };

  const handleKeyPressAddName = (event) => {
    if (event.key === 'Enter') {
      handleAddNames();
      event.preventDefault(); // Prevent form submission if it's part of a form
    }
  };

  const handleRemoveParticipant = (nameToRemove) => {
    setSelectedParticipants(selectedParticipants.filter(name => name !== nameToRemove));
  };

  const handleToggleWaitForRandomness = (event) => {
    setWaitForNewRandomness(event.target.checked);
  };

  const handleToggleHelp = () => {
    setShowHelp(!showHelp);
  };

  const handleRandomize = useCallback(async () => {
    setError('');
    setOrderedList([]);
    setCopySuccess('');

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
      .then(() => setCopySuccess('List copied to clipboard!'))
      .catch(err => {
        console.error('Failed to copy list: ', err);
        setError('Failed to copy list. See console for details.');
      });
  };

  const HelpDialog = () => (
    <Dialog open={showHelp} onClose={handleToggleHelp} aria-labelledby="help-dialog-title">
      <DialogTitle id="help-dialog-title">What's this all about?</DialogTitle>
      <DialogContent>
        <DialogContentText component="div">
          <Typography gutterBottom>
            This little app helps you randomize the order of speakers for your meetings or any list of names, really! It uses true randomness from the <Link href="https://drand.love/" target="_blank" rel="noopener noreferrer">Drand network</Link> (a League of Entropy project) to make sure it's fair.
          </Typography>
          <Typography variant="h6" component="h4" gutterBottom sx={{mt: 2}}>How to use:</Typography>
          <ol>
            <li><strong>Add Names:</strong> Type a name in the box and click "Add Name(s)" or press Enter. You can also paste a bunch of names separated by commas (e.g., <code>Alice, Bob, Charlie</code>) and then click the button.</li>
            <li><strong>Manage List:</strong> Added names will appear below. Click the <DeleteIcon fontSize="inherit" /> icon next to any name to take it off the list for this session.</li>
            <li><strong>Randomize:</strong>
              <ul>
                <li>The "Wait for Fresh Randomness" toggle (on by default) means the app will pause for about 4 seconds to grab the very latest random value from the Drand network. This is great for maximum unpredictability!</li>
                <li>If you're in a hurry, toggle it off for an instant shuffle using the most recently available randomness.</li>
              </ul>
              Hit the "Randomize Order!" button when you're ready!
            </li>
            <li><strong>Copy:</strong> Once the order is displayed, click "Copy List" to get a nice numbered list for pasting elsewhere.</li>
          </ol>
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleToggleHelp} color="primary" variant="contained">
          Got it!
        </Button>
      </DialogActions>
    </Dialog>
  );

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline /> {/* Normalizes styles across browsers */}
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Speaker Order Randomizer
          </Typography>
          <Button color="inherit" onClick={handleToggleHelp} startIcon={<HelpOutlineIcon />}>
            Help
          </Button>
        </Toolbar>
      </AppBar>

      <Container maxWidth="md" sx={{ mt: 3, mb: 3 }}> {/* Main content container */}
        {showHelp && <HelpDialog />}

        <Box component="section" sx={{ p: 2, mb: 3, border: theme => `1px solid ${theme.palette.divider}`, borderRadius: 1 }}>
          <Typography variant="h5" component="h2" gutterBottom>
            Add Participants
          </Typography>
          <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', mb: 2 }}>
            <TextField
              label="Enter name(s), comma-separated..."
              variant="outlined"
              fullWidth
              value={currentNameInput}
              onChange={(e) => setCurrentNameInput(e.target.value)}
              onKeyPress={handleKeyPressAddName}
            />
            <Button 
              variant="contained" 
              onClick={handleAddNames} 
              disabled={!currentNameInput.trim()}
              sx={{whiteSpace: 'nowrap'}}
            >
              Add Name(s)
            </Button>
          </Box>

          {selectedParticipants.length > 0 && (
            <Box>
              <Typography variant="subtitle1" gutterBottom>Current Participants ({selectedParticipants.length}):</Typography>
              <List dense>
                {selectedParticipants.map((name, index) => (
                  <ListItem
                    key={index}
                    secondaryAction={
                      <IconButton edge="end" aria-label="delete" onClick={() => handleRemoveParticipant(name)}>
                        <DeleteIcon />
                      </IconButton>
                    }
                    sx={{borderBottom: theme => `1px solid ${theme.palette.divider}`}}
                  >
                    <ListItemText primary={name} />
                  </ListItem>
                ))}
              </List>
            </Box>
          )}
        </Box>

        <Box component="section" sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, p:2, mb:3,  border: theme => `1px solid ${theme.palette.divider}`, borderRadius: 1 }}>
          <FormControlLabel
            control={
              <Switch
                checked={waitForNewRandomness}
                onChange={handleToggleWaitForRandomness}
                color="primary"
              />
            }
            label="Wait for Fresh Randomness (~4s delay if ON)"
          />
          <Button 
            variant="contained" 
            color="primary"
            size="large"
            onClick={handleRandomize} 
            disabled={isLoading || selectedParticipants.length < 1}
            sx={{minWidth: '200px'}}
          >
            {isLoading ? 'Randomizing...' : 'Randomize Order!'}
          </Button>
        </Box>

        {isLoading && (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', my: 2 }}>
            <CircularProgress sx={{mb: 1}}/>
            <Typography>{loadingMessage}</Typography>
          </Box>
        )}

        {error && !isLoading && <Alert severity="error" sx={{ my: 2 }}>{error}</Alert>}
        {copySuccess && !error && !isLoading && <Alert severity="success" sx={{ my: 2 }}>{copySuccess}</Alert>}


        {orderedList.length > 0 && !isLoading && (
          <Box component="section" sx={{ p:2, border: theme => `1px solid ${theme.palette.divider}`, borderRadius: 1 }}>
            <Typography variant="h5" component="h2" gutterBottom>
              Final Order:
            </Typography>
            <List>
              {orderedList.map((name, index) => (
                <ListItem key={index} sx={{borderBottom: theme => `1px solid ${theme.palette.divider}`}}>
                  <ListItemText primary={`${index + 1}. ${name}`} />
                </ListItem>
              ))}
            </List>
            <Button 
              variant="outlined" 
              onClick={copyToClipboard} 
              startIcon={<ContentCopyIcon />}
              sx={{mt: 2}}
            >
              Copy List
            </Button>
          </Box>
        )}
      </Container>
      <Box component="footer" sx={{ textAlign: 'center', mt: 4, py: 3, color: 'text.secondary', fontStyle: 'italic', borderTop: theme => `1px solid ${theme.palette.divider}` }}>
        <Typography variant="caption">
          This app is <Link href="https://en.wikipedia.org/wiki/Vibe_coding" target="_blank" rel="noopener noreferrer" color="inherit">vibe coded</Link> by <Link href="https://github.com/PranayAnchuri" target="_blank" rel="noopener noreferrer" color="inherit">Pranay</Link>
        </Typography>
      </Box>
    </ThemeProvider>
  );
}

export default App;