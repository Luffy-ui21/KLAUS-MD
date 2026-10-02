import fetch from 'node-fetch';
import { getOwnerName, getFooter} from '../../lib/menuHelper.js';

const dareCategories = {
    general: 'https://api.truthordarebot.xyz/v1/dare',
    challenge: 'https://api.truthordarebot.xyz/api/paranoia'
};

const thumbnailUrl = 'https://i.ibb.co/gFhF4kdz/wolf-jpg.jpg'; // Corrected image URL

const backupDares = [
    "Do your best impression of a celebrity",
    "Sing a song loudly for 30 seconds",
    "Dance without music for 1 minute",
    "Talk in an accent for the next 3 rounds",
    "Do 20 pushups right now",
    "Text your crush 'I like you'",
    "Eat a spoonful of a condiment you dislike",
    "Wear your clothes backwards for the next hour"
];

export default {
    name: "dare",
    alias: ["d"],
    desc: "Get a random dare challenge",
    category: "games",
    usage: `.dare - Random dare\n.dare challenge - Harder dare\n.dare rating=pg/pg13/r - Set rating`,
    
    async execute(sock, m, args) {
        try {
            const chatId = m.key.remoteJid;
            const userName = m.pushName || "Friend";
            
            const category = args[0]?.toLowerCase() || 'general';
            let rating = 'pg';
            
            // Check for rating parameter
            args.forEach(arg => {
                if (arg.startsWith('rating=')) {
                    rating = arg.split('=')[1];
                }
            });
            
            if (category === 'help') {
                return await sock.sendMessage(chatId, {
                    text: `╭─⌈ 🎯 *DARE COMMANDS* ⌋\n│\n├─⊷ *.dare*\n│  └⊷ Random dare\n│\n├─⊷ *.dare challenge*\n│  └⊷ Hard dare\n│\n├─⊷ *.dare rating=pg*\n│  └⊷ Family friendly\n│\n├─⊷ *.dare rating=pg13*\n│  └⊷ Teen\n│\n├─⊷ *.dare rating=r*\n│  └⊷ Adult (18+)\n│\n╰⊷ ${getFooter(m.key.participant || m.key.remoteJid)}`
                }, { quoted: m });
            }
            
            // Get a dare challenge
            const dare = await getDare(category, rating);
            
            if (!dare) {
                return await sock.sendMessage(chatId, {
                    text: "❌ Could not get a dare challenge. Try again!"
                }, { quoted: m });
            }
            
            // Send with thumbnail image as caption
            const caption = formatDareCaption(dare, userName, category, rating);
            
            return await sock.sendMessage(chatId, {
                image: { url: thumbnailUrl },
                caption: caption
            }, { quoted: m });
            
        } catch (error) {
            console.error("Dare error:", error);
            // If image fails, send text only
            const chatId = m.key.remoteJid;
            const userName = m.pushName || "Friend";
            const category = args[0]?.toLowerCase() || 'general';
            let rating = 'pg';
            
            args.forEach(arg => {
                if (arg.startsWith('rating=')) {
                    rating = arg.split('=')[1];
                }
            });
            
            const dare = await getDare(category, rating);
            
            if (dare) {
                await sock.sendMessage(chatId, {
                    text: formatDareCaption(dare, userName, category, rating)
                }, { quoted: m });
            }
        }
    }
};

async function getDare(category, rating) {
    const apiUrl = getApiUrl(category, rating);
    
    if (apiUrl) {
        try {
            const response = await fetch(apiUrl, {
                headers: { 'Accept': 'application/json' },
                timeout: 5000
            });
            
            if (response.ok) {
                const data = await response.json();
                return data.question || data.text || null;
            }
        } catch (error) {
            console.error("API error, using local dares:", error);
        }
    }
    
    // Fallback to local dares
    return backupDares[Math.floor(Math.random() * backupDares.length)];
}

function getApiUrl(category, rating) {
    const ratingParam = rating ? `?rating=${rating}` : '';
    
    const categoryMap = {
        'general': `${dareCategories.general}${ratingParam}`,
        'normal': `${dareCategories.general}${ratingParam}`,
        'standard': `${dareCategories.general}${ratingParam}`,
        'challenge': `${dareCategories.challenge}${ratingParam}`,
        'hard': `${dareCategories.challenge}${ratingParam}`,
        'extreme': `${dareCategories.challenge}${ratingParam}`
    };
    
    return categoryMap[category] || `${dareCategories.general}${ratingParam}`;
}

function formatDareCaption(dare, userName, category, rating) {
    const categoryNames = {
        'general': 'Dare',
        'challenge': 'Challenge',
        'hard': 'Hard Dare',
        'extreme': 'Extreme Dare'
    };
    
    const ratingEmojis = {
        'pg': '🟢',
        'pg13': '🟡',
        'r': '🔴'
    };
    
    const catName = categoryNames[category] || 'Dare';
    const ratingEmoji = ratingEmojis[rating] || '🟢';
    
    return `🔥 *${catName} Challenge*\n\n"${dare}"\n\n👤 For: ${userName}\n📊 Rating: ${rating.toUpperCase()} ${ratingEmoji}\n\nComplete the dare!`;
}