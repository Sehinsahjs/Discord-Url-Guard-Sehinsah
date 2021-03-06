const AdvancedGuardClient = require("./Client");
const { SERVER_ID, SAFE_BOTS, MAIN_TOKEN, AUTHOR, SAFE_USERS, STATUS, LOG_CHANNEL, VANITY_URL, VOICE_CHANNEL } = require("./configurations.json").DEFAULTS;
const { IGNORE_OWNER_MODE, OWNER_GUARD, DANGER_DETECTION, BOT_GUARD } = require("./configurations.json").SETTINGS;
const { approvedConsole, declinedConsole, logMessage, dangerModeControl, guardConsoleLog, clientAuthorSend } = require("./functions");
const chalk = require("chalk");
const client = new AdvancedGuardClient(MAIN_TOKEN);
const fetch = require("node-fetch");
const dangerPerms = ["ADMINISTRATOR", "KICK_MEMBERS", "MANAGE_GUILD", "BAN_MEMBERS", "MANAGE_ROLES", "MANAGE_WEBHOOKS", "MANAGE_CHANNELS"];
let dangerMode = false;
let dangerCount = 0;

client.on("ready", async () => {
    client.user.setPresence({ activity: { name: STATUS }, status: "dnd" });
    client.guilds.cache.get(SERVER_ID).channels.cache.get(VOICE_CHANNEL).join().catch();
    setInterval(async () => {
        if (DANGER_DETECTION === false) return;
        if (dangerMode === true) {
          await client.closeAllPermissionsFromRoles();  
          await dangerModeControl();
          approvedConsole("Danger counts are reseted.")  
        };
    }, 1000*60*2);
    setInterval(async () => {
        dangerCount = 0;
        approvedConsole("Danger counts are reseted.")
    }, 1000*60*15);
});

client.on("roleUpdate", async (oldRole, newRole) => {
    let entry = await newRole.guild.fetchAuditLogs({ limit: 1, type: 'ROLE_UPDATE' }).then(x => x.entries.first());
    if (!entry || !entry.executor || (OWNER_GUARD === false && entry.executor.id == oldRole.guild.ownerID) || (IGNORE_OWNER_MODE.IGNORE_OWNERS === true && oldRole.guild.members.cache.get(entry.executor.id).roles.cache.has(IGNORE_OWNER_MODE.OWNER_ROLE)) || client.whitelisted(entry.executor.id)) return;
    await client.punish(entry.executor.id).catch();
    await guardConsoleLog(oldRole.guild, newRole.id, entry.executor.id, 0);
    await logMessage(oldRole.guild, `${entry.executor} (\`${entry.executor.id}\`) adl?? kullan??c?? bir rol g??ncelledi ve rol?? eski haline geri ??evirdim, daha detayl?? bilgileri konsola att??m.`).catch();
    if (dangerPerms.some(x => !oldRole.permissions.has(x) && newRole.permissions.has(x))) {
        newRole.setPermissions(oldRole.permissions);
    };
    newRole.edit({ ...oldRole });
});

client.on("roleDelete", async role => {
    let entry = await role.guild.fetchAuditLogs({ limit: 1, type: 'ROLE_DELETE' }).then(x => x.entries.first());
    if (!entry || !entry.executor || (OWNER_GUARD === false && entry.executor.id == role.guild.ownerID) || (IGNORE_OWNER_MODE.IGNORE_OWNERS === true && role.guild.members.cache.get(entry.executor.id).roles.cache.has(IGNORE_OWNER_MODE.OWNER_ROLE)) || client.whitelisted(entry.executor.id)) return;
    dangerCount++;
    if (dangerCount >= 3) {
        dangerMode = true;
        setTimeout(() => {
            dangerMode = false;
            dangerCount = 0;
        }, 1000*60*30);
    };
    await client.closeAllPermissionsFromRoles();
    let newRole = await role.guild.roles.create({
        data: {
            name: role.name,
            color: role.hexColor,
            mentionable: role.mentionable,
            hoist: role.hoist,
            permissions: role.permissions,
            position: role.position
        }, reason: "Url Guard"
    });
    await logMessage(role.guild, `${entry.executor} (\`${entry.executor.id}\`) adl?? kullan??c?? bir rol sildi ve rol?? tekrar olu??turdum, daha detayl?? bilgileri konsola att??m.`).catch();
    await clientAuthorSend(role.guild, `Bir rol silindi, detaylara konsoldan g??z atabilirsin!`).catch();
    await guardConsoleLog(role.guild, newRole.id, entry.executor.id, 1);
    await client.punish(entry.executor.id).catch();
});

