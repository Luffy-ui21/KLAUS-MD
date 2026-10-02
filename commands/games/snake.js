import supabase from '../../lib/database.js';
import { getOwnerName, getFooter} from '../../lib/menuHelper.js';

const activeGames = new Map();
const snakeStats = new Map();
const leaderboard = new Map();

// Store sock reference globally or pass it through
let globalSock = null;

export default {
    name: "snake",
    alias: ["snakegame", "snk"],
    desc: "Play classic Snake game in WhatsApp",
    category: "games",
    usage: `.snake start - Start new game\n.snake up/down/left/right - Move snake\n.snake pause - Pause game\n.snake resume - Resume game\n.snake stop - End game\n.snake stats - Your statistics\n.snake leaderboard - High scores`,
    
    async execute(sock, m, args) {
        try {
            // Store sock reference for use in other functions
            globalSock = sock;
            
            const chatId = m.key.remoteJid;
            const userId = m.key.participant || m.key.remoteJid;
            const userName = m.pushName || "Player";
            
            // Initialize stats
            if (!snakeStats.has(userId)) {
                snakeStats.set(userId, {
                    name: userName,
                    highScore: 0,
                    totalGames: 0,
                    totalScore: 0,
                    totalApples: 0,
                    longestGame: 0,
                    lastPlayed: 0
                });
            }
            
            const action = args[0]?.toLowerCase();
            
            // Help command
            if (!action || action === 'help') {
                return await showHelp(sock, m, chatId);
            }
            
            // Stats command
            if (action === 'stats') {
                return await showStats(sock, m, chatId, userId, userName);
            }
            
            // Leaderboard
            if (action === 'leaderboard' || action === 'lb' || action === 'top') {
                return await showLeaderboard(sock, m, chatId);
            }
            
            // Find active game for this user in this chat
            const gameId = `${chatId}_${userId}`;
            const game = activeGames.get(gameId);
            const hasActiveGame = game && !game.gameOver;
            
            // Start new game
            if (action === 'start' || action === 'new' || action === 'play') {
                if (hasActiveGame) {
                    return await sock.sendMessage(chatId, {
                        text: "🎮 *Game already running!*\n\nUse `.snake stop` to end current game first."
                    }, { quoted: m });
                }
                return await startNewGame(sock, m, chatId, userId, userName);
            }
            
            // Stop game
            if (action === 'stop' || action === 'end' || action === 'quit') {
                if (!hasActiveGame) {
                    return await sock.sendMessage(chatId, {
                        text: "❌ No active game found!\nStart one with `.snake start`"
                    }, { quoted: m });
                }
                return await stopGame(sock, m, game, userId);
            }
            
            // Pause/Resume
            if (action === 'pause') {
                if (!hasActiveGame) {
                    return await sock.sendMessage(chatId, {
                        text: "❌ No active game!\nStart with `.snake start`"
                    }, { quoted: m });
                }
                
                if (game.paused) {
                    return await sock.sendMessage(chatId, {
                        text: "⏸️ Game is already paused!\nUse `.snake resume` to continue."
                    }, { quoted: m });
                }
                
                game.paused = true;
                clearInterval(game.interval);
                
                const boardDisplay = renderBoard(game);
                await sock.sendMessage(chatId, {
                    text: `⏸️ *Game Paused*\n\n${boardDisplay}\n\nScore: ${game.score}\nApples: ${game.applesEaten}\nLength: ${game.snake.length}\n\nUse \`.snake resume\` to continue`,
                    edit: game.gameMessage.key
                });
                return;
            }
            
            if (action === 'resume') {
                if (!hasActiveGame) {
                    return await sock.sendMessage(chatId, {
                        text: "❌ No active game!\nStart with `.snake start`"
                    }, { quoted: m });
                }
                
                if (!game.paused) {
                    return await sock.sendMessage(chatId, {
                        text: "▶️ Game is already running!"
                    }, { quoted: m });
                }
                
                game.paused = false;
                startGameTimer(game);
                
                const boardDisplay = renderBoard(game);
                await sock.sendMessage(chatId, {
                    text: `▶️ *Game Resumed!*\n\n${boardDisplay}\n\nScore: ${game.score}\nApples: ${game.applesEaten}\nLength: ${game.snake.length}\n\nUse arrow commands to move:\n.snake up/down/left/right`,
                    edit: game.gameMessage.key
                });
                return;
            }
            
            // Movement commands
            const directions = ['up', 'down', 'left', 'right', 'u', 'd', 'l', 'r'];
            if (directions.includes(action) && hasActiveGame) {
                return await handleMovement(sock, game, action);
            }
            
            // Show current game
            if (action === 'show' || action === 'board' || action === 'status') {
                if (!hasActiveGame) {
                    return await sock.sendMessage(chatId, {
                        text: "❌ No active game!\nStart with `.snake start`"
                    }, { quoted: m });
                }
                return await showGameStatus(sock, m, chatId, game);
            }
            
            return await showHelp(sock, m, chatId);
            
        } catch (error) {
            console.error("Snake game error:", error);
            await sock.sendMessage(m.key.remoteJid, {
                text: `❌ Error: ${error.message}\nUse .snake help for instructions`
            }, { quoted: m });
        }
    }
};

