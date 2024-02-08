
const fs = require('fs/promises');
const { Client, GatewayIntentBits, ChannelType, PermissionsBitField, Events, Collection, MessageFlagsBitField } = require('discord.js');
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildMessageTyping,
    GatewayIntentBits.MessageContent
  ]
});

const ADMIN_USER_ID = "798724675772612639";

// BREAKOUT ROOMS

const MATCHMAKING_CHANNEL_ID = "1121331806768201808";
const MATCHMAKING_MESSAGE_ID = "1121332210834874439";
const SUGGESTIONS_CHANNEL_ID = "1115699394210181130";
const MODERATOR_ROLE_ID = "1117927479764582411";
var matchmaking;

var BreakoutRoomJSON = {};

client.on('ready', async () => {
  console.log(`Logged in as ${client.user.tag}!`);

  // Delete messages
  matchmaking = client.channels.cache.get(MATCHMAKING_CHANNEL_ID);
  matchmaking.permissionOverwrites.edit(matchmaking.guild.id, {
    SendMessages: true
  });
  var messages = await getAllMessages(matchmaking);

  var count = 0;
  for (var i = messages.length - 1; i >= 0; i--) {
    if (messages[i].id == MATCHMAKING_MESSAGE_ID) continue;
    await messages[i].delete();
    console.log(`Deleted:\n${messages[i].content}\n\tby ${messages[i].author.username}`);
    count++;
  }

  console.log(`${count} messages successfully deleted!`);

  // Load channels
  const data = await fs.readFile('./data.json');
  BreakoutRoomJSON = JSON.parse(data);

  for (var id in BreakoutRoomJSON) {
    const json = BreakoutRoomJSON[id];
    const guild = await client.guilds.fetch(json.guild);
    const user = await client.users.fetch(json.owner);
    var room = new DiscordBreakoutRoom(user, guild);
    room.channel = await client.channels.fetch(json.id);
    if (json.voice_id) room.voicechannel = await client.channels.fetch(json.voice_id);
    room.name = json.name;
    room.ispublic = json.ispublic;
    room.members = [];
    for (var i = 0; i < json.members.length; i++) {
      var m = await client.users.fetch(json.members[i])
      room.members.push(m);
    }
    BreakoutRooms[json.id] = room;
    room.updateJSON();
    console.log(`Successfully reopened room(${room.name})`);
  }

  // Order
  orderByReactions(SUGGESTIONS_CHANNEL_ID);
});

var BreakoutRooms = {};

