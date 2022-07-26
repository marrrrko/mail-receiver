import { SMTPServer } from 'smtp-server'
import mailparser from 'mailparser'
import { createWriteStream, mkdir } from 'fs'
import { readFile, writeFile } from 'fs/promises'
import express from 'express'
import sanitize from 'sanitize-filename'
import { DateTime } from 'luxon'

const app = express()
const { simpleParser } = mailparser
const API_KEY = process.env.API_KEY
const EMAIL_DOMAINS = (process.env.EMAIL_DOMAIN || '').split(',')
const EMAIL_ACCOUNT_PREFIX = process.env.EMAIL_ACCOUNT_PREFIX
const ADMIN_APP_PORT = process.env.ADMIN_APP_PORT

if (!ADMIN_APP_PORT || !API_KEY || API_KEY.length < 20) {
  console.log(
    `Admin API settings missing or incomplete. Admin API will not be enabled.`
  )
  console.log(`To enable Admin API, add to settings to .env file:`)
  console.log(`  ADMIN_APP_PORT=2255`)
  console.log(`  API_KEY=<security key of at least 20 chars>`)
} else {
  startAdminAPI(ADMIN_APP_PORT, API_KEY)
}

const SERVER_PORT = 25

const server = new SMTPServer({
  onConnect,
  onRcptTo,
  onData,
  authOptional: true
})

server.on('error', (err) => {
  console.log(`Error: ${err.message}`)
})
server.listen(SERVER_PORT, null, () => {
  console.log(`SMTP listening on ${SERVER_PORT}`)
})

function onConnect(session, callback) {
  console.log(`Connection from ${session.remoteAddress} received`)
  return callback() // Accept the connection
}

function onRcptTo(address, session, callback) {
  const recipientAddress = address.address.toLowerCase()

  if (
    recipientAddress.startsWith(EMAIL_ACCOUNT_PREFIX) &&
    EMAIL_DOMAINS.find((domain) =>
      recipientAddress.endsWith(domain.toLocaleLowerCase())
    ) !== undefined
  ) {
    console.log(`Email #${session.id} to "${address.address}" accepted`)
    return callback() // Accept the address
  }
  console.log(`Email #${session.id} to "${address.address}" refused`)
  return callback(new Error('No thank you'))
}

function onData(stream, session, callback) {
  //stream.pipe(process.stdout) // print message to console
  const recipientFolderPath = `mail/${sanitize(
    session.envelope.rcptTo[0].address,
    sanitizeOptions
  )}/`

  createRecipientDirectory(recipientFolderPath)
    .then(() => {
      return handleMessageStream(recipientFolderPath, session.id, stream)
    })
    .then((transactionSummary) => {
      if (transactionSummary.error) {
        console.log(
          `Failed to parse email #${session.id}: ${transactionSummary.error}`
        )
      } else if (transactionSummary.writeErr) {
        console.log(
          `Failed to save email #${session.id}: ${transactionSummary.writeErr}`
        )
      } else {
        console.log(
          `Email #${session.id} parsed and saved successfully. Updating weekly index...`
        )
        return updateOrCreateWeeklyMessageIndex(transactionSummary)
      }
    })
    .then(() => console.log(`Done with #${session.id}`))

  stream.on('end', callback)
}

async function createRecipientDirectory(recipientFolderPath) {
  return new Promise((resolve, reject) => {
    mkdir(recipientFolderPath, { recursive: true }, () => resolve())
  })
}