client.on("roleCreate", async role => {
    let entry = await role.guild.fetchAuditLogs({ limit: 1, type: 'ROLE_CREATE' }).then(x => x.entries.first());
    if (!entry || !entry.executor || (OWNER_GUARD === false && entry.executor.id == role.guild.ownerID) || (IGNORE_OWNER_MODE.IGNORE_OWNERS === true && role.guild.members.cache.get(entry.executor.id).roles.cache.has(IGNORE_OWNER_MODE.OWNER_ROLE)) || client.whitelisted(entry.executor.id)) return;
    await guardConsoleLog(role.guild, role.id, entry.executor.id, 2);
    await client.punish(entry.executor.id).catch();
    await role.delete();
    await logMessage(role.guild, `${entry.executor} (\`${entry.executor.id}\`) adl?? ??ye bir rol olu??turdu ve rol silindi.`);
});

client.on("channelUpdate", async (oldChannel, newChannel) => {
    let entry = await newChannel.guild.fetchAuditLogs({type: 'CHANNEL_UPDATE'}).then(x => x.entries.first());
    if (!entry || !entry.executor || (OWNER_GUARD === false && entry.executor.id == oldChannel.guild.ownerID) || (IGNORE_OWNER_MODE.IGNORE_OWNERS === true && oldChannel.guild.members.cache.get(entry.executor.id).roles.cache.has(IGNORE_OWNER_MODE.OWNER_ROLE)) || client.whitelisted(entry.executor.id)) return;
    await logMessage(oldChannel.guild, `${entry.executor} (\`${entry.executor.id}\`) adl?? ??ye **${oldChannel.name}** adl?? kanal ??zerinde de??i??iklik yapt?? ve kanal geri eski haline getirildi.`);
    await guardConsoleLog(oldChannel.guild, oldChannel.id, entry.executor.id, 3);
    await client.punish(entry.executor.id).catch();
    if (newChannel.type !== "category" && newChannel.parentID !== oldChannel.parentID) newChannel.setParent(oldChannel.parentID);
    if (newChannel.type == "text") {
        newChannel.edit({
            name: oldChannel.name,
            nsfw: oldChannel.nsfw,
            topic: oldChannel.topic,
            rateLimitPerUser: oldChannel.rateLimitPerUser
        });
    } else if (newChannel.type == "voice") {
        newChannel.edit({
            name: oldChannel.name,
            userLimit: oldChannel.userLimit
        });
    } else if (newChannel.type == "category") {
        newChannel.edit({
            name: oldChannel.name
        });
    };

    oldChannel.permissionOverwrites.forEach(x => {
        let o = {};
        x.allow.toArray().forEach(p => {
          o[p] = true;
        });
        x.deny.toArray().forEach(p => {
          o[p] = false;
        });
        newChannel.createOverwrite(x.id, o);
      });
});

client.on("channelDelete", async channel => {
    let entry = await channel.guild.fetchAuditLogs({ limit: 1, type: 'CHANNEL_DELETE' }).then(x => x.entries.first());
    if (!entry || !entry.executor || (OWNER_GUARD === false && entry.executor.id == channel.guild.ownerID) || (IGNORE_OWNER_MODE.IGNORE_OWNERS === true && channel.guild.members.cache.get(entry.executor.id).roles.cache.has(IGNORE_OWNER_MODE.OWNER_ROLE)) || client.whitelisted(entry.executor.id)) return;
    dangerCount++;
    if (dangerCount >= 3) {
        dangerMode = true;
        setTimeout(() => {
            dangerMode = false;
            dangerCount = 0;
        }, 1000*60*30);
    };
    await client.closeAllPermissionsFromRoles();
    await guardConsoleLog(channel.guild, c.id, entry.executor.id, 4);
    await client.punish(entry.executor.id).catch();
    await clientAuthorSend(channel.guild, `Bir kanal silindi, detaylara konsoldan g??z atabilirsin!`).catch();
    await logMessage(channel.guild, `${entry.executor} (\`${entry.executor.id}\`) adl?? ??ye **${channel.name}** adl?? kanal?? sildi ve kanal tekrar olu??turuldu, detayl?? bilgi i??in konsolu inceleyebilirsin.`);
    await channel.clone().then(async (c) => {
        if (channel.parentID != null) await c.setParent(channel.parentID);
        await c.setPosition(channel.position);
        if (channel.type == "category") await channel.guild.channels.cache.filter(x => x.parentID == channel.id).forEach(y => y.setParent(c.id));        
    });
});

