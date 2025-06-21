require("dotenv").config();
const { Client, GatewayIntentBits, Events } = require("discord.js");
const express = require("express");

// === Discord Bot Setup ===
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const TOKEN = process.env.TOKEN;
const SEARCH_TIMEOUT = 20 * 60 * 1000; // 20 minutes

// === Replace these with your actual role IDs ===
const REMOTE_ROLE_ID = "1336110557564108851"; // @remotefight
const UNTAP_ROLE_ID = "1336110608092893197"; // @untap

// === Matchmaking Queues ===
const queues = {
  casual: new Map(), // @fight
  remote: new Map(), // @fight remote
  untap: new Map(), // @fight untap
};

// === Express Web Server for Replit Keep-Alive ===
const app = express();
app.get("/", (req, res) => res.send("Bot is alive!"));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🌐 Web server running on port ${PORT}`));

// === Timeout Cleaner ===
setInterval(() => {
  const now = Date.now();
  for (const [type, queue] of Object.entries(queues)) {
    for (const [userId, joinedAt] of queue.entries()) {
      if (now - joinedAt >= SEARCH_TIMEOUT) {
        queue.delete(userId);
        client.guilds.cache.forEach((guild) => {
          const member = guild.members.cache.get(userId);
          const systemChannel = guild.systemChannel;
          if (member && systemChannel) {
            systemChannel
              .send(
                `<@${userId}>, the reception has been cancelled because a certain amount of time has passed. ` +
                  `Please mention the bot one more time if you wish to keep searching for a game.`
              )
              .catch(() => {});
          }
        });
      }
    }
  }
}, 60 * 1000);

// === Bot Ready ===
client.once(Events.ClientReady, () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

// === Message Handler ===
client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;
  if (!message.mentions.has(client.user)) return;

  const content = message.content.toLowerCase();
  const userId = message.author.id;
  const now = Date.now();

  // === Determine queue and role mention based on keywords ===
  let queueType = "casual";
  let matchTag = "@here";

  if (content.includes("remote")) {
    queueType = "remote";
    matchTag = `<@&${REMOTE_ROLE_ID}>`;
  } else if (content.includes("untap")) {
    queueType = "untap";
    matchTag = `<@&${UNTAP_ROLE_ID}>`;
  }

  const thisQueue = queues[queueType];

  // === Cancel if already in this queue
  if (thisQueue.has(userId)) {
    thisQueue.delete(userId);
    await message.channel.send(
      `<@${userId}>, your search has been **cancelled**.`
    );
    return;
  }

  // === Try to match with someone in the same queue
  for (const [opponentId] of thisQueue.entries()) {
    if (opponentId !== userId) {
      thisQueue.delete(opponentId);

      const first = Math.random() < 0.5 ? userId : opponentId;
      const second = first === userId ? opponentId : userId;

      await message.channel.send(
        `<@${first}>, we found a bf game for you. <@${second}> <@${first}> please proceed to your game. ` +
          `<@${first}> will go first. Please message each other directly from this point on. Enjoy!`
      );
      return;
    }
  }

  // === No match found, add user to queue
  thisQueue.set(userId, now);
  await message.channel.send(
    `<@${userId}> is looking for a bf game ${matchTag}\n` +
      `<@${userId}>, please mention the bot one more time if you wish to cancel your search request.`
  );
});

client.login(TOKEN);
