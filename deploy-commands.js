const { REST, Routes, SlashCommandBuilder, ApplicationCommandOptionType, PermissionFlagsBits  } = require('discord.js');
const fs = require('fs');
const path = require('path');

const commands = [
  {
  	name: 'room',
  	description: 'Create a breakout room',
    options: [
  		{
  			type: ApplicationCommandOptionType.String,
  			name: 'name',
  			description: 'The name of the room',
  			required: true
  		}
  	]
  },
  {
  	name: 'rename',
  	description: 'Rename the breakout room',
    options: [
  		{
  			type: ApplicationCommandOptionType.String,
  			name: 'name',
  			description: 'The new name for the breakout room',
  			required: true
  		}
  	]
  },
  {
  	name: 'add',
  	description: 'Add a user to a breakout room',
    options: [
  		{
  			type: ApplicationCommandOptionType.User,
  			name: 'user',
  			description: 'The user to be added',
  			required: true
  		}
  	]
  },
  {
  	name: 'remove',
  	description: 'Remove a user from a breakout room',
    options: [
  		{
  			type: ApplicationCommandOptionType.User,
  			name: 'user',
  			description: 'The user to be removed',
  			required: true
  		}
  	]
  },
  {
  	name: 'leave',
  	description: 'Remove yourself from a breakout room'
  },
  {
  	name: 'voice',
  	description: 'Create a voice channel that contains all users in the room'
  },
  {
  	name: 'stopvoice',
  	description: 'Close the voice channel'
  },
  {
  	name: 'public',
  	description: 'Open to the public so anyone can view and message'
  },
  {
  	name: 'private',
  	description: 'Close so that only added members can view and message'
  },
  {
  	name: 'close',
  	description: 'Close the breakout room'
  },
  {
    name: 'closeall',
    description: 'close all breakout rooms',
    default_member_permissions: '8'
  }
];

// Construct and prepare an instance of the REST module
const rest = new REST({version:'9'}).setToken(process.env.CLIENT_TOKEN);

// and deploy your commands!
(async () => {
	try {
		console.log(`Started refreshing ${commands.length} application (/) commands.`);

		// The put method is used to fully refresh all commands in the guild with the current set
		const data = await rest.put(
			Routes.applicationCommands(process.env.CLIENT_ID),
			{ body: commands },
		);

		console.log(`Successfully reloaded ${data.length} application (/) commands.`);
	} catch (error) {
		// And of course, make sure you catch and log any errors!
		console.error(error);
	}
})();
/*
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');

const commands = [{
	name: 'ping',
	description: 'Replies with Pong!'
}]; // Define your command(s) here

const rest = new REST({ version: '9' }).setToken(process.env.CLIENT_TOKEN);

(async () => {
	try {
		console.log('Started refreshing application (/) commands.');

		await rest.put(
			Routes.applicationCommands(process.env.CLIENT_ID),
			{ body: commands },
		);

		console.log('Successfully reloaded application (/) commands.');
	} catch (error) {
		console.error(error);
	}
})();*/