client.on("channelCreate", async channel => {
    let entry = await channel.guild.fetchAuditLogs({ limit: 1, type: 'CHANNEL_CREATE' }).then(x => x.entries.first());
    if (!entry || !entry.executor || (OWNER_GUARD === false && entry.executor.id == channel.guild.ownerID) || (IGNORE_OWNER_MODE.IGNORE_OWNERS === true && channel.guild.members.cache.get(entry.executor.id).roles.cache.has(IGNORE_OWNER_MODE.OWNER_ROLE)) || client.whitelisted(entry.executor.id)) return;
    await guardConsoleLog(channel.guild, channel.id, entry.executor.id, 5);
    await client.punish(entry.executor.id).catch();
    await logMessage(channel.guild, `${entry.executor} (\`${entry.executor.id}\`) adl?? ??ye **${channel.name}** adl?? kanal?? a??t?? ve sunucudan uzakla??t??r??ld??.`);
    await channel.delete();
});

client.on("guildBanAdd", async (guild, user) => {
    let entry = await guild.fetchAuditLogs({ limit: 1, type: 'MEMBER_BAN_ADD' }).then(x => x.entries.first());
    if (!entry || !entry.executor || (OWNER_GUARD === false && entry.executor.id == guild.ownerID) || (IGNORE_OWNER_MODE.IGNORE_OWNERS === true && guild.members.cache.get(entry.executor.id).roles.cache.has(IGNORE_OWNER_MODE.OWNER_ROLE)) || client.whitelisted(entry.executor.id)) return;
    await guardConsoleLog(guild, user.id, entry.executor.id, 6); 
    await client.punish(entry.executor.id).catch();
    await logMessage(guild, `${entry.executor} (\`${entry.executor.id}\`) adl?? ??ye **${user.tag}** adl?? ??yeye sa?? t??k ban att?? ve sunucudan uzakla??t??r??ld??.`);
    await guild.members.unban(user.id).catch();

});

client.on("guildMemberUpdate", async (oldMember, newMember) => {
    let entry = await oldMember.guild.fetchAuditLogs({ limit: 1, type: 'MEMBER_ROLE_UPDATE' }).then(x => x.entries.first());
    if (!entry || !entry.executor || (OWNER_GUARD === false && entry.executor.id == oldMember.guild.ownerID) || (IGNORE_OWNER_MODE.IGNORE_OWNERS === true && oldMember.guild.members.cache.get(entry.executor.id).roles.cache.has(IGNORE_OWNER_MODE.OWNER_ROLE)) || client.whitelisted(entry.executor.id)) return;
    if (oldMember.roles.cache.size == newMember.roles.cache.size) return;
    if (dangerPerms.some(x => !oldMember.hasPermission(x) && newMember.hasPermission(x))) {
        await guardConsoleLog(oldMember.guild, oldMember.id, entry.executor.id, 7);
        await client.punish(entry.executor.id).catch();
        await logMessage(oldMember.guild, `${entry.executor} (\`${entry.executor.id}\`) adl?? ??ye **${oldMember.displayName}** adl?? ??yeye sa?? t??kla yetki vermeye ??al????t?? ve ??ye sunucudan uzakla??t??r??l??p ??ye geri eski haline ??evrildi.`);
        newMember.roles.set(oldMember.roles.array()).catch();
    };
});

