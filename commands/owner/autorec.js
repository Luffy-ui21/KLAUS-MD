import { getOwnerName, getFooter} from '../../lib/menuHelper.js';
// autorec.js - Fake recording simulation
let recordingStates = {
  groups: false,
  dms: false,
  all: false,
  command: false
};

let activeRecordings = new Map(); // Track ongoing recordings

export default {
  name: 'autorec',
  description: 'Simulate recording status',
  async execute(sock, m, args) {
    const jid = m.key.remoteJid;
    const isGroup = jid.endsWith('@g.us');
    
    const option = args[0]?.toLowerCase();
    
    if (!option) {
      const status = getStatusMessage();
      await sock.sendMessage(jid, { text: status }, { quoted: m });
      return;
    }
    
    // Handle special commands
    if (option === 'stop') {
      stopRecording(jid);
      await sock.sendMessage(jid, { 
        text: '⏹️ Stopped all simulated recordings in this chat'
      }, { quoted: m });
      return;
    }
    
    if (option === 'test') {
      await simulateRecording(sock, jid, 5000);
      return;
    }
    
    // Toggle states
    const oldState = { ...recordingStates };
    
    switch(option) {
      case 'dm':
      case 'dms':
        recordingStates.dms = !recordingStates.dms;
        recordingStates.all = false;
        break;
      case 'group':
      case 'groups':
        recordingStates.groups = !recordingStates.groups;
        recordingStates.all = false;
        break;
      case 'both':
      case 'all':
        recordingStates.all = !recordingStates.all;
        recordingStates.dms = false;
        recordingStates.groups = false;
        break;
      case 'cmd':
      case 'command':
        recordingStates.command = !recordingStates.command;
        break;
      case 'off':
        recordingStates.dms = false;
        recordingStates.groups = false;
        recordingStates.all = false;
        recordingStates.command = false;
        // Stop all recordings
        activeRecordings.forEach((timer, chatId) => {
          clearInterval(timer);
          activeRecordings.delete(chatId);
        });
        break;
      default:
        await sock.sendMessage(jid, { 
          text: '❌ Invalid\nUse: dm, group, both, cmd, test, stop, off' 
        }, { quoted: m });
        return;
    }
    
    const response = `🎙️ ${getToggleResponse(option, oldState)}\n\n${getCurrentStatus()}`;
    await sock.sendMessage(jid, { text: response }, { quoted: m });
    
    // Start/stop continuous recording if toggled
    const shouldRecordNow = shouldRecord(jid, false);
    if (['dm', 'group', 'both', 'all'].includes(option)) {
      if (shouldRecordNow && !oldState[getStateKey(option)]) {
        // Started recording
        startContinuousRecording(sock, jid);
      } else if (!shouldRecordNow && oldState[getStateKey(option)]) {
        // Stopped recording
        stopRecording(jid);
      }
    }
  }
};

// Simulate recording with messages
export async function simulateRecording(sock, jid, duration = 3000) {
  if (activeRecordings.has(jid)) {
    await sock.sendMessage(jid, { 
      text: '⏺️ Already recording in this chat'
    });
    return;
  }
  
  const isGroup = jid.endsWith('@g.us');
  const chatName = isGroup ? 'group' : 'DM';
  
  try {
    // Send recording started message
    const startMsg = await sock.sendMessage(jid, { 
      text: `🎙️ *Recording started...* (${chatName})`
    });
    
    // Create a timer to simulate recording
    let seconds = Math.floor(duration / 1000);
    const timer = setInterval(async () => {
      if (seconds <= 0) {
        clearInterval(timer);
        activeRecordings.delete(jid);
        await sock.sendMessage(jid, { 
          text: `⏹️ *Recording stopped*\nDuration: ${Math.floor(duration/1000)}s`
        });
        return;
      }
      
      // Update with dots animation
      const dots = '.'.repeat((seconds % 3) + 1);
      try {
        await sock.sendMessage(jid, {
          text: `⏺️ Recording${dots} (${seconds}s)`,
          edit: startMsg.key
        });
      } catch (e) {}
      
      seconds--;
    }, 1000);
    
    activeRecordings.set(jid, timer);
    
    // Auto-stop after duration
    setTimeout(() => {
      if (activeRecordings.has(jid)) {
        clearInterval(timer);
        activeRecordings.delete(jid);
      }
    }, duration);
    
  } catch (error) {
    console.log('Recording simulation error:', error.message);
  }
}

