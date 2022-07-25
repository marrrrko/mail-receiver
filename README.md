
A simple ["delivery"](https://datatracker.ietf.org/doc/html/rfc5321#section-2.3.10) smtp server that makes it easy to have infinite email addresses. Useful for development and testing.

## Setup

Let's assume that you want to receive emails sent to any `@dev.mail.example.com` address.

### DNS

You will need two DNS records:

### A Record

```
dev.mail.example.com   A    <ip of your server>
```

### MX Record
```
dev.mail.example.com   MX 10 dev.mail.example.com 
```

### Configuration

After cloning this repo, inside the project direction:

Create a `.env` file that looks like this

```
ADMIN_USER_PASSWORD=somepassword
EMAIL_DOMAIN=dev.mail.example.com
EMAIL_ACCOUNT_PREFIX=goodmailonly-
```

Emails sent to addresses that don't start with the prefix will be ignored. This provides some crude protection against spam. In the above example, an email sent to `goodmailonly-testuser573@dev.mail.example.com` will be saved. An email sent to `testuser573@dev.mail.example.com` will be ignored.


  
Then run `npm i`

Then `npm start`

Emails will be saved in the `mail` folder