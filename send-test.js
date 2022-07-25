import SMTPConnection from 'nodemailer/lib/smtp-connection/index.js'
import { nanoid } from 'nanoid'

const EMAIL_DOMAIN = process.env.EMAIL_DOMAIN
const EMAIL_ACCOUNT_PREFIX = process.env.EMAIL_ACCOUNT_PREFIX

if (!EMAIL_DOMAIN || !EMAIL_ACCOUNT_PREFIX) {
  throw new Error(
    'EMAIL_DOMAIN and EMAIL_ACCOUNT_PREFIX env variables must be set'
  )
}

const connection = new SMTPConnection({
  port: 25,
  host: EMAIL_DOMAIN,
  secure: false,
  ignoreTLS: true,
  requireTLS: false,
  connectionTimeout: 2000,
  greetingTimeout: 2000,
  socketTimeout: 10000,
  logger: true
})

connection.on('error', (err) => {
  console.log('Error:', err)
})
connection.on('connect', () => {
  console.log('Connected')
})
connection.on('end', () => {
  console.log('Disconnected')
})

connection.connect((err) => {
  if (err) {
    console.error('Failed to connect')
    console.error(err)
    process.exit(-1)
  }

  console.log(`Connected to SMTP server`)
  const testMessageId = nanoid(8)
  const envelope = {
    from: 'test@test.com',
    to: `${EMAIL_ACCOUNT_PREFIX}${testMessageId}@${EMAIL_DOMAIN}`
  }

  connection.send(envelope, 'Test message ' + testMessageId, (err, info) => {
    if (err) {
      console.error(`Failed to send message`)
      console.error(err)
    } else {
      console.log(`Test message ${testMessageId} sent!`)
      console.log(info)
    }
    connection.close()
    process.exit(0)
  })
})
