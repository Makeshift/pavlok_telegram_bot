// Express server on port 8000
import express from 'express';
import morgan from 'morgan';
import ip from 'ip';
import { JsonDB } from 'node-json-db';
import { Config } from 'node-json-db/dist/lib/JsonDBConfig.js';
import telegramInit from './telegram.js';

// The Pavlok API REALLY doesn't like being imported with import, so we're forced to use require here
import { createRequire } from 'module';
// @ts-ignore
const require = createRequire(import.meta.url);
const pavlok = require('./node_modules/pavlok/index.js');

const db = new JsonDB(new Config('db', true, true, '/'));

const app = express();
app.use(morgan('combined'));

pavlok.init(process.env.pavlok_client_id, process.env.pavlok_client_secret, {
  apiUrl: 'https://app.pavlok.com',
  verbose: true,
  app: app,
  callbackUrl: `${process.env.callback_root}/auth/pavlok/result`,
  callbackUrlPath: '/auth/pavlok/result',
  successPath: '/auth/pavlok/capture',
  failurePath: '/error'
});

telegramInit(pavlok, db);

app.get('/auth/pavlok/capture', async (req, res) => {
  try {
    db.push(`/pavlok/${req.session.pavlok_user.user.id}`, req.session.pavlok_user);
    pavlok.me({ request: req }, async (err, data) => {
      if (err) console.log(err);
      db.push(`/pavlok/${req.session.pavlok_user.user.id}/user`, JSON.parse(data.body));
      await doTelegramPavlokSync(req);
      res.redirect('/');
    });
  } catch (e) {
    console.log(e);
    res.redirect('/error');
  }
});

app.get('/error', (req, res) => {
  res.status(500).send('We failed to authenticate you for some reason. Talk to Makeshift.');
});

app.get('/', function (req, res) {
  let html = `<head>
    <style>
      html {
        color: #bfbfbf;
        background: #1f1f1f;
        filter: contrast(100%) brightness(100%) saturate(100%);
      }
      a {
        color: rgb(140,140,250);
      }
    </style>
  </head>
  <body>
  <h1>Pavlok Auth</h1>
  `;

  if (pavlok.isLoggedIn(req)) {
    html += `
      <p>You are logged into Pavlok as: <b>${req.session.pavlok_user.user.name}</b>. Click <a href='/auth/pavlok/logout'>>HERE<</a> to log out.</p>
      <a href='/pattern'>Pattern</a><br>
      <a href='/vibrate'>Vibrate</a><br>
      <a href='/beep'>Beep</a><br>
      <a href='/zap'>Zap</a><br>
      <a href='/me'>Me</a><br>
    `;
  } else {
    html += "You are not logged into Pavlok. Click <a href='/auth/pavlok'>>HERE<</a> to log in using your Pavlok account.";
  }
  html += '<h1>Telegram Auth</h1>';
  if (req.session.telegram) {
    // login to telegram via oauth
    html += `<p>You are logged into Telegram as: <b>${req.session.telegram.username}</b></p>`;
  } else {
    html += '<p>You are not currently logged into this application with Telegram. Please click the button below.</p>';
  }
  html += `<script async src="https://telegram.org/js/telegram-widget.js?15" data-telegram-login="${process.env.telegram_bot_name}" data-size="large" data-auth-url="${process.env.callback_root}/auth/telegram/result"></script>`;
  html += '</body>';
  res.send(html);
});

app.get('/auth/pavlok', (req, res) => {
  try {
    pavlok.auth(req, res);
  } catch (e) {
    console.log(e);
    res.redirect('/error');
  }
});

app.get('/auth/telegram/result', async (req, res) => {
  try {
    db.push(`/telegram/${req.query.username}`, req.query);
    req.session.telegram = req.query;
    await doTelegramPavlokSync(req);
    res.redirect('/');
  } catch (e) {
    console.log(e);
    res.redirect('/error');
  }
});

async function doTelegramPavlokSync (req) {
  if (req.session.pavlok_user && req.session.telegram) {
    db.push(`/pavlok/${req.session.pavlok_user.user.id}/telegram_username`, req.session.telegram.username);
    db.push(`/telegram/${req.session.telegram.username}/pavlok_id`, req.session.pavlok_user.user.id);
  }
}

app.get('/auth/pavlok/logout', function (req, res) {
  try {
    pavlok.logout(req);
    res.redirect('/');
  } catch (e) {
    console.log(e);
    res.redirect('/error');
  }
});

app.get('/pattern', function (req, res) {
  try {
    pavlok.pattern({
      request: req,
      pattern: ['beep', 'vibrate', 'zap'],
      count: 2,
      callback: (success, data) => {
        console.log(success, data);
        res.redirect('/');
      }
    });
  } catch (e) {
    console.log(e);
    res.redirect('/error');
  }
});

app.get('/zap', function (req, res) {
  try {
    pavlok.zap({
      request: req,
      callback: (success, data) => {
        console.log(success, data);
        res.redirect('/');
      }
    });
  } catch (e) {
    console.log(e);
    res.redirect('/error');
  }
});

app.get('/vibrate', function (req, res) {
  try {
    pavlok.vibrate({
      request: req,
      callback: (success, data) => {
        console.log(success, data);
        res.redirect('/');
      }
    });
  } catch (e) {
    console.log(e);
    res.redirect('/error');
  }
});

app.get('/beep', function (req, res) {
  try {
    pavlok.beep({
      request: req,
      callback: (success, data) => {
        console.log(success, data);
        res.redirect('/');
      }
    });
  } catch (e) {
    console.log(e);
    res.redirect('/error');
  }
});

app.get('/me', (req, res) => {
  try {
    pavlok.me({ request: req }, (err, data) => {
      if (!err) console.log(err, data);
      res.send(JSON.parse(data.body));
    });
  } catch (e) {
    console.log(e);
    res.redirect('/error');
  }
});

app.listen(process.env.port, () => {
  console.log(`Listening on port ${ip.address()}:${process.env.port}`);
});
