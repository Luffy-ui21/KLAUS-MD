// import axios from 'axios';

// const activeQuestions = new Map(); // Store active questions by message ID
// const userStats = new Map(); // Track user statistics

// // Quiz categories with descriptions
// const QUIZ_CATEGORIES = {
//     'general': { name: 'General Knowledge', emoji: '📚' },
//     'science': { name: 'Science', emoji: '🔬' },
//     'geography': { name: 'Geography', emoji: '🗺️' },
//     'history': { name: 'History', emoji: '🏛️' },
//     'sports': { name: 'Sports', emoji: '⚽' },
//     'animals': { name: 'Animals', emoji: '🐯' },
//     'movies': { name: 'Movies', emoji: '🎬' },
//     'music': { name: 'Music', emoji: '🎵' },
//     'tech': { name: 'Technology', emoji: '💻' },
//     'random': { name: 'Random Mix', emoji: '🎲' }
// };

// // Category IDs for OpenTDB API
// const CATEGORY_IDS = {
//     'general': 9,
//     'science': 17,
//     'geography': 22,
//     'history': 23,
//     'sports': 21,
//     'animals': 27,
//     'movies': 11,
//     'music': 12,
//     'tech': 18,
//     'random': null // Mixed categories
// };

// export default {
//     name: "quiz",
//     alias: ["q", "question", "trivia"],
//     desc: "Instant quiz questions - Answer anytime!",
//     category: "games",
//     usage: `.quiz - Random question\n.quiz [category] - Specific category\n.quiz stats - Your stats\n.quiz categories - List categories`,
    
//     async execute(sock, m, args) {
//         try {
//             const chatId = m.key.remoteJid;
//             const userId = m.key.participant || m.key.remoteJid;
//             const userName = m.pushName || "Player";
            
//             const action = args[0]?.toLowerCase();
            
//             // Initialize user stats
//             if (!userStats.has(userId)) {
//                 userStats.set(userId, {
//                     name: userName,
//                     correct: 0,
//                     wrong: 0,
//                     total: 0,
//                     streak: 0,
//                     bestStreak: 0,
//                     lastActive: Date.now()
//                 });
//             }
            
//             // Handle replies to any quiz question
//             if (m.hasQuotedMsg) {
//                 const quotedMsg = await m.getQuotedMessage();
//                 const question = activeQuestions.get(quotedMsg.key.id);
                
//                 if (question && !question.answered) {
//                     return await handleAnswer(sock, m, question, userId, userName);
//                 }
//             }
            
//             // Commands
//             switch(action) {
//                 case 'stats':
//                     return await showStats(sock, m, chatId, userId);
                    
//                 case 'categories':
//                 case 'cats':
//                     return await showCategories(sock, m, chatId);
                    
//                 case 'help':
//                     return await showHelp(sock, m, chatId);
                    
//                 case 'answer':
//                 case 'ans':
//                     // Get answer for last question in chat
//                     const lastQuestions = Array.from(activeQuestions.values())
//                         .filter(q => q.chatId === chatId && !q.answered)
//                         .sort((a, b) => b.time - a.time);
                    
//                     if (lastQuestions.length > 0) {
//                         const lastQuestion = lastQuestions[0];
//                         const answerText = `🎯 *Answer:* ${['A','B','C','D'][lastQuestion.correctIndex]}\n\n${lastQuestion.correctAnswer}`;
                        
//                         return await sock.sendMessage(chatId, {
//                             text: answerText
//                         }, { quoted: m });
//                     }
//                     return await sock.sendMessage(chatId, {
//                         text: "❌ No active question in this chat!"
//                     }, { quoted: m });
                    
//                 default:
//                     // Start a new question
//                     const category = action && Object.keys(QUIZ_CATEGORIES).includes(action) ? action : 'random';
//                     return await askQuestion(sock, m, chatId, category);
//             }
            
//         } catch (error) {
//             console.error("Quiz error:", error);
//         }
//     }
// };

// async function askQuestion(sock, m, chatId, category) {
//     try {
//         const questionData = await fetchQuestion(category);
        
//         if (!questionData) {
//             return await sock.sendMessage(chatId, {
//                 text: "❌ Couldn't get a question. Try again!"
//             }, { quoted: m });
//         }
        
//         const questionId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
        
//         // Create question object
//         const question = {
//             id: questionId,
//             chatId,
//             question: questionData.question,
//             options: questionData.options,
//             correctAnswer: questionData.correctAnswer,
//             correctIndex: questionData.correctIndex,
//             category: questionData.category,
//             difficulty: questionData.difficulty,
//             answers: [], // {userId, userName, answer, correct, time}
//             answered: false,
//             time: Date.now(),
//             messageId: null,
//             answeredUsers: new Set()
//         };
        