client.on("guildUpdate", async (oldGuild, newGuild) => {
    const entry = await oldGuild.fetchAuditLogs({ limit: 1, type: "GUILD_UPDATE" }).then(audit => audit.entries.first());
    await guardConsoleLog(oldGuild, oldGuild.vanityURLCode, entry.executor.id, 8, newGuild.vanityURLCode);
    if(oldGuild.vanityURLCode !== newGuild.vanityURLCode) {
        dangerCount++;
        dangerMode = true;
            setTimeout(() => {
                dangerMode = false;
                dangerCount = 0;
            }, 1000*60*30);
        await client.punish(entry.executor.id).catch();
        await client.closeAllPermissionsFromRoles();
        await clientAuthorSend(oldGuild, `${oldGuild.name} adl?? sunucunun URLsi de??i??tirilmeye ??al??????ld??, detaylara konsoldan g??z atabilirsin.`).catch();
        await logMessage(oldGuild, `${entry.executor} (\`${entry.executor.id}\`) adl?? ??ye URLyi de??i??tirdi ve eski haline getirildi!`);
        await fetch(`https://discord.com/api/guilds/${newGuild.id}/vanity-url`,{
            method: "PATCH",
            headers: { 'Authorization': 'Bot ' + client.token, 'Content-Type': 'application/json'},
            body: JSON.stringify({code: VANITY_URL})
    
        }).then(res => res.json())
         .then(json => { console.log(json)})
         .catch(err => console.log(err));
        await newGuild.edit({ 
            name: oldGuild.name, 
            icon: oldGuild.iconURL({ dynamic: true }), 
            banner: oldGuild.bannerURL(), 
            region: oldGuild.region, 
            verificationLevel: oldGuild.verificationLevel, 
            explicitContentFilter: oldGuild.explicitContentFilter, 
            afkChannel: oldGuild.afkChannel, 
            systemChannel: oldGuild.systemChannel,
            afkTimeout: oldGuild.afkTimeout,
            rulesChannel: oldGuild.rulesChannel,
            publicUpdatesChannel: oldGuild.publicUpdatesChannel,
            preferredLocale: oldGuild.preferredLocale
        })
    };
    
    if (!entry || !entry.executor || (OWNER_GUARD === false && entry.executor.id == oldGuild.ownerID) || (IGNORE_OWNER_MODE.IGNORE_OWNERS === true && oldGuild.members.cache.get(entry.executor.id).roles.cache.has(IGNORE_OWNER_MODE.OWNER_ROLE)) || client.whitelisted(entry.executor.id)) return;
    await logMessage(oldGuild, `${entry.executor} (\`${entry.executor.id}\`) adl?? ??ye sunucu ??zerinde de??i??iklikler yapt?? ve eski haline getirildi!`);
    await client.punish(entry.executor.id).catch();
    await newGuild.edit({ 
        name: oldGuild.name, 
        icon: oldGuild.iconURL({ dynamic: true }), 
        banner: oldGuild.bannerURL(), 
        region: oldGuild.region, 
        verificationLevel: oldGuild.verificationLevel, 
        explicitContentFilter: oldGuild.explicitContentFilter, 
        afkChannel: oldGuild.afkChannel, 
        systemChannel: oldGuild.systemChannel,
        afkTimeout: oldGuild.afkTimeout,
        rulesChannel: oldGuild.rulesChannel,
        publicUpdatesChannel: oldGuild.publicUpdatesChannel,
        preferredLocale: oldGuild.preferredLocale
    })
});

client.on("guildMemberAdd", async member => {
    let entry = await member.guild.fetchAuditLogs({ limit: 1, type: 'BOT_ADD' }).then(x => x.entries.first());
    if (!entry || !entry.executor || (OWNER_GUARD === false && entry.executor.id == member.guild.ownerID) || entry.executor.id == AUTHOR) return;
    if (!member.user.bot) return;
    if (BOT_GUARD === false) return;
    await guardConsoleLog(member.guild, member.id, entry.executor.id, 9);
    await client.punish(entry.executor.id).catch();
    await client.punish(member.id).catch();
    await client.closeAllPermissionsFromRoles();
    await logMessage(member.guild, `${entry.executor} (\`${entry.executor.id}\`) adl?? ??ye sunucuya bir bot eklemeye ??al????t??, eklenilen bot: **${member.user.tag}** (\`${member.id}\`)`);
    dangerCount++;
    if (dangerCount >= 3) {
        dangerMode = true;
        setTimeout(() => {
            dangerMode = false;
            dangerCount = 0;
        }, 1000*60*30);
    };
});

client.on("guildMemberRemove", async member => {
    let entry = await member.guild.fetchAuditLogs({ limit: 1, type: 'MEMBER_KICK' }).then(x => x.entries.first());
    if (!entry || !entry.executor || (OWNER_GUARD === false && entry.executor.id == member.guild.ownerID) || (IGNORE_OWNER_MODE.IGNORE_OWNERS === true && member.guild.members.cache.get(entry.executor.id).roles.cache.has(IGNORE_OWNER_MODE.OWNER_ROLE)) || client.whitelisted(entry.executor.id)) return;
    await guardConsoleLog(member.guild, member.id, entry.executor.id, 10);
    await client.punish(entry.executor.id).catch();
    await logMessage(member.guild, `${entry.executor} (\`${entry.executor.id}\`) adl?? ??ye **${member.user.tag}** adl?? ??yeye sa?? t??k kick att?? ve sunucudan uzakla??t??r??ld??.`);
});

client.login(MAIN_TOKEN).then(approvedConsole("Bot ba??ar??l?? bir ??ekilde giri?? yapt??.")).catch(e => { 
    declinedConsole("Bot giri?? yaparken bir sorun ????kt??!");
    console.error(e);
});