class DiscordBreakoutRoom {
  constructor(user, guild) {
    this.owner = user;
    this.members = [this.owner];
    this.guild = guild;
    this.channel = false;
    this.voicechannel = false;
    this.ispublic = false;
  }
  async open(interaction) {
    this.name = interaction.options.getString('name');
    const channelName = "room-" + this.name;
    this.channel = await this.guild.channels.create({
      name: channelName,
      type: ChannelType.GuildText,
      permissionOverwrites: [
        {
          id: this.guild.roles.everyone.id,
          deny: [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.CreatePublicThreads,
            PermissionsBitField.Flags.CreatePrivateThreads,
            PermissionsBitField.Flags.SendMessagesInThreads,
            PermissionsBitField.Flags.UseApplicationCommands
          ]
        },
        {
          id: this.owner.id,
          allow: [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.SendMessages,
            PermissionsBitField.Flags.UseApplicationCommands,
            PermissionsBitField.Flags.ManageMessages
          ]
        },
        {
          id: MODERATOR_ROLE_ID,
          allow: [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.SendMessages,
            PermissionsBitField.Flags.UseApplicationCommands,
            PermissionsBitField.Flags.ManageMessages
          ]
        }
      ],
      reason: 'New room created by user',
      parent: interaction.channel.parentId
    });
    BreakoutRooms[this.channel.id] = this;
    interaction.reply({
      content: 'Opened new breakout room!',
      ephemeral: true
    });
    this.updateJSON();
    console.log(`${this.owner.username} opened room(${this.name})`);
  }
  rename(interaction) {
    const name = interaction.options.getString('name');
    console.log(`Room(${this.name}) has been renamed to Room(${name})`);
    this.name = name;
    this.channel.setName("room-" + name);
    if (this.voicechannel) this.voicechannel.setName("voiceroom-" + name);
    interaction.reply('Renamed breakout room to ' + name);
    this.updateJSON();
  }
  add(interaction) {
    var user = interaction.options.getUser('user');
    this.members.push(user);
    this.channel.permissionOverwrites.edit(user.id, {
      ViewChannel: true,
      SendMessages: true,
      UseApplicationCommands: true
    });
    if (this.voicechannel) this.voicechannel.permissionOverwrites.edit(user.id, {
      ViewChannel: true,
      SendMessages: false
    });
    interaction.reply(user.username + " added.");
    this.updateJSON();
    console.log(`${user.username} has been added to Room(${this.name})`);
  }
  remove(interaction) {
    var user = interaction.options.getUser('user');
    var index = this.members.indexOf(user);
    this.members.splice(index, 1);
    this.channel.permissionOverwrites.edit(user.id, {
      ViewChannel: false,
      SendMessages: false,
      UseApplicationCommands: false
    });
    if (this.voicechannel) this.voicechannel.permissionOverwrites.edit(user.id, {
      ViewChannel: false
    });
    interaction.reply(user.username + " removed.");
    this.updateJSON();
    console.log(`${user.username} has been removed from Room(${this.name})`);
  }
  leave(interaction) {
    var user = interaction.user;
    if (user == this.owner) {
      interaction.reply({
        content: 'You can not leave this breakout room because you started it. In order to leave you must /close the breakout room.',
        ephemeral: true
      });
      return;
    }
    var index = this.members.indexOf(user);
    this.members.splice(index, 1);
    this.channel.permissionOverwrites.edit(user.id, {
      ViewChannel: false,
      SendMessages: false,
      UseApplicationCommands: false
    });
    if (this.voicechannel) this.voicechannel.permissionOverwrites.edit(user.id, {
      ViewChannel: false
    });
    interaction.reply(user.username + ' left.');
    this.updateJSON();
    console.log(`${user.username} has left Room(${this.name})`);
  }
  async voice(interaction) {
    if (this.voicechannel) {
      interaction.reply({
        content: 'You can not create a voice channel for this room since one already exists. You must first /stopvoice if you want to make another.',
        ephemeral: true
      });
      return;
    }
    const name = "voiceroom-" + this.name;
    var overwrites = [
      {
        id: this.guild.roles.everyone.id,
        deny: (this.ispublic ? [
          PermissionsBitField.Flags.SendMessages
        ] : [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.SendMessages
        ]),
      },
      {
        id: MODERATOR_ROLE_ID,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.SendMessages
        ]
      }
    ].concat(this.members.map((member) => {
      return {
        id: member.id,
        allow: [PermissionsBitField.Flags.ViewChannel],
        deny: [PermissionsBitField.Flags.SendMessages],
      };
    }));
    this.voicechannel = await this.guild.channels.create({
      name: name,
      type: ChannelType.GuildVoice,
      parent: this.channel.parentId,
      permissionOverwrites: overwrites,
    });
    //await members.forEach(async member => {
    //  await member.voice.setChannel(this.voicechannel);
    //});
    interaction.reply('Created voice channel for this room.');
    this.updateJSON();
    console.log(`Opened voice for room(${this.name})`);
  }
  stopvoice(interaction) {
    if (!this.voicechannel) {
      interaction.reply({
        content: 'Could not stop the voice channel because there is no voice channel for this room.',
        ephemeral: true
      });
      return;
    }
    this.voicechannel.delete();
    this.voicechannel = false;
    interaction.reply('Stopped voice channel for this room.');
    this.updateJSON();
    console.log(`Closed voice for room(${this.name})`);
  }
  public(interaction) {
    if (this.ispublic) {
      interaction.reply({
        content: 'Channel already public.',
        ephemeral: true
      });
      return;
    }
    this.ispublic = true;
    this.channel.permissionOverwrites.edit(this.guild.id, {
      ViewChannel: true,
      SendMessages: true
    });
    if (this.voicechannel) this.voicechannel.permissionOverwrites.edit(this.guild.id, {
      ViewChannel: true,
      SendMessages: false
    });
    interaction.reply('Opened room to public.');
    this.updateJSON();
    console.log(`Room(${this.name}) is now public`);
  }
  private(interaction) {
    if (!this.ispublic) {
      interaction.reply({
        content: 'Channel already private.',
        ephemeral: true
      });
      return;
    }
    this.ispublic = false;
    this.channel.permissionOverwrites.edit(this.guild.id, {
      ViewChannel: false,
      SendMessages: false
    });
    if (this.voicechannel) this.voicechannel.permissionOverwrites.edit(this.guild.id, {
      ViewChannel: false
    });
    interaction.reply('Closed room to private.');
    this.updateJSON();
    console.log(`Room(${this.name}) is now private`);
  }
  close(interaction) {
    delete BreakoutRooms[this.channel.id];
    delete BreakoutRoomJSON[this.channel.id];
    fs.writeFile('./data.json', JSON.stringify(BreakoutRoomJSON, null, 2));
    this.channel.delete();
    if (this.voicechannel) this.voicechannel.delete();
    interaction.reply('Closed room.');
    console.log(`Closed room(${this.name})`);
  }
  async updateJSON() {
    BreakoutRoomJSON[this.channel.id] = {
      name: this.name,
      owner: this.owner.id,
      guild: this.guild.id,
      members: this.members.map(m => m.id),
      id: this.channel.id,
      voice_id: false,
      ispublic: this.ispublic
    }
    if (this.voicechannel) BreakoutRoomJSON[this.channel.id].voice_id = this.voicechannel.id;
    fs.writeFile('./data.json', JSON.stringify(BreakoutRoomJSON, null, 2));
  }
}