//         // Send question
//         const questionText = formatQuestion(question);
//         const questionMsg = await sock.sendMessage(chatId, {
//             text: questionText
//         }, { quoted: m });
        
//         question.messageId = questionMsg.key.id;
        
//         // Store question
//         activeQuestions.set(questionMsg.key.id, question);
        
//         // Auto-cleanup after 5 minutes
//         setTimeout(() => {
//             const storedQuestion = activeQuestions.get(questionMsg.key.id);
//             if (storedQuestion && !storedQuestion.answered) {
//                 showFinalAnswer(storedQuestion);
//                 activeQuestions.delete(questionMsg.key.id);
//             }
//         }, 300000); // 5 minutes
        
//     } catch (error) {
//         console.error("Ask question error:", error);
//     }
// }

// async function fetchQuestion(category) {
//     try {
//         let url = 'https://opentdb.com/api.php?amount=1&type=multiple&encode=url3986';
        
//         if (category !== 'random' && CATEGORY_IDS[category]) {
//             url += `&category=${CATEGORY_IDS[category]}`;
//         } else if (category === 'random') {
//             // Random category - pick one
//             const categories = Object.values(CATEGORY_IDS).filter(id => id !== null);
//             const randomCat = categories[Math.floor(Math.random() * categories.length)];
//             url += `&category=${randomCat}`;
//         }
        
//         const response = await axios.get(url, { timeout: 5000 });
//         const data = response.data;
        
//         if (data.response_code !== 0 || !data.results?.length) {
//             return null;
//         }
        
//         const q = data.results[0];
//         const question = decodeURIComponent(q.question);
//         const correct = decodeURIComponent(q.correct_answer);
        
//         // Get options
//         let options = q.incorrect_answers.map(a => decodeURIComponent(a));
//         options.push(correct);
//         options = shuffleArray(options);
        
//         const correctIndex = options.indexOf(correct);
        
//         return {
//             question,
//             options,
//             correctAnswer: correct,
//             correctIndex,
//             category: q.category || 'General Knowledge',
//             difficulty: q.difficulty || 'medium'
//         };
        
//     } catch (error) {
//         console.error("Fetch question error:", error);
//         return null;
//     }
// }

// function formatQuestion(question) {
//     const { question: text, options, category, difficulty } = question;
//     const catInfo = QUIZ_CATEGORIES[getCategoryKey(category)] || QUIZ_CATEGORIES.general;
    
//     let message = `${catInfo.emoji} *${catInfo.name.toUpperCase()}* ${catInfo.emoji}\n\n`;
//     message += `*${text}*\n\n`;
    
//     // Options
//     const letters = ['A', 'B', 'C', 'D'];
//     options.forEach((opt, i) => {
//         message += `${letters[i]}. ${opt}\n`;
//     });
    
//     message += `\n⚡ *Difficulty:* ${difficulty.toUpperCase()}`;
//     message += `\n⏱️ *Answer anytime!*`;
//     message += `\n\n*Reply to this message with A, B, C, or D*`;
    
//     return message;
// }

// async function handleAnswer(sock, m, question, userId, userName) {
//     if (question.answeredUsers.has(userId)) {
//         return; // User already answered this question
//     }
    
//     const userAnswer = m.body?.trim().toUpperCase();
//     if (!userAnswer) return;
    
//     // Map answer to index
//     const answerMap = { 'A': 0, 'B': 1, 'C': 2, 'D': 3 };
//     const answerIndex = answerMap[userAnswer];
    
//     if (answerIndex === undefined) {
//         // Not a valid answer
//         await sock.sendMessage(question.chatId, {
//             text: `❌ ${userName}, please reply with A, B, C, or D!`
//         }, { quoted: m });
//         return;
//     }
    
//     question.answeredUsers.add(userId);
    
//     const isCorrect = answerIndex === question.correctIndex;
//     const answerTime = Date.now() - question.time;
//     const correctLetter = ['A','B','C','D'][question.correctIndex];
    
//     // Record answer
//     question.answers.push({
//         userId,
//         userName,
//         answer: userAnswer,
//         correct: isCorrect,
//         time: answerTime
//     });
    
//     // Update user stats
//     const stats = userStats.get(userId);
//     stats.total++;
//     stats.lastActive = Date.now();
    
//     if (isCorrect) {
//         stats.correct++;
//         stats.streak++;
//         if (stats.streak > stats.bestStreak) {
//             stats.bestStreak = stats.streak;
//         }
//     } else {
//         stats.wrong++;
//         stats.streak = 0;
//     }
    
//     // Update question message
//     await updateQuestionMessage(sock, question);
    
//     // Send immediate feedback
//     const feedback = isCorrect 
//         ? `✅ *CORRECT!* ${userName} got it right!`
//         : `❌ *WRONG!* ${userName}, correct answer is ${correctLetter}`;
    
