
A simple [delivery smtp server](https://datatracker.ietf.org/doc/html/rfc5321#section-2.3.10) that makes it easy to have near infinite email addresses. Useful for development and testing. For example, automated tests can use a different email "account" on every run.

This is mostly just configuration around the excellent [Nodemailer SMTP Server](https://nodemailer.com/extras/smtp-server/).

**Not secure**. Nothing is encrypted.

## Requirements

- A server running Node.js 16+ that's reacheable via public internet
- A domain name and access to its DNS configuration


## Setup

Let's assume that you want to receive emails sent to many different `@dev1.mail.example.com` and  `@dev2.mail.example.com` addresses.

### DNS

You will need 3 DNS records:

```
mydevserver.example.com   A    <ip of your server>
dev1.mail.example.com     MX   10   mydevserver.example.com
dev2.mail.example.com     MX   10   mydevserver.example.com 
```

### System Configuration

SMTP delivery runs on port 25. On Linux, only root can bind to this port. Running node as root is bad. You can override the limitation for the node binary with a command such as this:

`sudo setcap CAP_NET_BIND_SERVICE=+eip /home/myuser/.nvm/versions/node/v16.15.1/bin/node`


### App Configuration

After cloning this repo, inside the project directory:

#### 1. Create a `.env` file that looks like this

```
API_KEY=averylongpasswordtoprotectadminapi
EMAIL_DOMAINS=dev1.mail.example.com,dev2.mail.example.com
EMAIL_ACCOUNT_PREFIX=goodmailonly-
```

Emails sent to addresses that don't start with the prefix will be ignored. This provides some crude protection against spam. In the above example, an email sent to `goodmailonly-test-MCPNBoXE@dev1.mail.example.com` will be saved. An email sent to `test-MCPNBoXE@dev1.mail.example.com` will be refused.


#### 2. Run `npm i`

#### 3. Run `npm start`

Emails will be saved in the `mail` folder


# Testing your setup / Sending Email
Testing this tool by using the SMTP protocol to directly call port 25 can be tricky since many ISPs and service providers (e.g. AWS) block outgoing traffic on port 25. Therefore, you'll need a proper SMTP gateway to send messages. You cand easily test your setup by manually sending emails from say gmail.