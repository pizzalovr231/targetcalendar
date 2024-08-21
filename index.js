const fs = require('fs').promises;
const path = require('path');
const process = require('process');
const { authenticate } = require('@google-cloud/local-auth');
const { google } = require('googleapis');

const { createWorker, PSM } = require('tesseract.js');
const { table } = require('console');
const { OpenAI } = require("openai");





const openai = new OpenAI({
  organization: "REPLACE" // REPLACE WITH YOUR OWN ORGANIZATION ID!!!!
});





async function main(workDay) {
  const completion = await openai.chat.completions.create({
    messages: [{ role: "system", content: "Please format the following date and time according to RFC 3339 standard and in the CST time zone. Do not include any explanation, or any other extraneous text other than the start date time first, and end date time second, separated by a line break. If there is only a date, return NONE: " + workDay }],
    model: "gpt-4-turbo-2024-04-09",
  });
  return completion;
}

// If modifying these scopes, delete token.json.
const SCOPES = ['https://www.googleapis.com/auth/calendar'];
// The file token.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
// time.
const TOKEN_PATH = path.join(process.cwd(), 'token.json');
const CREDENTIALS_PATH = path.join(process.cwd(), 'credentials.json');

/**
 * Reads previously authorized credentials from the save file.
 *
 * @return {Promise<OAuth2Client|null>}
 */
async function loadSavedCredentialsIfExist() {
  try {
    const content = await fs.readFile(TOKEN_PATH);
    const credentials = JSON.parse(content);
    return google.auth.fromJSON(credentials);
  } catch (err) {
    return null;
  }
}

/**
 * Serializes credentials to a file compatible with GoogleAuth.fromJSON.
 *
 * @param {OAuth2Client} client
 * @return {Promise<void>}
 */
async function loadSavedCredentialsIfExist() {
  try {
    const content = await fs.readFile(TOKEN_PATH);
    const credentials = JSON.parse(content);
    return google.auth.fromJSON(credentials);
  } catch (err) {
    return null;
  }
}

/**
 * Serializes credentials to a file compatible with GoogleAuth.fromJSON.
 *
 * @param {OAuth2Client} client
 * @return {Promise<void>}
 */
async function saveCredentials(client) {
  const content = await fs.readFile(CREDENTIALS_PATH);
  const keys = JSON.parse(content);
  const key = keys.installed || keys.web;
  const payload = JSON.stringify({
    type: 'authorized_user',
    client_id: key.client_id,
    client_secret: key.client_secret,
    refresh_token: client.credentials.refresh_token,
  });
  await fs.writeFile(TOKEN_PATH, payload);
}

/**
 * Load or request or authorization to call APIs.
 *
 */
async function authorize() {
  let client = await loadSavedCredentialsIfExist();
  if (client) {
    return client;
  }
  client = await authenticate({
    scopes: SCOPES,
    keyfilePath: CREDENTIALS_PATH,
  });
  if (client.credentials) {
    await saveCredentials(client);
  }
  return client;
}


async function listEvents(auth) {

  const calendar = google.calendar({ version: 'v3', auth });

  const worker = await createWorker('eng');

  let someText

  await worker.setParameters({
    tessedit_pageseg_mode: PSM.PSM_SINGLE_COLUMN,
  });
  const { data: { text } } = await worker.recognize('Schedule.png');
  someText = text.replace(/(\r\n|\n|\r)/gm, "%%NEWLINE%%");

  await worker.terminate();

  function removeValue(value, index, arr) {
    if (value == "") {
      arr.splice(index, 1);
      return true;
    }
    return false;
  }

  newText = someText.split("%%NEWLINE%%");
  newText.filter(removeValue);
  let newArray = [];
  let val = -1;
  console.log(newText);
  for (const str of newText) {
    if (str.includes("AM") || str.includes("PM")) {
      newArray[val] = newArray[val].concat(" ", str);
    } else {
      newArray.push(str);
      val += 1
    }
  };

  /**
 * Lists the next 10 events on the user's primary calendar.
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 */
  for (const workDay of newArray) {
    const completion = await openai.chat.completions.create({
      messages: [{ role: "system", content: "Please format the following date and time according to RFC 3339 standard and in the CST time zone with daylight savings. Do not include any explanation, or any other extraneous text other than the start date time first, and end date time second, separated by &&&. All of these are in the year 2024. If there is only a date, return NONE: " + workDay }],
      model: "gpt-4-turbo-2024-04-09",
    });
    let dateTime = await completion.choices[0].message.content;

    if (dateTime == "NONE") {
      continue
    }

    let dateArray = dateTime.split(" &&& ");

    console.log(dateArray[0]);
    console.log(dateArray[1]);

    const event = {
      'summary': 'Work',
      'start': {
        'dateTime': dateArray[0],
        'timeZone': 'America/Chicago',
      },
      'end': {
        'dateTime': dateArray[1],
        'timeZone': 'America/Chicago',
      }
    };

    /**
* Lists the next 10 events on the user's primary calendar.
* @param {google.auth.OAuth2} auth An authorized OAuth2 client.
*/
    calendar.events.insert({
      auth: auth,
      calendarId: 'primary',
      resource: event,
    }, function (err, event) {
      if (err) {
        console.log('There was an error contacting the Calendar service: ' + err);
        return;
      }
      console.log('Event created: %s', event.htmlLink);
    });
    
  }

}
authorize().then(listEvents).catch(console.error);