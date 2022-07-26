import { SMTPServer } from 'smtp-server'
import mailparser from 'mailparser'
import { createWriteStream, writeFile, mkdir } from 'fs'
import express from 'express'
import sanitize from 'sanitize-filename'
import { DateTime } from 'luxon'

const app = express()
const { simpleParser } = mailparser
const API_KEY = process.env.API_KEY
const EMAIL_DOMAINS = (process.env.EMAIL_DOMAIN || '').split(',')
const EMAIL_ACCOUNT_PREFIX = process.env.EMAIL_ACCOUNT_PREFIX
const ADMIN_APP_PORT = process.env.ADMIN_APP_PORT || 3025

if (!API_KEY || API_KEY.length < 20) {
  throw new Error('API_KEY of 20 characters or more is required')
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
    console.log(`Email to ${address.address} accepted`)
    return callback() // Accept the address
  }
  console.log(`Email to ${address.address} refused`)
  return callback(new Error('No thank you'))
}

function onData(stream, session, callback) {
  //stream.pipe(process.stdout) // print message to console
  const folderPath = `mail/${sanitize(
    session.envelope.rcptTo[0].address,
    sanitizeOptions
  )}/`
  mkdir(folderPath, { recursive: true }, () => {
    const messageFileLabel = `${DateTime.utc().toISO()}-${session.id}`
    const rawFileStream = createWriteStream(
      `${folderPath}${messageFileLabel}.raw`
    )
    stream.pipe(rawFileStream)
    simpleParser(stream, {}, (parseErr, parsed) => {
      let filename
      let body
      if (parseErr) {
        filename = `${folderPath}${messageFileLabel}.err`
        body = JSON.stringify(parseErr, null, '  ')
      } else {
        filename = `${folderPath}${messageFileLabel}.json`
        body = JSON.stringify(parsed, null, '  ')
      }
      writeFile(filename, body, (writeErr) => {
        if (writeErr) console.log(`Failed to write email to file:`, writeErr)
      })
    })
  })
  stream.on('end', callback)
}

function sanitizeOptions(charToReplace) {
  return '-'
}

app.get('/api/mail', (req, res) => {
  res.json({ gotMail: true })
})

app.listen(ADMIN_APP_PORT, () => {
  console.log(`Admin app listening on ${ADMIN_APP_PORT}`)
})