client.commands = new Collection();
client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand()) return;
  const name = interaction.commandName;

  const isMod = !interaction.member._roles.some(role => role.id == MODERATOR_ROLE_ID);

  if (isMod) {
    if (name == "closeall") {
      for (var id in BreakoutRooms) {
        BreakoutRooms[id].channel.delete();
        if (BreakoutRooms[id].voicechannel) BreakoutRooms[id].voicechannel.delete();
      }
      BreakoutRooms = {};
      BreakoutRoomJSON = {};
      fs.writeFile('./data.json', JSON.stringify(BreakoutRoomJSON, null, 2));
      interaction.reply({
        content: 'Closed all rooms',
        ephemeral: true
      });
      console.log(`Closed all rooms`);
      return;
    }
  }

  if (name == "room") {
    if (interaction.channel.id != MATCHMAKING_CHANNEL_ID) {
      interaction.reply({
        content: 'This command can only be used in matchmaking.',
        ephemeral: true
      });
      return;
    }
    var room = new DiscordBreakoutRoom(interaction.user, interaction.guild).open(interaction);
    return;
  }

  var room = BreakoutRooms[interaction.channel.id];
  if (!room) {
    interaction.reply({
      content: 'This command can only be used in a breakout room.',
      ephemeral: true
    });
    return;
  }

  if (name == "add") { room.add(interaction); return; }
  if (name == "leave") { room.leave(interaction); return; }

  if (room.owner.id != interaction.user.id && !isMod) {
    interaction.reply({
      content: 'This command can only be used by the creator of a breakout room.',
      ephemeral: true
    });
    return;
  }

  if (name == "rename") { room.rename(interaction); return; }
  if (name == "remove") { room.remove(interaction); return; }
  if (name == "voice") { room.voice(interaction); return; }
  if (name == "stopvoice") { room.stopvoice(interaction); return; }
  if (name == "public") { room.public(interaction); return; }
  if (name == "private") { room.private(interaction); return; }
  if (name == "close") { room.close(interaction); return; }

  console.error(`No command matching ${name} was found.`);
});

client.on(Events.MessageCreate, msg => {
  if (msg.system == true && msg.author.id == client.user.id && msg.channel.parentId == SUGGESTIONS_CHANNEL_ID) {
    msg.type = 0;
    msg.system = false;
    //msg.delete();
    return;
  }
  if (msg.channel.parentId == SUGGESTIONS_CHANNEL_ID && msg.author.id != client.user.id) {
    if (sorting) querySort = true;
    else orderByReactions(SUGGESTIONS_CHANNEL_ID);
    return;
  }
  if (msg.channel.id == MATCHMAKING_CHANNEL_ID && msg.author.id != process.env.CLIENT_ID) {
    console.log(`Deleted:\n${msg.content}\n\tby ${msg.author.username}`);
    msg.delete();
    return;
  }
});

client.on(Events.MessageReactionAdd, reaction => {
  if (reaction.message.channel.parentId == SUGGESTIONS_CHANNEL_ID) {
    if (sorting) querySort = true;
    else orderByReactions(SUGGESTIONS_CHANNEL_ID);
  }
});
client.on(Events.MessageReactionRemove, reaction => {
  if (reaction.message.channel.parentId == SUGGESTIONS_CHANNEL_ID) {
    if (sorting) querySort = true;
    else orderByReactions(SUGGESTIONS_CHANNEL_ID);
  }
});

