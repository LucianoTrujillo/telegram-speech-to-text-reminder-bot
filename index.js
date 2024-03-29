const fetch = require('node-fetch');
require('dotenv').config();

const express = require('express');

const TelegramBot = require('node-telegram-bot-api');
const chrono = require('chrono-node');
const OpenAI = require('openai');

const app = express();

// Middleware to parse JSON bodies
app.use(express.json());


const openai = new OpenAI({
    apiKey: process.env.OPENAI_KEY, // This is the default and can be omitted
  });
// Replace 'YOUR_TELEGRAM_BOT_TOKEN' with the token given to you by BotFather
const token = process.env.TELEGRAM_TOKEN;
const bot = new TelegramBot(token, {polling: true});

const whiteListedUsers = process.env.WHITELISTED_USERS.split(',');

const validateUserIsWhitelisted = (chatId) => {
    if (!whiteListedUsers.includes(chatId.toString())){
        console.log(`${chatId} is not whitelisted: whitelist is: ${whiteListedUsers}`);
        throw new Error('User not whitelisted. Contact developer (luckytrujillo123@gmail.com) for enabling usage');
    }
}

const handleReminder = async (msg, chatId) => {
    console.log(`[${chatId}]: processing message: ${msg}`);

    const parsedMessage = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        response_format: {"type": "json_object"},
        messages: [
          {
            role: "system",
            content: "You are a reminder parser that separates a natural language reminder into a JSON object with the reminder's text and time. For example: \"recordame mandarle un mensaje de feliz cumple a mariano mañana a las 8am.\" would result in the following JSON: {\"text\": \"mandarle un mensaje de feliz cumple a mariano\", \"time\": \"mañana a las 8am\"}"
          },
          {
            role: "user",
            content: msg
          }
        ]
      });
    
      
      const responseAsJSON = JSON.parse(parsedMessage.choices[0].message.content);
      
      console.log(`[${chatId}]: parsed message: ${JSON.stringify(responseAsJSON)}`);

        const reminderTime = responseAsJSON.time;
        const reminderText = responseAsJSON.text;
    
    
        const newDate = new Date();        
    
        const parsedTime = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            response_format: {"type": "json_object"},
            messages: [
                {
                role: "system",
                content: `You are a reminder time parser that converts a natural lnaguage reminder's date time into a valid chrono-node input for parsing time.
                These are all valid inputs, but the parser is really versatile:
                Today, Tomorrow, Yesterday, Last Friday, etc
                17 August 2013 - 19 August 2013
                This Friday from 13:00 - 16.00
                5 days ago
                2 weeks from now
                Sat Aug 17 2013 18:40:39 GMT+0900 (JST)
                2014-11-30T08:15:30-05:30

                However, an extremely important thing to note is that it only accepts english input, so if the user's input was in other language, translate it to english for chrono-node to understand it.
                Expected JSON output: {"time": "input for chrono-node to parse time. For example: tomorrow at 8am.", "timezone": "timezone of the user. For example: GMT-3.}
                ` },
                {
                role: "user",
                content: "current date:" + newDate.toString() + ". Reminder time: " + reminderTime
                }
            ]
            });
    
        const responseAsJSON2 = JSON.parse(parsedTime.choices[0].message.content);
    
    
        console.log(`[${chatId}]: parsed time: ${JSON.stringify(responseAsJSON2)}`);

    
        const reminderDateTime = responseAsJSON2.time;
        const reminderTimezone = responseAsJSON2.timezone;
    
        
        // we set a timeout to send the user a message when the reminder is due.
        
        const parsedDate = chrono.parseDate(reminderDateTime, {
          instant: newDate,
          forwardDate: true,
          timezone: -180
        });

        bot.sendMessage(chatId, `Reminder: ${reminderText} \n Time: ${parsedDate}`);

        console.log(`[${chatId}]: parsed date: ${parsedDate}`);

    
        const currentTime = new Date().getTime();
        const reminderDateTimeObject = parsedDate.getTime();

        const timeToReminder = reminderDateTimeObject - currentTime;
        
        console.log(`[${chatId}]: current time: ${currentTime}, reminder time: ${reminderDateTimeObject}, time to reminder: ${timeToReminder / 1000 / 60} minutes`);

        setTimeoutUnlimitedDelay(() => {
            console.log(`[${chatId}]: sending reminder: ${reminderText}`);
            bot.sendMessage(chatId, `Reminder: ${reminderText}`);
        }, timeToReminder);
    
}

bot.on('message', async (msg) => {
    try {

        const chatId = msg.chat.id;
        
  const message = msg.text;

  if(!msg.voice?.duration){
    console.log(`[${chatId}]: new message: ${msg.text}`);
    validateUserIsWhitelisted(chatId);

      handleReminder(message, chatId);

    }
    }
    catch (e){
        console.error(`[${msg.chat.id}]: ${e.message}`);
        bot.sendMessage(msg.chat.id, e.message);
    }   
});

bot.on("voice", async (msg) => {
    try {

  const chatId = msg.chat.id;
    validateUserIsWhitelisted(chatId);
  console.log(`[${chatId}]: new voice message`);

  const fileInfoResponse = await fetch(`https://api.telegram.org/bot${token}/getFile?file_id=${msg.voice.file_id}`);
  const fileInfo = await fileInfoResponse.json();
  const filePath = fileInfo.result.file_path;

  // Step 2: Download the audio file
  const fileStream = await fetch(`https://api.telegram.org/file/bot${token}/${filePath}`);

  const transcription = await openai.audio.transcriptions.create({
    file: fileStream,
    model: "whisper-1",
  });

  console.log(transcription.text);

    handleReminder(transcription.text, chatId);
} catch (e){
    console.error(`[${msg.chat.id}]: ${e.message}`);
    bot.sendMessage(msg.chat.id, e.message);
}
});


function setTimeoutUnlimitedDelay(fn, delay) {
  // Calculate the maximum delay allowed by setTimeout
  var maxDelay = Math.pow(2, 31) - 1;

  if (delay > maxDelay) {
      // If the delay exceeds the maximum, schedule the first part now
      // and the remainder after the maxDelay has elapsed
      setTimeout(function() {
          // Calculate the remaining delay and call setTimeout_ recursively
          var remainingDelay = delay - maxDelay;
          setTimeout_(fn, remainingDelay);
      }, maxDelay);
  } else {
      // If the delay is within the allowable range, use the native setTimeout
      setTimeout(fn, delay);
  }
}


app.get('/', (req, res) => {
    res.send('Hello World! The server is running and listening for requests.');
  });
  
  // Make the server listen on port 3000
  app.listen(3000, () => {
    console.log('Server is running on http://localhost:3000');
  });