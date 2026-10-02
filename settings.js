// export default {
//   // ===== UPDATE CONFIGURATION =====
//   update: {
//     autoCheck: false, // Check for updates on startup (set to false for manual)
//     checkInterval: 6, // Check every 6 hours (if autoCheck is true)
//     autoDownload: false, // Auto-download updates
//     backupBeforeUpdate: true, // Backup before applying updates
//     method: "git", // Default method: "git" or "zip"
    
//     // Repository URLs - UPDATED
//     repository: {
//       // Your main repository (your current bot)
//       main: "https://github.com/7silent-wolf/silentwolf",
      
//       // Remote repository (where updates come from)
//       upstream: "https://github.com/7w07f/w7",
      
//       // Backup owner repository (if needed)
//       owner: "https://github.com/7silent-wolf/silentwolf"
//     },
    
//     // ZIP update URL (fallback method)
//     zipUrl: "https://github.com/7w07f/w7/archive/refs/heads/main.zip",
    
//     // Timeout settings (in milliseconds)
//     timeouts: {
//       download: 120000,     // 2 minutes for download
//       extraction: 180000,   // 3 minutes for extraction
//       copy: 300000,        // 5 minutes for file copy
//       preserve: 30000      // 30 seconds for file preservation
//     },
    
//     // Update behavior
//     behavior: {
//       preserveSession: true,     // Keep session files
//       preserveConfig: true,      // Keep config files
//       preserveData: true,        // Keep data files
//       skipNodeModules: true,     // Skip node_modules to save time
//       installDeps: true,         // Run npm install after update
//       restartAfterUpdate: true   // Restart bot after successful update
//     }
//   },
  
//   // ... rest of your configuration
// }

// //I am Silent Wolf yeap that is my name
// //git add --all :!node_modules :!package-lock.json :!*.log :!*.db


















export default {
  // ===== UPDATE CONFIGURATION =====
  // NOTE: Auto-update is disabled by default to preserve your customizations.
  //       Set `autoCheck: true` and replace the URLs below with YOUR own repo
  //       (e.g. https://github.com/your-username/your-bot) if you want the
  //       in-bot `.update` command to pull from your fork.
  update: {
    autoCheck: false,
    checkInterval: 6,
    autoDownload: false,
    backupBeforeUpdate: true,
    method: "git",

    repository: {
      // Replace with YOUR GitHub repo URL once you push your customized bot
      main:     "https://github.com/YOUR_USERNAME/YOUR_REPO",
      upstream: "https://github.com/YOUR_USERNAME/YOUR_REPO.git",
      owner:    "https://github.com/YOUR_USERNAME/YOUR_REPO"
    },

    zipUrl: "https://github.com/YOUR_USERNAME/YOUR_REPO/archive/refs/heads/main.zip",
    
    // Timeout settings (in milliseconds)
    timeouts: {
      download: 120000,     // 2 minutes for download
      extraction: 180000,   // 3 minutes for extraction
      copy: 300000,        // 5 minutes for file copy
      preserve: 30000      // 30 seconds for file preservation
    },
    
    // Update behavior
    behavior: {
      preserveSession: true,     // Keep session files
      preserveConfig: true,      // Keep config files
      preserveData: true,        // Keep data files
      skipNodeModules: true,     // Skip node_modules to save time
      installDeps: true,         // Run npm install after update
      restartAfterUpdate: true   // Restart bot after successful update
    }
  },
  
  // ... rest of your configuration
}

//I am Silent Wolf yeap that is my name
//git add --all :!node_modules :!package-lock.json :!*.log :!*.db