// ============= GAME FUNCTIONS =============

async function startNewGame(sock, m, chatId, userId, userName) {
    // Create game board: 15x15 grid (better for WhatsApp display)
    const boardWidth = 15;
    const boardHeight = 15;
    
    // Initialize snake in middle with 3 segments
    const initialSnake = [
        { x: Math.floor(boardWidth / 2), y: Math.floor(boardHeight / 2) },
        { x: Math.floor(boardWidth / 2) - 1, y: Math.floor(boardHeight / 2) },
        { x: Math.floor(boardWidth / 2) - 2, y: Math.floor(boardHeight / 2) }
    ];
    
    // Create first apple
    const apple = generateApple(boardWidth, boardHeight, initialSnake);
    
    const gameId = `${chatId}_${userId}`;
    const game = {
        id: gameId,
        chatId,
        userId,
        userName,
        boardWidth,
        boardHeight,
        snake: initialSnake,
        direction: 'right', // Start moving right
        apple,
        score: 0,
        applesEaten: 0,
        speed: 1500, // ms per move
        gameTime: 0,
        paused: false,
        gameOver: false,
        createdAt: Date.now(),
        lastMove: Date.now(),
        interval: null,
        gameMessage: null
    };
    
    activeGames.set(gameId, game);
    
    // Update stats
    const stats = snakeStats.get(userId);
    stats.totalGames++;
    stats.lastPlayed = Date.now();
    
    // Send initial game board
    const boardDisplay = renderBoard(game);
    
    const message = `
🐍 *SNAKE GAME STARTED!* 🐍

${boardDisplay}

👤 *Player:* ${userName}
🎯 *Score:* 0
🍎 *Apples:* 0
📏 *Length:* 3
⚡ *Speed:* Normal

*🎮 CONTROLS:*
• \`.snake up\` / \`.snake u\`
• \`.snake down\` / \`.snake d\`
• \`.snake left\` / \`.snake l\`
• \`.snake right\` / \`.snake r\`

*⚙️ OTHER COMMANDS:*
• \`.snake pause\` - Pause game
• \`.snake stop\` - End game
• \`.snake status\` - Show game info

*🚨 Game ends if you hit walls or yourself!*

*📌 The snake moves automatically every ${game.speed/1000} seconds!*
    `.trim();
    
    const gameMsg = await sock.sendMessage(chatId, {
        text: message,
        mentions: [userId]
    }, { quoted: m });
    
    game.gameMessage = gameMsg;
    
    // Start game timer
    startGameTimer(game);
}

function startGameTimer(game) {
    if (game.interval) clearInterval(game.interval);
    
    game.interval = setInterval(async () => {
        if (game.paused || game.gameOver) return;
        
        try {
            await moveSnake(game);
        } catch (error) {
            console.error("Game loop error:", error);
            clearInterval(game.interval);
        }
        
    }, game.speed);
}

