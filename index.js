// index.js
require("dotenv").config();
const {
  Client,
  GatewayIntentBits,
  Partials,
  Events,
  ActivityType,
  PermissionFlagsBits,
  SlashCommandBuilder,
  REST,
  Routes,
  EmbedBuilder,
} = require("discord.js");
const fs = require("fs");
const path = require("path");

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID; // optional, for faster command updates

if (!TOKEN || !CLIENT_ID) {
  console.error("Missing TOKEN or CLIENT_ID in .env");
  process.exit(1);
}

const DATA_DIR = path.join(__dirname, "data");
const SETTINGS_FILE = path.join(DATA_DIR, "welcome-settings.json");
const WARN_FILE = path.join(DATA_DIR, "warnings.json");

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(SETTINGS_FILE)) fs.writeFileSync(SETTINGS_FILE, JSON.stringify({}, null, 2));
if (!fs.existsSync(WARN_FILE)) fs.writeFileSync(WARN_FILE, JSON.stringify({}, null, 2));

function readJSON(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return {};
  }
}

function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function getWelcomeSettings() {
  return readJSON(SETTINGS_FILE);
}

function setWelcomeChannel(guildId, channelId) {
  const data = getWelcomeSettings();
  data[guildId] = { channelId };
  writeJSON(SETTINGS_FILE, data);
}

function getWarnData() {
  return readJSON(WARN_FILE);
}

function addWarn(guildId, userId, reason, moderatorId) {
  const data = getWarnData();
  if (!data[guildId]) data[guildId] = {};
  if (!data[guildId][userId]) data[guildId][userId] = [];
  data[guildId][userId].push({
    reason,
    moderatorId,
    timestamp: Date.now(),
  });
  writeJSON(WARN_FILE, data);
  return data[guildId][userId].length;
}

function getWarns(guildId, userId) {
  const data = getWarnData();
  return data[guildId]?.[userId] || [];
}

function clearWarns(guildId, userId) {
  const data = getWarnData();
  if (data[guildId]?.[userId]) {
    delete data[guildId][userId];
    writeJSON(WARN_FILE, data);
    return true;
  }
  return false;
}

