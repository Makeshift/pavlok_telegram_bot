import { Telegraf } from 'telegraf';
Error.stackTraceLimit = Infinity;

export default function telegramInit (pavlok, db) {
  const bot = new Telegraf(process.env.telegram_token);

  const percentageTo8bit = (intensity) => Math.min(Math.floor(intensity / 100 * 255), 255);
  const parseName = (name) => name.includes('@') ? name.split('@')[1] : name;
  const parseCommand = (command) => command.includes('/') ? command.split('/')[1] : command;

  const commandToFriendlyMap = {
    vibrate: 'Vibrating',
    zap: 'Zapping',
    beep: 'Beeping'
  };

  const commandToFunctionMap = {
    vibrate: pavlok.vibrate,
    zap: pavlok.zap,
    beep: pavlok.beep
  };

  const replyAndLog = (ctx, msg) => {
    console.log(`Reply to ${ctx.from.username}: ${msg}`);
    ctx.replyWithMarkdownV2(msg, { reply_to_message_id: ctx.message.message_id });
  };

  function runCommand (ctx) {
    const rawArgs = ctx.message.text.split(' ');
    const args = {
      command: parseCommand(rawArgs[0]),
      target: ctx.from.username,
      intensity: percentageTo8bit(50),
      message: 'Hi from zapbot!'
    };
    // if rawargs1 includes an @, we can assume the format is /command @target intensity message
    if (rawArgs[1] && rawArgs[1].includes('@')) {
      args.target = parseName(rawArgs[1]);
      // if rawargs1 is the target, we can assume rawargs2 (if set) is the intensity
      if (rawArgs[2]) {
        args.intensity = percentageTo8bit(Number(rawArgs[2]));
      }
      // if rawargs3 is set, we can assume that it is the message
      if (rawArgs[3]) {
        args.message = rawArgs.slice(3).join(' ');
      }
      // if args1 doesn't include an @, we assume it's the intensity
    } else if (rawArgs[1]) {
      args.intensity = percentageTo8bit(rawArgs[1]);
      // in which case args2 will be the message
      if (rawArgs[2]) {
        args.message = rawArgs.slice(2).join(' ');
      }
    }
    // else we just use the defaults in args
    try {
      const pavlokId = db.getData(`/telegram/${args.target}/pavlok_id`);
      args.token = db.getData(`/pavlok/${pavlokId}/access_token`);
    } catch (e) {
      replyAndLog(ctx, `User \`@${args.target}\` does not appear to be registered\\.`);
      return;
    }
    try {
      commandToFunctionMap[args.command]({
        code: args.token,
        intensity: args.intensity,
        message: args.message,
        callback: (err, data) => {
          if (err) console.log(err, data);
          replyAndLog(ctx, `${commandToFriendlyMap[args.command]} \`@${args.target}\` at intensity \`${args.intensity}\` with message \`${args.message}\``);
        }
      });
    } catch (e) {
      console.log(e);
      console.log(args);
      replyAndLog(ctx, 'Something went wrong, please try again\\.');
    }
  }

  bot.start(ctx => ctx.reply("Hey! You aren't really meant to message this bot directly, but hi!"));

  bot.command(['vibrate', 'zap', 'beep'], runCommand);

  bot.command('help', ctx => replyAndLog(ctx, `Currently supported commands:

\\/vibrate \\[\\@target\\] \\[intensity 0\\-100\\] \\[message\\]
\\/zap \\[\\@target\\] \\[intensity 0\\-100\\] \\[message\\]
\\/beep \\[\\@target\\] \\[intensity 0\\-100\\] \\[message\\]
\\/help
  
All of the above arguments are optional, and will default to the user who invoked the command if a target is not specified\\.

If you own a Pavlok device and wish to have it controllable via this bot, you can sign up at: ${process.env.callback_root.replaceAll('.', '\\.')}/ to associate your Telegram and Pavlok accounts\\.
  `));

  bot.launch();
}