async function handleMessageStream(recipientFolderPath, messageId, stream) {
  return new Promise((resolve) => {
    const transactionTime = DateTime.utc()
    let transactionSummary = {
      recipientFolderPath,
      messageId,
      processedAt: transactionTime.toISO()
    }
    const messageLabel = `${transactionTime.toISO()}-${messageId}`
    const rawFileStream = createWriteStream(
      `${recipientFolderPath}${messageLabel}.raw`
    )
    stream.pipe(rawFileStream)
    simpleParser(stream, {}, (parseErr, parsed) => {
      let filename
      let body
      if (parseErr) {
        filename = `${recipientFolderPath}${messageLabel}.err`
        body = JSON.stringify(parseErr, null, '  ')
        transactionSummary.error = parseErr
      } else {
        filename = `${recipientFolderPath}${messageLabel}.json`
        body = JSON.stringify(parsed, null, '  ')
        transactionSummary.from = parsed.from.value[0]
        transactionSummary.subject = parsed.subject
        transactionSummary.filename = `${messageLabel}.json`
      }
      writeFile(filename, body)
        .catch((writeErr) => {
          transactionSummary.writeErr = writeErr
          console.log(`Failed to write email to file:`, writeErr)
        })
        .then(() => {
          resolve(transactionSummary)
        })
    })
  })
}

async function updateOrCreateWeeklyMessageIndex(transactionSummary) {
  const processedAt = DateTime.fromISO(transactionSummary.processedAt)
  const indexName = `w${processedAt.weekNumber}-${processedAt.year}`
  const existingIndex = await loadWeeklyIndex(indexName)
  const newIndex = {
    ...existingIndex,
    messages: [transactionSummary, ...existingIndex.messages]
  }
  return saveWeeklyIndex(newIndex)
}

async function loadWeeklyIndex(indexName) {
  let index = { name: indexName, messages: [] }

  try {
    let existingData = await readFile(`mail/${indexName}.json`, 'utf-8')
    index = JSON.parse(existingData)
  } catch (err) {}

  return index
}

async function saveWeeklyIndex(index) {
  return writeFile(`mail/${index.name}.json`, JSON.stringify(index, null, '  '))
}

async function loadMessage(domain, username, messageFilename) {
  const recipientFolderPath = `mail/${sanitize(
    `${username}@${domain}`,
    sanitizeOptions
  )}/${messageFilename}`

  try {
    const existingData = await readFile(recipientFolderPath, 'utf-8')
    const content = JSON.parse(existingData)
    return { domain, username, messageFilename, ...content }
  } catch (err) {
    return null
  }
}

function sanitizeOptions(charToReplace) {
  return '-'
}

function startAdminAPI(port, apiKey) {
  function checkApiKey(req, res, next) {
    const submittedAPIKey = req.query.api_key
    if (!submittedAPIKey || submittedAPIKey.trim() !== apiKey) {
      res.status(401)
      res.json({ message: 'Access denied' })
    } else {
      next()
    }
  }

  app.use(checkApiKey)

  app.get('/api/mail', async (req, res) => {
    const now = DateTime.utc()
    const currentWeek = now.weekNumber
    const currentYear = now.year

    res.redirect(`/api/mail/${currentYear}/${currentWeek}`)
  })

  app.get('/api/mail/:year([0-9]{4})/:week([0-9]{1,2})', async (req, res) => {
    const weekNumber = parseInt(req.params.week)
    const year = parseInt(req.params.year)
    const indexName = `w${weekNumber}-${year}`
    const index = await loadWeeklyIndex(indexName)
    const indexWithMessageUrls = index.messages.map((message) => {
      const recipient = message.recipientFolderPath
        .replace('mail/', '')
        .slice(0, -1)
      const username = recipient.split('@')[0]
      const domain = recipient.split('@')[1]
      return {
        ...message,
        recipientFolderPath: null,
        recipient,
        message: {
          href: `/api/mail/${encodeURIComponent(domain)}/${encodeURIComponent(
            username
          )}/${encodeURIComponent(message.filename)}`
        }
      }
    })

    res.json(indexWithMessageUrls)
  })

  app.get('/api/mail/:domain/:username/:messageFilename', async (req, res) => {
    const message = await loadMessage(
      req.params.domain,
      req.params.username,
      req.params.messageFilename
    )

    if (!message) {
      res.status(404)
      res.json({ message: 'Not Found' })
    } else {
      res.json(message)
    }
  })

  app.listen(port, () => {
    console.log(`Admin app listening on ${port}`)
  })
}