//     await sock.sendMessage(question.chatId, {
//         text: feedback
//     }, { quoted: m });
// }

// async function updateQuestionMessage(sock, question) {
//     const { question: text, options, answers, category, difficulty } = question;
//     const catInfo = QUIZ_CATEGORIES[getCategoryKey(category)] || QUIZ_CATEGORIES.general;
    
//     let message = `${catInfo.emoji} *${catInfo.name.toUpperCase()}* ${catInfo.emoji}\n\n`;
//     message += `*${text}*\n\n`;
    
//     // Options with answer counts
//     const letters = ['A', 'B', 'C', 'D'];
//     const correctLetter = letters[question.correctIndex];
    
//     options.forEach((opt, i) => {
//         const letter = letters[i];
//         const answerCount = answers.filter(a => a.answer === letter).length;
        
//         message += `${letter}. ${opt}`;
//         if (i === question.correctIndex) message += ` ✅`;
//         if (answerCount > 0) message += ` (${answerCount}👤)`;
//         message += `\n`;
//     });
    
//     // Show who answered what
//     if (answers.length > 0) {
//         message += `\n📊 *Answers:*\n`;
        
//         // Group by answer
//         const answersByLetter = {};
//         answers.forEach(ans => {
//             if (!answersByLetter[ans.answer]) {
//                 answersByLetter[ans.answer] = [];
//             }
//             answersByLetter[ans.answer].push(ans);
//         });
        
//         Object.keys(answersByLetter).sort().forEach(letter => {
//             const users = answersByLetter[letter];
//             const correctUsers = users.filter(u => u.correct);
//             const wrongUsers = users.filter(u => !u.correct);
            
//             let line = `${letter}: `;
//             if (correctUsers.length > 0) {
//                 line += `✅ ${correctUsers.map(u => u.userName).join(', ')}`;
//                 if (wrongUsers.length > 0) {
//                     line += ` | ❌ ${wrongUsers.map(u => u.userName).join(', ')}`;
//                 }
//             } else {
//                 line += `❌ ${wrongUsers.map(u => u.userName).join(', ')}`;
//             }
            
//             message += `${line}\n`;
//         });
//     }
    
//     message += `\n⚡ *Difficulty:* ${difficulty.toUpperCase()}`;
//     message += `\n🎯 *Correct:* ${correctLetter}`;
//     message += `\n👥 *Answered:* ${answers.length} user${answers.length !== 1 ? 's' : ''}`;
    
//     const timePassed = Math.floor((Date.now() - question.time) / 1000);
//     if (timePassed < 300) { // 5 minutes
//         message += `\n⏱️ *${300 - timePassed}s left to answer*`;
//     }
    
//     message += `\n\n*Still time to answer! Reply with A-D*`;
    
//     try {
//         await sock.sendMessage(question.chatId, {
//             text: message,
//             edit: { remoteJid: question.chatId, id: question.messageId, fromMe: true }
//         });
//     } catch (error) {
//         console.error("Update message error:", error);
//     }
// }

// async function showFinalAnswer(question) {
//     const sock = require('./sockInstance'); // You'll need to make sock available globally
    
//     const { question: text, options, answers, category } = question;
//     const catInfo = QUIZ_CATEGORIES[getCategoryKey(category)] || QUIZ_CATEGORIES.general;
//     const correctLetter = ['A','B','C','D'][question.correctIndex];
    
//     let message = `🏁 *QUESTION ENDED* 🏁\n\n`;
//     message += `${catInfo.emoji} *${catInfo.name}*\n\n`;
//     message += `*${text}*\n\n`;
    
//     // Final options
//     options.forEach((opt, i) => {
//         const letter = ['A','B','C','D'][i];
//         message += `${letter}. ${opt}`;
//         if (i === question.correctIndex) message += ` ✅`;
//         message += `\n`;
//     });
    
//     message += `\n🎯 *Correct Answer:* ${correctLetter}. ${question.correctAnswer}`;
    
//     // Results summary
//     const correctCount = answers.filter(a => a.correct).length;
//     const wrongCount = answers.filter(a => !a.correct).length;
    
//     if (answers.length > 0) {
//         message += `\n\n📊 *Results:*`;
//         message += `\n✅ Correct: ${correctCount}`;
//         message += `\n❌ Wrong: ${wrongCount}`;
        
//         if (correctCount > 0) {
//             const correctUsers = answers.filter(a => a.correct).map(a => a.userName);
//             message += `\n\n🏆 *Winners:* ${correctUsers.join(', ')}`;
//         }
//     } else {
//         message += `\n\n😴 *No one answered!*`;
//     }
    
//     message += `\n\n*New question:* .quiz`;
    