async function handleMovement(sock, game, direction) {
    if (!game || game.paused || game.gameOver) {
        return await sock.sendMessage(game.chatId, {
            text: "❌ No active game or game is paused/over!"
        });
    }
    
    // Convert short commands
    const dirMap = { 'u': 'up', 'd': 'down', 'l': 'left', 'r': 'right' };
    const newDirection = dirMap[direction] || direction;
    
    // Prevent 180-degree turns
    const oppositeDirections = {
        'up': 'down', 'down': 'up',
        'left': 'right', 'right': 'left'
    };
    
    if (oppositeDirections[game.direction] === newDirection) {
        // Don't allow turning back on itself
        return;
    }
    
    // Update direction
    game.direction = newDirection;
    
    // Move snake immediately with new direction
    await moveSnake(game);
    
    // Reset the timer for next auto-move
    clearInterval(game.interval);
    startGameTimer(game);
}

async function moveSnake(game) {
    // Get head position
    const head = { ...game.snake[0] };
    
    // Calculate new head position based on current direction
    switch (game.direction) {
        case 'up': head.y--; break;
        case 'down': head.y++; break;
        case 'left': head.x--; break;
        case 'right': head.x++; break;
    }
    
    // Check collision with walls
    if (head.x < 0 || head.x >= game.boardWidth || 
        head.y < 0 || head.y >= game.boardHeight) {
        await gameOver(game, 'wall');
        return;
    }
    
    // Check collision with self (except tail which will move)
    for (let i = 0; i < game.snake.length; i++) {
        const segment = game.snake[i];
        if (segment.x === head.x && segment.y === head.y) {
            await gameOver(game, 'self');
            return;
        }
    }
    
    // Add new head
    game.snake.unshift(head);
    
    // Check if ate apple
    if (head.x === game.apple.x && head.y === game.apple.y) {
        // Increase score and length (snake already grew by adding head)
        game.score += 10;
        game.applesEaten++;
        
        // Generate new apple
        game.apple = generateApple(game.boardWidth, game.boardHeight, game.snake);
        
        // Increase speed every 5 apples (max speed: 300ms)
        if (game.applesEaten % 5 === 0 && game.speed > 300) {
            game.speed = Math.max(300, game.speed - 200);
            clearInterval(game.interval);
            startGameTimer(game);
        }
        
        // Update stats
        const stats = snakeStats.get(game.userId);
        stats.totalApples++;
    } else {
        // Remove tail if didn't eat apple
        game.snake.pop();
    }
    
    game.lastMove = Date.now();
    game.gameTime = Date.now() - game.createdAt;
    
    // Update the game display
    await updateGameDisplay(game);
}

async function updateGameDisplay(game) {
    if (!game.gameMessage) return;
    
    const sock = globalSock;
    if (!sock) return;
    
    const boardDisplay = renderBoard(game);
    const speedLabel = getSpeedLabel(game.speed);
    const directionSymbols = {
        'up': '⬆️', 'down': '⬇️', 
        'left': '⬅️', 'right': '➡️'
    };
    
    const message = `
🐍 *Snake Game*

${boardDisplay}

👤 *Player:* ${game.userName}
🎯 *Score:* ${game.score}
🍎 *Apples:* ${game.applesEaten}
📏 *Length:* ${game.snake.length}
⚡ *Speed:* ${speedLabel}
🧭 *Direction:* ${directionSymbols[game.direction] || game.direction}

*Next move in: ${(game.speed / 1000).toFixed(1)}s*
*Use .snake [direction] to change direction*
    `.trim();
    
    try {
        await sock.sendMessage(game.chatId, {
            text: message,
            edit: game.gameMessage.key,
            mentions: [game.userId]
        });
    } catch (error) {
        console.error("Failed to edit game message:", error);
        // If editing fails, send new message
        const newMsg = await sock.sendMessage(game.chatId, {
            text: message,
            mentions: [game.userId]
        });
        game.gameMessage = newMsg;
    }
}