// Start continuous recording simulation
function startContinuousRecording(sock, jid) {
  if (activeRecordings.has(jid)) return;
  
  const isGroup = jid.endsWith('@g.us');
  const chatType = isGroup ? '👥 Group' : '📱 DM';
  
  // Send initial message
  sock.sendMessage(jid, { 
    text: `🎙️ *Auto-recording ENABLED*\n${chatType} chat\n\nBot will simulate recording periodically.`
  });
  
  // Create periodic recording simulation
  let recordingCount = 0;
  const timer = setInterval(async () => {
    recordingCount++;
    
    // Random duration between 3-10 seconds
    const duration = 3000 + Math.random() * 7000;
    
    // Send recording start
    const startTime = Date.now();
    const msg = await sock.sendMessage(jid, { 
      text: `⏺️ *Recording #${recordingCount}* (${getRandomRecordingReason()})`
    });
    
    // Simulate recording time
    setTimeout(async () => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      try {
        await sock.sendMessage(jid, { 
          text: `⏹️ *Recording #${recordingCount} complete*\nDuration: ${elapsed}s`,
          edit: msg.key
        });
      } catch (e) {}
    }, duration);
    
  }, 15000 + Math.random() * 15000); // Every 15-30 seconds
  
  activeRecordings.set(jid, timer);
}

// Stop recording in a chat
function stopRecording(jid) {
  if (activeRecordings.has(jid)) {
    clearInterval(activeRecordings.get(jid));
    activeRecordings.delete(jid);
  }
}

// Auto-record after commands
export async function autoRecordAfterCommand(sock, jid) {
  if (!shouldRecord(jid, true)) return;
  
  // 50% chance to simulate recording after command
  if (Math.random() > 0.5) return;
  
  const duration = 1000 + Math.random() * 4000; // 1-5 seconds
  
  setTimeout(async () => {
    try {
      await simulateRecording(sock, jid, duration);
    } catch (e) {
      console.log('Auto-record error:', e.message);
    }
  }, 500);
}

// Check if should record
function shouldRecord(jid, isCommand) {
  const isGroup = jid.endsWith('@g.us');
  
  if (isCommand && recordingStates.command) return true;
  if (recordingStates.all) return true;
  if (isGroup && recordingStates.groups) return true;
  if (!isGroup && recordingStates.dms) return true;
  
  return false;
}

// Helper functions
function getStateKey(option) {
  const keys = {
    'dm': 'dms',
    'group': 'groups',
    'both': 'all',
    'all': 'all'
  };
  return keys[option] || option;
}

function getToggleResponse(option, oldState) {
  if (option === 'off') return 'All recording simulations OFF';
  if (option === 'cmd') return `Command recording ${recordingStates.command ? 'ON' : 'OFF'}`;
  
  const wasOn = oldState[getStateKey(option)];
  const isOn = recordingStates[getStateKey(option)];
  
  if (wasOn && !isOn) return `${option.toUpperCase()} recording OFF`;
  if (!wasOn && isOn) return `${option.toUpperCase()} recording ON`;
  return `${option.toUpperCase()} ${isOn ? 'ON' : 'OFF'}`;
}

function getCurrentStatus() {
  let status = '';
  if (recordingStates.all) status = '🟢 Simulating in ALL chats\n';
  else {
    if (recordingStates.dms) status += '📱 Simulating in DMs\n';
    if (recordingStates.groups) status += '👥 Simulating in Groups\n';
  }
  if (recordingStates.command) status += '🔧 Simulating after commands\n';
  if (!status) status = '🔴 All simulations OFF';
  
  // Add active recordings count
  const activeCount = activeRecordings.size;
  if (activeCount > 0) {
    status += `\n\n⏺️ Active in ${activeCount} chat${activeCount > 1 ? 's' : ''}`;
  }
  
  return status;
}

function getStatusMessage() {
  const activeCount = activeRecordings.size;
  
  return `╭─⌈ 🎙️ *RECORDING SIMULATOR* ⌋\n│\n│ 📱 *DM:* ${recordingStates.dms ? 'ON ✅' : 'OFF ❌'}\n│ 👥 *Groups:* ${recordingStates.groups ? 'ON ✅' : 'OFF ❌'}\n│ 🌐 *Both:* ${recordingStates.all ? 'ON ✅' : 'OFF ❌'}\n│ 🔧 *Command:* ${recordingStates.command ? 'ON ✅' : 'OFF ❌'}\n│` +
         (activeCount > 0 ? ` ⏺️ *Active:* ${activeCount} chat${activeCount > 1 ? 's' : ''}\n│` : '') +
         `\n├─⊷ *.autorec dm/group/both/cmd*\n│  └⊷ Toggle recording mode\n├─⊷ *.autorec test*\n│  └⊷ Test recording\n├─⊷ *.autorec stop*\n│  └⊷ Stop in this chat\n├─⊷ *.autorec off*\n│  └⊷ Turn off all\n╰⊷ ${getFooter(m.key.participant || m.key.remoteJid)}`;
}

function getRandomRecordingReason() {
  const reasons = [
    'Voice note',
    'Audio message',
    'Meeting',
    'Conversation',
    'Interview',
    'Lecture',
    'Podcast',
    'Music',
    'Discussion',
    'Memo'
  ];
  return reasons[Math.floor(Math.random() * reasons.length)];
}