//     try {
//         await sock.sendMessage(question.chatId, {
//             text: message,
//             edit: { remoteJid: question.chatId, id: question.messageId, fromMe: true }
//         });
//     } catch (error) {
//         console.error("Final answer error:", error);
//     }
// }

// async function showStats(sock, m, chatId, userId) {
//     const stats = userStats.get(userId) || {
//         correct: 0, wrong: 0, total: 0, streak: 0, bestStreak: 0
//     };
    
//     const accuracy = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0;
    
//     const statsText = `📊 *QUIZ STATS*\n\n`;
//     statsText += `✅ *Correct:* ${stats.correct}\n`;
//     statsText += `❌ *Wrong:* ${stats.wrong}\n`;
//     statsText += `🎯 *Total:* ${stats.total}\n`;
//     statsText += `📈 *Accuracy:* ${accuracy}%\n`;
//     statsText += `🔥 *Current Streak:* ${stats.streak}\n`;
//     statsText += `🏆 *Best Streak:* ${stats.bestStreak}\n\n`;
    
//     if (accuracy >= 80) statsText += `🎉 *Quiz Master!*`;
//     else if (accuracy >= 60) statsText += `👍 *Great Job!*`;
//     else if (accuracy >= 40) statsText += `👏 *Good Effort!*`;
//     else statsText += `💪 *Keep Trying!*`;
    
//     statsText += `\n\n*Play more:* .quiz`;
    
//     await sock.sendMessage(chatId, { text: statsText }, { quoted: m });
// }

// async function showCategories(sock, m, chatId) {
//     let categoriesText = `📚 *QUIZ CATEGORIES*\n\n`;
    
//     Object.entries(QUIZ_CATEGORIES).forEach(([key, cat]) => {
//         categoriesText += `${cat.emoji} *${cat.name}:* .quiz ${key}\n`;
//     });
    
//     categoriesText += `\n*Example:* .quiz science\n*Random:* .quiz`;
    
//     await sock.sendMessage(chatId, { text: categoriesText }, { quoted: m });
// }

// async function showHelp(sock, m, chatId) {
//     const helpText = `🎮 *INSTANT QUIZ GAME*\n\n*Start:* .quiz\n*Categories:* .quiz science/geography/etc\n*Stats:* .quiz stats\n*Categories:* .quiz categories\n*Answer:* Reply to any question with A-D\n\n*Features:*\n• New questions anytime\n• Answer anytime within 5 minutes\n• Live results updating\n• Multiple users can answer\n• No waiting for others\n\n*Just type .quiz to start!*`;
    
//     await sock.sendMessage(chatId, { text: helpText }, { quoted: m });
// }

// function getCategoryKey(apiCategory) {
//     const lowerCat = apiCategory.toLowerCase();
    
//     if (lowerCat.includes('science')) return 'science';
//     if (lowerCat.includes('geography')) return 'geography';
//     if (lowerCat.includes('history')) return 'history';
//     if (lowerCat.includes('sport')) return 'sports';
//     if (lowerCat.includes('animal')) return 'animals';
//     if (lowerCat.includes('movie') || lowerCat.includes('film')) return 'movies';
//     if (lowerCat.includes('music')) return 'music';
//     if (lowerCat.includes('computer') || lowerCat.includes('technology')) return 'tech';
    
//     return 'general';
// }

// function shuffleArray(array) {
//     for (let i = array.length - 1; i > 0; i--) {
//         const j = Math.floor(Math.random() * (i + 1));
//         [array[i], array[j]] = [array[j], array[i]];
//     }
//     return array;
// }

// // Cleanup old questions every hour
// setInterval(() => {
//     const now = Date.now();
//     const hourAgo = now - 3600000; // 1 hour
    
//     for (const [msgId, question] of activeQuestions) {
//         if (question.time < hourAgo) {
//             activeQuestions.delete(msgId);
//         }
//     }
// }, 3600000); // Run every hour
























import axios from 'axios';
import { getOwnerName, getFooter} from '../../lib/menuHelper.js';

const activeQuestions = new Map(); // Store active questions by message ID
const userStats = new Map(); // Track user statistics
let isListenerSet = false; // Track if we've set up the listener

// Quiz categories with descriptions
const QUIZ_CATEGORIES = {
    'general': { name: 'General Knowledge', emoji: '📚' },
    'science': { name: 'Science', emoji: '🔬' },
    'geography': { name: 'Geography', emoji: '🗺️' },
    'history': { name: 'History', emoji: '🏛️' },
    'sports': { name: 'Sports', emoji: '⚽' },
    'animals': { name: 'Animals', emoji: '🐯' },
    'movies': { name: 'Movies', emoji: '🎬' },
    'music': { name: 'Music', emoji: '🎵' },
    'tech': { name: 'Technology', emoji: '💻' }
};