async function gameOver(game, reason) {
    game.gameOver = true;
    if (game.interval) clearInterval(game.interval);
    
    const sock = globalSock;
    if (!sock) return;
    
    // Update stats
    const stats = snakeStats.get(game.userId);
    const gameDuration = Math.floor((Date.now() - game.createdAt) / 1000);
    
    stats.totalScore += game.score;
    stats.longestGame = Math.max(stats.longestGame, gameDuration);
    
    if (game.score > stats.highScore) {
        stats.highScore = game.score;
        // Update leaderboard
        updateLeaderboard(game.userId, game.userName, game.score);
    }
    
    // Generate final board
    const boardDisplay = renderBoard(game);
    
    const reasonText = {
        'wall': '💥 *Hit the wall!*',
        'self': '💥 *Ate yourself!*'
    }[reason] || '🎮 *Game Over!*';
    
    const durationText = formatTime(gameDuration);
    const isHighScore = game.score >= stats.highScore;
    
    const message = `
${reasonText}

${boardDisplay}

🏁 *FINAL SCORE:* ${game.score}
🍎 *Apples Eaten:* ${game.applesEaten}
📏 *Snake Length:* ${game.snake.length}
⏱️ *Game Time:* ${durationText}
⚡ *Final Speed:* ${getSpeedLabel(game.speed)}

${isHighScore ? '🎉 *NEW HIGH SCORE!* 🎉\n' : ''}
*Type \`.snake start\` to play again!*
    `.trim();
    
    try {
        await sock.sendMessage(game.chatId, {
            text: message,
            edit: game.gameMessage.key,
            mentions: [game.userId]
        });
    } catch (error) {
        console.error("Failed to edit game over message:", error);
        await sock.sendMessage(game.chatId, {
            text: message,
            mentions: [game.userId]
        });
    }
    
    // Clean up
    activeGames.delete(game.id);
    saveStats();
}

async function stopGame(sock, m, game, userId) {
    if (!game) return;
    
    if (game.interval) clearInterval(game.interval);
    
    const gameDuration = Math.floor((Date.now() - game.createdAt) / 1000);
    const durationText = formatTime(gameDuration);
    
    // Update stats even if quit
    const stats = snakeStats.get(userId);
    stats.totalScore += game.score;
    
    const message = `🎮 *GAME STOPPED*\n\n🎯 Score: ${game.score}\n⏱️ Time: ${durationText}\n🍎 Apples: ${game.applesEaten}\n\n*Thanks for playing!*`;
    
    try {
        await sock.sendMessage(game.chatId, {
            text: message,
            edit: game.gameMessage.key,
            mentions: [userId]
        });
    } catch (error) {
        console.error("Failed to edit stop message:", error);
        await sock.sendMessage(game.chatId, {
            text: message,
            mentions: [userId]
        });
    }
    
    activeGames.delete(game.id);
    saveStats();
}

async function showGameStatus(sock, m, chatId, game) {
    if (!game) return;
    
    const boardDisplay = renderBoard(game);
    const duration = Math.floor((Date.now() - game.createdAt) / 1000);
    
    const message = `
🎮 *SNAKE GAME STATUS* 🎮

${boardDisplay}

👤 *Player:* ${game.userName}
${game.paused ? '⏸️ *PAUSED*' : '▶️ *PLAYING*'}
🎯 *Score:* ${game.score}
🍎 *Apples:* ${game.applesEaten}
📏 *Length:* ${game.snake.length}
⚡ *Speed:* ${getSpeedLabel(game.speed)}
⏱️ *Time:* ${formatTime(duration)}

*Next apple at:* (${game.apple.x + 1}, ${game.apple.y + 1})

${game.paused ? '*Type `.snake resume` to continue*' : '*Keep moving!*'}
    `.trim();
    
    try {
        await sock.sendMessage(chatId, {
            text: message,
            edit: game.gameMessage.key,
            mentions: [game.userId]
        });
    } catch (error) {
        console.error("Failed to edit status message:", error);
        await sock.sendMessage(chatId, {
            text: message,
            mentions: [game.userId]
        }, { quoted: m });
    }
}

// ============= UTILITY FUNCTIONS =============

