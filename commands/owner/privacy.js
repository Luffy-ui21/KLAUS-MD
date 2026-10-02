import fs from 'fs';
import { getArchivedList, getMutedList, getPinnedList, getFavouritesList } from '../../lib/chat-state.js';
import { getOwnerName, getFooter} from '../../lib/menuHelper.js';

export default {
    name: 'privacy',
    alias: ['privacysettings', 'myprivacy', 'privacyinfo'],
    category: 'owner',
    description: 'View WhatsApp privacy settings and chat management status',
    ownerOnly: true,

    async execute(sock, msg, args, PREFIX, extra) {
        const chatId = msg.key.remoteJid;
        const { jidManager } = extra;

        const isSudoUser = extra?.isSudo ? extra.isSudo() : false;
        if (!jidManager.isOwner(msg) && !isSudoUser) {
            return sock.sendMessage(chatId, {
                text: '❌ *Owner Only Command*'
            }, { quoted: msg });
        }

        try {
            await sock.sendMessage(chatId, { react: { text: '🔒', key: msg.key } });
        } catch {}

        try {
            let privacySettings = {};
            try {
                privacySettings = await sock.fetchPrivacySettings(true);
            } catch {
                try {
                    privacySettings = await sock.fetchPrivacySettings();
                } catch {}
            }

            const presenceConfig = { enabled: false };
            try {
                if (fs.existsSync('./data/presence/config.json')) {
                    Object.assign(presenceConfig, JSON.parse(fs.readFileSync('./data/presence/config.json', 'utf8')));
                }
            } catch {}

            const formatSetting = (value) => {
                if (!value) return '❓ Unknown';
                switch (value.toString().toLowerCase()) {
                    case 'all': return '🌍 Everyone';
                    case 'contacts': return '👥 My Contacts';
                    case 'contact_blacklist': return '🚫 Contacts Except...';
                    case 'none': return '🔒 Nobody';
                    case 'match_last_seen': return '🔄 Match Last Seen';
                    default: return `⚙️ ${value}`;
                }
            };

            const lastSeen = privacySettings.last || privacySettings.lastSeen || 'Unknown';
            const profilePic = privacySettings.profile || privacySettings.profilePicture || 'Unknown';
            const statusPrivacy = privacySettings.status || privacySettings.statusPrivacy || 'Unknown';
            const readReceipts = privacySettings.readreceipts || privacySettings.readReceipts || 'Unknown';
            const groupAdd = privacySettings.groupadd || privacySettings.groupAdd || 'Unknown';
            const onlineStatus = privacySettings.online || privacySettings.onlinePrivacy || 'Unknown';

            const archived = getArchivedList();
            const muted = getMutedList();
            const pinned = getPinnedList();
            const favourites = getFavouritesList();

            let text = `╭─⌈ 🔒 *PRIVACY & CHAT SETTINGS* ⌋\n│\n`;
            text += `├─⌈ 👁️ *PRIVACY SETTINGS* ⌋\n│\n`;
            text += `├─⊷ *👁️ Last Seen*\n`;
            text += `│  └⊷ ${formatSetting(lastSeen)}\n│\n`;
            text += `├─⊷ *🟢 Online Status*\n`;
            text += `│  └⊷ ${formatSetting(onlineStatus)}\n│\n`;
            text += `├─⊷ *🖼️ Profile Picture*\n`;
            text += `│  └⊷ ${formatSetting(profilePic)}\n│\n`;
            text += `├─⊷ *📊 Status Visibility*\n`;
            text += `│  └⊷ ${formatSetting(statusPrivacy)}\n│\n`;
            text += `├─⊷ *✅ Read Receipts*\n`;
            text += `│  └⊷ ${readReceipts === 'all' || readReceipts === true ? '🟢 ON' : readReceipts === 'none' || readReceipts === false ? '🔴 OFF' : formatSetting(readReceipts)}\n│\n`;
            text += `├─⊷ *👥 Group Add*\n`;
            text += `│  └⊷ ${formatSetting(groupAdd)}\n│\n`;
            text += `├─⊷ *🟢 Always Online Bot*\n`;
            text += `│  └⊷ ${presenceConfig.enabled ? '✅ ACTIVE' : '❌ INACTIVE'}\n│\n`;

            text += `├─⌈ 💬 *CHAT MANAGEMENT* ⌋\n│\n`;
            text += `├─⊷ *📌 Pinned Groups:* ${pinned.length}\n`;
            text += `├─⊷ *🔕 Muted Groups:* ${muted.length}\n`;
            text += `├─⊷ *📦 Archived Groups:* ${archived.length}\n`;
            text += `├─⊷ *⭐ Favourite Groups:* ${favourites.length}\n│\n`;

            text += `├─⌈ 🔧 *QUICK COMMANDS* ⌋\n│\n`;
            text += `│ *Privacy:*\n`;
            text += `│ • \`${PREFIX}online\` - Toggle always online\n`;
            text += `│ • \`${PREFIX}onlineprivacy\` - Who sees Online status\n`;
            text += `│ • \`${PREFIX}lastseen\` - Last seen privacy\n`;
            text += `│ • \`${PREFIX}receipt\` - Toggle read receipts\n`;
            text += `│ • \`${PREFIX}profilepic\` - Profile pic privacy\n`;
            text += `│ • \`${PREFIX}viewer\` - Status viewer privacy\n`;
            text += `│ • \`${PREFIX}groupadd\` - Who can add you to groups\n│\n`;
            text += `│ *Chat Management:*\n`;
            text += `│ • \`${PREFIX}archive\` - Archive/unarchive group\n`;
            text += `│ • \`${PREFIX}notifications\` - Mute/unmute group\n`;
            text += `│ • \`${PREFIX}pingroup\` - Pin group to top\n`;
            text += `│ • \`${PREFIX}unpingroup\` - Unpin group\n`;
            text += `│ • \`${PREFIX}addtofavourite\` - Add to favourites\n`;
            text += `│ • \`${PREFIX}removefromfavourite\` - Remove from favs\n│\n`;
            text += `│ *Message Actions:*\n`;
            text += `│ • \`${PREFIX}pin\` - Pin a replied message\n`;
            text += `│ • \`${PREFIX}unpin\` - Unpin a message\n`;
            text += `│ • \`${PREFIX}star\` - Star a replied message\n`;
            text += `│ • \`${PREFIX}unstar\` - Unstar a message\n│\n`;
            text += `│ *Listings:*\n`;
            text += `│ • \`${PREFIX}pinnedgroups\` - List pinned groups\n`;
            text += `│ • \`${PREFIX}mutedgroups\` - List muted groups\n`;
            text += `│ • \`${PREFIX}archivedgroups\` - List archived groups\n`;
            text += `│ • \`${PREFIX}starredchats\` - List favourite groups\n│\n`;
            text += `╰⊷ ${getFooter(msg.key.participant || msg.key.remoteJid)}`;

            await sock.sendMessage(chatId, { text }, { quoted: msg });

        } catch (error) {
            console.error('[Privacy] Error:', error);
            await sock.sendMessage(chatId, {
                text: `❌ *Failed to fetch privacy settings*\n\n${error.message}`
            }, { quoted: msg });
        }
    }
};