// Category IDs for OpenTDB API
const CATEGORY_IDS = {
    'general': 9,
    'science': 17,
    'geography': 22,
    'history': 23,
    'sports': 21,
    'animals': 27,
    'movies': 11,
    'music': 12,
    'tech': 18
};

export default {
    name: "quiz",
    alias: ["q", "question", "trivia"],
    desc: "Instant quiz questions - Answer anytime!",
    category: "games",
    usage: `.quiz - Random question\n.quiz [category] - Specific category\n.quiz stats - Your stats\n.quiz categories - List categories`,
    
    async execute(sock, m, args) {
        try {
            const chatId = m.key.remoteJid;
            const userId = m.key.participant || m.key.remoteJid;
            const userName = m.pushName || "Player";
            
            console.log(`Quiz command from ${userName}`);
            
            // Initialize user stats
            if (!userStats.has(userId)) {
                userStats.set(userId, {
                    name: userName,
                    correct: 0,
                    wrong: 0,
                    total: 0,
                    streak: 0,
                    bestStreak: 0,
                    lastActive: Date.now()
                });
            }
            
            // Set up the message listener if not already set
            if (!isListenerSet && sock.ev) {
                console.log("Setting up quiz reply listener...");
                setupMessageListener(sock);
                isListenerSet = true;
            }
            
            const action = args[0]?.toLowerCase();
            
            // Commands
            switch(action) {
                case 'stats':
                    return await showStats(sock, m, chatId, userId);
                    
                case 'categories':
                case 'cats':
                    return await showCategories(sock, m, chatId);
                    
                case 'help':
                    return await showHelp(sock, m, chatId);
                    
                case 'answer':
                case 'ans':
                    // Get answer for last question in chat
                    const lastQuestions = Array.from(activeQuestions.values())
                        .filter(q => q.chatId === chatId && !q.answered)
                        .sort((a, b) => b.time - a.time);
                    
                    if (lastQuestions.length > 0) {
                        const lastQuestion = lastQuestions[0];
                        const answerText = `🎯 *Answer:* ${['A','B','C','D'][lastQuestion.correctIndex]}\n\n${lastQuestion.correctAnswer}`;
                        
                        return await sock.sendMessage(chatId, {
                            text: answerText
                        }, { quoted: m });
                    }
                    return await sock.sendMessage(chatId, {
                        text: "❌ No active question in this chat!"
                    }, { quoted: m });
                    
                case 'general':
                case 'science':
                case 'geography':
                case 'history':
                case 'sports':
                case 'animals':
                case 'movies':
                case 'music':
                case 'tech':
                    // Specific category requested
                    return await askQuestion(sock, m, chatId, action);
                    
                default:
                    // Start a new RANDOM question
                    const category = getRandomCategory();
                    return await askQuestion(sock, m, chatId, category);
            }
            
        } catch (error) {
            console.error("Quiz error:", error);
            await sock.sendMessage(m.key.remoteJid, {
                text: "❌ Quiz error occurred. Try again!"
            });
        }
    }
};

// Setup listener for incoming messages (replies to quiz questions)
function setupMessageListener(sock) {
    console.log("Setting up quiz answer listener...");
    
    sock.ev.on('messages.upsert', async ({ messages }) => {
        try {
            for (const m of messages) {
                // Skip if message is from the bot itself
                if (m.key.fromMe) continue;
                
                // Get message text
                const message = m.message?.conversation || 
                               m.message?.extendedTextMessage?.text || "";
                
                // Check if this is a reply to a quiz question
                if (m.message?.extendedTextMessage?.contextInfo) {
                    const quotedId = m.message.extendedTextMessage.contextInfo.stanzaId;
                    const userId = m.key.participant || m.key.remoteJid;
                    const userName = m.pushName || "Player";
                    
                    console.log(`Detected reply to message ${quotedId} from ${userName}: ${message}`);
                    
                    // Check if this is a reply to an active quiz question
                    const question = activeQuestions.get(quotedId);
                    if (question && !question.answered) {
                        console.log(`Processing answer for question ${quotedId}`);
                        await handleAnswer(sock, m, question, userId, userName, message);
                    }
                }
                
                // Also handle direct A,B,C,D messages in quiz chats
                if (/^[A-Da-d1-4]$/.test(message.trim())) {
                    const chatId = m.key.remoteJid;
                    const userId = m.key.participant || m.key.remoteJid;
                    const userName = m.pushName || "Player";
                    
                    // Find active question in this chat
                    const chatQuestions = Array.from(activeQuestions.values())
                        .filter(q => q.chatId === chatId && !q.answered)
                        .sort((a, b) => b.time - a.time);
                    
                    if (chatQuestions.length > 0) {
                        const question = chatQuestions[0];
                        console.log(`Direct answer in chat for question ${question.messageId}`);
                        await handleAnswer(sock, m, question, userId, userName, message);
                    }
                }
            }
        } catch (error) {
            console.error("Error in quiz message listener:", error);
        }
    });
    
    console.log("Quiz reply listener is now active!");
}