function renderBoard(game) {
    const { boardWidth, boardHeight, snake, apple } = game;
    let board = '';
    
    // Top border
    board += '┌' + '──'.repeat(boardWidth) + '┐\n';
    
    for (let y = 0; y < boardHeight; y++) {
        board += '│';
        for (let x = 0; x < boardWidth; x++) {
            let cell = '⬜';
            
            // Check snake
            for (let i = 0; i < snake.length; i++) {
                if (snake[i].x === x && snake[i].y === y) {
                    if (i === 0) {
                        // Head with direction
                        const headSymbols = {
                            'up': '⬆️', 'down': '⬇️',
                            'left': '⬅️', 'right': '➡️'
                        };
                        cell = headSymbols[game.direction] || '🟢';
                    } else if (i === snake.length - 1) {
                        // Tail
                        cell = '🟡';
                    } else {
                        // Body
                        cell = '🟢';
                    }
                    break;
                }
            }
            
            // Check apple
            if (apple.x === x && apple.y === y) {
                cell = '🍎';
            }
            
            board += cell;
        }
        board += '│\n';
    }
    
    // Bottom border
    board += '└' + '──'.repeat(boardWidth) + '┘';
    
    return board;
}

function generateApple(width, height, snake) {
    let apple;
    let valid = false;
    let attempts = 0;
    const maxAttempts = width * height * 2;
    
    while (!valid && attempts < maxAttempts) {
        apple = {
            x: Math.floor(Math.random() * width),
            y: Math.floor(Math.random() * height)
        };
        
        // Check if apple is on snake
        valid = true;
        for (const segment of snake) {
            if (segment.x === apple.x && segment.y === apple.y) {
                valid = false;
                break;
            }
        }
        attempts++;
    }
    
    // If couldn't find empty spot, put apple at (0,0)
    if (!valid) {
        // Find any empty spot
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                let empty = true;
                for (const segment of snake) {
                    if (segment.x === x && segment.y === y) {
                        empty = false;
                        break;
                    }
                }
                if (empty) {
                    return { x, y };
                }
            }
        }
        return { x: 0, y: 0 };
    }
    
    return apple;
}

function getSpeedLabel(speed) {
    if (speed >= 1500) return '🐌 Slow';
    if (speed >= 1000) return '🚶 Normal';
    if (speed >= 700) return '🏃 Fast';
    if (speed >= 500) return '⚡ Very Fast';
    return '🔥 Extreme';
}

function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function updateLeaderboard(userId, userName, score) {
    leaderboard.set(userId, {
        name: userName,
        score,
        date: Date.now()
    });
    
    // Keep only top 100 scores
    const sorted = Array.from(leaderboard.entries())
        .sort((a, b) => b[1].score - a[1].score)
        .slice(0, 100);
    
    leaderboard.clear();
    for (const [id, data] of sorted) {
        leaderboard.set(id, data);
    }
}

// ============= INFO COMMANDS =============

async function showHelp(sock, m, chatId) {
    const helpText = `╭─⌈ 🐍 *SNAKE GAME* ⌋
│
├─⊷ *.snake start / play*
│  └⊷ Start new game
│
├─⊷ *.snake up / down / left / right*
│  └⊷ Move direction (or u/d/l/r)
│
├─⊷ *.snake pause / resume*
│  └⊷ Pause or resume game
│
├─⊷ *.snake stop*
│  └⊷ End game
│
├─⊷ *.snake status*
│  └⊷ Show game info
│
├─⊷ *.snake stats*
│  └⊷ Your statistics
│
├─⊷ *.snake leaderboard*
│  └⊷ High scores
│
├─⊷ 🎮 Eat 🍎 to grow, avoid walls & yourself
├─⊷ 📌 Snake moves every 1.5s, can't turn 180°
│
╰⊷ ${getFooter(m.key.participant || m.key.remoteJid)}`;
    
    await sock.sendMessage(chatId, { text: helpText }, { quoted: m });
}