var querySort = false;
var sorting = false;
async function orderByReactions(id) {
  console.log("Starting sort...");
  sorting = true;
  const forum = await client.channels.fetch(id);
  const default_emoji = forum.defaultReactionEmoji;
  /*forum.permissionOverwrites.edit(forum.guild.id, {
    ReadMessageHistory: false
  });*/
  // Get threads
  var threads = [];
  await forum.threads.fetch({ limit: 100 }).then(threadPage => {
    threadPage.threads.forEach(t => {
      if (t.parentId != id) return;
      threads.push(t);
    });
  });
  // Get reactions
  var threadList = threads.map(async t => {
    var p = await t.fetchStarterMessage();
    var r = p.reactions.cache.get(default_emoji.name);
    var c = r ? r.count : 0;
    return { thread: t, count: c };
  });
  threadList = await Promise.all(threadList);
  threadList.sort((a, b) => a.count - b.count);
  threadList = threadList.filter(a => !a.thread.locked);

  for (var i = 0; i < threadList.length; i++) {
    var t = threadList[i];
    //t.thread.members.fetch({ limit: 100 }).then(members => members.forEach(m => t.thread.members.remove(m.id)));
    var msg = await t.thread.send({
      content: "Bump",
      flags: [ 4096 ]
    });
    msg.delete();
    await wait(1);
  }

  /*forum.permissionOverwrites.edit(forum.guild.id, {
    ReadMessageHistory: true
  });*/

  //console.log(default_emoji);
  //console.log(reactionList);
  /*const posts = getAllMessages(forum);
  const postCounts = posts.map(pst => ({ post: pst, reactions: pst.reactions.cache.size }));

  // Sort messages by reactions
  postCounts.sort((a, b) => b.reactions - a.reactions);

  console.log(postCounts);*/
  sorting = false;
  console.log("Sort complete.");
}

setInterval(()=>{
  if (querySort && !sorting) {
    orderByReactions(SUGGESTIONS_CHANNEL_ID);
    querySort = false;
  }
},1000);

async function getAllMessages(channel) {
  var messages = [];

  // Create message pointer
  let pointerMsg = await channel.messages
    .fetch({ limit: 1 })
    .then(messagePage => (messagePage.size === 1 ? messagePage.at(0) : null));
  if (pointerMsg) messages.push(pointerMsg);

  while (pointerMsg) {
    await channel.messages
      .fetch({ limit: 100, before: pointerMsg.id })
      .then(messagePage => {
        messagePage.forEach(msg => messages.push(msg));
        // Update our message pointer to be last message in page of messages
        pointerMsg = 0 < messagePage.size ? messagePage.at(messagePage.size - 1) : null;
      });
  }

  return messages;
}

/*
async function gracefulShutdown(code) {
  console.log("Ending process with code " + code);
  matchmaking.permissionOverwrites.edit(matchmaking.guild.id, {
    SendMessages: false
  });
  for (var id in BreakoutRooms) {
    BreakoutRooms[id].close();
  }
  client.destroy();
  process.exit();
}
*/
//make sure this line is the last line
client.login(process.env.CLIENT_TOKEN); //login bot using token

/*
// Exit
process.on('exit', gracefulShutdown);

process.on('uncaughtException', (err) => {
  console.error(`Uncaught exception: ${err.message}`);
  gracefulShutdown(1);
});

process.on('uncaughtRejection', (err) => {
  console.error(`Uncaught Rejection: ${err.message}`);
  gracefulShutdown(1);
});

function signalHandler() {
  console.log('Stop button pressed');
  gracefulShutdown(0);
}

process.on('SIGINT', signalHandler);
process.on('SIGTERM', signalHandler);
process.on('SIGQUIT', signalHandler);
*/
//

const express = require('express')
const app = express();
const port = 3000;

app.use(express.json());

app.get('/', (req, res) => {
  res.send('Pumpkin Master Bot is now online!');
});

app.post('/', (req, res) => {
  console.log(req.body);
});

app.head("/", (req, res) => {
  console.log('Ping!');
});

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
})

// Misc
function wait(t) {
  return new Promise(function(resolve) {
    setTimeout(() => {
      resolve();
    }, t);
  });
}