function getRandomCategory() {
    const categories = Object.keys(QUIZ_CATEGORIES);
    return categories[Math.floor(Math.random() * categories.length)];
}

async function askQuestion(sock, m, chatId, category) {
    try {
        const questionData = await fetchQuestion(category);
        
        if (!questionData) {
            return await sock.sendMessage(chatId, {
                text: "❌ Couldn't get a question. Try again!"
            }, { quoted: m });
        }
        
        // Create question object
        const question = {
            chatId,
            question: questionData.question,
            options: questionData.options,
            correctAnswer: questionData.correctAnswer,
            correctIndex: questionData.correctIndex,
            category: questionData.category,
            difficulty: questionData.difficulty,
            answers: [], // {userId, userName, answer, correct, time}
            answered: false,
            time: Date.now(),
            messageId: null,
            answeredUsers: new Set()
        };
        
        // Send question
        const questionText = formatQuestion(question);
        const questionMsg = await sock.sendMessage(chatId, {
            text: questionText
        }, { quoted: m });
        
        question.messageId = questionMsg.key.id;
        
        // Store question with message ID as key
        activeQuestions.set(questionMsg.key.id, question);
        console.log(`New question created: ${questionMsg.key.id} in chat ${chatId}`);
        console.log(`Total active questions: ${activeQuestions.size}`);
        
        // Auto-cleanup after 5 minutes
        setTimeout(async () => {
            const storedQuestion = activeQuestions.get(questionMsg.key.id);
            if (storedQuestion && !storedQuestion.answered) {
                await showFinalAnswer(sock, storedQuestion);
                activeQuestions.delete(questionMsg.key.id);
            }
        }, 300000); // 5 minutes
        
    } catch (error) {
        console.error("Ask question error:", error);
    }
}

async function fetchQuestion(category) {
    try {
        let url = 'https://opentdb.com/api.php?amount=1&type=multiple&encode=url3986';
        
        if (CATEGORY_IDS[category]) {
            url += `&category=${CATEGORY_IDS[category]}`;
        }
        
        const response = await axios.get(url, { timeout: 5000 });
        const data = response.data;
        
        if (data.response_code !== 0 || !data.results?.length) {
            return null;
        }
        
        const q = data.results[0];
        const question = decodeURIComponent(q.question);
        const correct = decodeURIComponent(q.correct_answer);
        
        // Get options
        let options = q.incorrect_answers.map(a => decodeURIComponent(a));
        options.push(correct);
        options = shuffleArray(options);
        
        const correctIndex = options.indexOf(correct);
        
        return {
            question,
            options,
            correctAnswer: correct,
            correctIndex,
            category: q.category || 'General Knowledge',
            difficulty: q.difficulty || 'medium'
        };
        
    } catch (error) {
        console.error("Fetch question error:", error);
        return null;
    }
}

function formatQuestion(question) {
    const { question: text, options, category, difficulty } = question;
    const catInfo = QUIZ_CATEGORIES[getCategoryKey(category)] || QUIZ_CATEGORIES.general;
    
    let message = `${catInfo.emoji} *${catInfo.name.toUpperCase()}* ${catInfo.emoji}\n\n`;
    message += `*${text}*\n\n`;
    
    // Options
    const letters = ['A', 'B', 'C', 'D'];
    options.forEach((opt, i) => {
        message += `${letters[i]}. ${opt}\n`;
    });
    
    message += `\n⚡ *Difficulty:* ${difficulty.toUpperCase()}`;
    message += `\n⏱️ *Answer anytime within 5 minutes!*`;
    message += `\n\n*Reply to this message with A, B, C, or D*`;
    
    return message;
}

