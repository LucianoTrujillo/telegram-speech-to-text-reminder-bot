const fetch = require('node-fetch');
require('dotenv').config();


const TelegramBot = require('node-telegram-bot-api');
const OpenAI = require('openai');


const openai = new OpenAI({
    apiKey: process.env.OPENAI_KEY, // This is the default and can be omitted
  });
// Replace 'YOUR_TELEGRAM_BOT_TOKEN' with the token given to you by BotFather
const token = process.env.TELEGRAM_TOKEN;
const bot = new TelegramBot(token, {polling: true});

const handleReminder = async (msg, chatId) => {
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
    
    
        // we parse the response to JSON:
        const responseAsJSON = JSON.parse(parsedMessage.choices[0].message.content);
    
        const reminderTime = responseAsJSON.time;
        const reminderText = responseAsJSON.text;
    
        console.log(responseAsJSON.time)
    
        const newDate = new Date();
        const isoString = newDate.toISOString();
        
    
        const parsedTime = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            response_format: {"type": "json_object"},
            messages: [
                {
                role: "system",
                content: `You are a reminder time parser that converts a natural lnaguage reminder's date time into an actual date time.
                 For example: if current date is: "2024-03-08T00:39:42.787Z", mañana a las 8am would result in the following JSON: {"time": "2022-03-09T08:00:00.000Z"}
                 Another example: if current date is: "2024-05-15T16:39:42.787Z", pasado mañana a las 10pm would result in the following JSON: {"time": "2022-05-17T22:00:00.000Z"}`
                },
                {
                role: "user",
                content: "current date:" + isoString + ". Reminder time: " + reminderTime
                }
            ]
            });
    
        const responseAsJSON2 = JSON.parse(parsedTime.choices[0].message.content);
    
    
        console.log(responseAsJSON2);
    
        const reminderDateTime = responseAsJSON2.time;
    
        bot.sendMessage(chatId, `Reminder set for: ${reminderDateTime} with text: ${reminderText}`);
    
        // we set a timeout to send the user a message when the reminder is due.
    
        const currentTime = new Date().getTime();
        const reminderDateTimeObject = new Date(reminderDateTime).getTime();
        const timeToReminder = reminderDateTimeObject - currentTime;
    
        setTimeout(() => {
            bot.sendMessage(chatId, `Reminder: ${reminderText}`);
        }, timeToReminder);
    
}

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;

  // we process the message that we received into a JSON object with the reminder's text and time.
  // we send the user that a reminder has been set with name and time.

  const message = msg.text;

  if(!msg.voice?.duration){

      handleReminder(message, chatId);

  }
});

bot.on("voice", async (msg) => {
  const chatId = msg.chat.id;

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
});