const commands = [
  new SlashCommandBuilder()
    .setName("welcome-channel")
    .setDescription("Set the welcome channel for this server.")
    .addChannelOption(option =>
      option
        .setName("channel")
        .setDescription("Choose a text channel")
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  new SlashCommandBuilder()
    .setName("welcome-test")
    .setDescription("Send a test welcome message.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  new SlashCommandBuilder()
    .setName("purge")
    .setDescription("Delete a number of messages.")
    .addIntegerOption(option =>
      option
        .setName("amount")
        .setDescription("How many messages to delete")
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(100)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  new SlashCommandBuilder()
    .setName("kick")
    .setDescription("Kick a member.")
    .addUserOption(option =>
      option.setName("user").setDescription("User to kick").setRequired(true)
    )
    .addStringOption(option =>
      option.setName("reason").setDescription("Reason for kick")
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),

  new SlashCommandBuilder()
    .setName("ban")
    .setDescription("Ban a member.")
    .addUserOption(option =>
      option.setName("user").setDescription("User to ban").setRequired(true)
    )
    .addStringOption(option =>
      option.setName("reason").setDescription("Reason for ban")
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

  new SlashCommandBuilder()
    .setName("timeout")
    .setDescription("Timeout a member.")
    .addUserOption(option =>
      option.setName("user").setDescription("User to timeout").setRequired(true)
    )
    .addIntegerOption(option =>
      option
        .setName("minutes")
        .setDescription("Timeout length in minutes")
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(40320)
    )
    .addStringOption(option =>
      option.setName("reason").setDescription("Reason for timeout")
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  new SlashCommandBuilder()
    .setName("untimeout")
    .setDescription("Remove a member timeout.")
    .addUserOption(option =>
      option.setName("user").setDescription("User to untimeout").setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  new SlashCommandBuilder()
    .setName("warn")
    .setDescription("Warn a member.")
    .addUserOption(option =>
      option.setName("user").setDescription("User to warn").setRequired(true)
    )
    .addStringOption(option =>
      option.setName("reason").setDescription("Reason for warning").setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  new SlashCommandBuilder()
    .setName("warnings")
    .setDescription("Show warnings for a member.")
    .addUserOption(option =>
      option.setName("user").setDescription("User to check").setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  new SlashCommandBuilder()
    .setName("clearwarnings")
    .setDescription("Clear all warnings for a member.")
    .addUserOption(option =>
      option.setName("user").setDescription("User to clear").setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
].map(cmd => cmd.toJSON());

async function registerCommands() {
  const rest = new REST({ version: "10" }).setToken(TOKEN);

  try {
    if (GUILD_ID) {
      await rest.put(
        Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
        { body: commands }
      );
      console.log("Registered guild commands.");
    } else {
      await rest.put(
        Routes.applicationCommands(CLIENT_ID),
        { body: commands }
      );
      console.log("Registered global commands.");
    }
  } catch (err) {
    console.error("Failed to register commands:", err);
  }
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel],
});

client.once(Events.ClientReady, async () => {
  console.log(`Logged in as ${client.user.tag}`);

  client.user.setPresence({
    status: "idle",
    activities: [
      {
        name: "Audioquack! - Canary Bot",
        type: ActivityType.Listening,
      },
    ],
  });

  await registerCommands();
});

client.on(Events.GuildMemberAdd, async (member) => {
  const settings = getWelcomeSettings();
  const guildConfig = settings[member.guild.id];
  if (!guildConfig?.channelId) return;

  const channel = member.guild.channels.cache.get(guildConfig.channelId);
  if (!channel || !channel.isTextBased()) return;

  const embed = new EmbedBuilder()
    .setColor(0x2ecc71)
    .setTitle("Welcome!")
    .setDescription(`Hey ${member}, welcome to **${member.guild.name}**!`)
    .addFields(
      { name: "Member", value: `${member.user.tag}`, inline: true },
      { name: "Server Members", value: `${member.guild.memberCount}`, inline: true }
    )
    .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
    .setTimestamp();

  channel.send({ content: `${member}`, embeds: [embed] }).catch(() => {});
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  try {
    if (interaction.commandName === "welcome-channel") {
      const channel = interaction.options.getChannel("channel", true);

      if (!channel.isTextBased()) {
        return interaction.reply({
          content: "Please choose a text channel.",
          ephemeral: true,
        });
      }

      setWelcomeChannel(interaction.guildId, channel.id);

      return interaction.reply({
        content: `Welcome channel set to ${channel}.`,
        ephemeral: true,
      });
    }

    if (interaction.commandName === "welcome-test") {
      const settings = getWelcomeSettings();
      const guildConfig = settings[interaction.guildId];

      if (!guildConfig?.channelId) {
        return interaction.reply({
          content: "No welcome channel has been set yet.",
          ephemeral: true,
        });
      }

      const channel = interaction.guild.channels.cache.get(guildConfig.channelId);
      if (!channel || !channel.isTextBased()) {
        return interaction.reply({
          content: "The saved welcome channel is invalid.",
          ephemeral: true,
        });
      }

      const embed = new EmbedBuilder()
        .setColor(0x2ecc71)
        .setTitle("Welcome!")
        .setDescription(`Hey ${interaction.user}, welcome to **${interaction.guild.name}**!`)
        .setThumbnail(interaction.user.displayAvatarURL({ size: 256 }))
        .setTimestamp();

      await channel.send({ content: `${interaction.user}`, embeds: [embed] });

      return interaction.reply({
        content: `Test welcome sent in ${channel}.`,
        ephemeral: true,
      });
    }

    if (interaction.commandName === "purge") {
      const amount = interaction.options.getInteger("amount", true);

      const deleted = await interaction.channel.bulkDelete(amount, true).catch(() => null);
      if (!deleted) {
        return interaction.reply({
          content: "I could not delete those messages.",
          ephemeral: true,
        });
      }

      return interaction.reply({
        content: `Deleted ${deleted.size} messages.`,
        ephemeral: true,
      });
    }

    if (interaction.commandName === "kick") {
      const user = interaction.options.getUser("user", true);
      const reason = interaction.options.getString("reason") || "No reason provided";
      const member = await interaction.guild.members.fetch(user.id).catch(() => null);

      if (!member) {
        return interaction.reply({
          content: "That user is not in this server.",
          ephemeral: true,
        });
      }

      await member.kick(reason);
      return interaction.reply({
        content: `${user.tag} was kicked. Reason: ${reason}`,
        ephemeral: true,
      });
    }

    if (interaction.commandName === "ban") {
      const user = interaction.options.getUser("user", true);
      const reason = interaction.options.getString("reason") || "No reason provided";

      await interaction.guild.members.ban(user.id, { reason });
      return interaction.reply({
        content: `${user.tag} was banned. Reason: ${reason}`,
        ephemeral: true,
      });
    }

    if (interaction.commandName === "timeout") {
      const user = interaction.options.getUser("user", true);
      const minutes = interaction.options.getInteger("minutes", true);
      const reason = interaction.options.getString("reason") || "No reason provided";
      const member = await interaction.guild.members.fetch(user.id).catch(() => null);

      if (!member) {
        return interaction.reply({
          content: "That user is not in this server.",
          ephemeral: true,
        });
      }

      await member.timeout(minutes * 60 * 1000, reason);
      return interaction.reply({
        content: `${user.tag} was timed out for ${minutes} minute(s). Reason: ${reason}`,
        ephemeral: true,
      });
    }

    if (interaction.commandName === "untimeout") {
      const user = interaction.options.getUser("user", true);
      const member = await interaction.guild.members.fetch(user.id).catch(() => null);

      if (!member) {
        return interaction.reply({
          content: "That user is not in this server.",
          ephemeral: true,
        });
      }

      await member.timeout(null);
      return interaction.reply({
        content: `${user.tag} timeout removed.`,
        ephemeral: true,
      });
    }

    if (interaction.commandName === "warn") {
      const user = interaction.options.getUser("user", true);
      const reason = interaction.options.getString("reason", true);
      const count = addWarn(interaction.guildId, user.id, reason, interaction.user.id);

      return interaction.reply({
        content: `${user.tag} has been warned.\nReason: ${reason}\nTotal warnings: ${count}`,
        ephemeral: true,
      });
    }

    if (interaction.commandName === "warnings") {
      const user = interaction.options.getUser("user", true);
      const warns = getWarns(interaction.guildId, user.id);

      if (!warns.length) {
        return interaction.reply({
          content: `${user.tag} has no warnings.`,
          ephemeral: true,
        });
      }

      const list = warns
        .map((w, i) => `**${i + 1}.** ${w.reason} — <@${w.moderatorId}>`)
        .join("\n");

      return interaction.reply({
        content: `Warnings for ${user.tag}:\n${list}`,
        ephemeral: true,
      });
    }

    if (interaction.commandName === "clearwarnings") {
      const user = interaction.options.getUser("user", true);
      const removed = clearWarns(interaction.guildId, user.id);

      return interaction.reply({
        content: removed
          ? `Cleared warnings for ${user.tag}.`
          : `${user.tag} had no warnings to clear.`,
        ephemeral: true,
      });
    }
  } catch (err) {
    console.error(err);
    if (!interaction.replied) {
      return interaction.reply({
        content: "Something went wrong while running that command.",
        ephemeral: true,
      });
    }
  }
});

client.login(TOKEN);