async function handleAnswer(sock, m, question, userId, userName, userMessage) {
    console.log(`Processing answer from ${userName} to question ${question.messageId}`);
    
    if (question.answeredUsers.has(userId)) {
        console.log(`User ${userName} already answered this question`);
        await sock.sendMessage(question.chatId, {
            text: `❌ ${userName}, you already answered this question!`
        });
        return;
    }
    
    // Clean and normalize the answer
    const userAnswer = userMessage.toUpperCase().trim();
    console.log(`User answer: ${userAnswer}`);
    
    // Map answer to index (accepts both letters and numbers)
    const answerMap = { 
        'A': 0, 'B': 1, 'C': 2, 'D': 3,
        '1': 0, '2': 1, '3': 2, '4': 3 
    };
    
    const answerIndex = answerMap[userAnswer];
    
    if (answerIndex === undefined) {
        // Not a valid answer
        console.log(`Invalid answer from ${userName}: ${userAnswer}`);
        await sock.sendMessage(question.chatId, {
            text: `❌ ${userName}, please answer with A, B, C, or D (or 1, 2, 3, 4)!`
        });
        return;
    }
    
    question.answeredUsers.add(userId);
    
    const isCorrect = answerIndex === question.correctIndex;
    const answerTime = Date.now() - question.time;
    const correctLetter = ['A','B','C','D'][question.correctIndex];
    const userAnswerLetter = ['A','B','C','D'][answerIndex];
    
    // Record answer
    question.answers.push({
        userId,
        userName,
        answer: userAnswerLetter,
        correct: isCorrect,
        time: answerTime
    });
    
    // Update user stats
    const stats = userStats.get(userId);
    if (stats) {
        stats.total++;
        stats.lastActive = Date.now();
        
        if (isCorrect) {
            stats.correct++;
            stats.streak++;
            if (stats.streak > stats.bestStreak) {
                stats.bestStreak = stats.streak;
            }
        } else {
            stats.wrong++;
            stats.streak = 0;
        }
    }
    
    // Send immediate feedback
    const feedback = isCorrect 
        ? `✅ *CORRECT!* ${userName} got it right! (${userAnswerLetter})`
        : `❌ *WRONG!* ${userName}, correct answer is ${correctLetter}`;
    
    await sock.sendMessage(question.chatId, {
        text: feedback
    });
    
    // Update question message
    await updateQuestionMessage(sock, question);
}

async function updateQuestionMessage(sock, question) {
    try {
        const { question: text, options, answers, category, difficulty } = question;
        const catInfo = QUIZ_CATEGORIES[getCategoryKey(category)] || QUIZ_CATEGORIES.general;
        
        let message = `${catInfo.emoji} *${catInfo.name.toUpperCase()}* ${catInfo.emoji}\n\n`;
        message += `*${text}*\n\n`;
        
        // Options with answer counts
        const letters = ['A', 'B', 'C', 'D'];
        const correctLetter = letters[question.correctIndex];
        
        options.forEach((opt, i) => {
            const letter = letters[i];
            const answerCount = answers.filter(a => a.answer === letter).length;
            
            message += `${letter}. ${opt}`;
            if (i === question.correctIndex) message += ` ✅`;
            if (answerCount > 0) message += ` (${answerCount}👤)`;
            message += `\n`;
        });
        
        // Show who answered what
        if (answers.length > 0) {
            message += `\n📊 *Answers so far:*\n`;
            
            // Group by answer
            const answersByLetter = {};
            answers.forEach(ans => {
                if (!answersByLetter[ans.answer]) {
                    answersByLetter[ans.answer] = [];
                }
                answersByLetter[ans.answer].push(ans);
            });
            
            Object.keys(answersByLetter).sort().forEach(letter => {
                const users = answersByLetter[letter];
                const correctUsers = users.filter(u => u.correct);
                const wrongUsers = users.filter(u => !u.correct);
                
                let line = `${letter}: `;
                if (correctUsers.length > 0) {
                    line += `✅ ${correctUsers.map(u => u.userName).join(', ')}`;
                    if (wrongUsers.length > 0) {
                        line += ` | ❌ ${wrongUsers.map(u => u.userName).join(', ')}`;
                    }
                } else {
                    line += `❌ ${wrongUsers.map(u => u.userName).join(', ')}`;
                }
                
                message += `${line}\n`;
            });
        }
        
        message += `\n⚡ *Difficulty:* ${difficulty.toUpperCase()}`;
        message += `\n🎯 *Correct:* ${correctLetter}`;
        message += `\n👥 *Answered:* ${answers.length} user${answers.length !== 1 ? 's' : ''}`;
        
        const timePassed = Math.floor((Date.now() - question.time) / 1000);
        if (timePassed < 300) { // 5 minutes
            const timeLeft = 300 - timePassed;
            message += `\n⏱️ *${Math.floor(timeLeft/60)}:${(timeLeft%60).toString().padStart(2, '0')} left*`;
        }
        
        message += `\n\n*Still time to answer! Reply with A-D*`;
        
        // Try to edit the original message
        await sock.sendMessage(question.chatId, {
            text: message,
            edit: { remoteJid: question.chatId, id: question.messageId, fromMe: true }
        });
        console.log(`Updated question message ${question.messageId}`);
        
    } catch (error) {
        console.error("Update message error:", error);
    }
}