async function showStats(sock, m, chatId, userId, userName) {
    const stats = snakeStats.get(userId) || {
        highScore: 0, totalGames: 0, totalScore: 0,
        totalApples: 0, longestGame: 0
    };
    
    const avgScore = stats.totalGames > 0 ? Math.floor(stats.totalScore / stats.totalGames) : 0;
    const avgApples = stats.totalGames > 0 ? Math.floor(stats.totalApples / stats.totalGames) : 0;
    const avgTime = stats.totalGames > 0 ? Math.floor(stats.longestGame / stats.totalGames) : 0;
    
    const statsText = `
📊 *SNAKE STATS - ${userName}* 📊

🏆 *High Score:* ${stats.highScore}
🎮 *Total Games:* ${stats.totalGames}
🎯 *Total Score:* ${stats.totalScore}
🍎 *Total Apples:* ${stats.totalApples}

📈 *Average Score:* ${avgScore}
📈 *Average Apples:* ${avgApples}
⏱️ *Longest Game:* ${formatTime(stats.longestGame)}
⏱️ *Average Time:* ${formatTime(avgTime)}

${stats.lastPlayed ? `*Last Played:* ${new Date(stats.lastPlayed).toLocaleDateString()}` : ''}

*Keep playing to improve your stats!*
    `.trim();
    
    await sock.sendMessage(chatId, { text: statsText }, { quoted: m });
}

async function showLeaderboard(sock, m, chatId) {
    const allScores = Array.from(leaderboard.entries())
        .map(([id, data]) => ({ id, ...data }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 10);
    
    let leaderboardText = `🏆 *SNAKE LEADERBOARD* 🏆\n\n`;
    
    if (allScores.length === 0) {
        leaderboardText += "No scores yet! Be the first to play!";
    } else {
        for (let i = 0; i < allScores.length; i++) {
            const player = allScores[i];
            const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i+1}.`;
            const date = new Date(player.date).toLocaleDateString();
            
            leaderboardText += `${medal} *${player.name}*\n`;
            leaderboardText += `   🏆 ${player.score} points | 📅 ${date}\n\n`;
        }
    }
    
    leaderboardText += `\n*Play \`.snake start\` to get on the board!*`;
    
    await sock.sendMessage(chatId, { text: leaderboardText });
}

// ============= DATA PERSISTENCE =============

async function saveStats() {
    const data = {
        snakeStats: Array.from(snakeStats.entries()),
        leaderboard: Array.from(leaderboard.entries()),
        timestamp: Date.now()
    };
    try {
        await supabase.setConfig('game_snake_data', data);
    } catch (error) {
        console.error("Failed to save snake stats:", error);
    }
}

async function loadStats() {
    try {
        const parsed = supabase.getConfigSync('game_snake_data', null);
        if (!parsed) return;
        for (const [userId, stats] of parsed.snakeStats) {
            snakeStats.set(userId, stats);
        }
        for (const [userId, scoreData] of parsed.leaderboard) {
            leaderboard.set(userId, scoreData);
        }
        globalThis._wolfSysStats = globalThis._wolfSysStats || {};
        globalThis._wolfSysStats.snakePlayers = snakeStats.size;
    } catch (error) {
        console.log("No snake stats found, starting fresh");
    }
}

// Auto-cleanup inactive games
setInterval(() => {
    const now = Date.now();
    const sock = globalSock;
    
    for (const [gameId, game] of activeGames) {
        if (now - game.lastMove > 300000) { // 5 minutes inactivity
            if (game.interval) clearInterval(game.interval);
            
            if (game.gameMessage && sock) {
                try {
                    sock.sendMessage(game.chatId, {
                        text: `⏰ *Game auto-ended due to inactivity*\n\n🎯 Final Score: ${game.score}\n🍎 Apples: ${game.applesEaten}\n\n*Start new game with .snake start*`,
                        edit: game.gameMessage.key
                    });
                } catch (error) {
                    console.error("Failed to send auto-end message:", error);
                }
            }
            activeGames.delete(gameId);
        }
    }
}, 60000); // Check every minute

// Initialize
loadStats();
setInterval(saveStats, 300000); // Save every 5 minutes