async function showFinalAnswer(sock, question) {
    try {
        const { question: text, options, answers, category } = question;
        const catInfo = QUIZ_CATEGORIES[getCategoryKey(category)] || QUIZ_CATEGORIES.general;
        const correctLetter = ['A','B','C','D'][question.correctIndex];
        
        let message = `🏁 *QUESTION ENDED* 🏁\n\n`;
        message += `${catInfo.emoji} *${catInfo.name}*\n\n`;
        message += `*${text}*\n\n`;
        
        // Final options
        options.forEach((opt, i) => {
            const letter = ['A','B','C','D'][i];
            message += `${letter}. ${opt}`;
            if (i === question.correctIndex) message += ` ✅`;
            message += `\n`;
        });
        
        message += `\n🎯 *Correct Answer:* ${correctLetter}. ${question.correctAnswer}`;
        
        // Results summary
        const correctCount = answers.filter(a => a.correct).length;
        const wrongCount = answers.filter(a => !a.correct).length;
        
        if (answers.length > 0) {
            message += `\n\n📊 *Results:*`;
            message += `\n✅ Correct: ${correctCount}`;
            message += `\n❌ Wrong: ${wrongCount}`;
            
            if (correctCount > 0) {
                const correctUsers = answers.filter(a => a.correct).map(a => a.userName);
                message += `\n\n🏆 *Winners:* ${correctUsers.join(', ')}`;
            }
        } else {
            message += `\n\n😴 *No one answered!*`;
        }
        
        message += `\n\n*New question:* .quiz`;
        
        await sock.sendMessage(question.chatId, {
            text: message,
            edit: { remoteJid: question.chatId, id: question.messageId, fromMe: true }
        });
        console.log(`Final answer shown for question ${question.messageId}`);
        
    } catch (error) {
        console.error("Final answer error:", error);
    }
}

async function showStats(sock, m, chatId, userId) {
    const stats = userStats.get(userId) || {
        correct: 0, wrong: 0, total: 0, streak: 0, bestStreak: 0
    };
    
    const accuracy = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0;
    
    let statsText = `📊 *QUIZ STATS*\n\n`;
    statsText += `✅ *Correct:* ${stats.correct}\n`;
    statsText += `❌ *Wrong:* ${stats.wrong}\n`;
    statsText += `🎯 *Total:* ${stats.total}\n`;
    statsText += `📈 *Accuracy:* ${accuracy}%\n`;
    statsText += `🔥 *Current Streak:* ${stats.streak}\n`;
    statsText += `🏆 *Best Streak:* ${stats.bestStreak}\n\n`;
    
    if (accuracy >= 80) statsText += `🎉 *Quiz Master!*`;
    else if (accuracy >= 60) statsText += `👍 *Great Job!*`;
    else if (accuracy >= 40) statsText += `👏 *Good Effort!*`;
    else statsText += `💪 *Keep Trying!*`;
    
    statsText += `\n\n*Play more:* .quiz`;
    
    await sock.sendMessage(chatId, { text: statsText }, { quoted: m });
}

async function showCategories(sock, m, chatId) {
    let categoriesText = `╭─⌈ 📚 *QUIZ CATEGORIES* ⌋\n│\n`;
    
    Object.entries(QUIZ_CATEGORIES).forEach(([key, cat]) => {
        categoriesText += `├─⊷ *${cat.emoji} ${cat.name}*\n│  └⊷ .quiz ${key}\n│\n`;
    });
    
    categoriesText += `├─⊷ *.quiz*\n│  └⊷ Random question\n│\n├─⊷ *.quiz stats*\n│  └⊷ Your stats\n│\n╰───`;
    
    await sock.sendMessage(chatId, { text: categoriesText }, { quoted: m });
}

async function showHelp(sock, m, chatId) {
    const helpText = `╭─⌈ 🎮 *INSTANT QUIZ GAME* ⌋\n│\n├─⊷ *.quiz*\n│  └⊷ Start a random quiz\n│\n├─⊷ *.quiz science/geography/etc*\n│  └⊷ Quiz by category\n│\n├─⊷ *.quiz stats*\n│  └⊷ Your statistics\n│\n├─⊷ *.quiz categories*\n│  └⊷ List all categories\n│\n├─⊷ *Answer:* Reply to any question with A-D\n├─⊷ ⏱️ 5 minutes to answer, multiple users can play\n│\n╰⊷ ${getFooter(m.key.participant || m.key.remoteJid)}`;
    
    await sock.sendMessage(chatId, { text: helpText }, { quoted: m });
}

function getCategoryKey(apiCategory) {
    const lowerCat = apiCategory.toLowerCase();
    
    if (lowerCat.includes('science')) return 'science';
    if (lowerCat.includes('geography')) return 'geography';
    if (lowerCat.includes('history')) return 'history';
    if (lowerCat.includes('sport')) return 'sports';
    if (lowerCat.includes('animal')) return 'animals';
    if (lowerCat.includes('movie') || lowerCat.includes('film')) return 'movies';
    if (lowerCat.includes('music')) return 'music';
    if (lowerCat.includes('computer') || lowerCat.includes('technology')) return 'tech';
    
    return 'general';
}

function shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

